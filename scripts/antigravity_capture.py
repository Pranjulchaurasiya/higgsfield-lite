"""Automatic, prompt/final-only Antigravity capture adapter.

Wraps scripts/agent_capture.py to extract verbatim user prompts and
final assistant responses from Antigravity lifecycle hooks (PreInvocation & Stop).
"""

from __future__ import annotations

import argparse
from datetime import datetime
import json
import os
from pathlib import Path
import re
import sys
import time

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import agent_capture


def extract_user_prompt(content: str) -> str:
    """Extracts only the verbatim user request, removing injected metadata tags."""
    if not isinstance(content, str):
        return ""
    match = re.search(r"<USER_REQUEST>(.*?)</USER_REQUEST>", content, re.DOTALL)
    if match:
        body = match.group(1)
        if body.startswith("\r\n"):
            body = body[2:]
        elif body.startswith("\n"):
            body = body[1:]
        if body.endswith("\r\n"):
            body = body[:-2]
        elif body.endswith("\n"):
            body = body[:-1]
        return body
    # Filter out system injected control turns
    if (
        content.startswith("<turn_aborted>\nThe user interrupted")
        or content.startswith("# AGENTS.md instructions for ")
        or content.startswith("<environment_context>")
    ):
        return ""
    return content


def resolve_transcript_path(path_str: str | Path | None, session_id: str | None = None) -> Path | None:
    if path_str:
        p = Path(path_str)
        if p.is_file():
            full = p.with_name("transcript_full.jsonl")
            if full.is_file():
                return full
            return p
    if session_id:
        user_profile = os.environ.get("USERPROFILE") or str(Path.home())
        candidates = [
            Path(user_profile) / ".gemini" / "antigravity-ide" / "brain" / session_id / ".system_generated" / "logs" / "transcript_full.jsonl",
            Path(user_profile) / ".gemini" / "antigravity-ide" / "brain" / session_id / ".system_generated" / "logs" / "transcript.jsonl",
            Path(user_profile) / ".gemini" / "antigravity" / "brain" / session_id / ".system_generated" / "logs" / "transcript_full.jsonl",
            Path(user_profile) / ".gemini" / "antigravity" / "brain" / session_id / ".system_generated" / "logs" / "transcript.jsonl",
            Path(user_profile) / ".gemini" / "antigravity-cli" / "brain" / session_id / ".system_generated" / "logs" / "transcript_full.jsonl",
            Path(user_profile) / ".gemini" / "antigravity-cli" / "brain" / session_id / ".system_generated" / "logs" / "transcript.jsonl",
        ]
        for candidate in candidates:
            if candidate.is_file():
                return candidate
    return None


def parse_transcript_turns(records: list[dict]) -> list[dict]:
    """Extracts turns containing verbatim prompts and final assistant responses."""
    user_steps = [
        (idx, r) for idx, r in enumerate(records)
        if r.get("type") == "USER_INPUT" and r.get("content")
    ]

    turns = []
    for turn_num, (u_idx, u_rec) in enumerate(user_steps, start=1):
        prompt = extract_user_prompt(u_rec.get("content", ""))
        if not prompt:
            continue

        turn_id = f"turn-{turn_num}"
        next_u_idx = user_steps[turn_num][0] if turn_num < len(user_steps) else len(records)
        turn_slice = records[u_idx + 1:next_u_idx]

        # Extract only the final assistant response without tool calls or thinking
        final_responses = [
            s for s in turn_slice
            if s.get("source") == "MODEL"
            and s.get("type") == "PLANNER_RESPONSE"
            and isinstance(s.get("content"), str)
            and s.get("content", "").strip()
            and not s.get("tool_calls")
        ]

        response_body = final_responses[-1]["content"] if final_responses else None
        response_time = final_responses[-1].get("created_at") if final_responses else None

        turns.append({
            "turn_id": turn_id,
            "turn_num": turn_num,
            "prompt": prompt,
            "prompt_time": u_rec.get("created_at") or agent_capture.utc_now(),
            "response": response_body,
            "response_time": response_time,
        })

    return turns


