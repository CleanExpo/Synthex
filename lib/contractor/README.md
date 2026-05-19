# `lib/contractor/` — Contractor Onboarding Event

Foundation primitive for SYN-834 NRPG → DR dynamic service-area expansion. Emits the `ContractorOnboardedEvent` that every downstream worker subscribes to (DR GBP update, landing-page generator, budget ledger, sitemap regen, Bing Places sync, attribution registration).

**Linear:** SYN-836 (parent: SYN-834 epic)
**Owners:** `marketing-operations-director` + `code-architect`
**Foundation authority:** `ceo-foundation.md` (Q3.2.4 H8 + Q3.2.5 P10/P16) + `verification-gates.md`

---

## Files

| File                  | Purpose                                                                       |
| --------------------- | ----------------------------------------------------------------------------- |
| `types.ts`            | `ContractorOnboardedEvent` · `Input` · `Handler` · `EmitResult` · `PersistFn` |
| `address-hash.ts`     | `hashAddress(raw)` — sha256 of normalised address. P10 binding.               |
| `event-emitter.ts`    | Typed in-process pub/sub with handler-error isolation                         |
| `onboarding-event.ts` | `emitContractorOnboarded()` — validate · persist · notify                     |
| `index.ts`            | Public re-exports                                                             |

## Hard rules (binding behaviour)

1. **Source-of-truth job ID required** — Q3.2.4 H8. Every emit must carry it. Throws if omitted.
2. **Brand whitelist: `'NRPG'` only** — DR/RA/CARSI/external client have separate flows per Phase 3.4.
3. **Payment gate** — `paymentConfirmedAt` required (no payment = no event).
4. **Consent gate** — `consentForServiceAreaListing` must be `true` (coverage cannot open without explicit consent).
5. **Raw address NEVER stored, NEVER logged** — Q3.2.5 P10. Either pass `rawAddress` (hashed in-memory + discarded) OR pre-hash and pass `addressHash`. Both is an error.
6. **Radius validated 1-200 km** — sanity bound matching `lib/postcode` resolver cap.
7. **Idempotent** — same `sourceOfTruthJobId` returns `firstEmit: false` on second call (Postgres `UNIQUE` constraint enforced; subscribers do NOT re-run).
8. **Per-handler error isolation** — one subscriber's exception does not break siblings.

## Usage

### Subscribe (in a worker module)

```ts
import { subscribeContractorOnboarded } from '@/lib/contractor';

const unsubscribe = subscribeContractorOnboarded(async event => {
  // event.sourceOfTruthJobId · event.contractorId · event.baseLocation
  // event.radiusKm · event.serviceCategories · event.expectedSuburbCount
  // event.expectedMonthlyBudgetAud · event.emittedAt
  await doWorkForThis(event);
});

// later
unsubscribe();
```

### Emit (in the onboarding API route, after payment confirmation)

```ts
import { emitContractorOnboarded } from '@/lib/contractor';

const result = await emitContractorOnboarded({
  sourceOfTruthJobId: `nrpg_onboarding_job_${jobId}`,
  contractorId: 'contractor_abc',
  brand: 'NRPG',
  baseLat: -27.4705,
  baseLng: 153.026,
  rawAddress: '123 Smith St, Brisbane QLD 4000', // hashed in-memory + discarded
  radiusKm: 20,
  serviceCategories: ['water-damage', 'fire-restoration'],
  paymentConfirmedAt: new Date().toISOString(),
  consentForServiceAreaListing: true,
  expectedSuburbCount: 28, // optional · pre-resolved via lib/postcode
  expectedMonthlyBudgetAud: 1540, // optional · 28 × $55
});

// result.firstEmit · result.notifiedHandlers · result.failedHandlers · result.event
```

## Persistence

The default `PersistFn` writes the event row to Supabase
`contractor_onboarding_event` (created by [PR #129](https://github.com/CleanExpo/Synthex/pull/129)) via the service-role
client. Tests inject a mock via `opts.persist`.

If `SUPABASE_SERVICE_ROLE_KEY` isn't configured (local dev / CI), the persist
is a warn-only no-op that returns `'inserted'` so the rest of the pipeline
still runs.

## Idempotency

The `source_of_truth_job_id` column has `UNIQUE` in Postgres. Re-emitting the
same job ID:

1. Persist returns `'duplicate'`
2. `firstEmit: false` returned to caller
3. Subscribers are NOT notified again (they already ran the first time)

This means upstream cron / retry logic can safely re-emit without worrying
about double-firing the downstream pipeline.

## Foundation hooks (future consumers)

- **SYN-NRPG-DR-3** (DR GBP service-area worker) → subscribe + run [`resolveSuburbsWithinRadius`](../postcode/) + PATCH GBP
- **SYN-NRPG-DR-4** (per-suburb landing-page generator) → subscribe + iterate suburbs × service categories
- **SYN-NRPG-DR-5** ($55/mo budget ledger) → subscribe + commit per-suburb ledger entries
- **SYN-NRPG-DR-6** (sitemap regen) → subscribe + append URLs to sitemap.xml
- **SYN-NRPG-DR-7** (Bing Places sync) → subscribe + mirror GBP coverage update
- **SYN-NRPG-DR-8** (per-location KPI) → subscribe + register location in attribution tracking

## What this layer does NOT do

- It does NOT geocode raw addresses → caller provides lat/lng
- It does NOT resolve coverage suburbs → caller can pre-resolve via `lib/postcode`
- It does NOT enforce per-contractor budget caps → that's `lib/budget/per-location-ledger.ts` (SYN-839)
- It does NOT broadcast cross-process → in-process pub/sub only. For multi-instance fan-out, add a Redis pub/sub or DB-poll worker on top.
