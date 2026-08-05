# Capability Matrix Heatmap

Derived from [capability-matrix.csv](./capability-matrix.csv) (32 tasks).

Re-audited 05/08/2026 against `main`. The previous version dated from 26/05/2026
and was ~699 commits stale, so several rows understated what had since shipped.
**C1 was not re-audited in this pass** — those values are carried forward from
26/05/2026 and should be treated as unconfirmed.

## By status

| Status             | Count |   % | Change since 26/05 |
| ------------------ | ----: | --: | ------------------ |
| IDE_ONLY           |     9 | 28% | −5                 |
| UI_PARTIAL         |    21 | 66% | +6                 |
| MISSING            |     2 |  6% | −1                 |
| COMPLETE (product) |     0 |  0% | unchanged          |

## By service line

| Service line                               | Tasks | IDE_ONLY | UI_PARTIAL | MISSING |
| ------------------------------------------ | ----: | -------: | ---------: | ------: |
| Orchestration & strategy (001, 004)        |     2 |        1 |          1 |       0 |
| Copy & brand voice (002, 003, 009)         |     3 |        0 |          3 |       0 |
| Reporting (005–008)                        |     4 |        1 |          2 |       1 |
| Creative & video (010, 032)                |     2 |        0 |          2 |       0 |
| Growth channels (011, 012, 014, 015, 016)  |     5 |        2 |          2 |       1 |
| Insights & research (013, 018)             |     2 |        0 |          2 |       0 |
| Platform adapt & score (020, 021)          |     2 |        0 |          2 |       0 |
| Ops & governance (017, 019, 022, 024, 025) |     5 |        5 |          0 |       0 |
| Advisor & delivery (023, 026–029)          |     5 |        0 |          5 |       0 |
| Tenant ops & social publish (030, 031)     |     2 |        0 |          2 |       0 |

## C1 / C2 (policy + IDE)

| Column    | COMPLETE | Partial / missing                                    |
| --------- | -------- | ---------------------------------------------------- |
| C1 Policy | 30       | 2 (AT-027, AT-029 — carried forward, not re-audited) |
| C2 IDE    | 28       | 4 (AT-027, AT-029, AT-030, AT-031)                   |

## Interpretation

- **C2 is near-complete and the old matrix undercounted it.** Every skill the
  26/05 matrix listed as unshipped now exists on disk, including `senior-cmo`
  (AT-008, AT-022) and `cro-specialist` (AT-011).
- **C3 still reaches COMPLETE nowhere.** Existing in `.claude/skills/` is not
  the same as being invoked: skills such as `senior-cmo`,
  `platform-content-optimiser`, and `cro-specialist` appear in
  `lib/agency/agency-task-catalog.ts` and nowhere else in `app/` or `lib/`.
  `lib/ai/skills/` (SYN-806) now makes product invocation possible; the
  remaining work is calling it from each surface.
- **The gap is wiring, not documentation** — unchanged as a conclusion, but the
  shape moved: the dominant state is now UI_PARTIAL (a surface exists but is
  fed by a stub, a placeholder, or an unpopulated data source) rather than
  IDE_ONLY.

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

**Known residual (not the original defect):** scheduled X publish may still
need `connectionId` threaded into `TwitterSyncService` so OAuth 2.0 refresh
uses the advisory lock after ~2h token expiry — tracked as a follow-up to
AT-031.
