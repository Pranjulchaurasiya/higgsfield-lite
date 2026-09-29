# Product requirements

## Assignment and product goal

Build a demonstrable image-generation product inspired by Higgsfield AI for the 8x Software Engineer assignment. The candidate-provided brief is authoritative. Optimize for a working product shipped quickly, sound product judgment, and polished UX/UI within roughly four hours.

Keep the familiar prompt → generations → library mental model, but create an original visual identity. Do not copy Higgsfield's branding, colors, or layout.

## Intended user

A seeded demo creator using the app without authentication. There are no payments or credit purchases; credits are internal demo units.

## Core journey

1. Enter an image prompt and choose an aspect ratio; the Generate button shows the credit cost before submission.
2. Submit and see a persisted job move through `queued` → `processing` → `completed` or `failed`; an in-progress job remains accurate after refresh.
3. On success, view the generated image and find it in the asset library after reload.
4. Download or delete an asset, or reuse its prompt/settings to start a related generation.
5. On failure, see an explanation, receive an automatic credit refund in the ledger, and retry.

## Requirements and scope

- Use Cloudflare Workers AI `@cf/black-forest-labs/flux-1-schnell` via synchronous REST in a server background task; poll our persisted Supabase job status. Free tiers only.
- Make the per-generation demo-credit cost visible before submit. Reserve one demo credit when a job is accepted; refund it automatically on failure. Show a ledger entry for every credit transaction.
- Provide a visible one-shot `SAMPLE` / `MOCK` failure control for reviewers; the simulated failure must be clearly identified and exercise the same refund/retry UX.
- Asset library supports download, delete, and **Remix** of prompt/settings. FLUX Schnell is text-to-image; Remix does not send image pixels as model conditioning. Three aspect options are clearly described as output crops because Cloudflare's documented model schema does not expose native dimensions.
- Label all fixtures or sample media with a visible `SAMPLE` badge. Live output must not be mislabeled.
- Keep all provider and Supabase service credentials server-side.
- Cut: video, Explore, marketing studio, payments, and “coming soon” features.

## Acceptance checks

- Submit a valid prompt: a job visibly shows `queued`, then `processing`, then `completed` for a successful live generation.
- Refresh mid-job: the same job's persisted status is still correct.
- Show the one-credit cost on the Generate button; submitting reserves one credit and adds a ledger transaction.
- Force a demo failure: UI visibly identifies the `MOCK` failure, displays an error and retry action, restores the reserved credit, and records the refund in the ledger. Retrying creates a new auditable job.
- A completed asset appears in `/assets` after reload and can be downloaded and deleted.
- Reuse from an asset restores its prompt and settings in the create flow.
- Empty asset library has a useful empty state.
- Any fixture/sample result displays a visible `SAMPLE` badge.
- A reviewer can follow documented setup/run instructions; only checks actually run are reported as passing.
