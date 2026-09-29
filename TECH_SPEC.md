# Technical specification

## Locked stack

- Next.js App Router, TypeScript, Tailwind CSS
- Cloudflare Workers AI `@cf/black-forest-labs/flux-1-schnell`, synchronous REST inference inside a server background task
- Supabase Postgres and Storage
- Vercel Hobby deployment; free services only
- Seeded demo user; no authentication, payments, or credit purchases

FLUX Schnell is text-to-image. **Remix** restores the prompt and settings, never image conditioning. Cloudflare's [model schema](https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/) documents `prompt` (1–2048 characters) and `steps`; always send four steps. It does not document width/height controls. Offer square, portrait, and landscape as explicitly labeled output crops, performed server-side after inference, with neither output dimension exceeding 1024 pixels. Do not claim native aspect-ratio generation without verification.

Cloudflare's [free allocation](https://developers.cloudflare.com/workers-ai/platform/pricing/) is 10,000 neurons/day, resetting at 00:00 UTC; capacity is shared with other usage on the account. Do not upgrade or enable paid overages. A provider limit failure follows the same refund path as other failures. Demo credits are not currency or provider billing units.

## Architecture

```text
Browser → Next.js server routes → after() → Cloudflare synchronous REST
                           └──→ Supabase Postgres + Storage
```

The browser never receives provider or Supabase service-role credentials. Persist the output image to a private Supabase Storage bucket so the app does not depend on temporary provider URLs. Use signed download URLs or a server-mediated download.

The submit route returns a durable queued job immediately. An `after()` callback claims it atomically, calls Cloudflare once, stores the decoded image, and completes the job. The browser polls only our database-backed endpoint. Use a provider abort deadline below the route's execution budget, leaving time for storage and refund. Configure `maxDuration = 60` for compatibility with non-Fluid Hobby, with inference bounded to 40 seconds. Four steps and at most 1024-pixel output keep work bounded but cannot guarantee provider latency.

`after()` survives sending the HTTP response, **not** the Vercel function's hard timeout. [Vercel documents](https://vercel.com/docs/functions/configuring-functions/duration) 60 seconds for non-Fluid Hobby and 300 seconds with Fluid compute. Persist a processing lease. Reconcile expired processing jobs as failed with an idempotent refund on subsequent API reads; redispatch still-queued jobs safely. Never blindly rerun a claimed inference after a crash. This is recovery on access, not a durable external worker queue, and must be documented as a trade-off.

## Data model (minimum)

- `demo_users`: stable seeded user ID and current demo-credit balance.
- `generation_jobs`: ID, demo user ID, idempotency key, prompt, aspect ratio, state, provider/model, timestamps, processing lease, safe error summary, retry parent ID, forced-failure flag, and resulting asset ID.
- `credit_transactions`: user ID, job ID, transaction type (`seed`, `reserve`, or `refund`), signed amount, timestamp; enforce idempotent reservation/refund per job.
- `assets`: job/user IDs, Storage object key, prompt/settings metadata, creation time.

Initialize the demo user with 10 demo credits; one image costs one demo credit. These units are for assignment UX only and do not represent dollars or payment. Reserve atomically with job creation (e.g. a Postgres function/transaction that checks balance); on terminal failure issue one idempotent refund transaction. Preserve ledger history rather than editing prior transactions. Use a database uniqueness constraint to prevent duplicate refunds.

## Job lifecycle and API shape

```text
queued → processing → completed
                    ↘ failed
queued → cancelled (refund)
```

Suggested routes (final names may follow scaffold conventions):

- `POST /api/generations`: validate prompt/aspect ratio/idempotency key, atomically reserve credit and persist a queued job; dispatch with `after()`.
- `GET /api/generations` and `GET /api/generations/:id`: reconcile expired leases and return persisted job/result metadata; no provider polling.
- `POST /api/generations/:id/cancel`: cancel only an unclaimed queued job and refund atomically.
- `GET /api/assets` and `DELETE /api/assets/:id`: list and delete a user's demo assets.
- `GET /api/credits`: current demo balance and transaction ledger.
- Download route or short-lived signed URL for authorized asset retrieval.

All states are owned by the app; Cloudflare does not supply an asynchronous prediction ID. Atomic database transitions resolve claim/cancel/complete races. Retry creates a new job linked to the original; never erase its failure or refund. Duplicate idempotency keys return the original job without charging again.

## Failure/demo behavior

Provide an obvious one-shot “Simulate next failure” control with visible `SAMPLE` and `MOCK` labels. It deterministically fails the next job without calling Cloudflare, exercising the same refund/ledger path. Retry defaults to live generation and starts a new job. All fixtures carry `SAMPLE`; never substitute them silently for failed live output.

## Security and validation

- Required environment variable names: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`. Cloudflare credentials and the Supabase secret key are server-only. Never inspect or print `.env.local`; the runtime loads it for authorized API calls.
- Enable RLS on every app table. No anonymous write/read policies; server routes use the secret key and fixed seeded identity. Keep the Storage bucket private. Revoke execution of privileged database functions from public/anon/authenticated roles.
- Validate prompt length and supported aspect ratios on the server.
- Scope data access to the seeded demo identity; do not accept arbitrary user IDs from the browser.
- Do not put credentials or sensitive provider error details in logs or client responses.
- Set required environment variable names in `.env.example`, never values.

## Verification priorities

- Unit-test reserve, insufficient balance, failure refund, idempotent refund, and ledger balance calculations.
- Verify polling/state persistence across refresh and after terminal completion.
- Verify storage persistence, signed download, deletion, empty state, prompt/settings reuse, and forced failure/retry.
- Verify one minimal Cloudflare call before scaffolding. Then follow the candidate's numbered milestones; migration execution requires candidate confirmation, and Vercel setup/deployment follows the UX pass.
