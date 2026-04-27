# Synthex Network Score — Architecture Spec (Draft)

**Linear:** SYN-780 | **Date:** 25/04/2026 (AEST) | **Owner:** Technical Architect + Product Strategist
**Status:** Draft for Phill / architect review
**Parent:** SYN-775 | **Related:** SYN-669, SYN-725, SYN-779, SYN-793, SYN-794, SYN-795
**Measurement gate posture:** Per ticket — schema design proceeds regardless of measurement gate. The gate only controls _client-facing activation_, never schema or admin-side computation. This document specifies storage, computation, and admin surfaces only.

---

## 1. Problem statement

Synthex collects rich per-client signals (content performance, GBP reviews, GA4 conversions, lead pipeline, CVML feature usage) but each signal lives in its own silo and is interpreted only against the client's own history. There is no compounding cross-client layer that converts the fleet's data into a benchmark, a percentile, or a defensible "you're in the top 20% of Australian plumbers" claim. Without that layer, the referral surface, the partner conversation, the GBP badge, and the benchmark landing page have nothing to anchor on. The Network Score closes that gap by composing existing per-client signals into a single privacy-preserving, industry-segmented benchmark layer.

## 2. Scope boundaries

**In scope (this spec):**

- Signal taxonomy and source-of-truth tables for each input
- Computation model — weighting, normalisation, confidence floor, industry segmentation
- Storage — Prisma model sketches, anonymisation key table, retention
- Admin-only API surface (read endpoints for the internal benchmarks dashboard)
- Privacy + opt-in posture and the consent record schema
- Phased rollout map and kill criteria

**Out of scope (downstream tickets):**

- Client-facing UI (panel, percentile widget, referral copy rendering)
- Activation gate logic (feature flag implementation lives in the ticket that ships the panel)
- Benchmark landing page hero stats rendering (SYN-779)
- Referral message personalisation templates (specced in SYN-780 ticket body, rendered in a later ticket)
- GBP badge gating mechanic
- External press / "industry report" surfaces

## 3. Inputs (signals)

All signals are sourced from existing or in-flight Synthex tables. The Network Score is a _composition layer_ — it does **not** introduce new collection.

| #   | Signal                              | Source table / view                        | Refresh cadence  | Anonymisation step                                           | Depends on |
| --- | ----------------------------------- | ------------------------------------------ | ---------------- | ------------------------------------------------------------ | ---------- |
| 1   | GA4 per-client conversion velocity  | `ga4_conversion_rollups` (vw)              | Daily 02:00 AEST | Strip `client_id` → `cohort_hash` before aggregation         | SYN-793    |
| 2   | Lead conversion rate (CRM pipeline) | `lead_conversion_rollups` (vw)             | Daily 02:15 AEST | Strip `client_id`, bucket by `industry_category`             | SYN-794    |
| 3   | CVML feature engagement             | `cvml_engagement_view` (mv)                | Hourly           | Aggregated to industry bucket only; no row-level client data | SYN-725    |
| 4   | GBP review velocity                 | `gbp_review_events` → `gbp_review_rollups` | Every 6 hours    | Hash `place_id` to `cohort_hash` post-rollup                 | (existing) |
| 5   | Content publishing cadence          | `content_performance_profiles`             | Daily 02:30 AEST | Strip `client_id`; preserve `industry_category` only         | SYN-631    |
| 6   | Authority momentum                  | `authority_scores` (rolling 30-day delta)  | Daily 03:00 AEST | Hash to `cohort_hash`                                        | SYN-584    |

**Six dimensions** map to these signals (per SYN-780 ticket interface):

