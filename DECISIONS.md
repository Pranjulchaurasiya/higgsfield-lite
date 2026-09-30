# Project decision log

This log records decisions that materially affect the 8x Software Engineer assignment. It is not a transcript of chats, questions, or agent sessions. Record each decision when it is made, with its timestamp, reason, alternatives considered, and effect on the product. Timestamps use Asia/Kolkata time (IST, UTC+05:30). Keep actual coding-agent session logs separately if the assignment requests them.

The entries below were first written together after the earlier discussion. Their timestamps are when they were recorded, not invented times for the earlier conversation. Future entries should use the time of the decision.

The candidate supplied the full brief on 2026-09-29. It is authoritative over earlier provisional choices; the scope and acceptance criteria below now reflect it.

## D-001 — Choose the Higgsfield AI reference

- **Recorded at:** 2026-09-29 03:31 IST (UTC+05:30)
- **Status:** Decided by candidate
- **Decision:** Build the Higgsfield AI assignment from the three options presented: Higgsfield AI, Amazon.com, and Fanthom AI.
- **Reason:** The candidate explicitly selected Higgsfield AI. It offers an opportunity to demonstrate an AI media workflow and end-to-end product engineering.
- **Alternatives considered:** Amazon.com and Fanthom AI.
- **Effect:** Product research, design, and implementation will center on Higgsfield's creative-generation experience.
- **Revisit if:** The opened brief changes the task or imposes constraints not yet seen.

## D-002 — Optimize for reviewable evidence of ownership

