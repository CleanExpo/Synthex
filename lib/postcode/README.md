# `lib/postcode/` — AU Postcode / Suburb Resolver

Foundation primitive for SYN-834 NRPG → DR dynamic service-area expansion. Given a contractor base location + GEO km radius, returns the list of AU suburbs/postcodes within range (Haversine, sphere).

**Linear:** SYN-835 (parent: SYN-834 epic)
**Owners:** `code-architect` + `marketing-operations-director`
**Foundation authority:** none — pure utility, no auth, no PII

---

## Files

| File                    | Purpose                                                                    |
| ----------------------- | -------------------------------------------------------------------------- |
| `types.ts`              | `BaseLocation` · `SuburbHit` · `ResolveOptions` · `PostcodeDatasetRow`     |
| `haversine.ts`          | Pure great-circle distance function                                        |
| `dataset-loader.ts`     | Lazy CSV load + cached singleton + parser                                  |
| `postcode-resolver.ts`  | Main `resolveSuburbsWithinRadius()` function                               |
| `index.ts`              | Public re-exports                                                          |
| `data/au-postcodes.csv` | AU postcode dataset (Matthew Proctor, MIT licence — see attribution below) |

## Usage

```ts
import { resolveSuburbsWithinRadius } from '@/lib/postcode';

// Brisbane CBD base, 20 km radius
const suburbs = await resolveSuburbsWithinRadius(
  { lat: -27.4705, lng: 153.026 },
  20
);

// suburbs is sorted by distance ascending
console.log(suburbs.length, 'suburbs covered');
console.log(suburbs[0]); // closest
// → { postcode: '4000', suburb: 'Brisbane City', state: 'QLD',
//     lat: -27.4675, lng: 153.0291, distanceFromBaseKm: 0.42 }
```

### Options

```ts
// Restrict to QLD only (faster — skips other states)
const qldOnly = await resolveSuburbsWithinRadius(
  { lat: -27.4705, lng: 153.026 },
  50,
  { states: ['QLD'] }
);

// Inject a custom dataset (for tests)
const fixture = [
  {
    postcode: '4000',
    suburb: 'Brisbane',
    state: 'QLD',
    lat: -27.47,
    lng: 153.02,
  },
];
const result = await resolveSuburbsWithinRadius(
  { lat: -27.4705, lng: 153.026 },
  20,
  { dataset: fixture }
);
```

### Synchronous variant

For callers that have already loaded the dataset (e.g. via a startup hook):

```ts
import { loadDataset, resolveSuburbsWithinRadiusSync } from '@/lib/postcode';

const dataset = await loadDataset();
// ... later, in a hot path ...
const suburbs = resolveSuburbsWithinRadiusSync(
  { lat: -27.4705, lng: 153.026 },
  20,
  { dataset }
);
```

## Performance

- O(N) scan across the dataset (~18.5k rows after filtering 0,0 sentinels)
- Measured < 30 ms on Node 22 for typical 20 km radius queries
- First call pays the CSV load + parse cost (~50 ms one-time)
- Subsequent calls use the cached in-memory array

## Hard rules (binding behaviour)

1. **Radius cap: 200 km.** Sanity guard against accidental global resolves. Throws if exceeded.
2. **Coordinate validation.** lat ∈ [-90, 90], lng ∈ [-180, 180], finite. Throws otherwise.
3. **Skips (0, 0) sentinel rows** — the dataset has many geocoding-failed rows at the equator. They're not real AU suburbs.
4. **Cached singleton.** First call loads + parses; subsequent calls return the cached array. Use `_resetDatasetCacheForTests()` between test cases.
5. **No JS-bundle inclusion.** The 8.4 MB CSV lives at `lib/postcode/data/au-postcodes.csv` and is loaded via `fs.readFile` lazily. It does NOT enter the Webpack/Turbopack bundle. (For Vercel deploys, the file is included in the function bundle via Next's static-asset handling — no additional config needed.)

## Dataset attribution

`data/au-postcodes.csv` is sourced from [matthewproctor/australianpostcodes](https://github.com/matthewproctor/australianpostcodes) (MIT licence).

> Copyright (c) 2017 Matthew Proctor
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction…

Refresh quarterly (or whenever Australia Post publishes updates) by running:

```bash
curl -sL https://raw.githubusercontent.com/matthewproctor/australianpostcodes/master/australian_postcodes.csv \
  -o lib/postcode/data/au-postcodes.csv
```

## Foundation hooks (called by SYN-834 children)

- **SYN-NRPG-DR-3** (DR GBP service-area update worker) → calls `resolveSuburbsWithinRadius()` to get the full coverage list per onboarding event
- **SYN-NRPG-DR-4** (per-suburb landing-page generator) → iterates the result list to generate one page per (service × suburb)
- **SYN-NRPG-DR-5** (per-location budget ledger) → uses `result.length × $55` to compute the monthly commitment
- **SYN-NRPG-DR-6** (sitemap regen) → registers each new suburb in the sitemap
- **SYN-NRPG-DR-7** (Bing Places sync) → mirrors the GBP coverage update
- **SYN-NRPG-DR-8** (per-location KPI) → registers each new location in attribution tracking
