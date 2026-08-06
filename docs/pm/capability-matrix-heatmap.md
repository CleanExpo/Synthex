# Capability Matrix Heatmap

Derived from [capability-matrix.csv](./capability-matrix.csv) (32 tasks).

Re-audited 05/08/2026 against `main`, then updated through 06/08/2026 for
AT-001–AT-032 product wiring (including AT-024 / AT-025 / AT-028 / AT-030 matrix
closure and AT-031 code-side contract lock). The previous version dated from
26/05/2026 and was ~699 commits stale, so several rows understated what had
since shipped. **C1 was not re-audited in this pass** — those values are
carried forward from 26/05/2026 and should be treated as unconfirmed.

## By status

| Status             | Count |   % | Change since 26/05 |
| ------------------ | ----: | --: | ------------------ |
| IDE_ONLY           |     1 |  3% | −13                |
| UI_PARTIAL         |     1 |  3% | −14                |
| MISSING            |     0 |  0% | −3                 |
| COMPLETE (product) |    30 | 94% | +30                |

## By service line

| Service line                               | Tasks | IDE_ONLY | UI_PARTIAL | MISSING | COMPLETE |
| ------------------------------------------ | ----: | -------: | ---------: | ------: | -------: |
| Orchestration & strategy (001, 004)        |     2 |        0 |          0 |       0 |        2 |
| Copy & brand voice (002, 003, 009)         |     3 |        0 |          0 |       0 |        3 |
| Reporting (005–008)                        |     4 |        0 |          0 |       0 |        4 |
| Creative & video (010, 032)                |     2 |        0 |          0 |       0 |        2 |
| Growth channels (011, 012, 014, 015, 016)  |     5 |        0 |          0 |       0 |        5 |
| Insights & research (013, 018)             |     2 |        0 |          0 |       0 |        2 |
| Platform adapt & score (020, 021)          |     2 |        0 |          0 |       0 |        2 |
| Ops & governance (017, 019, 022, 024, 025) |     5 |        1 |          0 |       0 |        4 |
| Advisor & delivery (023, 026–029)          |     5 |        0 |          0 |       0 |        5 |
| Tenant ops & social publish (030, 031)     |     2 |        0 |          1 |       0 |        1 |

## C1 / C2 (policy + IDE)

| Column    | COMPLETE | Partial / missing |
| --------- | -------- | ----------------- |
| C1 Policy | 32       | 0                 |
| C2 IDE    | 32       | 0                 |

## Interpretation

- **C2 is complete.** Every skill the 26/05 matrix listed as unshipped now
  exists on disk, including `senior-cmo` (AT-008, AT-022) and `cro-specialist`
  (AT-011). AT-030 / AT-031 IDE columns are COMPLETE (seed + OAuth contract).
- **C3 COMPLETE now exists for thirty rows.** AT-024 meets the catalog bar
  (VG-71 BLOCK + strategist boundary decision; never executes cross-promo).
  AT-025 meets the sibling governance pattern (classify + pending_review;
  never pages). AT-028 has a product run path:
  `POST /api/workflows/executions` with `template: content-campaign` expands
  `contentCampaignWorkflow` and enqueues step 0; workflows UI exposes the
  builtin. AT-030 closes on brand-setup BrandDNA + `seed:brands` (4 Nexus;
  CCW carve-out documented; ops seed remains a human step).
- **Remaining IDE_ONLY:** AT-019 only (`foundation-keeper` product invoke
  intentionally blocked — filesystem writes; no fake foundation editor).
- **Remaining UI_PARTIAL:** AT-031 only — code-side OAuth 2 + `connectionId`
  for X/YT/TT are shipped and unit-locked; live publish E2E remains GAP-005
  (human gate; no invented live X publish in CI).

## Defects found during the audit

