# `lib/bing-places/` — Bing Places Per-Location Sync

Mirrors the SYN-837 GBP work for Bing's index. Per the SEO/AEO/GEO research transcript: ChatGPT uses Bing's web index, so keeping Bing Places in sync with GBP service-area updates means citations from ChatGPT pick up new DR locations.

**Linear:** SYN-841 (parent: SYN-834 epic)
**Owners:** `local-seo-geo-veteran` + `marketing-operations-director`

---

## Files

| File                   | Purpose                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `types.ts`             | `BingLocality` · `UpdateBingServiceAreaInput` · `BingPlacesApiClient` · audit shape |
| `bing-api-client.ts`   | Default REST client (uses `BING_PLACES_API_KEY` env). Inject fakes in tests.        |
| `service-area-sync.ts` | Main API — `updateBingServiceArea(input, opts?)`                                    |
| `index.ts`             | Public re-exports                                                                   |

## Hard rules (binding behaviour)

Mirrors the SYN-837 ruleset exactly so the two workers stay aligned:

1. **Source-of-truth job ID required** on every call (Q3.2.4 H8).
2. **Consent flag required** — `consentGranted: true`. NEVER syncs without consent.
3. **Distance sanity bound** — localities > `maxDistanceKm` (default 100) from contractor base are dropped. Caller supplies distance map.
4. **Idempotent** — diff against current Bing coverage, PUT only additions. Re-running = zero PUTs, audit row still written.
5. **Audit fire-and-forget** — failing sink logs and continues so Bing coverage stays correct even if audit pipe is down.

## Usage

### Wire alongside the GBP worker (typical SYN-834 flow)

```ts
import { subscribeContractorOnboarded } from '@/lib/contractor';
import { resolveSuburbsWithinRadius } from '@/lib/postcode';
import { updateGbpServiceArea } from '@/lib/gbp';
import { updateBingServiceArea } from '@/lib/bing-places';

subscribeContractorOnboarded(async event => {
  if (!event.consentGranted) return;

  const suburbs = await resolveSuburbsWithinRadius(
    { lat: event.baseLocation.lat, lng: event.baseLocation.lng },
    event.radiusKm
  );

  const distanceMap = Object.fromEntries(
    suburbs.map(s => [s.suburb, s.distanceKm])
  );

  // Run GBP and Bing in parallel — neither depends on the other
  const [gbp, bing] = await Promise.all([
    updateGbpServiceArea({
      locationId: process.env.DR_GBP_LOCATION_ID!,
      sourceOfTruthJobId: event.sourceOfTruthJobId,
      contractorId: event.contractorId,
      consentGranted: event.consentGranted,
      newPlaces: suburbs.map(s => ({
        placeName: s.suburb,
        postcode: s.postcode,
      })),
      contractorBaseDistanceKmByPlace: distanceMap,
    }),
    updateBingServiceArea({
      storeId: process.env.DR_BING_PLACES_STORE_ID!,
      sourceOfTruthJobId: event.sourceOfTruthJobId,
      contractorId: event.contractorId,
      consentGranted: event.consentGranted,
      newLocalities: suburbs.map(s => ({
        name: s.suburb,
        postcode: s.postcode,
      })),
      contractorBaseDistanceKmByLocality: distanceMap,
    }),
  ]);
});
```

## Env config

| Var                               | Default | Notes                                                     |
| --------------------------------- | ------- | --------------------------------------------------------- |
| `BING_PLACES_API_KEY`             | —       | Subscription key for Bing Places API.                     |
| `DR_BING_PLACES_STORE_ID`         | —       | DR's Bing Places store identifier.                        |
| `DR_BING_PLACES_ENABLED` (caller) | —       | Recommended feature flag — caller checks before invoking. |

In tests, inject `opts.client` and `opts.audit` to avoid hitting the real API.

## Architecture notes

- **Mirror of `lib/gbp/`.** Same workflow, same DI shape, same audit pattern. The two libs are deliberately structured identically so a developer who knows one can read the other in ~30 seconds.
- **No XML pipeline yet.** Production Bing Places sync uses the Bulk Upload XML format. This client uses a JSON wrapper that the SYN-841 follow-up will swap when the auth review is done. Validation + diff + idempotency are correct; only the wire format changes.
- **Localities, not place IDs.** Bing's service-area API doesn't expose a stable opaque place ID (unlike GBP). We dedupe by case-insensitive name only.

## What this layer does NOT do

- It does NOT subscribe to events — caller wires the subscription
- It does NOT update GBP — that's `lib/gbp` (SYN-837)
- It does NOT touch Bing Webmaster sitemap submissions — that's `lib/sitemap` ping client (SYN-840)
- It does NOT touch any non-DR brand's Bing listing — single-storeId, caller controls which
