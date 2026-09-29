"""Automatic, prompt/final-only Codex capture. Uses the Python standard library."""

from __future__ import annotations

import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "capture.config.json"


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


@contextmanager
def locked(path):
    """OS lock releases even on a crash; concurrent hooks cannot interleave entries."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a+b") as handle:
        if handle.tell() == 0:
            handle.write(b"0")
            handle.flush()
        handle.seek(0)
        if os.name == "nt":
            import msvcrt
            for attempt in range(100):
                try:
                    msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
                    break
                except OSError:
                    if attempt == 99:
                        raise
                    time.sleep(0.05)
        else:
            import fcntl
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            handle.seek(0)
            if os.name == "nt":
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def read_records(path):
    if not path or not Path(path).is_file():
        return []
    records = []
    with Path(path).open(encoding="utf-8") as handle:
        for line in handle:
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                # Codex may currently be appending the last record.
                if not line.endswith("\n"):
                    break
                raise
    return records


def importable_messages(records):
    """Recover only visible prompts/finals; never export tool or reasoning records."""
    model = None
    turn = None
    for record in records:
        payload = record.get("payload", {})
        if record.get("type") == "turn_context":
            model = payload.get("model")
            turn = payload.get("turn_id")
        if record.get("type") != "response_item" or payload.get("type") != "message":
            continue
        role = payload.get("role")
        if role == "assistant" and payload.get("phase") not in ("final", "final_answer"):
            continue
        if role not in ("user", "assistant") or not model or not turn:
            continue
        body = "".join(p["text"] for p in payload.get("content", []) if p.get("type") in ("input_text", "output_text"))
        # These are host-injected context/control messages, not submitted prompts.
        if role == "user" and (body.startswith("<turn_aborted>\nThe user interrupted") or body.startswith("# AGENTS.md instructions for ") or body.startswith("<environment_context>")):
            continue
        yield {
            "kind": "PROMPT" if role == "user" else "RESPONSE",
            "turn": turn, "model": model, "timestamp": record["timestamp"], "body": body,
        }


def append_message(state, message):
    """Use event identity, not text, so identical prompts in different turns survive."""
    key = message["turn"] + ":" + message["kind"]
    digest = hashlib.sha256(message["body"].encode("utf-8")).hexdigest()
    existing = next((e for e in state["entries"] if e["key"] == key), None)
    if existing:
        if existing["digest"] != digest:
            raise ValueError("Existing captured event differs; refusing to change an entry")
        return False
    if message["kind"] == "PROMPT":
        number = 1 + sum(e["kind"] == "PROMPT" for e in state["entries"])
    else:
        prompts = [e for e in state["entries"] if e["kind"] == "PROMPT"]
        matched = next((e for e in reversed(prompts) if e["turn"] == message["turn"]), None)
        if matched is None:
            # An interrupted turn can resume under a new turn id/model without a new prompt.
            answered = {e["number"] for e in state["entries"] if e["kind"] == "RESPONSE"}
            matched = next((e for e in reversed(prompts) if e["number"] not in answered), None)
        if matched is None:
            raise ValueError("Final response has no captured prompt; refusing to invent one")
        number = matched["number"]
    short = state["session_id"][:8]
    rendered = (
        f"[LOG_ENTRY type={message['kind']} num={number} session={short}]\n"
        f"timestamp: {message['timestamp']}\nmodel: {message['model']}\n\n"
        + message["body"] + "\n\n\n"
    )
    # The journal contains only public prompt/final data plus capture metadata.
    entry = {**message, "key": key, "digest": digest, "number": number, "rendered": rendered}
    state["entries"].append(entry)
    return True


def render(state, config):
    entries = state["entries"]
    prompts = [e for e in entries if e["kind"] == "PROMPT"]
    first, last = prompts[0], prompts[-1]
    date = first["timestamp"][:10]
    header = {
        "session_id": state["session_id"], "date": date, "author": config["author"],
        "model": first["model"], "tool": state["tool"], "project": config["project"],
        "total_exchanges": len(prompts), "first_prompt_time": first["timestamp"],
        "last_prompt_time": last["timestamp"],
    }
    return (
        "---\n" + "".join(f"{key}: {json.dumps(value, ensure_ascii=False)}\n" for key, value in header.items())
        + f"---\n\n# Session Log - {date}\n\nSession: `{state['session_id'][:8]}` | Project: `{config['project']}` | Author: `{config['author']}`\n\n---\n\n"
        + "".join(e["rendered"] for e in entries)
    )


def capture_attachments(body, output):
    """Preserve pasted-text files without altering the prompt that references them."""
    for line in body.splitlines():
        if not line.startswith("## ") or ": " not in line:
            continue
        candidate = Path(line.rsplit(": ", 1)[1])
        normalized = candidate.as_posix().replace("\\", "/").lower()
        if "/.codex/attachments/" not in normalized or candidate.suffix.lower() != ".txt":
            continue
        if not candidate.is_file():
            raise ValueError("Referenced pasted text is missing")
        data = candidate.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        destination = output / "attachments" / f"{digest}.txt"
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists():
            if destination.read_bytes() != data:
                raise ValueError("Captured attachment was modified")
        else:
            with destination.open("xb") as handle:
                handle.write(data)
        return {"source": str(candidate), "file": destination.relative_to(output).as_posix(), "sha256": digest}
    return None


def capture(event, root=ROOT, config=None, recover=False):
    config = config or json.loads((root / "capture.config.json").read_text(encoding="utf-8"))
    # A repository-local hook must never export another project's conversation.
    cwd = Path(event.get("cwd", "")).resolve()
    if cwd != root.resolve() and root.resolve() not in cwd.parents:
        return None
    session = event["session_id"]
    if not re.fullmatch(r"[a-zA-Z0-9_-]+", session):
        raise ValueError("Invalid session id")
    output = root / ".agent-logs"
    state_dir = output / ".state"
    with locked(state_dir / (session + ".lock")):
        state_path = state_dir / (session + ".json")
        records = read_records(event.get("transcript_path"))
        meta = next((r["payload"] for r in records if r.get("type") == "session_meta"), {})
        state = json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else {
            "session_id": session, "tool": meta.get("originator", "codex"), "entries": [],
        }
        if recover:
            for message in importable_messages(records):
                append_message(state, message)
        name = event.get("hook_event_name")
        if name in ("UserPromptSubmit", "Stop"):
            body = event.get("prompt") if name == "UserPromptSubmit" else event.get("last_assistant_message")
            if not isinstance(body, str):
                raise ValueError("Hook is missing the full message")
            message = {"kind": "PROMPT" if name == "UserPromptSubmit" else "RESPONSE", "turn": event["turn_id"], "model": event["model"], "timestamp": utc_now(), "body": body}
            append_message(state, message)
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
            if entry["kind"] == "PROMPT":
                attachment = capture_attachments(entry["body"], output)
                if attachment:
                    entry["attachment"] = attachment
        # Atomic private journal saves the exact hook timestamp through a crash/retry.
        state_temp = state_path.with_suffix(".json.tmp")
        state_temp.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")
        os.replace(state_temp, state_path)
        rendered = render(state, config)
        if log_path.exists() and log_path.read_bytes() == rendered.encode("utf-8"):
            return None
        temp = log_path.with_suffix(".md.tmp")
        temp.write_text(rendered, encoding="utf-8", newline="")
        os.replace(temp, log_path)
        return log_path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--import-rollout", type=Path)
    args = parser.parse_args()
    if args.import_rollout:
        records = read_records(args.import_rollout)
        meta = next(r["payload"] for r in records if r.get("type") == "session_meta")
        result = capture({"session_id": meta["id"], "cwd": meta["cwd"], "transcript_path": str(args.import_rollout)}, recover=True)
        print(result or "Already captured")
    else:
        event = json.load(sys.stdin)
        capture(event)
        print("{}")  # Stop expects JSON; never return continuation instructions.


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Do not echo prompt, response, or environment values in diagnostics.
        print(f"Capture failed ({type(error).__name__}); inspect local collector state.", file=sys.stderr)
        sys.exit(1)
