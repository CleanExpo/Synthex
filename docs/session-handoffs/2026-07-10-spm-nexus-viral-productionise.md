# SPM Spec — Productionise the nexus-viral 1→8 pipeline

`spec_version: 1.0-draft` · 2026-07-10 · baseline commit: **origin/main @ f3fd9cf3** (contains #657 cards, #667 deriveSocialCut, #668 render cron, #670 derive_cuts tool, #676 live registry, SYN-1080 MCP key registry). Spec author: /spm T3 run in the viral-method-cards session.

## 1. Task

Wire the nexus-viral 1→8 short-form pipeline for production use: orchestrator, drift canary, real gates, and human release — under draft-first spend, always-human-gated publish, org-scoped tenancy.

## 2. Project context

Synthex (internal Unite-Group tool, not public SaaS). This session shipped and live-verified: viral cards → hero generation (MCP `generate_video`) → `derive_cuts` → ffmpeg render cron → `queued_human_gated` publish rows. Sandbox E2E passed 8/8 grill twice; a live run caught fal retiring 3 of 5 registry models (repaired, #676).

## 3. Problem

Four gaps stop the pipeline being routinely usable: (WS1) no runner composes the stages; (WS2) provider model drift is only caught by paid failures; (WS3) the Brief/Broadcast grills exist as prose + session-local judge agents, unusable by any headless caller and unenforceable at the queue; (WS4) released cuts cannot actually publish — the dispatcher has no YouTube/TikTok capability and the YouTube search package has no home. **WS0 (discovered during this spec): the SYN-1080 MCP auth cutover locked ALL existing MCP callers out of production** (env var renamed to `SYNTHEX_MCP_LEGACY_KEYS`, `mcp_api_keys` table empty, no caller migration step) — nothing MCP-driven can run until access is restored.

## 4. Desired outcome

A human can trigger a full 1→8 run in one action; the run is gated (LLM judge verdicts enforced deterministically at the queue); provider drift is caught before real spend; the founder releases cuts from a purpose-built surface and the YouTube cut publishes with its search package; every action is org-scoped, audited, and inside quota.

## 5. Scope

**In:** WS0 access-restoration runbook; WS1 orchestrator as _skill-invoked agent session_ over MCP (no daemon); WS2 free submit-time liveness probe + weekly paid canary (cron route, isolated internal org, Sentry alert); WS3 gate module pair (LLM producer + deterministic enforcer + QA rows); WS4 CalendarSlot JSON extension (`video`, `youtube{title,description,tags}`), YouTube+TikTok platform adapters over existing `lib/social/*-service.ts`, release surface (studio tab, batch-of-8, partial release), release route (RBAC + audit + rate limit).
**Out:** autonomous cron orchestrator; model-health dashboards; metadata editing UI at release; non-YouTube metadata shapes; auto-disable of models; public-SaaS multi-tenant release UX.

## 6. Existing capability (do not rebuild)

`generate_video/get_job/derive_cuts` MCP tools; social-cut renderer cron; quota hold/release (proven live); `lib/social/youtube-service.ts` + `tiktok-service.ts`; `lib/publish/publishQueue.ts` atomic claim; approvals system (unsuitable for video — see UX seat); `components/schema/VideoObjectSchema.tsx`; `scripts/video-smoke-test.ts`; sandbox judge-agent grill pattern (validated 8/8 ×2); marketing_agency_qa_reports shape.

## 7. Specialist board (receipt)

`leveling_version 1.0 · board_version 1.0` · axis F=2 I=2 N=1 X=2 S=2 → **T3** · 8 seats convened in one parallel round (product/architect/ux/security/qa/judge/marketing/ops; Opus on architect+security+qa+judge; contracts 8/8, no abstentions) · rounds: 1 (divergence low — convergent on baseline-pin, metadata-home, canary isolation; contested only on paid-canary value, resolved by two-tier drift detection) · **environment caveat:** seats audited the stale session worktree (e9a74d75); "surface missing" findings were re-verified by the author against origin/main and retired as environment artifacts — surviving must_fix items are listed in §8/§15. Judge seat score: **61/100 (needs-work)** on the raw programme; this spec incorporates every surviving must_fix as a mandatory criterion.

## 8. Judge challenge (surviving must_fix = mandatory)

1. `pin-verified-surfaces` — spec pins baseline f3fd9cf3; every WS PR branches from it.
2. `free-drift-check-before-paid-canary` — submit-time liveness (fal 404-class detection surfaced to the caller immediately) is primary; the paid canary is the weekly end-to-end proof, spend-capped.
3. `justify-code-gate-over-agent` — resolved via two-layer design: judges stay LLM (rubric-versioned), enforcement is deterministic code reading QA rows; an agent's 8/8 is [UNCONFIRMED] until the enforcer reads it.
4. `metadata-home-additive-only` — CalendarSlot JSON extension; **no schema migration**.
5. `defer-orchestrator-until-gates-real` — WS1 lands after WS3; WS1 is an agent-session skill, not infrastructure.
   Verdict sought on this revised spec: APPROVE BUILD only at real 100/100 (post-adversarial pass).

## 9. Proposed solution (per WS)

**WS0 (prereq, ~1h):** mint scoped `mcp_api_keys` rows for: founder session key, orchestrator, canary (least-privilege scopes, not `*` where SYN-MCP-007 filtering exists); document `SYNTHEX_MCP_LEGACY_KEYS` as emergency fallback only; add caller-migration note to SYN-1080; **human decision required to mint** (see §19).
**WS2 (next, ~0.5d):** (a) submit-path liveness surfacing — generation-service maps the webhook 404-class failure to an actionable `model_retired?` error + Sentry event; (b) `/api/cron/video-canary` weekly, `verifyCronRequest`, runs registry-driven draft smoke (not hardcoded model) against a dedicated internal canary org marked via the existing `Organization.settings` Json (**no `is_internal` column — no migration**) with `parentOrgId = null` so org-scoping already excludes it from client/workspace aggregates, own quota row, asserts rendered + correct model id, Sentry alert on fail, hard spend cap.
**WS3 (~1.5d):** `lib/video/gates/` — `runBriefGrill`/`runBroadcastGrill` (LLM producers via `getAIProvider`, rubric text versioned from broadcast-grill-viral.md, structured JSON verdicts, prompt-injection hardening: judge input is data-fenced, never instruction-bearing) writing `marketing_agency_qa_reports` rows; plus `assertGatePassed(assetRef)` deterministic enforcer used by derive/release paths. Golden-transcript unit tests; FAIL is terminal + Sentry.
**WS1 (~1d):** `nexus-viral-run` skill + thin `scripts/nexus-viral-run.ts` driver: Stage1 brief (org data) → Gate A → copy (nexus-copywriter agent) → `generate_video` → poll → Gate B → `derive_cuts` → report. Human-triggered only. No publish primitives (phase-1 boundary preserved).
**WS4 (~2d):** CalendarSlot JSON gains optional `video{url,thumbnail}` + `youtube{title,description,tags}`; new `platformAdapters/youtube.ts` + `tiktok.ts` over existing services, enabled by adding `case 'youtube'/'tiktok'` to `dispatchToPlatform`'s switch ONLY — **`AUTO_PUBLISH_PLATFORMS` must NOT gain youtube/tiktok** (that constant feeds `seedPublishQueue`, which creates `pending` rows directly from approved calendar slots and would bypass the human gate; adversarial finding `auto-publish-set-arms-ungated-seed`); a unit test asserts `seedPublishQueue` skips youtube/tiktok slots; `POST /api/publish-queue/release` (Zod, owner/RBAC, writeDefault rate limit, audit_logs row, org-scoped, batch or per-cut; transition `queued_human_gated→pending` atomic updateMany); release surface = studio tab grouped by hero (video preview cards, captions, YT search package read-only, approve/reject per cut, partial release explicit).

## 10. UX

Release tab under the studio page: batch header (hero thumbnail, topic, 8-cut progress), per-cut card (`<video>` preview from storage URL, platform badge, caption, YT card shows search package), actions Release / Hold / Reject with per-cut state; empty state ("no cuts awaiting release"); error state per failed dispatch with `lastError`. AU English.

## 11. Technical

Layer rules respected (app→lib→prisma). No new packages. No migrations (slot JSON + existing tables). Out-of-enum `queued_human_gated` pinned by a dedicated unit test as a deliberate invariant. Quota TOCTOU race (`lib/services/ai/video/quota.ts` `holdQuota`, the documented optimistic read-then-write near line 28; cap fields on `organizationVideoQuota`) tightened to a conditional update (`updateMany ... where spent+amount<=cap`-style) in WS2's PR.

## 12. Security

Release route: owner/admin RBAC, audit row, rate-limited, org-scoped, Zod. MCP route gains writeDefault rate limiting. Canary org isolated + excluded from client aggregates. Gate LLM inputs data-fenced (no instruction execution from captions). Keys: least-privilege scopes, revocation tested. Cron secrets per-route. Constant-time cron compare (low, bundled).

## 13. Verification plan (sandbox-policy)

Isolation: unit/integration via jest.worktree (mocked prisma/providers — no external calls); pipeline-level via the session's scratchpad Docker harness pattern (node:22 + repo tsc + local Supabase container) — **no in-tree docker harness exists; the spec names the scratchpad harness as the container strategy**; live proof: one WS1 run at draft tier (≈$1.69 + renders) against prod with human watching; canary first run manual-triggered. Prod untouched by tests except the explicitly-priced live proofs.

## 14. Loop + stress tests

Concurrent release clicks (atomic claim — reuse postPublishClaim test pattern); canary during simulated fal outage (Sentry path, no crash-loop); gate FAIL → remediation ladder → re-judge loop; 8-cut partial release; dispatcher retry exhaustion → held; revoked-key MCP call → 401 + no side effects.

## 15. Acceptance criteria (mandatory 100/100)

All §8 items; plus: (1) WS0 access restored + runbook; (2) canary catches a deliberately-dead model id in a test double AND its live run passes; (3) `assertGatePassed` blocks release when the QA row is FAIL — proven by test; (4) YouTube adapter emits the correct create-request payload (title/description/tags) proven by a mocked-API unit test, AND one priced live publish to a named Unite-Group-owned YouTube test channel (confirmed PlatformConnection required; add this live proof to §13's priced list) succeeds on a human release; (5) TikTok adapter dispatch path unit-proven; (6) zero cross-org access in release route tests (401/403/400/200 ladder); (7) full gauntlet green on every PR; (8) release audit rows present; (9) all publish paths remain human-gated: **no path creates OR transitions a youtube/tiktok publish_queue row into pending/publishing except the human release route** — proven by a unit test asserting `seedPublishQueue` skips youtube/tiktok slots AND a grep-level test that no automated `queued_human_gated→pending` transition exists.

## 16. Goal command

`/goal Implement SPM spec 'nexus-viral productionise' (scratchpad spm-spec-nexus-viral-productionise.md) in order WS0→WS2→WS3→WS1→WS4 from baseline f3fd9cf3; every WS = feature/agent-* branch + agent-metadata PR + full gauntlet; live-spend steps require explicit human ack in-session; stop after each WS for review.`

## 17. Implementation sequence

WS0 (human key decision → mint → verify MCP 200) → WS2 (liveness + canary) → WS3 (gates) → WS1 (runner skill) → WS4 (adapters + release) → live 1→8 proof run → close SYN-1075 programme.

## 18. Session-handoff seed

Baseline f3fd9cf3; artifacts: this spec, sandbox E2E artifacts (scratchpad/viral-e2e), grilled CopyBundle + YT search package (fixtures), live-run payloads (out/live-\*.json); blocked-on: WS0 key mint (human); monitors running: PR watch; open: hero rerun awaits WS0.

## 19. Final recommendation

REDUCE SCOPE → then APPROVE BUILD in the §17 order. WS0 is a decision only Phill can make (production credential mint). WS2/WS3 are the highest value per dollar; WS4 is the largest and should not start until the judge-enforcer pair exists. Judge's 61/100 rises to a claimable 100/100 only if every §15 criterion lands — nothing here is approved below that.
