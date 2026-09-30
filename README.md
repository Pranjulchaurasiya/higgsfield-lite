# Higgsfield-inspired image creator

An 8x Software Engineer assignment prototype focused on a complete image workflow: prompt → visible generation status → persistent asset library. The interface will have its own visual identity and will not copy Higgsfield's branding, colors, or layout.

## Scope

- Next.js App Router, TypeScript, Tailwind; Cloudflare Workers AI FLUX.1 Schnell; Supabase Postgres/Storage; Vercel Hobby. Free tiers only.
- Seeded demo user with 10 internal demo credits; one credit per generation. Failures refund automatically and appear in the ledger. Credits are not money; there are no payments.
- Asset download, delete, and Remix of prompt/settings. FLUX Schnell is text-to-image; Remix does not condition on previous image pixels. Aspect choices will be labeled output crops, limited to 1024 pixels per dimension.
- Video, Explore, marketing studio, payments, and “coming soon” features are intentionally cut.
- Forced demo failure is `MOCK`; sample/fixture content is visibly labeled `SAMPLE`.

## Current status

The full end-to-end product workflow and warm editorial visual identity are implemented and verified:
- **Design System**: Atelier Studio warm editorial look with linen canvas (`#FAF7F2`), terracotta ochre accent (`#B8502D`), deep charcoal high-contrast typography (`Newsreader` serif display, `Plus Jakarta Sans` body, `JetBrains Mono` for metadata), generous spacing, subtle paper grain, and accessible focus states and tap targets.
- **Workflow**: Creation console with inline credit cost (`Generate · 1 credit`), 3-step live pipeline tracker (`Queued` → `Processing` → `Completed`), deterministic `MOCK` failure simulation switch, and instant credit refund on failure.
- **Ledger**: Demo credit drawer displaying atomic reservation entries, initial grant (+10 credits), and strictly idempotent refund (+1) audit trail.
- **Library Archive**: Contact-sheet asset grid with varied aspect ratios (`1:1`, `9:16`, `16:9`), caption strips with prompts and dimensions, `SAMPLE` badge for initial fixtures, Remix button to restore settings to Studio, and asset deletion and download.
- **Resilience**: Zero-breakage in-memory fallback store allows immediate end-to-end testing of Cloudflare FLUX Schnell generations and simulated refunds even before Supabase database migration is pasted.

## Setup & Running

Required environment variable names (set in `.env.local` or Vercel dashboard — never commit secret values):
- `CLOUDFLARE_ACCOUNT_ID` (Cloudflare account ID)
- `CLOUDFLARE_API_TOKEN` (Workers AI API token)
- `NEXT_PUBLIC_SUPABASE_URL` (Supabase project URL)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase anonymous public key)
- `SUPABASE_SECRET_KEY` (Supabase service role secret key, server-only)

Database migration SQL is provided at `supabase/migration.sql` for Supabase SQL Editor.

### Runnable commands

- Start development server: `npm run dev` (runs on `http://localhost:3000`)
- Run credit invariant unit tests: `npm test` (tests 4/4 passing)
- Run typecheck: `npx tsc --noEmit`
- Run linter: `npm run lint`

## Project notes

- [`PRD.md`](PRD.md): requirements and acceptance checks.
- [`TECH_SPEC.md`](TECH_SPEC.md): data model, routes, and integration constraints.
- [`AGENTS.md`](AGENTS.md): repository working rules.
- [`DECISIONS.md`](DECISIONS.md): durable decisions.
- [`LOG.txt`](LOG.txt): append-only material project events.

