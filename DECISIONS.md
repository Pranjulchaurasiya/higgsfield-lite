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

## Pending decisions

- Exact environment setup and Vercel project linking after the candidate provides project access; do not put secret values in this file.
- Implementation details may be adjusted based on real integration behavior, with material changes logged here and in `LOG.txt`.