def capture_antigravity(event: dict, root: Path = ROOT, config: dict | None = None) -> Path | None:
    config = config or json.loads((root / "capture.config.json").read_text(encoding="utf-8"))

    # Verify session id
    session = event.get("conversationId") or event.get("session_id")
    if not session or not re.fullmatch(r"[a-zA-Z0-9_-]+", session):
        raise ValueError("Invalid conversationId/session_id")

    # Verify workspace scope
    workspace_paths = event.get("workspacePaths") or [str(root)]
    workspace_root = Path(workspace_paths[0]).resolve()
    if workspace_root != root.resolve() and root.resolve() not in workspace_root.parents:
        return None

    model = event.get("modelName") or event.get("model") or "gemini-3.8-flash"
    transcript_arg = event.get("transcriptPath") or event.get("transcript_path")
    transcript_file = resolve_transcript_path(transcript_arg, session)

    output = root / ".agent-logs"
    state_dir = output / ".state"
    state_dir.mkdir(parents=True, exist_ok=True)
    try:
        audit_file = state_dir / "hook_audit.log"
        with audit_file.open("a", encoding="utf-8") as f:
            f.write(f"[{agent_capture.utc_now()}] event keys: {list(event.keys())}, session: {session}, transcript: {transcript_file}\n")
    except Exception:
        pass

    # Wait briefly if transcript is still flushing on very first prompt
    records = []
    if transcript_file:
        for _ in range(5):
            records = agent_capture.read_records(transcript_file)
            if records:
                break
            time.sleep(0.1)

    turns = parse_transcript_turns(records)
    if not turns:
        return None

    output = root / ".agent-logs"
    state_dir = output / ".state"

    with agent_capture.locked(state_dir / (session + ".lock")):
        state_path = state_dir / (session + ".json")
        state = json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else {
            "session_id": session,
            "tool": "antigravity-ide",
            "entries": [],
        }

        updated = False
        for t in turns:
            prompt_key = f"{t['turn_id']}:PROMPT"
            if not any(e["key"] == prompt_key for e in state["entries"]):
                msg = {
                    "kind": "PROMPT",
                    "turn": t["turn_id"],
                    "model": model,
                    "timestamp": agent_capture.utc_now(),
                    "body": t["prompt"],
                }
                if agent_capture.append_message(state, msg):
                    updated = True

            if t["response"] is not None:
                resp_key = f"{t['turn_id']}:RESPONSE"
                if not any(e["key"] == resp_key for e in state["entries"]):
                    msg = {
                        "kind": "RESPONSE",
                        "turn": t["turn_id"],
                        "model": model,
                        "timestamp": agent_capture.utc_now(),
                        "body": t["response"],
                    }
                    if agent_capture.append_message(state, msg):
                        updated = True

        if not state["entries"]:
            return None

        first = next(e for e in state["entries"] if e["kind"] == "PROMPT")
        stamp = datetime.fromisoformat(first["timestamp"].replace("Z", "+00:00")).strftime("%Y-%m-%d_%H-%M-%S")
        log_path = output / f"{stamp}_{session}.md"

        if log_path.exists():
            previous = log_path.read_bytes().decode("utf-8")
            prior_body = previous.split("\n---\n\n", 2)[-1]
            new_body = "".join(e["rendered"] for e in state["entries"])
            if not new_body.startswith(prior_body):
                raise ValueError("Log was changed externally; refusing to overwrite entries")

        for entry in state["entries"]:
            if entry["kind"] == "PROMPT" and "attachment" not in entry:
                attachment = agent_capture.capture_attachments(entry["body"], output)
                if attachment:
                    entry["attachment"] = attachment

        # Save private state atomically
        state_temp = state_path.with_suffix(".json.tmp")
        state_temp.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")
        os.replace(state_temp, state_path)

        rendered = agent_capture.render(state, config)
        if log_path.exists() and log_path.read_bytes() == rendered.encode("utf-8"):
            return None

        temp = log_path.with_suffix(".md.tmp")
        temp.write_text(rendered, encoding="utf-8", newline="")
        os.replace(temp, log_path)
        return log_path


def main():
    parser = argparse.ArgumentParser(description="Antigravity capture hook adapter")
    parser.add_argument("--event", choices=["PreInvocation", "Stop", "auto"], default="auto")
    parser.add_argument("--payload-file", type=Path, help="For offline testing with payload file")
    parser.add_argument("--session", type=str, help="Conversation ID for manual session export")
    parser.add_argument("--model", type=str, default="gemini-3.8-flash", help="Model name for manual export")
    args = parser.parse_args()

    if args.session:
        event = {"conversationId": args.session, "modelName": args.model}
        res = capture_antigravity(event)
        if res:
            print(f"Exported session {args.session} -> {res}")
        else:
            print(f"Session {args.session} already up to date or empty.")
        return

    if args.payload_file:
        event = json.loads(args.payload_file.read_text(encoding="utf-8"))
    else:
        event = agent_capture.read_hook_input(sys.stdin.buffer)

    capture_antigravity(event)
    print("{}")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Capture failed ({type(error).__name__}); inspect local collector state.", file=sys.stderr)
        sys.exit(1)