| Dimension               | Primary signals (#) |
| ----------------------- | ------------------- |
| `post_frequency`        | 5                   |
| `engagement_trajectory` | 1, 5                |
| `review_responsiveness` | 4                   |
| `geo_visibility`        | 4, 6                |
| `content_consistency`   | 5                   |
| `authority_momentum`    | 6, 3                |

## 4. Computation model

### 4.1 Per-dimension score

For each dimension `d` and client `c`:

```
raw_d_c       = aggregator(signal_inputs)        // signal-specific
normalised_d_c = winsorise(raw_d_c, p5, p95)     // clamp tails
percentile_d_c = ecdf(normalised_d_c | industry, reference_mode)
```

`ecdf` is the empirical CDF of the chosen reference set (external benchmark vs internal cohort).

### 4.2 Reference mode switch

```
reference_mode =
  cohort_size(industry) >= 50 ? 'internal_cohort' : 'external_benchmark'
```

External benchmarks: ABS Small Business industry averages + Google industry norms (versioned by `benchmark_version` string, e.g. `abs-2025q4`).

### 4.3 Overall score

```
overall_score = Σ ( weight_d × percentile_d )   // Σ weights = 1.0
```

**Default weights (v1, subject to calibration):**

| Dimension             | Weight |
| --------------------- | ------ |
| post_frequency        | 0.10   |
| engagement_trajectory | 0.25   |
| review_responsiveness | 0.15   |
| geo_visibility        | 0.20   |
| content_consistency   | 0.10   |
| authority_momentum    | 0.20   |

### 4.4 Confidence floor

`overall_percentile = null` when **any** of:

- `cohort_size(industry) < 10` AND `reference_mode = 'internal_cohort'`
- Client has fewer than 10 posts in the trailing 90 days
- Fewer than 4 of 6 dimensions have non-null inputs

Null percentiles are stored — they signal "compute attempted, insufficient data". A null `overall_percentile` blocks the referral personalisation surface (falls back to the generic variant).

### 4.5 Industry segmentation

Cohorts are bucketed by `industry_category` (string, sourced from `clients.industry_category`). Cross-industry comparison is **not** supported in v1 — a plumber is benchmarked against plumbers, not against the whole Synthex fleet.

## 5. Storage

### 5.1 Prisma sketch — `client_network_benchmarks`

```prisma
model ClientNetworkBenchmark {
  id                  String   @id @default(uuid()) @db.Uuid
  clientId            String   @map("client_id") @db.Uuid
  computedAt          DateTime @map("computed_at") @db.Timestamptz(6)
  industryCategory    String   @map("industry_category")
  overallPercentile   Decimal? @map("overall_percentile") @db.Decimal(5, 2)
  dimensionScores     Json     @map("dimension_scores")          // NetworkScoreDimension[]
  referenceMode       NetworkReferenceMode @map("reference_mode")
  cohortSize          Int      @map("cohort_size")
  benchmarkVersion    String   @map("benchmark_version")
  createdAt           DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  client              Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)

  @@index([clientId, computedAt(sort: Desc)])
  @@index([industryCategory, computedAt(sort: Desc)])
  @@map("client_network_benchmarks")
}

enum NetworkReferenceMode {
  external_benchmark
  internal_cohort
}
```

### 5.2 `industry_benchmarks` (external + internal snapshots)

```prisma
model IndustryBenchmark {
  id                  String   @id @default(uuid()) @db.Uuid
  industryCategory    String   @map("industry_category")
  dimension           String   // matches NetworkScoreDimension['dimension']
  benchmarkSource     String   @map("benchmark_source")  // abs_smb_average | google_industry_norm | synthex_cohort
  benchmarkVersion    String   @map("benchmark_version")
  p25                 Decimal  @db.Decimal(10, 4)
  p50                 Decimal  @db.Decimal(10, 4)
  p75                 Decimal  @db.Decimal(10, 4)
  p90                 Decimal  @db.Decimal(10, 4)
  cohortSize          Int      @map("cohort_size")
  validFrom           DateTime @map("valid_from") @db.Timestamptz(6)
  validUntil          DateTime? @map("valid_until") @db.Timestamptz(6)

  @@unique([industryCategory, dimension, benchmarkVersion])
  @@map("industry_benchmarks")
}
```

### 5.3 Anonymisation key — `cohort_anonymisation_keys`

Maps `client_id` → opaque `cohort_hash` used by every aggregation pipeline. Hash rotation invalidates re-identification windows.

```prisma
model CohortAnonymisationKey {
  clientId       String   @id @map("client_id") @db.Uuid
  cohortHash     String   @unique @map("cohort_hash")
  rotatedAt      DateTime @default(now()) @map("rotated_at") @db.Timestamptz(6)
  previousHash   String?  @map("previous_hash")  // for one rotation window of overlap

  @@map("cohort_anonymisation_keys")
}
```

### 5.4 Retention policy

| Table                       | Retention                                                     |
| --------------------------- | ------------------------------------------------------------- |
| `client_network_benchmarks` | Last 12 monthly snapshots per client; older rows pruned       |
| `industry_benchmarks`       | All versions retained (immutable history, source of truth)    |
| `cohort_anonymisation_keys` | Rotated quarterly; `previous_hash` retained 30 days then null |

## 6. API surface

**Phase 1 = admin-read only. No client-facing endpoints.**

| Method | Route                                           | Auth               | Purpose                                    |
| ------ | ----------------------------------------------- | ------------------ | ------------------------------------------ |
| GET    | `/api/admin/network-score/clients/:clientId`    | Admin RBAC + owner | Latest score for one client                |
| GET    | `/api/admin/network-score/industries/:industry` | Admin RBAC         | Cohort distribution for an industry        |
| GET    | `/api/admin/network-score/benchmarks?version=`  | Admin RBAC         | List benchmark snapshots                   |
| POST   | `/api/admin/network-score/recompute`            | Admin RBAC + owner | Trigger out-of-band recompute (debug only) |

**RLS posture:**

- `client_network_benchmarks` — RLS denies all client-side reads. Service-role-only access. Admin endpoints proxy via `lib/auth/admin-guard`.
- `industry_benchmarks` — read-only for authenticated admin; service role for writes.
- `cohort_anonymisation_keys` — service role only. Never exposed via any API.

## 7. Privacy + opt-in posture

- **Default:** clients are _opted in_ to anonymised aggregation (covered by existing ToS clause "we use de-identified aggregate data to improve the platform").
- **Opt-out path:** a flag on `clients` (`network_score_opt_out boolean default false`). When true, the client's signals are excluded from `industry_benchmarks` aggregation and no `client_network_benchmarks` row is computed for them.
- **Re-identification risk:** mitigated by `cohort_hash`, industry-bucket aggregation, and a minimum cohort size of 10 before any external surface (admin or client) is shown a percentile.
- **Audit:** every recompute writes a row to `intelligence_compute_audit` (existing table from SYN-669) with input row counts and output hash.
- **Consent record:** `client_consents` row of type `network_score_aggregation` with `granted_at`, `revoked_at`. Revocation triggers a purge of that client's contribution from the next benchmark version.

## 8. Dependencies

| Ticket  | What it provides                                                             | Blocks                                          |
| ------- | ---------------------------------------------------------------------------- | ----------------------------------------------- |
| SYN-669 | `IntelligenceScore<TDomain>` parent interface in `lib/intelligence/types.ts` | Hard                                            |
| SYN-725 | CVML engagement view (`cvml_engagement_view`)                                | Hard for dimension 6                            |
| SYN-793 | GA4 per-client conversion velocity rollup                                    | Hard for dimensions 1, 2                        |
| SYN-794 | Lead conversion rate rollup                                                  | Hard for dimension 2                            |
| SYN-795 | Cross-channel attribution engine (lift weighting refinement)                 | Soft — improves v2 weights, not required for v1 |
| SYN-631 | `content_performance_profiles`                                               | Hard                                            |
| SYN-611 | Health Score live ≥ 14 days (data quality precondition)                      | Activation gate only                            |
| SYN-779 | Benchmark landing page (consumes Phase 2 output)                             | Downstream consumer                             |

## 9. Phased rollout

| Phase | Surface                          | Trigger condition                                                     | Tickets          |
| ----- | -------------------------------- | --------------------------------------------------------------------- | ---------------- |
| 1     | Admin-only dashboard read        | Schema applied + nightly compute green for 7 days                     | this spec + impl |
| 2     | Benchmark landing page claims    | `cohort_size >= 10` per claimed industry + legal review of claim copy | SYN-779          |
| 3     | Referral message personalisation | Phase 2 live + flag `network_score_referral_personalization` ON       | follow-up        |
| 4     | GBP badge gating                 | Phase 3 conversion lift validated + GBP API quota review              | follow-up        |

Each phase is gated by an explicit feature flag; a phase can be killed without affecting earlier phases.

## 10. Success / kill criteria

**Keep after 90 days if:**

- Compute pipeline green ≥ 95% of nightly runs
- Admin team reports the dashboard is used in ≥ 1 client conversation per week
- Phase 2 (when it ships) lifts benchmark page trial conversion ≥ 0.5% absolute
- No privacy incident, no opt-out spike (> 5% of fleet)

**Kill if:**

- Cohort sizes never reach n ≥ 50 in any industry within 90 days _and_ external benchmarks prove too coarse to drive a defensible claim
- Compute cost > AUD 50/month per 100 clients (cost ceiling — score is infrastructure, not a paid feature)
- Any single re-identification incident
- Internal cohort distributions are too narrow to produce meaningful percentiles (e.g. p25 ≈ p75)

## 11. Open questions

- `<TBD>` Which industry taxonomy is canonical — ANZSIC codes, GBP categories, or a Synthex-curated list of ~30 buckets? Affects `industry_category` cardinality and ABS benchmark mapping.
- `<TBD>` Benchmark version cadence — quarterly refresh of ABS data, or annual? Cost of re-licensing vs accuracy.
- `<TBD>` Should `overall_percentile` be a single number, or a 6-vector with no overall composite (avoids the "one number lies" critique)?
- `<TBD>` Weight calibration method — fixed at v1 defaults, or learned from referral-conversion lift once Phase 3 runs?
- `<TBD>` Cross-industry comparison for multi-location clients (e.g. a group with both a cafe and a bakery) — averaged, or one score per location?
- `<TBD>` Whether `cohort_anonymisation_keys.previous_hash` retention of 30 days is the right window, or whether it should be 7 days to tighten re-identification surface.
- `<TBD>` Confirm Phase 4 GBP badge gating is contractually permissible under Google's Business Profile terms (legal review).
