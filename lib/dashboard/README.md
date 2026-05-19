# `lib/dashboard/` — NRPG → DR Admin Dashboard Data Layer

Single-shot aggregator that the admin dashboard UI page consumes. Joins `service_area_coverage` + `lib/budget` (ledger + monthly utilisation) + `lib/kpi` (latest 30d/90d snapshots + retreat candidates) into one typed `NrpgCoverageSnapshot`.

**Linear:** SYN-843 (parent: SYN-834 epic)
**Owners:** `ui-ux` + `code-architect` + `marketing-operations-director`

> **Scope note:** This module ships the **data layer**. The actual `/admin/nrpg-coverage` page (map + tables + auth gating) is a follow-up — it will read this snapshot and render. Keeping the aggregation in a pure lib means the UI can be swapped (or a CSV-only cron added) without rewriting the join logic.

---

## Files

| File                              | Purpose                                                                |
| --------------------------------- | ---------------------------------------------------------------------- |
| `types.ts`                        | `NrpgCoverageSnapshot` · `DashboardLocationRow` · `CoverageRepository` |
| `supabase-coverage-repository.ts` | Default repo over `service_area_coverage` (Phase 3.4 brand=DR filter)  |
| `coverage-snapshot.ts`            | Main API — `getNrpgCoverageSnapshot(opts?)`                            |
| `csv-export.ts`                   | `snapshotToCsv(snapshot)` — monthly board-pack export                  |
| `index.ts`                        | Public re-exports                                                      |

## Hard rules (binding behaviour)

1. **DR-only.** Coverage repo hard-filters `brand='DR'` at the query level. Defence-in-depth on top of the DB CHECK constraint. Phase 3.4 cross-portfolio boundary stays clean.
2. **No contractor PII.** Snapshot carries pseudonymous `openedByContractorId` only — never names, phones, or addresses (Q3.2.5 P10).
3. **DI-friendly.** Every external read (`coverageRepo`, `loadMonthlyBudget`, `loadRetreatCandidates`, `loadLedgerForContractor`, `loadLatestKpi`) can be injected via `opts` for testing.
4. **Bounded fan-out.** Per-coverage KPI lookups are fanned out at concurrency 4 — keeps Supabase happy when there are hundreds of coverages.
5. **CSV export ships zero PII.** Only the columns enumerated in `csv-export.ts`. Adding a column = explicit code change + review.

## Usage

### Render the admin dashboard page (server component)

```ts
import { getNrpgCoverageSnapshot } from '@/lib/dashboard';

export default async function NrpgCoveragePage() {
  const snapshot = await getNrpgCoverageSnapshot();
  return <NrpgCoverageDashboard snapshot={snapshot} />;
}
```

### Export the monthly CSV (board-pack cron)

```ts
import { getNrpgCoverageSnapshot, snapshotToCsv } from '@/lib/dashboard';

const snapshot = await getNrpgCoverageSnapshot();
const csv = snapshotToCsv(snapshot);
await uploadToBoardPackBucket('nrpg-coverage-' + monthSlug + '.csv', csv);
```

### Test with injected fakes

```ts
const snapshot = await getNrpgCoverageSnapshot({
  coverageRepo: {
    async findAllForDr() {
      return [
        /* ... */
      ];
    },
  },
  loadMonthlyBudget: async () => ({
    totalCommittedAud: 1100,
    capAud: 10000,
    utilisationPct: 11,
    activeLocationCount: 20,
  }),
  loadRetreatCandidates: async () => [],
  loadLedgerForContractor: async () => [],
  loadLatestKpi: async () => null,
});
```

## Architecture notes

- **Single-shot snapshot, no streaming.** The dashboard page is read-mostly; one round-trip is cheaper than wiring SWR + websockets for an admin tool. If load grows past hundreds of coverages, swap to a server-streaming pattern in this lib without touching the UI.
- **Map rendering deferred.** Per the SYN-843 ticket, the UI uses Leaflet or MapLibre (no Google Maps Platform billing). That decision lives in the UI layer; this data layer just hands the UI lat/lng-free coverage rows. Geocoding suburb → coordinates can happen on the client from a static AU postcode CSV (already shipped in `lib/postcode/`).
- **Budget per coverage.** We don't have a `serviceAreaCoverageId → monthlyAud` index in the DB; we look it up via `getLedgerForContractor(contractor)` and find the matching row. Cheap because each contractor's ledger is typically a few rows. If contractor ledgers grow large, add a direct `findByCoverage` to `BudgetLedgerRepository`.
- **Counts always populated for every status.** Even if zero rows are paused, the `counts.paused = 0` field is always present so the UI can render badges without null checks.

## What this layer does NOT do

- It does NOT render any UI — that's the `/admin/nrpg-coverage` page (separate ticket)
- It does NOT auth-gate — caller's responsibility (use existing Synthex `lib/auth` patterns)
- It does NOT touch external client or any non-Nexus brand — single-brand-by-construction (Phase 3.4)
- It does NOT page or stream — single round-trip; revisit if scale grows past hundreds of coverages
