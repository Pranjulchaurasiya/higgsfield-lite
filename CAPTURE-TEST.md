# Capture Test

## Tool and model

- Tool: Codex Desktop
- Model: `gpt-5.6-luna`
- Reasoning effort: `medium`
- Planning/execution: the same configured model handles both; no separate planner or executor model is configured.

## Mechanism and configuration

Codex lifecycle command hooks receive the current event as JSON on stdin. The repository hook runs `scripts/agent_capture.py` for `UserPromptSubmit` and `Stop`. The collector reads the prompt or final response from the hook event, preserves only visible prompt/final text, and writes an append-only per-session Markdown log under `.agent-logs/`.

Relevant changed files and directories:

- `.codex/hooks.json` — registers `UserPromptSubmit` and `Stop` command hooks.
- `capture.config.json` — capture author and project metadata.
- `scripts/capture-hooks.json` — portable hook definition used during setup.
- `scripts/agent_capture.py` — collector, session journal, locking, deduplication, and safe rendering logic.
- `scripts/test_agent_capture.py` — synthetic collector tests.

## Canary log files

The two canaries landed in these files:

- `.agent-logs/2026-09-29_18-18-17_01a0ee63-7453-7d43-a32d-0ff913a7e69c.md`
- `.agent-logs/2026-09-29_18-18-58_01a0ee64-1769-7371-8fe4-e80ad61886e1.md`

## Canary entries pasted raw

### `.agent-logs/2026-09-29_18-18-17_01a0ee63-7453-7d43-a32d-0ff913a7e69c.md`

```text
[LOG_ENTRY type=PROMPT num=1 session=01a0ee63]
timestamp: 2026-09-29T18:18:17.140Z
model: gpt-5.6-luna

CAPTURE TEST â€” 8x assignment, Pranjul Chaurasiya


[LOG_ENTRY type=RESPONSE num=1 session=01a0ee63]
timestamp: 2026-09-29T18:18:20.836Z
model: gpt-5.6-luna

Acknowledged â€” 8x assignment capture test for Pranjul Chaurasiya.
```

### `.agent-logs/2026-09-29_18-18-58_01a0ee64-1769-7371-8fe4-e80ad61886e1.md`

```text
[LOG_ENTRY type=PROMPT num=1 session=01a0ee64]
timestamp: 2026-09-29T18:18:58.978Z
model: gpt-5.6-luna

CAPTURE TEST â€” 8x assignment, Pranjul Chaurasiya


[LOG_ENTRY type=RESPONSE num=1 session=01a0ee64]
timestamp: 2026-09-29T18:19:02.867Z
model: gpt-5.6-luna

Acknowledged.
```

## Things that did not work

No capture-hook or canary-capture attempt failed. An initial lookup used an incorrect local OpenAI Docs skill path; it returned “path not found,” and the correct path was then used. No `.agent-logs/` file was edited or deleted while preparing this report.
