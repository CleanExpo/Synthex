# Capability Matrix Heatmap

Derived from [capability-matrix.csv](./capability-matrix.csv) (32 tasks).

Re-audited 05/08/2026 against `main`, then updated 05/08/2026 for AT-001 /
AT-006 / AT-007 / AT-012 / AT-017 product wiring. The previous version dated from
26/05/2026 and was ~699 commits stale, so several rows understated what had
since shipped. **C1 was not re-audited in this pass** — those values are carried
forward from 26/05/2026 and should be treated as unconfirmed.

## By status

| Status             | Count |   % | Change since 26/05 |
| ------------------ | ----: | --: | ------------------ |
| IDE_ONLY           |     5 | 16% | −9                 |
| UI_PARTIAL         |    21 | 66% | +6                 |
| MISSING            |     1 |  3% | −2                 |
| COMPLETE (product) |     5 | 16% | +5                 |

## By service line

| Service line                               | Tasks | IDE_ONLY | UI_PARTIAL | MISSING | COMPLETE |
| ------------------------------------------ | ----: | -------: | ---------: | ------: | -------: |
| Orchestration & strategy (001, 004)        |     2 |        0 |          1 |       0 |        1 |
| Copy & brand voice (002, 003, 009)         |     3 |        0 |          3 |       0 |        0 |
| Reporting (005–008)                        |     4 |        0 |          2 |       0 |        2 |
| Creative & video (010, 032)                |     2 |        0 |          2 |       0 |        0 |
| Growth channels (011, 012, 014, 015, 016)  |     5 |        1 |          2 |       1 |        1 |
| Insights & research (013, 018)             |     2 |        0 |          2 |       0 |        0 |
| Platform adapt & score (020, 021)          |     2 |        0 |          2 |       0 |        0 |
| Ops & governance (017, 019, 022, 024, 025) |     5 |        4 |          0 |       0 |        1 |
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
- **C3 COMPLETE now exists for five rows:** AT-001 (orchestrate skill
  contribution), AT-006 (Hyper-Care daily), AT-007 (Tier-2 monthly), AT-012
  (email-sequence executor), AT-017 (orchestrate persist). Skills such as
  `platform-content-optimiser` and `cro-specialist` remain catalog-only.
- **The gap is still mostly wiring** — UI_PARTIAL remains dominant (a surface
  exists but is fed by a stub, placeholder, or unpopulated data source).

## Defects found during the audit

Ranked by blast radius at re-audit. **All of the following are now shipped on
`main`** (PRs #846–#851). Residual notes below each row are follow-ups, not
open blockers of the original finding.

| Row    | Original defect                                                                                                                      | Shipped |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| AT-014 | PR routes set `orgId` to a **user** id at 24 sites across 12 files (`orgId` is a FK to `Organization.id`). Also `api/eeat/v2/audit`. | #846    |
| AT-031 | `PlatformConnection.refreshToken` stored an OAuth 2.0 refresh token but was consumed as an OAuth 1.0a `accessSecret` for X.          | #847    |
| AT-003 | Workflow brand-voice gate was an anti-pattern stub; full R1–R9 `enforceBrandVoice` was unwired.                                      | #848    |
| AT-009 | `quality-scorer.ts` returned hardcoded `0.5` on provider failure (read as mid-range).                                                | #849    |
| AT-005 | Weekly Tier-1 cron omitted `gateCounts`, so Monday snapshots lacked `agencyLoop`.                                                    | #849    |
| AT-023 | Nightly churn-scorer path was scheduled but 404'd (missing Next.js route).                                                           | #850    |
| AT-032 | `api/video` POST ran long capture synchronously instead of queueing.                                                                 | #851    |

Also fixed earlier in the skill-runtime pass: AT-029 (fictional assignees /
discarded assigneeId) and AT-026 (silent workflow no-op).

**Shipped after heatmap re-audit (capability wiring):**

| Row    | Product wiring                                                                             | Shipped |
| ------ | ------------------------------------------------------------------------------------------ | ------- |
| AT-001 | Optional `skillContribution` on `POST /api/marketing/orchestrate`                          | #855    |
| AT-012 | `POST /api/marketing/email-sequence` invokes `email-specialist` and persists review drafts | #856    |
| AT-017 | Orchestrate persists `MarketingAgencyCampaign` in `pending_review`                         | #857    |
| AT-007 | Monthly Tier-2 AEO snapshot API + cron + AEO dashboard                                     | #858    |
| AT-006 | Daily Hyper-Care AEO snapshot API + cron + AEO dashboard                                   | (this)  |

**Known residual (not the original defect):** scheduled X publish may still
need `connectionId` threaded into `TwitterSyncService` so OAuth 2.0 refresh
uses the advisory lock after ~2h token expiry — tracked as a follow-up to
AT-031.
