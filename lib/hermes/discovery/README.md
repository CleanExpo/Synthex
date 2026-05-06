# HERMES Discovery — H-1 Pilot Notes

This directory holds the discovery sweep that runs daily for each org with
HERMES enabled. The sweep ingests three signal types and writes them to
`hermes_discovery_signal` for the gap engine to consume.

## H-1 stubs

Two of the three signal types are stubs in H-1 and tagged `// TODO HER-2`
in code:

- **`competitor_signal`** — returns `[]`. Competitor monitoring lands in HER-2.
- **`regulatory_signal`** — returns `[]`. ACCC / ASIC feed lands in HER-2.

The **`traffic_signal`** is real but reads from a baseline that must be
manually seeded. See below.

## Traffic baseline seeding (REQUIRED before first sweep)

`HermesConfig.metadata.trafficBaseline` is a 7-day rolling array of traffic
values used to detect >30% drops. **An unseeded baseline causes the drop
check to no-op silently** — the sweep runs and writes nothing, no error,
no signal. Per Implementer Note 1 in [SYN-911](https://linear.app/unite-group/issue/SYN-911).

Seed it once per org in staging before flipping `enabled: true`:

```ts
import { prisma } from '@/lib/prisma';

await prisma.hermesConfig.update({
  where: { organizationId: ORG_ID },
  data: {
    metadata: {
      trafficBaseline: [
        { date: '2026-05-06', value: BASELINE_VALUE },
        // …7 daily entries minimum, oldest first
      ],
    },
  },
});
```

Document the baseline source per org in the HermesConfig metadata so future
audits can trace what the seed was anchored against:

```ts
metadata: {
  trafficBaseline: [...],
  trafficBaselineSource: 'GSC weekly impressions, /water-damage cluster, week ending 2026-05-04',
}
```

Without this, you cannot tell six months later whether a "30% drop" alert
came from a real production trend or a stale H-1 baseline.

## How the sweep updates the baseline

After each sweep, the latest measured value is appended to the baseline and
entries older than 7 days are dropped. This keeps the baseline a 7-day
rolling window without manual maintenance after the initial seed.

If you skip the seed step the sweep silently no-ops on the drop check —
no signal is written, no error is thrown, and the only diagnostic is that
no rows ever appear in `hermes_discovery_signal` with `signal_type='traffic_drop'`.
