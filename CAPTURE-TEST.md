# Capture Test

**PASS — verified 2026-09-29 at 18:25 UTC after fixing Windows UTF-8 decoding.** Two independent Codex CLI sessions automatically captured the exact prompt and complete final response. `scripts/verify_capture.py` compared each message and model with the original local Codex transcript; both passed. Nine collector unit tests passed. No product implementation has started.

## Tool and model

- Tool: Codex Desktop on Windows; independent canaries run through its installed Codex CLI, version `0.158.0-alpha.2.1`.
- Setup model: `gpt-6-astra`; the interrupted initial setup turn used `gpt-5.6-luna`. Verified from session `turn_context` records.
- Canary model: `gpt-5.6-luna`, taken from each hook event and checked against its session record.
- Reasoning effort: `medium`
- Planning/execution: the same configured model handles both; no separate planner or executor model is configured.

## Mechanism and configuration

Codex lifecycle command hooks receive the current event as JSON on stdin. The repository hook runs `scripts/agent_capture.py` for `UserPromptSubmit` and `Stop`. The collector reads the prompt or final response from the hook event, preserves only visible prompt/final text, and writes an append-only per-session Markdown log under `.agent-logs/`.

Both repository hooks were individually reviewed and trusted using the CLI `/hooks` screen. No trust-bypass or sandbox-bypass flag was used. Trust decisions are stored locally in `C:\Users\pranj\.codex\config.toml` under `[hooks.state]`; that personal configuration is not committed. Native hooks run on their own, without an agent remembering to log. See the [official hook documentation](https://learn.chatgpt.com/docs/hooks).

Entry bodies are immutable; the file header's exchange count and last-prompt time update as the session grows. Timestamps are actual UTC hook invocation times. Restored setup messages retain their original transcript timestamps. `total_exchanges` counts submitted prompts, including interrupted prompts without a response. The collector never invents a response for an interruption.

The initial setup prompt predates installation. It was recovered once from its real local transcript, and its pasted-text attachment was copied byte-for-byte into `.agent-logs/attachments/`. A temporary collector follows only that setup transcript until its final answer appears, then exits. This is bootstrap recovery, not the ongoing capture mechanism.

Relevant changed files and directories:

- `.codex/hooks.json` — registers `UserPromptSubmit` and `Stop` command hooks.
- `.gitignore` — keeps `.agent-logs/` itself tracked while excluding only collector state and temporary files.
- `capture.config.json` — capture author and project metadata.
- `scripts/capture-hooks.json` — installation template; its Windows absolute path must be adjusted on another machine.
- `scripts/agent_capture.py` — collector, session journal, locking, deduplication, and safe rendering logic.
- `scripts/test_agent_capture.py` — synthetic collector tests.
- `scripts/verify_capture.py` — read-only full-text/model comparison against the original canary transcripts.
- `.gitattributes` — prevents Git from normalizing captured line endings.

## Passing canary log files

- `.agent-logs/2026-09-29_18-22-29_01a0ee67-4a22-72f0-874c-a839c297b88b.md`
- `.agent-logs/2026-09-29_18-24-20_01a0ee68-fc0b-74e2-9744-43b44328e709.md`

Both sessions printed `UserPromptSubmit Completed` and `Stop Completed`; no manual collector invocation created these canary entries. The first passing file inherits `tool: Codex Desktop` from the process originator. Its source transcript confirms `source: exec`; the collector now labels this source `codex-cli` explicitly, as shown by the second file. The earlier header is preserved.

### First passing canary — raw entries

```text
[LOG_ENTRY type=PROMPT num=1 session=01a0ee67]
timestamp: 2026-09-29T18:22:29.568Z
model: gpt-5.6-luna

CAPTURE TEST — 8x assignment, Pranjul Chaurasiya


[LOG_ENTRY type=RESPONSE num=1 session=01a0ee67]
timestamp: 2026-09-29T18:22:33.220Z
model: gpt-5.6-luna

Acknowledged — capture canary.


```

### Second passing canary — raw entries

```text
[LOG_ENTRY type=PROMPT num=1 session=01a0ee68]
timestamp: 2026-09-29T18:24:20.016Z
model: gpt-5.6-luna

CAPTURE TEST — 8x assignment, Pranjul Chaurasiya


[LOG_ENTRY type=RESPONSE num=1 session=01a0ee68]
timestamp: 2026-09-29T18:24:24.177Z
model: gpt-5.6-luna

Acknowledged — second capture canary.


```

## Failed early canary files — preserved evidence

These hooks fired but failed exact-text verification because the em dash was decoded incorrectly. They do not count toward the gate:

- `.agent-logs/2026-09-29_18-18-17_01a0ee63-7453-7d43-a32d-0ff913a7e69c.md`
- `.agent-logs/2026-09-29_18-18-58_01a0ee64-1769-7371-8fe4-e80ad61886e1.md`

## Failed canary entries pasted raw

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

1. The initial restricted shell could not resolve the Codex home directory. Running the inspection with approved host access resolved that.
2. The interactive terminal warned that `TERM=dumb` was unsupported and dropped the canary's em dash. That attempt remains in session `01a0ee60-eed1-70b1-9752-c2e59bb5c705` and is not a passing exact canary.
3. Creating the desktop test chat through the app coordination tool delivered its input as a tool-result delegation, not a normal user-prompt event. It therefore did not prove `UserPromptSubmit` capture. Later normal user messages in the same desktop chat did trigger both hooks.
4. The first two non-interactive canaries exposed Windows Python's stdin codepage: UTF-8 bytes became `â€”`. Reading stdin as bytes and explicitly decoding UTF-8 fixed it. Those faulty entries remain untouched above; the replacement canaries passed comparison against actual transcripts.
5. An early report incorrectly said no capture attempts failed. This report corrects that claim and keeps the failed raw entries. The other chat also reported a missing local skill path during its own documentation work.
6. Some CLI runs warned that the terminal-event transcript flush could not find its thread. The passing canaries' source files nevertheless contain both complete messages, and the independent verifier succeeded.

## Reproduce the checks

```powershell
python -m unittest discover -s scripts -p 'test_*.py' -v
python scripts/verify_capture.py 'C:\Users\pranj\.codex\sessions\2026\09\29\rollout-2026-09-29T23-52-21-01a0ee67-4a22-72f0-874c-a839c297b88b.jsonl' 'C:\Users\pranj\.codex\sessions\2026\09\29\rollout-2026-09-29T23-54-13-01a0ee68-fc0b-74e2-9744-43b44328e709.jsonl'
```

The source transcripts and deduplication journal are local-only; the public evidence is the committed Markdown logs and raw canaries above. New clones need Python, an adjusted hook command path, and a fresh `/hooks` trust review. This setup needs no API key or added environment variable. Do not put secrets into prompts: capture is verbatim and is intended for a public submission.
