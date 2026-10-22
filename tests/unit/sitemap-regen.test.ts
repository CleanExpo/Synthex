/**
 * Unit tests for lib/sitemap/
 *
 * Covers:
 *  - slugifySuburb: normalisation, punctuation, whitespace, edge cases
 *  - buildLandingPageUrl: shape + base override + trailing-slash handling
 *  - parseSitemap / buildSitemap: round-trip + sort + entity escape
 *  - regenerateSitemapForLocations: validation, idempotency, dedupe-within-batch,
 *    custom changefreq/priority/now, lastmod NOT updated for existing entries
 *  - pingSearchEngine / pingAllSearchEngines: the Google and Bing sitemap
 *    ping endpoints are retired, so no request is sent and every result says
 *    so (pinged=false, retired=true) and names the replacement routes.
 *    SEAM: the exported ping functions plus a scan of the ping-client source.
 *    Catches: a retired ping URL reintroduced, a fake pinged=true. Misses:
 *    whether the replacement routes ran (their own tests cover that).
 *
 * @see SYN-840 (parent: SYN-834 epic)
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
  slugifySuburb,
  buildLandingPageUrl,
  parseSitemap,
  buildSitemap,
  regenerateSitemapForLocations,
  pingSearchEngine,
  pingAllSearchEngines,
} from '@/lib/sitemap';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { LocationOpenedEvent } from '@/lib/sitemap/types';

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

function eventFor(
  suburb: string,
  serviceCategory: 'water-damage' | 'fire' | 'mould' = 'water-damage',
  overrides: Partial<LocationOpenedEvent> = {}
): LocationOpenedEvent {
  return {
    sourceOfTruthJobId: 'job_abc',
    serviceAreaCoverageId: `cov_${suburb}`,
    suburb,
    postcode: '4000',
    serviceCategory,
    openedAt: '2026-04-29T00:00:00Z',
    ...overrides,
  };
}

describe('slugifySuburb', () => {
  it.each([
    ['Brisbane CBD', 'brisbane-cbd'],
    ['Mount Cotton', 'mount-cotton'],
    ['St. Lucia', 'st-lucia'],
    ['  Spring   Hill  ', 'spring-hill'],
    ['Carindale', 'carindale'],
    ["O'Connor", 'o-connor'],
    ['Twin-Waters', 'twin-waters'],
  ])('slugifies %s → %s', (input, expected) => {
    expect(slugifySuburb(input)).toBe(expected);
  });

  it('throws on empty string', () => {
    expect(() => slugifySuburb('')).toThrow(/non-empty string/);
  });

  it('throws on non-string', () => {
    // @ts-expect-error — deliberately invalid
    expect(() => slugifySuburb(null)).toThrow(/non-empty string/);
  });
});

describe('buildLandingPageUrl', () => {
  it('builds canonical URL with default base', () => {
    expect(buildLandingPageUrl('water-damage', 'Brisbane CBD')).toBe(
      'https://disasterrecovery.com.au/water-damage/brisbane-cbd/'
    );
  });

  it('honours base URL override', () => {
    expect(
      buildLandingPageUrl('fire', 'Mount Cotton', 'https://staging.example.com')
    ).toBe('https://staging.example.com/fire/mount-cotton/');
  });

  it('strips trailing slashes from base URL', () => {
    expect(
      buildLandingPageUrl('mould', 'Spring Hill', 'https://example.com///')
    ).toBe('https://example.com/mould/spring-hill/');
  });

  it('throws when suburb slugifies to empty', () => {
    expect(() => buildLandingPageUrl('water-damage', '   ')).toThrow();
  });
});

describe('xml parser + serialiser', () => {
  it('round-trips a minimal urlset', () => {
    const xml = buildSitemap([
      { loc: 'https://example.com/a/', lastmod: '2026-04-29T00:00:00.000Z' },
      {
        loc: 'https://example.com/b/',
        lastmod: '2026-04-29T00:00:00.000Z',
        changefreq: 'monthly',
        priority: 0.6,
      },
    ]);
    const parsed = parseSitemap(xml);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].loc).toBe('https://example.com/a/');
    expect(parsed[1].changefreq).toBe('monthly');
    expect(parsed[1].priority).toBe(0.6);
  });

  it('parseSitemap returns empty for empty input', () => {
    expect(parseSitemap('')).toEqual([]);
    expect(parseSitemap('<urlset></urlset>')).toEqual([]);
  });

  it('serialiser sorts entries by loc ascending', () => {
    const xml = buildSitemap([
      {
        loc: 'https://example.com/zebra/',
        lastmod: '2026-04-29T00:00:00.000Z',
      },
      {
        loc: 'https://example.com/apple/',
        lastmod: '2026-04-29T00:00:00.000Z',
      },
      {
        loc: 'https://example.com/mango/',
        lastmod: '2026-04-29T00:00:00.000Z',
      },
    ]);
    const parsed = parseSitemap(xml);
    expect(parsed.map(u => u.loc)).toEqual([
      'https://example.com/apple/',
      'https://example.com/mango/',
      'https://example.com/zebra/',
    ]);
  });

  it('encodes XML entities on serialise and decodes on parse', () => {
    const xml = buildSitemap([
      {
        loc: 'https://example.com/a?x=1&y=2',
        lastmod: '2026-04-29T00:00:00.000Z',
      },
    ]);
    expect(xml).toContain('x=1&amp;y=2');
    const parsed = parseSitemap(xml);
    expect(parsed[0].loc).toBe('https://example.com/a?x=1&y=2');
  });

  it('skips <url> blocks missing <loc>', () => {
    const xml = `<urlset>
  <url><lastmod>2026-04-29</lastmod></url>
  <url><loc>https://example.com/ok/</loc><lastmod>2026-04-29</lastmod></url>
</urlset>`;
    const parsed = parseSitemap(xml);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].loc).toBe('https://example.com/ok/');
  });
});

describe('regenerateSitemapForLocations — validation', () => {
  it('throws when events is not an array', () => {
    expect(() =>
      // @ts-expect-error — deliberately invalid
      regenerateSitemapForLocations('', null)
    ).toThrow(/must be an array/);
  });

  it('throws on missing sourceOfTruthJobId (Q3.2.4 H8)', () => {
    expect(() =>
      regenerateSitemapForLocations(
        '',
        // @ts-expect-error — deliberately invalid
        [{ ...eventFor('A'), sourceOfTruthJobId: '' }]
      )
    ).toThrow(/sourceOfTruthJobId required/);
  });

  it('throws on missing serviceAreaCoverageId', () => {
    expect(() =>
      regenerateSitemapForLocations(
        '',
        // @ts-expect-error — deliberately invalid
        [{ ...eventFor('A'), serviceAreaCoverageId: '' }]
      )
    ).toThrow(/serviceAreaCoverageId required/);
  });

  it('throws on missing suburb', () => {
    expect(() =>
      regenerateSitemapForLocations(
        '',
        // @ts-expect-error — deliberately invalid
        [{ ...eventFor('A'), suburb: '' }]
      )
    ).toThrow(/suburb required/);
  });

  it('throws on invalid serviceCategory', () => {
    expect(() =>
      regenerateSitemapForLocations(
        '',
        // @ts-expect-error — deliberately invalid
        [{ ...eventFor('A'), serviceCategory: 'asbestos' }]
      )
    ).toThrow(/serviceCategory must be water-damage, fire, or mould/);
  });
});

describe('regenerateSitemapForLocations — merge behaviour', () => {
  const fixedNow = () => new Date('2026-04-29T10:00:00.000Z');

  it('appends URLs to an empty sitemap', () => {
    const result = regenerateSitemapForLocations(
      '',
      [eventFor('Brisbane CBD')],
      {
        now: fixedNow,
      }
    );
    expect(result.added).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
    expect(result.totalUrls).toBe(1);
    expect(result.added[0].loc).toBe(
      'https://disasterrecovery.com.au/water-damage/brisbane-cbd/'
    );
    expect(result.added[0].lastmod).toBe('2026-04-29T10:00:00.000Z');
    expect(result.added[0].changefreq).toBe('monthly');
    expect(result.added[0].priority).toBe(0.6);
  });

  it('is idempotent — re-running same event does not add', () => {
    const first = regenerateSitemapForLocations('', [eventFor('Carindale')], {
      now: fixedNow,
    });
    const second = regenerateSitemapForLocations(
      first.xml,
      [eventFor('Carindale')],
      {
        now: fixedNow,
      }
    );
    expect(second.added).toHaveLength(0);
    expect(second.skipped).toHaveLength(1);
    expect(second.totalUrls).toBe(1);
  });

  it('does NOT update lastmod for existing entries', () => {
    const first = regenerateSitemapForLocations('', [eventFor('Carindale')], {
      now: () => new Date('2026-04-01T00:00:00.000Z'),
    });
    const second = regenerateSitemapForLocations(
      first.xml,
      [eventFor('Carindale')],
      {
        now: () => new Date('2026-04-29T10:00:00.000Z'),
      }
    );
    expect(second.skipped[0].lastmod).toBe('2026-04-01T00:00:00.000Z');
  });

  it('dedupes within a single batch', () => {
    const result = regenerateSitemapForLocations(
      '',
      [eventFor('Carindale'), eventFor('Carindale')],
      { now: fixedNow }
    );
    expect(result.added).toHaveLength(1);
  });

  it('treats different service categories as different URLs', () => {
    const result = regenerateSitemapForLocations(
      '',
      [
        eventFor('Carindale', 'water-damage'),
        eventFor('Carindale', 'fire'),
        eventFor('Carindale', 'mould'),
      ],
      { now: fixedNow }
    );
    expect(result.added).toHaveLength(3);
  });

  it('honours custom baseUrl', () => {
    const result = regenerateSitemapForLocations('', [eventFor('Carindale')], {
      baseUrl: 'https://staging.example.com/',
      now: fixedNow,
    });
    expect(result.added[0].loc).toBe(
      'https://staging.example.com/water-damage/carindale/'
    );
  });

  it('honours custom changefreq + priority', () => {
    const result = regenerateSitemapForLocations('', [eventFor('Carindale')], {
      changefreq: 'weekly',
      priority: 0.9,
      now: fixedNow,
    });
    expect(result.added[0].changefreq).toBe('weekly');
    expect(result.added[0].priority).toBe(0.9);
  });

  it('preserves pre-existing entries from currentXml', () => {
    const seed = buildSitemap([
      {
        loc: 'https://disasterrecovery.com.au/about/',
        lastmod: '2026-01-01T00:00:00.000Z',
      },
    ]);
    const result = regenerateSitemapForLocations(
      seed,
      [eventFor('Carindale')],
      {
        now: fixedNow,
      }
    );
    expect(result.totalUrls).toBe(2);
    const parsed = parseSitemap(result.xml);
    expect(parsed.map(u => u.loc).sort()).toEqual([
      'https://disasterrecovery.com.au/about/',
      'https://disasterrecovery.com.au/water-damage/carindale/',
    ]);
  });
});

/** Fails if a source text contains a retired sitemap ping endpoint. */
function checkNoRetiredPingUrl(source: string): void {
  const hit = source.match(/(?:google|bing)\.com\/ping\?sitemap=/);
  if (hit) throw new Error(`retired ping endpoint present: ${hit[0]}`);
}

