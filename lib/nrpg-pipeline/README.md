# `lib/nrpg-pipeline/` — SYN-834 Final Integration Handler

Subscribes to `ContractorOnboardedEvent` and orchestrates the full NRPG → DR pipeline: postcode resolve → $55/mo budget commits → GBP + Bing service-area updates → per-suburb landing pages → sitemap regen + Google/Bing ping.

**Linear:** SYN-834 epic (final integration — all 9 children already merged)
**Owners:** `marketing-operations-director` + `code-architect`

---

## Files

| File                      | Purpose                                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| `types.ts`                | `NrpgPipelineOptions` · `NrpgPipelineResult` · `StageOutcome`                                             |
| `service-category-map.ts` | NRPG `'water-damage' / 'fire-restoration' / 'mould-remediation'` → DR `'water-damage' / 'fire' / 'mould'` |
| `handler.ts`              | `createNrpgPipelineHandler(opts)` — pure handler factory                                                  |
| `subscriber.ts`           | `subscribeNrpgPipeline(opts)` — wires the handler onto the event bus                                      |
| `index.ts`                | Public re-exports                                                                                         |

## Stage flow

1. **Gate** — `brand === 'NRPG'` AND `consentForServiceAreaListing === true` AND at least one DR-mappable service category. Otherwise `accepted=false`, no side effects.
2. **Postcode resolve** (`lib/postcode`) — `(lat, lng, radiusKm)` → suburb list with per-suburb distance.
3. **Budget commits** (`lib/budget`) — synthesise a deterministic coverage ID per (job, suburb) and commit `$55/mo`. The ledger's idempotency means re-playing the same event = zero double-charges. Only suburbs that committed proceed to downstream stages.
4. **GBP + Bing** (`lib/gbp` + `lib/bing-places`) — fan out **in parallel**. Distance map gates suburbs > 100 km from contractor base.
5. **Landing pages** (`lib/landing-page`) — one page per (`drCategory` × committed suburb). Validators block on Aid Rule, category-claim, schema-vs-content mismatch, PII leak. Rejected pages don't reach the sitemap.
6. **Sitemap regen + ping** (`lib/sitemap`) — only the pages that landed are appended. Ping is skipped if `regen.added.length === 0` or `opts.skipPing` is set. Ping is rate-limited 1/hour per target by the underlying client.

**Per-stage error isolation:** a GBP API failure does NOT block Bing, the budget commits stick, the page generation runs. Every stage outcome is captured in `NrpgPipelineResult` for audit.

## Hard rules (binding behaviour)

1. **NRPG-only.** `brand !== 'NRPG'` → refused upfront. No side effects.
2. **Consent required.** `consentForServiceAreaListing !== true` → refused. NEVER PATCHes GBP / Bing / generates a page without consent.
3. **Source-of-truth job ID propagated** end-to-end (Q3.2.4 H8). Every downstream call carries it.
4. **Idempotent.** Every primitive in the chain is idempotent on `(sourceOfTruthJobId, suburb)` — re-playing the same event produces zero new commits, zero new GBP / Bing PATCHes, and at most a no-op sitemap regen.
5. **No file I/O directly.** Caller injects `loadCurrentSitemapXml`, `saveSitemapXml`, `saveLandingPage` — keeps cross-repo deploy + secrets concerns in the caller.

## Usage

### Wire it up at app boot

```ts
import { subscribeNrpgPipeline } from '@/lib/nrpg-pipeline';
import { gbpApiClient } from '@/lib/gbp';
import { bingPlacesApiClient } from '@/lib/bing-places';

const unsubscribe = subscribeNrpgPipeline({
  brand: {
    name: 'Disaster Recovery',
    legalName: 'Disaster Recovery Pty Ltd',
    url: 'https://disasterrecovery.com.au',
    logoUrl: 'https://disasterrecovery.com.au/logo.png',
    telephone: '+61730000000',
    hq: { lat: -27.4698, lng: 153.0251, addressLocality: 'Brisbane' },
  },
  gbpLocationId: process.env.DR_GBP_LOCATION_ID!,
  bingStoreId: process.env.DR_BING_PLACES_STORE_ID!,
  loadCurrentSitemapXml: async () => readSitemapFromRepo(),
  saveSitemapXml: async xml => writeSitemapToRepo(xml),
  saveLandingPage: async page => commitPageToDrRepo(page),
});
```

### Test with injected fakes (no Supabase, no fetch, no real APIs)

```ts
const handler = createNrpgPipelineHandler({
  brand: testBrand,
  gbpLocationId: 'locations/test',
  bingStoreId: 'store_test',
  loadCurrentSitemapXml: async () => '',
  gbpClient: fakeGbpClient,
  bingClient: fakeBingClient,
  postcodeResolveOptions: { dataset: testDataset },
  skipPing: true,
});

const result = await handler(event);
expect(result.accepted).toBe(true);
expect(result.gbp?.ok).toBe(true);
expect(result.bingPlaces?.ok).toBe(true);
```

## What this layer does NOT do

- It does NOT implement the budget / GBP / Bing / page / sitemap logic — those live in the corresponding `lib/*` modules. This is wiring only.
- It does NOT auth-gate the bus — caller controls who can call `emitContractorOnboarded`.
- It does NOT retry — each stage runs once. Re-playing the event is the retry path (idempotent).
- It does NOT support multi-instance fan-out — the in-process subscribe is single-process. For horizontal scale, swap `subscribeContractorOnboarded` for a Postgres LISTEN/NOTIFY adapter.