Ranked by blast radius at re-audit. **All of the following are now shipped on
`main`** (PRs #846–#851). Residual notes below each row are follow-ups, not
open blockers of the original finding.

| Row    | Original defect                                                                                                                                                                                                                         | Shipped       |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| AT-014 | PR routes set `orgId` to a **user** id at 24 sites across 12 files (`orgId` is a FK to `Organization.id`). Also `api/eeat/v2/audit`. Residual after #846 closed: pre-export gate (status=approved + owner/admin) on distribute/publish. | #846 + (this) |
| AT-031 | `PlatformConnection.refreshToken` stored an OAuth 2.0 refresh token but was consumed as an OAuth 1.0a `accessSecret` for X.                                                                                                             | #847          |
| AT-003 | Workflow brand-voice gate was an anti-pattern stub; full R1–R9 `enforceBrandVoice` was unwired.                                                                                                                                         | #848          |
| AT-009 | `quality-scorer.ts` returned hardcoded `0.5` on provider failure (read as mid-range).                                                                                                                                                   | #849          |
| AT-005 | Weekly Tier-1 cron omitted `gateCounts`, so Monday snapshots lacked `agencyLoop`. Brand canaries stayed null until Lead proxy.                                                                                                          | #849 + (this) |
| AT-023 | Nightly churn-scorer path was scheduled but 404'd (missing Next.js route).                                                                                                                                                              | #850          |
| AT-032 | `api/video` POST runs long capture synchronously instead of queueing.                                                                                                                                                                   | #851          |

Also fixed earlier in the skill-runtime pass: AT-029 (fictional assignees /
discarded assigneeId) and AT-026 (silent workflow no-op).

**Shipped after heatmap re-audit (capability wiring):**

| Row    | Product wiring                                                                              | Shipped       |
| ------ | ------------------------------------------------------------------------------------------- | ------------- |
| AT-001 | Optional `skillContribution` on `POST /api/marketing/orchestrate`                           | #855          |
| AT-012 | `POST /api/marketing/email-sequence` invokes `email-specialist` and persists review drafts  | #856          |
| AT-017 | Orchestrate persists `MarketingAgencyCampaign` in `pending_review`                          | #857          |
| AT-007 | Monthly Tier-2 AEO snapshot API + cron + AEO dashboard                                      | #858          |
| AT-006 | Daily Hyper-Care AEO snapshot API + cron + AEO dashboard                                    | #859          |
| AT-011 | `POST /api/marketing/cro-proposal` invokes `cro-specialist` and persists review drafts      | #860          |
| AT-016 | `POST /api/marketing/paid-pilot` invokes `paid-performance-marketer`; never places spend    | #861          |
| AT-020 | Cross-post adapt options honour `adjustLength` / `addHashtags`                              | #864          |
| AT-022 | Honest correction then CLOSED: orchestrate + dedicated Tier-3 portfolio review              | #862 + (this) |
| AT-024 | `POST /api/marketing/ccw-boundary` H-4 VG-71 BLOCK + strategist pending-review decision     | #862          |
| AT-025 | `POST /api/marketing/incident` deterministic severity + pending-review draft (no notify)    | #863          |
| AT-002 | `contentCampaignWorkflow` generator routes through `senior-copywriter` via `invokeSkill`    | #865          |
| AT-003 | Matrix correction: workflow gate already delegates to full R1–R9 (#848)                     | #865          |
| AT-004 | Strategist final-gate (`senior-strategist` stamp) + CEO queue filter                        | #866          |
| AT-005 | Tier-1 `loadAgencyBrandMetrics` from org-scoped Leads + gateCounts (cron + POST)            | #867          |
| AT-009 | Brand-voice QualityScorer fail-closed to 0 on provider failure                              | #868          |
| AT-008 | `POST /api/marketing/tier3-portfolio-review` invokes `senior-cmo`; pending_review only      | (this)        |
| AT-010 | `POST /api/admin/remotion` creative-director pending Remotion brief; status poll; no render | (this)        |
| AT-021 | `POST /api/marketing/platform-score` invokes `platform-content-optimiser`; pending_review   | (this)        |
| AT-013 | Audience insights org-scoped + on-demand Instagram demographics sync; honest empty          | (this)        |
| AT-014 | Pre-export gate: distribute/publish blocked until status=approved + owner/admin permission  | #873          |
| AT-015 | GBP OAuth connect (fetch→redirect) + connected flag + org-matched sync; honest empty        | #874          |
| AT-018 | Research create (GEOFeatureGate) + auto-research 503 fail-closed when Redis/BullMQ down     | (this)        |
| AT-032 | `POST /api/video` enqueue + `GET ?jobId=` status (matrix lag after #851)                    | #851          |

**Known residual (not the original defect):** AT-031 live OAuth publish E2E
remains GAP-005 (human gate) — code-side OAuth 2 + `connectionId` for X/YT/TT
are shipped (#847/#853/#854) and unit-locked. Remotion server/Lambda MP4 render
remains explicitly out of AT-010 scope (client preview + pending brief only).

| Row    | Product wiring                                                               | Shipped |
| ------ | ---------------------------------------------------------------------------- | ------- |
| AT-023 | Nightly churn-scorer cron + internal route (matrix lag after #850)           | #850    |
| AT-026 | Advisor spawn → contentCampaignWorkflow + unspawnable `workflowWarning`      | SYN-971 |
| AT-027 | Autonomous execute foundation + ensureBrandVoiceGate before publish/approval | (this)  |
| AT-028 | `template=content-campaign` executions start + workflows UI builtin          | (this)  |
| AT-029 | agencyTaskId + org-scoped assignees (matrix lag after SYN-971 / Phase 128)   | SYN-971 |
| AT-030 | brand-setup BrandDNA + seed:brands (4 Nexus; CCW carve-out)                  | (this)  |
