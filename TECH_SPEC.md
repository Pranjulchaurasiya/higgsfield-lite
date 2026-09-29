# Technical specification

## Locked stack

- Next.js App Router, TypeScript, Tailwind CSS
- Replicate `black-forest-labs/flux-schnell`, asynchronous prediction with polling
- Supabase Postgres and Storage
- Vercel deployment
- Seeded demo user; no authentication, payments, or credit purchases

FLUX Schnell is a text-to-image model. Its official [API documentation](https://replicate.com/black-forest-labs/flux-schnell/api) describes prompt-based generation; do not imply that prior image pixels condition a new result. Asset “reuse” restores the original prompt and settings. The model listing currently quotes $3 per 1,000 outputs (~$0.003/image); show this as an estimate, distinct from internal demo credits, and recheck before release.

## Architecture

```text
Browser → Next.js server routes → Replicate predictions
                           └──→ Supabase Postgres + Storage
```

The browser never receives provider or Supabase service-role credentials. Persist the output image to a private Supabase Storage bucket so the app does not depend on temporary provider URLs. Use signed download URLs or a server-mediated download.

## Data model (minimum)

- `demo_users`: stable seeded user ID and current demo-credit balance.
- `generation_jobs`: ID, demo user ID, prompt, aspect ratio, state, provider/model and prediction IDs, timestamps, safe error summary, and resulting asset ID.
- `credit_transactions`: user ID, job ID, transaction type (`reserve` or `refund`), signed amount, timestamp; enforce idempotent refund per job.
- `assets`: job/user IDs, Storage object key, prompt/settings metadata, creation time.

Initialize the demo user with 10 demo credits; one image costs one demo credit. These units are for assignment UX only and do not represent dollars or payment. Reserve atomically with job creation (e.g. a Postgres function/transaction that checks balance); on terminal failure issue one idempotent refund transaction. Preserve ledger history rather than editing prior transactions. Use a database uniqueness constraint to prevent duplicate refunds.

## Job lifecycle and API shape

```text
queued → processing → completed
                    ↘ failed
```

Suggested routes (final names may follow scaffold conventions):

- `POST /api/generations`: validate prompt/aspect ratio, reserve credit and persist job, create Replicate prediction.
- `GET /api/generations/:id`: poll provider, persist normalized state, return job/result metadata.
- `GET /api/assets` and `DELETE /api/assets/:id`: list and delete a user's demo assets.
- `GET /api/credits`: current demo balance and transaction ledger.
- Download route or short-lived signed URL for authorized asset retrieval.

Map Replicate `starting` to `queued`, `processing` to `processing`, `succeeded` to `completed`, and `failed`/`canceled` to an app failure state. Persist each state change. Retry creates a new job; never erase the original failure or its refund.

## Failure/demo behavior

Provide an obvious one-shot “Simulate next failure” control, explicitly marked `MOCK`. It deterministically fails the next job without pretending Replicate failed, but uses the same state/refund/ledger path. The retry starts a new job. All seeded or fixture media must carry a visible `SAMPLE` badge. Do not silently substitute sample content for failed live output.

## Security and validation

- Keep `REPLICATE_API_TOKEN`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` server-only.
- Validate prompt length and supported aspect ratios on the server.
- Scope data access to the seeded demo identity; do not accept arbitrary user IDs from the browser.
- Do not put credentials or sensitive provider error details in logs or client responses.
- Set required environment variable names in `.env.example`, never values.

## Verification priorities

- Unit-test reserve, insufficient balance, failure refund, idempotent refund, and ledger balance calculations.
- Verify polling/state persistence across refresh and after terminal completion.
- Verify storage persistence, signed download, deletion, empty state, prompt/settings reuse, and forced failure/retry.
- Configure Vercel environment variables and verify the deployed hello-world before continuing into generation work.
