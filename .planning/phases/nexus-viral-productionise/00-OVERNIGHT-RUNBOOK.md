---
phase: nexus-viral-productionise
type: overnight-autonomous
source_spec: docs/session-handoffs/2026-07-10-spm-nexus-viral-productionise.md
started: 2026-07-10 (overnight, Phill asleep)
---

# Overnight Runbook — nexus-viral productionise (WS2 → WS3 → WS1 → WS4)

Orchestrator (me) drives fresh-context subagents per workstream, re-runs the gauntlet on
each integrated branch before trusting "green" (Fabel evidence standard), opens a PR per WS,
and **hard-stops at every human gate**. Phill reviews + runs the live proofs + merges in the
morning.

## HARD STOPS — never cross unattended (Phill asleep)

- ❌ No live `generate_video` / any paid MCP call / live 1→8 (draft-first-spend is human-acked)
- ❌ No prod migration (founder gate SYN-1085) — additive SQL is authored + committed, NOT applied
- ❌ No publish to any platform (YouTube/TikTok/…)
- ❌ No merge to `main` — spec says "stop after each WS for review"
- ❌ No GitHub repo-settings / secrets changes
  On hitting any gate: STOP that workstream, record it, continue with other buildable work.

## Definition of "done" for the night (per WS)

1. Code implements the spec §9 for that WS.
2. Mocked jest tests (jest.worktree, mocked prisma/providers — **no external calls**) written + green.
3. Full gauntlet green on the WS branch: `npm run type-check && npm run lint && npx jest --config jest.worktree.cjs <paths>`.
4. Own branch `feat/nexus-viral-wsN-*` + agent-metadata PR opened (NOT merged).
5. Orchestrator re-ran the gauntlet on the branch and pasted the real `Tests:` line.

## Build order + scope (from spec §9)

- **WS2 (~0.5d)** — submit-path liveness surfacing (map fal webhook 404-class → actionable `model_retired?` error + Sentry) + `/api/cron/video-canary` weekly (verifyCronRequest, registry-driven draft smoke against a dedicated internal canary org via `Organization.settings` JSON — **no `is_internal` column, no migration**, `parentOrgId=null`, own quota, hard spend cap, Sentry alert). Also tighten the quota TOCTOU race (`lib/services/ai/video/quota.ts holdQuota`) to a conditional `updateMany`.
- **WS3 (~1.5d)** — `lib/video/gates/`: `runBriefGrill`/`runBroadcastGrill` (LLM producers via `getAIProvider`, rubric from broadcast-grill-viral.md, structured JSON verdicts, **judge input data-fenced / never instruction-bearing**) → `marketing_agency_qa_reports` rows; `assertGatePassed(assetRef)` deterministic enforcer used by derive/release; golden-transcript unit tests; FAIL terminal + Sentry.
- **WS1 (~1d)** — `nexus-viral-run` skill + thin `scripts/nexus-viral-run.ts`: Stage1 brief → Gate A → copy (nexus-copywriter) → generate_video → poll → Gate B → derive_cuts → report. **Human-triggered only, no publish primitives.** (Live generate step is a documented STOP — code the path, don't run it.)
- **WS4 (~2d) — SAFETY-CRITICAL, build but flag for careful human review:** CalendarSlot JSON `video{url,thumbnail}` + `youtube{title,description,tags}`; `platformAdapters/youtube.ts` + `tiktok.ts` over existing `lib/social/*-service.ts`; add `case 'youtube'/'tiktok'` to `dispatchToPlatform` switch ONLY. **`AUTO_PUBLISH_PLATFORMS` MUST NOT gain youtube/tiktok** (adversarial finding `auto-publish-set-arms-ungated-seed`; a unit test asserts `seedPublishQueue` skips youtube/tiktok). `POST /api/publish-queue/release` (Zod, owner/RBAC, writeDefault rate limit, audit_logs row, org-scoped, batch/per-cut; `queued_human_gated→pending` atomic updateMany). Release surface = studio tab grouped by hero. **No live publish; the priced YouTube-publish proof is Phill's, morning.**

## Invariant to protect above all (spec §15.9)

No path creates OR transitions a youtube/tiktok `publish_queue` row into `pending`/`publishing`
except the human release route — enforced by a unit test asserting `seedPublishQueue` skips
youtube/tiktok AND a grep-level test that no automated `queued_human_gated→pending` exists.

## Morning report (orchestrator writes before ending)

Per WS: built? gauntlet green (paste Tests: line)? PR #? gates hit? risks. Plus the human
to-do list: review PRs, run the priced live proofs (canary live run, live 1→8, one YouTube
publish), apply any authored migration, merge in order.
