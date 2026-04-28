# `lib/sitemap/` — Per-Suburb Sitemap Regeneration

Keeps `disasterrecovery.com.au/sitemap.xml` in sync with newly-generated per-suburb landing pages so AI crawlers + Bing/Google can discover them. Foundation primitive for SYN-840 in the SYN-834 NRPG → DR pipeline.

**Linear:** SYN-840 (parent: SYN-834 epic)
**Owners:** `seo-sitemap` + `marketing-operations-director`

---

## Files

| File               | Purpose                                                                       |
| ------------------ | ----------------------------------------------------------------------------- |
| `types.ts`         | `LocationOpenedEvent` · `SitemapUrl` · `SitemapRegenResult` · `PingResult`    |
| `url-builder.ts`   | `slugifySuburb` · `buildLandingPageUrl` · `urlForEvent`                       |
| `xml.ts`           | Pure W3C urlset parser + serialiser (no external XML lib, no XXE surface)     |
| `sitemap-regen.ts` | `regenerateSitemapForLocations(currentXml, events, opts?)` — idempotent merge |
| `ping-client.ts`   | `pingSearchEngine` / `pingAllSearchEngines` — 1/hour rate-limited per target  |
| `index.ts`         | Public re-exports                                                             |

## Hard rules (binding behaviour)

1. **Idempotent on `loc`** — re-running with the same events does not duplicate URLs. `lastmod` is NOT updated for existing entries.
2. **Source-of-truth job ID required** on every event (Q3.2.4 H8). Throws otherwise.
3. **Service category must be `water-damage`, `fire`, or `mould`.** Mirrors SYN-838 page-generator scope.
4. **Sorted output** — entries serialised in ascending `loc` order so git diffs stay readable.
5. **Ping rate limit: 1/hour per target.** In-memory counter per Node process. For multi-instance fan-out, replace with Redis counter.
6. **No file I/O.** This module returns the new XML string; the caller writes the file and opens the cross-repo PR.

## Usage

### Regen + ping (typical cron flow)

```ts
import {
  regenerateSitemapForLocations,
  pingAllSearchEngines,
} from '@/lib/sitemap';

const currentXml = await readSitemapFromDisk();
const events = await drainLocationOpenedQueue();

const result = regenerateSitemapForLocations(currentXml, events);
// → { xml, added: SitemapUrl[], skipped: SitemapUrl[], totalUrls: number }

if (result.added.length > 0) {
  await writeSitemapToDisk(result.xml);
  await commitToDisasterRecoveryRepo({ files: ['sitemap.xml'] });

  const pings = await pingAllSearchEngines(
    'https://disasterrecovery.com.au/sitemap.xml'
  );
  // pings: PingResult[] — one per target, may be { pinged:false, reason:'rate-limited ...' }
}
```

### Build a URL for a single (service × suburb)

```ts
import { buildLandingPageUrl, slugifySuburb } from '@/lib/sitemap';

const slug = slugifySuburb('Brisbane CBD');
// → 'brisbane-cbd'

const url = buildLandingPageUrl('water-damage', 'Mount Cotton');
// → 'https://disasterrecovery.com.au/water-damage/mount-cotton/'
```

### Override defaults (for staging or per-call testing)

```ts
const result = regenerateSitemapForLocations(currentXml, events, {
  baseUrl: 'https://staging.disasterrecovery.com.au',
  changefreq: 'weekly',
  priority: 0.8,
  now: () => new Date('2026-04-29T00:00:00Z'), // deterministic lastmod
});
```

## Architecture notes

- **No external XML library.** sitemap.org spec is small enough that a regex parser is safer (no XXE attack surface, no transitive churn). Trade-off: we don't preserve unknown extension elements (e.g. `image:image`) on round-trip. Acceptable since DR's sitemap only uses core urlset fields.
- **Single sitemap only.** No sitemap-index support. Revisit when DR exceeds 50,000 URLs.
- **In-memory ping rate limit.** Per-process counter. For multi-instance deploys this is best-effort — each Node process tracks its own. Acceptable for a daily cron; revisit with Redis if SYN-834 grows multiple workers regenerating in parallel.
- **Pure regen function.** No file I/O. Caller controls when/where to write — keeps cross-repo deploy concerns out of this module.

## What this layer does NOT do

- It does NOT write `sitemap.xml` to disk — caller does that
- It does NOT open the cross-repo PR to disasterrecovery.com.au — caller does that
- It does NOT subscribe to events — wiring lives in the caller (will be SYN-838 page-generator's downstream worker)
- It does NOT support sitemap-index — single urlset only
