# Higgsfield-inspired image creator

An 8x Software Engineer assignment prototype focused on a complete image workflow: prompt → visible generation status → persistent asset library. The interface will have its own visual identity and will not copy Higgsfield's branding, colors, or layout.

## Scope

- Next.js App Router, TypeScript, Tailwind; Replicate FLUX Schnell; Supabase Postgres/Storage; Vercel.
- Seeded demo user with 10 internal demo credits; one credit per generation. Failures refund automatically and appear in the ledger. Credits are not money; there are no payments.
- Asset download, delete, and prompt/settings reuse. FLUX Schnell is text-to-image; reuse does not condition on previous image pixels.
- Video, Explore, marketing studio, payments, and “coming soon” features are intentionally cut.
- Forced demo failure is `MOCK`; sample/fixture content is visibly labeled `SAMPLE`.

## Current status

Planning documentation is aligned to the candidate-provided brief. There is no application scaffold or verified deployment yet. Do not treat any planned behavior as implemented.

## Setup

After the app scaffold is created, copy `.env.example` to `.env.local` and fill values locally; never paste or commit secret values. Required server-side variables are expected to be `REPLICATE_API_TOKEN`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. Vercel must receive the same values through its project environment settings. Exact setup/run commands will be added with the scaffold.

## Project notes

- [`PRD.md`](PRD.md): requirements and acceptance checks.
- [`TECH_SPEC.md`](TECH_SPEC.md): data model, routes, and integration constraints.
- [`AGENTS.md`](AGENTS.md): repository working rules.
- [`DECISIONS.md`](DECISIONS.md): durable decisions.
- [`LOG.txt`](LOG.txt): append-only material project events.
