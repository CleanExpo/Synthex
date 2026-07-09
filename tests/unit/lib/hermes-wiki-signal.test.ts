/**
 * Wiki-signal source tests (Flywheel C1).
 *
 * Pins the parsing, brand→org mapping, and hash-dedup rules that decide which
 * Brain-1 wiki intelligence reaches the Hermes gap engine. Failures here mean
 * signals silently duplicate (draft spam) or silently vanish (starved engine).
 */

import { describe, it, expect } from '@jest/globals';
import {
  BRAND_TO_ORG_SLUG,
  buildWikiSignals,
  parseSignalBullets,
  parseSignalPageName,
  wikiSignalHash,
  type WikiPageContent,
} from '@/lib/hermes/discovery/wiki-signal';

const SAMPLE_PAGE = `---
type: wiki
updated: 2026-07-09
---

# CARSI source signals — 2026-07-05 → 2026-07-09 ingest

Intro line that is not a signal.

## Training market
- **~$13M in US grants for worker safety & health training** (Cleanfax, 2026-07-07) —
  funding tailwind for safety-training providers; watch for an AU equivalent.
- Short.
- I-CAR published a facility & equipment best-practice standard for collision repair
  (2026-07-09) — see https://collisionweek.com/example for detail.

## Compliance watch
- No IICRC-specific items in this sweep; posture tracked in machine memory (GP-498).
`;

describe('parseSignalPageName', () => {
  it('parses brand and date from signal pages', () => {
    expect(parseSignalPageName('signals-carsi-2026-07-09.md')).toEqual({
      path: 'Wiki/sources/signals-carsi-2026-07-09.md',
      brand: 'carsi',
      date: '2026-07-09',
    });
    expect(
      parseSignalPageName('signals-synthex-seo-2026-07-09.md')?.brand
    ).toBe('synthex-seo');
  });

  it('rejects catalogs and non-signal pages', () => {
    expect(parseSignalPageName('catalog-2026-07b.md')).toBeNull();
    expect(parseSignalPageName('signals-carsi.md')).toBeNull();
  });
});

describe('parseSignalBullets', () => {
  const bullets = parseSignalBullets(SAMPLE_PAGE);

  it('extracts multi-line bullets with their heading context', () => {
    expect(bullets).toHaveLength(3);
    expect(bullets[0].heading).toBe('Training market');
    expect(bullets[0].text).toContain('$13M in US grants');
    expect(bullets[0].text).toContain('AU equivalent');
  });

  it('captures source URLs and drops sub-20-char noise bullets', () => {
    expect(bullets[1].sourceUrl).toBe('https://collisionweek.com/example');
    expect(bullets.map(b => b.text)).not.toContain('Short.');
  });

  it('keeps signals from later headings', () => {
    expect(bullets[2].heading).toBe('Compliance watch');
  });
});

describe('buildWikiSignals', () => {
  const page: WikiPageContent = {
    path: 'Wiki/sources/signals-carsi-2026-07-09.md',
    brand: 'carsi',
    date: '2026-07-09',
    markdown: SAMPLE_PAGE,
  };

  it('maps brand pages to the owning org only', () => {
    const forCarsi = buildWikiSignals({
      organizationId: 'org-1',
      orgSlug: 'carsi',
      pages: [page],
      existingHashes: new Set(),
    });
    const forSynthex = buildWikiSignals({
      organizationId: 'org-2',
      orgSlug: 'synthex',
      pages: [page],
      existingHashes: new Set(),
    });
    expect(forCarsi).toHaveLength(3);
    expect(forSynthex).toHaveLength(0);
    expect(forCarsi[0].signalType).toBe('wiki_signal');
    expect(forCarsi[0].severity).toBe('routine');
  });

  it('deduplicates against existing hashes — an unchanged wiki writes nothing', () => {
    const seen = new Set<string>();
    const first = buildWikiSignals({
      organizationId: 'org-1',
      orgSlug: 'carsi',
      pages: [page],
      existingHashes: seen,
    });
    const second = buildWikiSignals({
      organizationId: 'org-1',
      orgSlug: 'carsi',
      pages: [page],
      existingHashes: seen,
    });
    expect(first).toHaveLength(3);
    expect(second).toHaveLength(0);
  });

  it('hashes are org-scoped so two brands can carry the same text', () => {
    expect(wikiSignalHash('org-1', 'same text')).not.toBe(
      wikiSignalHash('org-2', 'same text')
    );
  });

  it('estate-wide pages (unite-group, ai-tooling) map to no org', () => {
    expect(BRAND_TO_ORG_SLUG['unite-group']).toBeNull();
    expect(BRAND_TO_ORG_SLUG['ai-tooling']).toBeNull();
  });
});
