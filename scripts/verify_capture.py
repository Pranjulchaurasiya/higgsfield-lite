"""Compare captured canaries with their actual Codex transcripts, without editing logs."""

import argparse
import json
from pathlib import Path

from agent_capture import ROOT, importable_messages, read_records


def verify(rollout):
    records = read_records(rollout)
    meta = next(r["payload"] for r in records if r.get("type") == "session_meta")
    state = json.loads((ROOT / ".agent-logs" / ".state" / (meta["id"] + ".json")).read_text(encoding="utf-8"))
    messages = list(importable_messages(records))
    assert len(messages) == 2, "Canary must have exactly a prompt and final response"
    assert messages[0]["body"] == "CAPTURE TEST — 8x assignment, Pranjul Chaurasiya", "Canary changed before submission"
    paths = list((ROOT / ".agent-logs").glob(f"*_{meta['id']}.md"))
    assert len(paths) == 1, "Expected exactly one log per session"
    data = paths[0].read_bytes()
    assert len(state["entries"]) == len(messages)
    for actual, captured in zip(messages, state["entries"]):
        assert actual["body"] == captured["body"], f"{actual['kind']} differs from source"
        assert actual["model"] == captured["model"], "Model differs from source"
        assert captured["rendered"].encode("utf-8") in data, "Public log differs from journal"
    print(json.dumps({"result": "PASS", "session": meta["id"], "source": meta.get("source"), "log": str(paths[0].relative_to(ROOT)), "model": messages[0]["model"], "checks": "full prompt/final Unicode equality; matching models; public entries match journal"}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("rollouts", type=Path, nargs="+")
    for rollout in parser.parse_args().rollouts:
        verify(rollout)