- **Recorded at:** 2026-09-29 03:31 IST (UTC+05:30)
- **Status:** Working direction; confirm against the full brief
- **Decision:** Deliver a usable end-to-end flow, an understandable repository, and a concise walkthrough that explains trade-offs and demonstrates the product.
- **Reason:** The [8x role](https://www.8x.careers/join/software-engineer) emphasizes end-to-end ownership and shipping with AI. The [8x employer page](https://www.8x.careers/client) says it scores coding-agent session logs, repository architecture, and a reviewer-assessed walkthrough. The published examples are illustrative, not a Higgsfield-specific rubric.
- **Alternatives considered:** Broad feature coverage without a complete user flow.
- **Effect:** Scope choices should preserve a working demonstration and leave time for verification and explanation.
- **Revisit if:** The full brief states a different evaluation or mandatory feature set.

## D-003 — Keep evidence authentic

- **Recorded at:** 2026-09-29 03:31 IST (UTC+05:30)
- **Status:** Working direction; confirm submission requirements in the full brief
- **Decision:** Explain which features are live, simulated, or represented by sample media. Preserve real coding-agent logs if requested; do not reconstruct or embellish them.
- **Reason:** Reviewers need to understand the candidate's actual contribution and assess the running product. [8x candidate guidance](https://www.8x.careers/) asks candidates to make their own contribution clear.
- **Alternatives considered:** Presenting sample output as live generation or writing a retrospective account as though it were an agent session log.
- **Effect:** Demo mode, external API dependencies, and known limitations should be labeled in the submission.
- **Revisit if:** The brief specifies the exact form of evidence to submit.

## D-004 — Lock the implementation stack

- **Recorded at:** 2026-09-29 19:27 IST (UTC+05:30)
- **Status:** Decided; confirmed against candidate-provided brief
- **Decision:** Use Next.js App Router, TypeScript, Tailwind CSS, Replicate's `black-forest-labs/flux-schnell` image model with asynchronous polling, Supabase Postgres and Storage, and Vercel deployment.
- **Reason:** This gives one concrete image-generation path and durable job/media persistence. Vercel Functions have read-only filesystems except temporary `/tmp`, which makes local SQLite unsuitable for deployed job state. Replicate documents the selected model and polling workflow.
- **Alternatives considered:** SQLite was rejected for deployed persistence because of Vercel's filesystem behavior; multi-provider generation was rejected to keep the implementation focused.
- **Effect:** Architecture, environment configuration, and implementation should follow `TECH_SPEC.md`.
- **Revisit if:** A later explicit assignment requirement conflicts.

## D-005 — Make generation acceptance checks observable

- **Recorded at:** 2026-09-29 19:27 IST (UTC+05:30)
- **Status:** Decided; aligned to candidate-provided brief
- **Decision:** Require observable job progression, status restoration after refresh, a failure-and-retry path, persistent appearance of completed assets at `/assets`, and a visible `SAMPLE` badge on fixtures.
- **Reason:** These checks make the core workflow and demo/live distinction verifiable by a reviewer.
- **Alternatives considered:** Broad checks such as “no dead ends” were rejected because they cannot be assessed consistently.
- **Effect:** These criteria are now listed in `PRD.md`; no behavior is claimed implemented yet.
- **Revisit if:** The assignment brief changes.

## D-006 — Prioritize the brief's narrow, complete image workflow

- **Recorded at:** 2026-09-29 23:10 IST (UTC+05:30)
- **Status:** Decided by candidate brief
- **Decision:** Ship prompt → persisted generation status → asset library, with transparent demo-credit reservation/refund, ledger, and visible failure/retry. Exclude video, Explore, marketing studio, payments, and coming-soon items; use a seeded user without auth.
- **Reason:** The four-hour assignment prioritizes a shipped product, judgment, and UX quality, and the candidate explicitly listed this build order and cuts.
- **Alternatives considered:** Broadly reproducing Higgsfield's product; rejected as infeasible and contrary to the brief.
- **Effect:** PRD and implementation scope are constrained to this end-to-end image workflow; create a distinct visual identity rather than copying Higgsfield branding, colors, or layout.
- **Revisit if:** The candidate supplies a new or contradictory assignment requirement.

## D-007 — Separate demo credits from actual provider cost

- **Recorded at:** 2026-09-29 23:10 IST (UTC+05:30)
- **Status:** Decided for the prototype
- **Decision:** Seed the demo wallet with 10 internal credits and charge one credit per image; reserve on submission and append an idempotent refund on failure. Show the one-credit price on Generate and distinguish it from the model's estimated ~$0.003/output provider cost.
- **Reason:** This makes the cost and failure-credit policy legible without introducing payments; the selected Replicate model currently lists $3 per 1,000 outputs.
- **Alternatives considered:** Treat demo credits as dollars or add purchasing; rejected because payments are explicitly cut.
- **Effect:** Add a durable transaction ledger and tests for reservation/refund behavior.
- **Revisit if:** Testing or a later brief requires a different demo balance/pricing.

## D-008 — Interpret asset “reuse as reference” within model capability

- **Recorded at:** 2026-09-29 23:10 IST (UTC+05:30)
- **Status:** Decided for the locked model
- **Decision:** Reuse restores an asset's prompt and generation settings; it does not send the previous image as conditioning input.
- **Reason:** Replicate's official FLUX Schnell API is text-to-image and does not expose a reference-image input.
- **Alternatives considered:** Claim image-to-image/reference conditioning; rejected as unsupported by the selected model.
- **Effect:** Document the limitation in the interface/help text and preserve a useful one-click continuation workflow.
- **Revisit if:** The candidate authorizes changing the selected model.

## D-CAPTURE-001 — Use native Codex hooks for the public assignment record

- **Recorded at:** 2026-09-29 23:57 IST (UTC+05:30)
- **Status:** Installed and verified with two independent sessions
- **Decision:** Capture normal user prompts and final responses using repository-local `UserPromptSubmit` and `Stop` command hooks. Preserve entry bodies and failed attempts, track public logs with code, and keep only collector state private. Decode hook input explicitly as UTF-8.
- **Reason:** The candidate's capture brief requires automatic, verbatim, cross-session evidence before product implementation. Native hooks provide full text and the actual per-event model.
- **Alternatives considered:** Manual summaries or reconstructed responses are incompatible with the brief. A permanent transcript watcher is unnecessary; a temporary source-based recovery collector covers only the already-running setup turn.
- **Effect:** `CAPTURE-TEST.md` records actual successful canaries and failed encoding attempts. New installations require hook path adjustment and trust review. Product scope remains unchanged.
- **Revisit if:** The Codex hook event format changes or a new capture tool is introduced.

## D-009 — Replace Replicate with free-tier Cloudflare inference

- **Recorded at:** 2026-09-29 23:58 IST (UTC+05:30)
- **Status:** Decided by candidate; supersedes provider/pricing parts of D-004 and D-007
- **Decision:** Use Cloudflare Workers AI `@cf/black-forest-labs/flux-1-schnell` REST at four steps, Supabase persistence, and Vercel Hobby; no paid services. Run one minimal live preflight before scaffolding and stop if it fails.
- **Reason:** Candidate explicitly changed the integration and requires a free-tier demonstration within about three hours.
- **Alternatives considered:** Replicate, provider switching, and paid queues; outside the requested scope.
- **Effect:** Our job states and polling replace provider prediction polling. One demo credit per image remains; remove Replicate dollar estimates. Shared free daily allowance can reject requests and must trigger refunds.

## D-010 — Bound background execution and expose honest crop/Remix limits

- **Recorded at:** 2026-09-29 23:58 IST (UTC+05:30)
- **Status:** Implementation direction based on official API documentation
- **Decision:** Use Next.js `after()` with a 60-second route budget, 40-second provider deadline, atomic claim/cancel transitions, and persisted lease recovery. Fail/refund expired processing jobs on later API access. Offer three output crops with dimensions at most 1024; call prompt/settings restoration Remix.
- **Reason:** `after()` does not survive the platform's hard timeout. Cloudflare's documented Schnell input supports prompt and steps, not width/height or reference images.
- **Alternatives considered:** Pretending background work is durable indefinitely or that the provider supports unlisted parameters; rejected as misleading. External durable workers are cut for time/free-tier simplicity.
- **Effect:** UI/help will state output-crop behavior. Refresh restores persisted jobs; retry creates a new audit entry. A hard-killed job recovers on the next read rather than on a continuously running worker.

## D-CAPTURE-002 — Transition Antigravity capture to manual transcript export

- **Recorded at:** 2026-09-30 01:34 IST (UTC+05:30)
- **Status:** Decided per assignment deadline cutoff rule (01:20 IST)
- **Decision:** Because the Antigravity IDE GUI chat runner does not trigger lifecycle hooks configured in `.agents/hooks.json`, capture for Antigravity sessions will be performed via direct transcript extraction using `python scripts/antigravity_capture.py --session <conversationId>`, writing to the same immutable `.agent-logs/` format and directory without fabricating automation.
- **Reason:** Real verification revealed that while Codex CLI runs native command hooks reliably, Antigravity IDE on Windows did not invoke `.agents/hooks.json` during chat turns. Attempting to force manual hooks during canaries violated the authentic capture rule. The candidate set an explicit 01:20 IST deadline to pivot to documented manual export and proceed with the build.
- **Alternatives considered:** Continuing to debug IDE hook dispatch beyond the deadline; rejected because it risks the four-hour assignment completion window. Fabricating automatic execution was strictly rejected.
- **Effect:** Both hook failure and manual export workflow are documented in `CAPTURE-TEST.md` and `LOG.txt`. Engineering moves immediately to the core product build.

## D-011 — Establish warm editorial visual identity and resilient demo store fallback

- **Recorded at:** 2026-09-30 10:40 IST (UTC+05:30)
- **Status:** Decided; design pass completed
- **Decision:** Implemented a warm editorial aesthetic (terracotta ochre `#B8502D` accent, paper/linen canvas `#FAF7F2`, high-contrast deep charcoal text `#1F1D1A`, Google Fonts `Newsreader` serif + `Plus Jakarta Sans` body + `JetBrains Mono` code, subtle SVG paper grain). Provided a zero-breakage in-memory demo store fallback that operates gracefully prior to Supabase migration, ensuring Cloudflare FLUX Schnell generations, simulated MOCK failure refunds, and contact-sheet asset browsing work immediately on cold start.
- **Reason:** Satisfies the brief's requirement to build a distinctive, non-generic UI (rejecting purple gradients, generic shadcn templates, and 1:1 Higgsfield copies) while keeping credit ledger and job recovery observable.
- **Alternatives considered:** Dark mode default or purple AI aesthetic (rejected per brief); blocking on manual Supabase SQL paste before allowing local reviewer exploration (rejected to ensure immediate reviewer testability).
- **Effect:** Both live Cloudflare generations and MOCK failure paths work seamlessly out-of-the-box. Contact sheet grid presents sample fixtures (`SAMPLE`) and user creations with prompt caption strips, aspect ratios, and Remix parameters.

## D-012 — Resolve Supabase persistence failures and gate in-memory fallback to dev-only

- **Recorded at:** 2026-09-30 12:55 IST (UTC+05:30)
- **Status:** Decided & implemented
- **Decision:** Diagnosed why Supabase writes failed and resolved all root causes:
  1. **Storage Bucket**: Created missing private storage bucket `generated-images` and added bucket creation retry logic.
  2. **Row Level Security (RLS)**: Added comprehensive `INSERT`, `UPDATE`, and `DELETE` policies to `supabase/migration.sql` so client requests are not rejected with code `42501`.
  3. **Referential Integrity Ordering**: Adjusted `createGenerationJob` to insert the generation job into `generation_jobs` *before* inserting into `credit_transactions`, satisfying the `job_id REFERENCES generation_jobs(id)` foreign key constraint.
  4. **Strict Error Logging**: Configured all database operations to log explicit error messages and codes (`[Supabase Error]`) to the dev terminal without printing tokens, secrets, or keys.
  5. **Environment-Gated In-Memory Fallback**: Made in-memory fallbacks strictly dev-only (`process.env.NODE_ENV !== 'production'`). In production environments, Supabase database failures return visible HTTP 500 error responses (`{ success: false, error: ... }`) instead of silently masking database issues with transient memory structures.
- **Reason:** The brief and user instructions require durable database persistence in production and honest, visible failure reporting when database connections fail, rather than silently masquerading failures with in-memory stores.
- **Alternatives considered:** Keeping silent in-memory fallback in production (rejected as masking infrastructure failures); omitting RLS mutation policies (rejected as blocking anon key writes).
- **Effect:** Real generations, credit reservations, and refunds persist durably to Supabase tables (`demo_users`, `generation_jobs`, `credit_transactions`, `assets`) and Storage. Production environments reliably surface database errors.

## Remaining setup

- Exact environment setup and Vercel project linking after the candidate provides project access; do not put secret values in this file.
- Implementation details may be adjusted based on real integration behavior, with material changes logged here and in `LOG.txt`.