describe('pingSearchEngine (retired endpoints)', () => {
  it.each(['google', 'bing'] as const)(
    'sends nothing to %s and reports the ping as retired',
    async target => {
      const fetchImpl = jest.fn(async () => ({ status: 200 }) as Response);
      const result = await pingSearchEngine(
        target,
        'https://disasterrecovery.com.au/sitemap.xml',
        { fetchImpl: fetchImpl as unknown as typeof fetch }
      );
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(result.pinged).toBe(false);
      expect(result.retired).toBe(true);
      expect(result.status).toBeUndefined();
    }
  );

  it('names the replacement routes in the reason', async () => {
    const result = await pingSearchEngine('bing', 'https://e.com/s.xml');
    expect(result.reason).toMatch(/Search Console/);
    expect(result.reason).toMatch(/IndexNow/);
    expect(result.reason).toMatch(/SubmitFeed/);
  });

  it('the ping client source holds no retired endpoint', () => {
    const source = readFileSync(
      join(process.cwd(), 'lib/sitemap/ping-client.ts'),
      'utf8'
    );
    expect(() => checkNoRetiredPingUrl(source)).not.toThrow();
  });

  it('retired ping URL reintroduced (control: planted failure is caught)', () => {
    const planted =
      'return `https://www.google.com/ping?sitemap=${encoded}`; // reintroduced';
    expect(() => checkNoRetiredPingUrl(planted)).toThrow(/retired/);
  });
});

describe('pingAllSearchEngines (retired endpoints)', () => {
  it('returns one retired result per target and sends nothing', async () => {
    const fetchImpl = jest.fn(async () => ({ status: 200 }) as Response);
    const results = await pingAllSearchEngines('https://e.com/s.xml', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(results.map(r => r.target).sort()).toEqual(['bing', 'google']);
    expect(results.every(r => r.pinged === false && r.retired === true)).toBe(
      true
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('honours targets override', async () => {
    const results = await pingAllSearchEngines('https://e.com/s.xml', {
      targets: ['bing'],
    });
    expect(results).toHaveLength(1);
    expect(results[0].target).toBe('bing');
  });
});
