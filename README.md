# Higgsfield-inspired image creator

An 8x Software Engineer assignment prototype focused on a complete image workflow: prompt → visible generation status → persistent asset library. The interface will have its own visual identity and will not copy Higgsfield's branding, colors, or layout.

## Scope

- Next.js App Router, TypeScript, Tailwind; Cloudflare Workers AI FLUX.1 Schnell; Supabase Postgres/Storage; Vercel Hobby. Free tiers only.
- Seeded demo user with 10 internal demo credits; one credit per generation. Failures refund automatically and appear in the ledger. Credits are not money; there are no payments.
- Asset download, delete, and Remix of prompt/settings. FLUX Schnell is text-to-image; Remix does not condition on previous image pixels. Aspect choices will be labeled output crops, limited to 1024 pixels per dimension.
- Video, Explore, marketing studio, payments, and “coming soon” features are intentionally cut.
- Forced demo failure is `MOCK`; sample/fixture content is visibly labeled `SAMPLE`.

## Current status

Step 0 is blocked: the one Cloudflare preflight on 2026-09-29 at 18:29:20 UTC returned HTTP 403 in 242 ms with no image and no structured numeric error codes. This indicates access was denied; the exact credential/account cause has not been established. Implementation stops at the candidate's preflight gate. There is no application scaffold or verified deployment yet.

Automatic Codex prompt/final capture is installed and verified in two independent sessions. See [`CAPTURE-TEST.md`](CAPTURE-TEST.md) for exact canaries, failures, and verification details. Logs ship in `.agent-logs/`; interrupted prompts have no invented responses.

## Agent capture setup

Capture uses Python 3.10+ (standard library only) and native Codex `UserPromptSubmit`/`Stop` hooks. It requires no added environment variables or credentials. On this machine the hooks are installed and trusted. To set up another checkout:

1. Set your GitHub handle/project in `capture.config.json` and adjust the Windows command path in `scripts/capture-hooks.json` to the new checkout.
2. Copy that template to `.codex/hooks.json`, preserving any existing hooks.
3. Open Codex in the repo, use `/hooks` to review/trust the two command hooks, and send the canary in two new sessions. Check both prompt and final response before starting implementation.

Run the collector checks with:

```powershell
python -m unittest discover -s scripts -p 'test_*.py' -v
```

The hooks preserve message bodies and update only the session metadata header. `.gitattributes` preserves log line endings. Keep `.agent-logs/` committed alongside each implementation batch; only collector state and temporary files are ignored. Text attachments referenced by pasted prompts are preserved separately under `.agent-logs/attachments/`. Secrets must stay out of prompts because the public transcript is verbatim. Tool-driven delegation is not a normal user prompt; use normal desktop/CLI prompts for the assignment record.

## Setup

Required variable names: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`. Keep values in local/Vercel environment settings; never paste or commit them. The account/token and Supabase secret are server-only. Exact app commands will be added with the scaffold.

The one-request provider preflight runs with Node 24: `node --env-file=.env.local scripts/test-cloudflare.mjs`. It prints only sanitized status, timing, and image metadata; it neither prints credentials nor saves an image. Do not rerun it automatically: every inference consumes the daily free allocation.

## Project notes

- [`PRD.md`](PRD.md): requirements and acceptance checks.
- [`TECH_SPEC.md`](TECH_SPEC.md): data model, routes, and integration constraints.
- [`AGENTS.md`](AGENTS.md): repository working rules.
- [`DECISIONS.md`](DECISIONS.md): durable decisions.
- [`LOG.txt`](LOG.txt): append-only material project events.
