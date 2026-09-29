# Instructions for coding agents

## Assignment context

This repository is being prepared for an 8x Software Engineer practical assignment based on Higgsfield AI. Read `PRD.md`, `TECH_SPEC.md`, and `DECISIONS.md` before making product or architecture changes. The candidate-provided assignment brief is authoritative and is summarized in `PRD.md` and `DECISIONS.md`.

## Working rules

- Work toward a complete, demonstrable user journey. Do not expand scope without recording a material scope decision in `DECISIONS.md` and `LOG.txt`.
- Preserve an original visual identity; do not copy Higgsfield's branding, colors, or layout. Keep the prompt → generations → library mental model.
- Keep the four-hour scope focused: image creation, persisted job status, demo-credit ledger/refunds, and asset library. Video, Explore, marketing studio, payments, and “coming soon” features are cut.
- The seeded demo wallet is not money. Mark the forced failure as `MOCK`; mark fixture/sample media as `SAMPLE`.
- Before implementation, inspect the existing repository and preserve user changes.
- Make focused changes, explain assumptions, and do not claim unimplemented functionality.
- Clearly label mocked, sample, or demo-only generation and content as `MOCK` in UI and documentation where users could otherwise mistake it for live output.
- Keep API keys and service credentials out of client code, committed files, logs, and prompts. Add variable names (never values) to `.env.example` when needed.
- Do not fabricate agent activity, tests, API results, timestamps, or product capabilities.
- Record material decisions, scope changes, bugs, fixes, approach changes, and milestones in the append-only root `LOG.txt` using its required format. Skip small chatter and questions. Do not rewrite prior entries.
- Maintain `DECISIONS.md` for durable product and architecture decisions; do not use it as a conversation transcript.
- Update `README.md` when setup, features, integrations, or limitations materially change.
- Keep automatic prompt/final capture enabled using `.codex/hooks.json`; see `CAPTURE-TEST.md` for the two-session gate and real failure history. Never manually fabricate or repair a captured entry. Commit `.agent-logs/` alongside the code it produced; private deduplication state stays ignored.

## Commands

These commands are the expected scaffold scripts; they become runnable after `package.json` and the test setup are added.

- `dev`: `npm run dev`
- `test`: `npm test`
- `lint`: `npm run lint`

## Layout

- `app/` — App Router pages and API routes
- `lib/` — generation jobs, Cloudflare Workers AI client, Supabase access, and credit rules
- `components/` — reusable interface components

## Before calling work complete

- State what works and what is mocked or incomplete.
- Provide the exact run/setup commands and required environment variable names.
- Summarize important trade-offs and the next useful step.
- Do not report checks as passed unless they were actually run.
