---
phase: nexus-viral-productionise
type: morning-report
generated: 2026-07-10 overnight (autonomous)
---

# Morning Report — nexus-viral productionise (overnight autonomous build)

**All four workstreams built, PR'd, gauntlet-green, MERGEABLE — nothing merged.** Every
human gate (spend, publish, prod migration, merge) was honoured. Each subagent's "green" was
re-verified against full CI by the orchestrator (not trusted on the mocked subset — which is
how three real regressions were caught and fixed overnight).

## The four PRs (review these; do NOT auto-merge the safety-critical one)

| PR                                                    | WS  | What                                                                                                       | CI                                          |
| ----------------------------------------------------- | --- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| [#694](https://github.com/CleanExpo/Synthex/pull/694) | WS2 | drift canary + fal-retired liveness surfacing + quota TOCTOU→conditional updateMany                        | ✅ 32 green                                 |
| [#695](https://github.com/CleanExpo/Synthex/pull/695) | WS3 | gate producers (data-fenced, injection-tested) + fail-closed `assertGatePassed` + rubric authored in-repo  | ✅ 31 green                                 |
| [#696](https://github.com/CleanExpo/Synthex/pull/696) | WS1 | `nexus-viral-run` skill + driver; Gate A/B abort-**before-spend** proven; `--live` needs `--confirm-spend` | 🟢 30 green, 1 slow check finishing, 0 fail |
| [#697](https://github.com/CleanExpo/Synthex/pull/697) | WS4 | **SAFETY-CRITICAL** publish adapters + human release route + Release UI; §15.9 invariant verified          | ✅ 32 green                                 |

Plans + runbook: branch `claude/nexus-viral-overnight-plans` (8 executable PLAN.md files).

## ⛔ THE ONE DECISION THAT GATES THE REST (yours)

**QA-row schema blocker.** `MarketingAgencyQaReport` requires a `campaignId` FK and has **no
video/asset-ref column**. So the WS3 gates cannot persist a video verdict, and
`assertGatePassed` fails closed → wiring it into the live `deriveSocialCut`/release path breaks
the working pipeline (it broke 13 existing tests until we un-wired it). WS3/WS1/WS4 all built
_around_ this: the gate LOGIC + enforcer + tests exist and pass, but the **live wiring is
deferred** with a documented TODO. Decide one of:

- add a video/asset-ref column to `marketing_agency_qa_reports` (additive, founder-gated migration), or
- scope gate enforcement to campaign-backed runs only, or
- persist verdicts on the `videoAsset`/a new lightweight table.
  Once decided, the gate wiring is a small follow-up.

## Human to-do (only you can do these)

1. **Review the PRs** — especially #697 (safety-critical publish). A `senior-reviewer` pass on
   the release-route authz/atomicity + the §15.9 invariant tests is worth it.
2. **Decide the QA-schema question** above → then gate wiring lands.
3. **Priced live proofs** (each a watched, human-acked spend; ~US$1.69/draft render):
   - WS2 canary: provision an internal org (`Organization.settings.videoCanary=true`, `parentOrgId=null`, a TeamMember) + one manual `/api/cron/video-canary` trigger, check the Sentry path.
   - WS1 live 1→8: `nexus-viral-run --live --confirm-spend --campaign <id>` (campaign needed for gate persistence per the blocker).
   - WS4: one YouTube publish to a Unite-Group test channel via the release route (needs a YouTube `PlatformConnection`).
4. **Two WS4 follow-ups it deliberately deferred** (flagged, not risked on a safety-critical PR):
   - mount `components/publish/ReleaseTab.tsx` into a studio page;
   - reconcile the social-cut→dispatch data path (`deriveSocialCut` anchors rows with `slotId:'social-cut:<assetId>'`; the queue reads `video`/`youtube` from a real calendar slot).
5. **Merge order** once reviewed: WS2 → WS3 → WS1 (stacked on WS3) → WS4. **No migrations needed** — everything additive (JSON slot fields, `Organization.settings`).

## Regressions caught + fixed overnight (why re-verification mattered)

- WS2: `holdQuota` rewrite broke the pre-existing `__tests__/video-engine/quota.test.ts` (fixed, behaviours preserved).
- WS3: fail-closed gate wired into `deriveSocialCut` broke 13 derive tests (un-wired; wiring deferred to the QA-schema decision).
- WS1: inherited the pre-fix WS3 base; merged the fixed WS3 branch in.
- Two transient GitHub Docker-registry 500s on WS2 (re-run, cleared).

## Notes

- `next/og` type errors seen in agent worktrees are a Node-20 local artifact; CI runs Node 22 → type-check is green on all PRs.
- #693 (session docs + Phase C drift-visibility CI) merged to `main` overnight (`c9776229`).
