# `lib/gbp/` — DR Google Business Profile Service-Area Updater

PATCHes DR's GBP service-area attribute when new suburbs are opened by NRPG contractor onboarding. Foundation primitive for SYN-837 in the SYN-834 NRPG → DR pipeline.

**Linear:** SYN-837 (parent: SYN-834 epic)
**Owners:** `local-seo-geo-veteran` + `marketing-operations-director`

---

## Files

| File                      | Purpose                                                                          |
| ------------------------- | -------------------------------------------------------------------------------- |
| `types.ts`                | `GbpPlace` · `UpdateGbpServiceAreaInput` · `GbpApiClient` · `GbpAuditSink`       |
| `gbp-api-client.ts`       | Default GBP REST client (uses `DR_GBP_OAUTH_BEARER` env). Inject fakes in tests. |
| `service-area-updater.ts` | Main API — `updateGbpServiceArea(input, opts?)`                                  |
| `index.ts`                | Public re-exports                                                                |

## Hard rules (binding behaviour)

1. **Source-of-truth job ID required** on every call (Q3.2.4 H8). Throws otherwise.
2. **Consent flag required** — `consentGranted: true`. Throws if false/undefined. NEVER PATCHes without consent.
3. **L7 carve-out** — this module only knows about a single GBP `locationId`. Caller is responsible for passing DR's location ID and never an NRPG/RA/CARSI/external client ID.
4. **Distance sanity bound** — places > `maxDistanceKm` (default 100) from contractor base are dropped before PATCH. Caller supplies distance map; without it, no filter is applied (caller's responsibility).
5. **Idempotent** — diff against current GBP coverage, PATCH only additions. Re-running the same event = zero PATCHes, audit row still written.
6. **No transactions.** Failure between PATCH and audit-write means audit may be missing — caller can re-replay; the diff step makes it safe.

## Usage

### Wire to a ContractorOnboarded event

```ts
import { subscribeContractorOnboarded } from '@/lib/contractor';
import { resolveSuburbsWithinRadius } from '@/lib/postcode';
import { updateGbpServiceArea } from '@/lib/gbp';

subscribeContractorOnboarded(async event => {
  if (!event.consentGranted) return;

  const suburbs = await resolveSuburbsWithinRadius(
    { lat: event.baseLocation.lat, lng: event.baseLocation.lng },
    event.radiusKm
  );

  // Build distance map for sanity filter
  const distanceMap = Object.fromEntries(
    suburbs.map(s => [s.suburb, s.distanceKm])
  );

  const result = await updateGbpServiceArea({
    locationId: process.env.DR_GBP_LOCATION_ID!,
    sourceOfTruthJobId: event.sourceOfTruthJobId,
    contractorId: event.contractorId,
    consentGranted: event.consentGranted,
    newPlaces: suburbs.map(s => ({
      placeName: s.suburb,
      postcode: s.postcode,
    })),
    contractorBaseDistanceKmByPlace: distanceMap,
  });

  if (result.patched) {
    logger.info('GBP coverage extended', {
      added: result.added.map(p => p.placeName),
      skipped: result.skipped.length,
      dropped: result.droppedFarFromBase.length,
    });
  }
});
```

### Test with an injected client

```ts
const fakeClient: GbpApiClient = {
  async getServiceArea() {
    return {
      locationId: 'L1',
      readAt: '...',
      places: [{ placeName: 'Carindale' }],
    };
  },
  async patchServiceArea() {
    return { status: 200 };
  },
};

const result = await updateGbpServiceArea(
  {
    ...input,
    newPlaces: [{ placeName: 'Carindale' }, { placeName: 'Mansfield' }],
  },
  { client: fakeClient }
);
// result.added → [{ placeName: 'Mansfield' }]
// result.skipped → [{ placeName: 'Carindale' }]
```

## Env config

| Var                       | Default | Notes                                                                  |
| ------------------------- | ------- | ---------------------------------------------------------------------- |
| `DR_GBP_OAUTH_BEARER`     | —       | OAuth bearer token for `mybusinessbusinessinformation.googleapis.com`. |
| `DR_GBP_LOCATION_ID`      | —       | DR's GBP location resource name (e.g. `locations/123456789`).          |
| `DR_GBP_ENABLED` (caller) | —       | Recommended feature flag — caller checks before invoking the worker.   |

In tests, inject `opts.client` and `opts.audit` to avoid hitting the real API.

## Architecture notes

- **No googleapis dependency.** We shell out via plain `fetch` to keep the bundle small and avoid CEO-sign-off on a new dep. Trade-off: caller is responsible for OAuth refresh (the env bearer is short-lived). When CEO approves `googleapis`, swap the client implementation in one file.
- **Diff happens in app code, not via PATCH-with-merge.** GBP doesn't support partial-merge on `serviceArea.places` — every PATCH replaces the whole list. So we must read first, union, then write. The dedupe lives in `normalisePlaceName` (case-insensitive trim).
- **Audit is fire-and-forget.** A failing audit sink logs and continues — the GBP PATCH is the load-bearing side effect. If the foundation-keeper sink is unavailable we'd rather the GBP coverage be correct and the audit row be re-derived later from logs than block the user-visible action.

## What this layer does NOT do

- It does NOT subscribe to events — caller wires the subscription
- It does NOT resolve suburbs from (lat, lng, radius) — that's `lib/postcode`
- It does NOT update Bing Places — that's `lib/bing-places` (SYN-841)
- It does NOT touch any non-DR brand's GBP — single-locationId, caller controls which
