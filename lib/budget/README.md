# `lib/budget/` — Per-Location Budget Ledger

The gating component for the SYN-834 NRPG → DR dynamic service-area pipeline. Every new opened location commits a $55/mo ledger entry; the trigger pipeline refuses to open new locations when the monthly cap or per-contractor cap is exceeded.

**Linear:** SYN-839 (parent: SYN-834 epic)
**Owners:** `marketing-operations-director` + `senior-cmo`
**Foundation authority:** `senior-cmo` SeniorCMODecision (capital pool) + `marketing-operations-director` hard rule 3 (cross-brand frequency cap pooling discipline)

---

## Files

| File                     | Purpose                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `types.ts`               | `LedgerEntry` · `CommitLocationInput` · `CommitLocationResult` · `BudgetLedgerRepository` · `MonthlyUtilisation` |
| `supabase-repository.ts` | Default repository — Supabase service-role client backed by `location_budget_ledger` table (PR #129)             |
| `per-location-ledger.ts` | Main API — commit, pause, resume, headroom checks, reporting                                                     |
| `index.ts`               | Public re-exports                                                                                                |

## Hard rules (binding behaviour)

1. **Source-of-truth job ID required** on every commit (Q3.2.4 H8). Throws if omitted.
2. **Idempotent on `serviceAreaCoverageId`** — re-commit returns existing entry without double-charging the cap.
3. **Monthly cap enforced** — `NRPG_LOCATION_BUDGET_CAP_AUD` (default $10k/mo). Refuses commit if exceeded.
4. **Per-contractor cap enforced** — `NRPG_PER_CONTRACTOR_BUDGET_CAP_AUD` (default $3k/mo). Refuses commit if exceeded.
5. **No `[CEO override]` shortcut in code** — caller must explicitly pause/close other locations to free headroom, OR temporarily raise the env cap.
6. **Pause does NOT auto-notify performance-attribution-lead** — that's the caller's responsibility (NEVER list rule 4). This module is a pure data layer.

## Usage

### Subscribe + commit (typical flow from a SYN-NRPG-DR-\* worker)

```ts
import { subscribeContractorOnboarded } from '@/lib/contractor';
import { resolveSuburbsWithinRadius } from '@/lib/postcode';
import { commitLocation } from '@/lib/budget';

subscribeContractorOnboarded(async event => {
  const suburbs = await resolveSuburbsWithinRadius(
    { lat: event.baseLocation.lat, lng: event.baseLocation.lng },
    event.radiusKm
  );

  for (const suburb of suburbs) {
    // Caller (e.g. SYN-837 GBP worker) creates the service_area_coverage
    // row first, then we commit the budget against it.
    const coverageId = await ensureCoverageExists(suburb, event);

    const result = await commitLocation({
      serviceAreaCoverageId: coverageId,
      sourceOfTruthJobId: event.sourceOfTruthJobId,
      contractorId: event.contractorId,
      postcode: suburb.postcode,
      suburb: suburb.suburb,
      // monthlyAmountAud defaults to $55
    });

    if (!result.committed) {
      logger.warn('budget refused', {
        suburb: suburb.suburb,
        reason: result.reason,
      });
      // Skip this suburb; continue with others
      continue;
    }

    // Trigger downstream actions (GBP patch, landing-page gen, etc.)
    await openSuburbCoverage(suburb, event);
  }
});
```

### Read-only headroom checks

```ts
import { canCommitMonthlyBudget, canCommitForContractor } from '@/lib/budget';

const monthly = await canCommitMonthlyBudget(55);
// → { ok: true, remainingAud: 8945 }
//   or { ok: false, remainingAud: 30, reason: 'monthly cap exceeded — cap=10000 ...' }

const perContractor = await canCommitForContractor('contractor_abc', 55);
// → { ok: true, remainingAud: 2945 }
```

### Reporting

```ts
import {
  getMonthlyBudgetUtilisation,
  getActiveLocationCount,
  getLedgerForContractor,
} from '@/lib/budget';

const util = await getMonthlyBudgetUtilisation();
// → { totalCommittedAud: 1100, capAud: 10000, utilisationPct: 11, activeLocationCount: 20 }

const count = await getActiveLocationCount();
// → 20

const entries = await getLedgerForContractor('contractor_abc');
// → LedgerEntry[] (newest first)
```

### Pause + resume

```ts
import { pauseLocation, resumeLocation } from '@/lib/budget';

// Caller MUST notify performance-attribution-lead first per NEVER list rule 4
await notifyAttributionOfPause(coverageId, '90-day zero-attribution');

const paused = await pauseLocation(coverageId, '90-day zero-attribution');
// → LedgerEntry (status='paused') OR null if no active entry found

// Later, when conditions improve:
const resumed = await resumeLocation(coverageId);
```

## Env config

| Var                                  | Default | Notes                                     |
| ------------------------------------ | ------- | ----------------------------------------- |
| `NRPG_LOCATION_BUDGET_CAP_AUD`       | `10000` | Monthly portfolio-wide cap. Configurable. |
| `NRPG_PER_CONTRACTOR_BUDGET_CAP_AUD` | `3000`  | Monthly per-contractor cap. Configurable. |
| `NEXT_PUBLIC_SUPABASE_URL`           | —       | Required for default Supabase repository  |
| `SUPABASE_SERVICE_ROLE_KEY`          | —       | Required for default Supabase repository  |

In tests, pass `opts.repository` (mock) and `opts.monthlyCapAud` / `opts.perContractorCapAud` to override env without touching `process.env`.

## Architecture notes

- **No transactions.** This module assumes the caller (SYN-837/838/etc.) creates the `service_area_coverage` row separately. If the ledger commit fails, the caller is responsible for rolling back coverage. Acceptable trade-off for now; revisit if data drift becomes a real problem.
- **Idempotency via SELECT-then-INSERT.** Cheaper than a partial UNIQUE index migration. Race condition is theoretically possible (two simultaneous commits for the same coverage) but exceedingly unlikely given upstream NRPG signup is one-at-a-time per contractor. V2 ticket should add `UNIQUE WHERE status='active'` partial index.
- **Caps are read at every call.** Allows env changes to take effect without process restart. Cost is one extra env read per commit — negligible.
- **Default monthly cap intentionally generous** ($10k = ~180 active locations). CEO can dial down via env when monitoring shows real utilisation patterns.

## What this layer does NOT do

- It does NOT create `service_area_coverage` rows — caller does that
- It does NOT communicate with GBP/Bing — that's SYN-837/841
- It does NOT decide WHICH locations to retreat — that's `performance-attribution-lead` reading `location_kpi`
- It does NOT broadcast cross-process — single-process write/read; for multi-instance fan-out add Postgres LISTEN/NOTIFY on top
