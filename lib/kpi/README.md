# `lib/kpi/` — Per-Location KPI Registration

Records `performance-attribution-lead` snapshots for every opened location in the SYN-834 NRPG → DR dynamic service-area pipeline. Feeds the controlled-retreat decision in the SYN-839 budget ledger.

**Linear:** SYN-842 (parent: SYN-834 epic)
**Owners:** `performance-attribution-lead` + `analytics-lead`
**Foundation authority:** Q3.2.3 A2 (AI-search visibility = directional, not hard KPI), `performance-attribution-lead` hard rules 1–5.

---

## Files

| File                     | Purpose                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| `types.ts`               | `KpiSnapshot` · `RecordKpiInput` · `RecordKpiResult` · `RetreatCandidate` · `KpiRepository` |
| `supabase-repository.ts` | Default repository — Supabase service-role client backed by `location_kpi` table            |
| `per-location-kpi.ts`    | Main API — record, read, retreat-candidate scan                                             |
| `index.ts`               | Public re-exports                                                                           |

## Hard rules (binding behaviour)

1. **`periodDays` must be 7, 30, or 90.** Mirrors the DB CHECK constraint. Throws otherwise.
2. **All metric values must be non-negative finite numbers.** Throws on `NaN`, `Infinity`, or negatives.
3. **Verified state only via 30-day window.** A snapshot promotes to `verification_state='verified'` iff `periodDays === 30 AND conversions >= threshold` (default 30, configurable via `NRPG_KPI_VERIFY_CONVERSIONS_THRESHOLD`). Mirrors `performance-attribution-lead`'s N=30 rule.
4. **Retreat scan is read-only.** `getRetreatCandidates()` returns coverages whose latest 90-day snapshot has `clicks === 0 AND conversions === 0`. It does NOT pause anything — the caller (or operator) decides. Aligns with SYN-839 NEVER list rule 4 (don't auto-pause without notifying performance-attribution-lead).
5. **No transactions.** Each `recordKpiSnapshot` call is a single insert. Append-only table; no updates.

## Usage

### Record a weekly snapshot

```ts
import { recordKpiSnapshot } from '@/lib/kpi';

const { snapshot, promotedToVerified } = await recordKpiSnapshot({
  serviceAreaCoverageId: coverageId,
  periodDays: 7,
  impressions: 1240,
  clicks: 38,
  conversions: 4,
  revenueAud: 880.0,
});
// promotedToVerified === false (only 30-day windows can verify)
```

### Record a 30-day snapshot that promotes to verified

```ts
const { snapshot, promotedToVerified } = await recordKpiSnapshot({
  serviceAreaCoverageId: coverageId,
  periodDays: 30,
  impressions: 8200,
  clicks: 240,
  conversions: 32, // ≥ 30 → promotes
  revenueAud: 7040.0,
});
// snapshot.verificationState === 'verified'
// snapshot.verifiedAt is now an ISO timestamp
// promotedToVerified === true
```

### Read latest snapshot

```ts
import { getLatestSnapshot, getCoverageKpiHistory } from '@/lib/kpi';

const latest = await getLatestSnapshot(coverageId);
// → KpiSnapshot | null

const ninetyDay = await getLatestSnapshot(coverageId, 90);
// → most recent 90-day snapshot or null

const history = await getCoverageKpiHistory(coverageId);
// → KpiSnapshot[] (newest first)
```

### Retreat-candidate scan (operator workflow)

```ts
import { getRetreatCandidates } from '@/lib/kpi';
import { pauseLocation } from '@/lib/budget';

const candidates = await getRetreatCandidates();
// → RetreatCandidate[] — coverages with 90d clicks=0 conversions=0

for (const c of candidates) {
  // Caller MUST notify performance-attribution-lead first
  await notifyAttributionOfPause(
    c.serviceAreaCoverageId,
    '90-day zero-attribution'
  );
  await pauseLocation(c.serviceAreaCoverageId, '90-day zero-attribution');
}
```

## Env config

| Var                                     | Default | Notes                                                           |
| --------------------------------------- | ------- | --------------------------------------------------------------- |
| `NRPG_KPI_VERIFY_CONVERSIONS_THRESHOLD` | `30`    | Conversions in a 30-day window required to promote to verified. |
| `NEXT_PUBLIC_SUPABASE_URL`              | —       | Required for default Supabase repository.                       |
| `SUPABASE_SERVICE_ROLE_KEY`             | —       | Required for default Supabase repository.                       |

In tests, pass `opts.repository` (mock) and `opts.verifyConversionsThreshold` to override env without touching `process.env`.

## Architecture notes

- **Append-only.** Snapshots are immutable history, not a mutable state row. A coverage may have many `(measuredAt, periodDays)` snapshots over its lifetime.
- **`listLatestNinetyDayPerCoverage` is N+1-free.** Pulls all 90-day rows ordered newest-first, then dedupes by coverage in application code. Cheap given expected scale (hundreds of coverages, not millions).
- **Verification gate is one-way per snapshot.** Older snapshots stay `'directional'`; only new 30-day inserts above threshold get the `'verified'` stamp. No retroactive promotion.

## What this layer does NOT do

- It does NOT compute KPIs from raw events — caller (analytics worker) provides aggregated counts.
- It does NOT pause/close ledger entries — that's `lib/budget` via the operator workflow.
- It does NOT cross-mix funnels — `performance-attribution-lead` cross-funnel separation rule means the caller is responsible for keeping DR D-funnel data separate from NRPG N-funnel data when feeding this layer.
- It does NOT emit events — single-process write/read; downstream consumers should poll `getLatestSnapshot` or query Supabase directly.
