# Capability Matrix Heatmap

Derived from [capability-matrix.csv](./capability-matrix.csv) (32 tasks).

Re-audited 05/08/2026 against `main`, then updated through 06/08/2026 for
AT-001 / AT-002 / AT-003 / AT-004 / AT-005 / AT-006 / AT-007 / AT-008 / AT-009 / AT-010 / AT-011 /
AT-012 / AT-013 / AT-016 / AT-017 / AT-020 / AT-021 / AT-022 / AT-024 / AT-025 / AT-032 product wiring. The previous
version dated from 26/05/2026 and was ~699 commits stale, so several rows understated
what had since shipped. **C1 was not re-audited in this pass** — those values are
carried forward from 26/05/2026 and should be treated as unconfirmed.

## By status

| Status             | Count |   % | Change since 26/05 |
| ------------------ | ----: | --: | ------------------ |
| IDE_ONLY           |     1 |  3% | −13                |
| UI_PARTIAL         |    12 | 38% | −3                 |
| MISSING            |     0 |  0% | −3                 |
| COMPLETE (product) |    19 | 59% | +19                |

## By service line

| Service line                               | Tasks | IDE_ONLY | UI_PARTIAL | MISSING | COMPLETE |
| ------------------------------------------ | ----: | -------: | ---------: | ------: | -------: |
| Orchestration & strategy (001, 004)        |     2 |        0 |          0 |       0 |        2 |
| Copy & brand voice (002, 003, 009)         |     3 |        0 |          0 |       0 |        3 |
| Reporting (005–008)                        |     4 |        0 |          0 |       0 |        4 |
| Creative & video (010, 032)                |     2 |        0 |          0 |       0 |        2 |
| Growth channels (011, 012, 014, 015, 016)  |     5 |        0 |          2 |       0 |        3 |
| Insights & research (013, 018)             |     2 |        0 |          1 |       0 |        1 |
| Platform adapt & score (020, 021)          |     2 |        0 |          0 |       0 |        2 |
| Ops & governance (017, 019, 022, 024, 025) |     5 |        1 |          2 |       0 |        2 |
| Advisor & delivery (023, 026–029)          |     5 |        0 |          5 |       0 |        0 |
| Tenant ops & social publish (030, 031)     |     2 |        0 |          2 |       0 |        0 |

## C1 / C2 (policy + IDE)

| Column    | COMPLETE | Partial / missing                                    |
| --------- | -------- | ---------------------------------------------------- |
| C1 Policy | 30       | 2 (AT-027, AT-029 — carried forward, not re-audited) |
| C2 IDE    | 28       | 4 (AT-027, AT-029, AT-030, AT-031)                   |

## Interpretation

- **C2 is near-complete and the old matrix undercounted it.** Every skill the
  26/05 matrix listed as unshipped now exists on disk, including `senior-cmo`
  (AT-008, AT-022) and `cro-specialist` (AT-011).
- **C3 COMPLETE now exists for nineteen rows:** AT-001 (orchestrate skill
  contribution), AT-002 (`contentCampaignWorkflow` generator →
  `senior-copywriter` via `invokeSkill`), AT-003 (workflow brand-voice gate →
  full R1–R9 `enforceBrandVoice`, #848), AT-004 (strategist final-gate stamp +
  CEO queue filter), AT-005 (Tier-1 gateCounts + Lead-proxied brand canaries),
  AT-006 (Hyper-Care daily), AT-007 (Tier-2 monthly), AT-008 (Tier-3
  `senior-cmo` portfolio review pending_review), AT-009 (brand-voice fail-closed
  scoring), AT-010 (`POST /api/admin/remotion` creative-director pending brief;
  no auto-publish; server/Lambda render still not configured), AT-011 (CRO
  proposal), AT-012 (email-sequence), AT-013 (audience insights org-scoped +
  on-demand Instagram demographics sync; honest empty when unavailable), AT-016
  (paid-pilot), AT-017 (orchestrate persist), AT-020 (cross-post adapt options),
  AT-021 (`POST /api/marketing/platform-score` `platform-content-optimiser`
  pending_review), AT-022 (orchestrate `senior-cmo` + dedicated Tier-3 portfolio
  review), AT-032 (`POST /api/video` queue + job poll, #851). AT-024 is
  UI_PARTIAL — H-4 VG-71 BLOCK + strategist decision ship; the full handoff
  chain does not.
- **Remaining IDE_ONLY:** AT-019 only (`foundation-keeper` product invoke
  intentionally blocked — filesystem writes; no fake foundation editor).
  AT-025 is UI_PARTIAL — `POST /api/marketing/incident` classifies + stores for
  review (no notify/page; no dashboard). The gap elsewhere is still mostly
  wiring — UI_PARTIAL remains dominant.

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
| AT-014 | Pre-export gate: distribute/publish blocked until status=approved + owner/admin permission  | (this)        |
| AT-032 | `POST /api/video` enqueue + `GET ?jobId=` status (matrix lag after #851)                    | #851          |

**Known residual (not the original defect):** scheduled X publish may still
need `connectionId` threaded into `TwitterSyncService` so OAuth 2.0 refresh
uses the advisory lock after ~2h token expiry — tracked as a follow-up to
AT-031. Remotion server/Lambda MP4 render remains explicitly out of AT-010
scope (client preview + pending brief only).
