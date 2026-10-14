/**
 * Unsupported marketing claims must not return to public copy — source check.
 *
 * None of these is backed by anything in the repo: there is no customer count
 * behind "5,000+ businesses", no refund policy behind a "money-back guarantee",
 * and nothing that substantiates "world's first fully autonomous". /case-studies
 * itself says case studies are still being prepared. Copy that states them on a
 * public page is an Australian Consumer Law exposure.
 *
 * Two layers, sharing one inventory, normaliser and pattern set
 * (helpers/public-claims.ts):
 *  - this file scans the normalised SOURCE of every public file and everything
 *    it imports, which also covers copy that only renders after interaction
 *    (dynamic imports, effects, other video ids in a catalogue);
 *  - public-claims-rendered.test.tsx renders every public page and scans the
 *    markup a visitor gets, which catches copy composed at runtime
 *    ('Join 5,' + '000+ …').
 */

import { readFileSync } from 'fs';
import {
  BANNED_CLAIMS,
  REMOVED_CLAIM_SEEDS,
  findClaims,
  normaliseCopy,
  publicAppFiles,
  publicSourceInventory,
  rel,
} from './helpers/public-claims';

const inventory = publicSourceInventory();

describe('public copy — inventory', () => {
  it.each([
    'app/compare/page.tsx',
    'app/compare/hootsuite/page.tsx',
    'app/add-ons/page.tsx',
    'app/add-ons/mcp-app-development/page.tsx',
    'app/agencies/page.tsx',
    'app/dashboard/admin/vision-board/ra-launch-2026-05/panels/CopyPanel.tsx',
    'components/marketing/MarketingLayout.tsx',
    'components/demo/CaptionDemo.tsx',
    'lib/remotion/educational-content.ts',
    'lib/seo/metadata.ts',
    'public/llms.txt',
  ])('covers %s', file => {
    expect(inventory.map(rel)).toContain(file);
  });

  // Seeds are routes the proxy serves without auth. Files they import are
  // public by reach even when they live under app/dashboard (e.g. the
  // /vision-board-preview panels), so the closure is not filtered.
  it('seeds no API route or auth-protected route', () => {
    const stray = publicAppFiles()
      .map(rel)
      .filter(f =>
        /^app\/(\([^/]+\)\/)*(api|dashboard|onboarding|admin)\//.test(f)
      );
    expect(stray).toEqual([]);
  });
});

describe('public copy — normalisation', () => {
  it.each([
    ['Five thousand business owners', '5000 business owners'],
    ['twenty-five hours', '25 hours'],
    ['ten', '10'],
    ['5,000+ businesses', '5000+ businesses'],
    ['1,000,000 users', '1000000 users'],
    ['The world&#x27;s FIRST', "the world's first"],
    ['world’s   first', "world's first"],
    ['Join 5&#44;000+', 'join 5000+'],
    ['Grew to 10K followers', 'grew to 10000 followers'],
    ['6.9× more', '6.9x more'],
    ['six point nine times', '6.9 times'],
  ])('normalises %j', (raw, expected) => {
    expect(normaliseCopy(raw)).toBe(expected);
  });

  it.each(REMOVED_CLAIM_SEEDS)('catches the removed claim %j', seed => {
    expect(findClaims(seed)).not.toEqual([]);
  });

  it('every pattern is exercised by at least one seed', () => {
    const unused = BANNED_CLAIMS.filter(
      ([, pattern]) =>
        !REMOVED_CLAIM_SEEDS.some(s => pattern.test(normaliseCopy(s)))
    ).map(([label]) => label);
    expect(unused).toEqual([]);
  });
});

describe('public copy — unsupported claims (source)', () => {
  it('no public page or anything it imports carries a banned claim', () => {
    const hits = inventory.flatMap(file =>
      findClaims(readFileSync(file, 'utf8')).map(hit => `${rel(file)}: ${hit}`)
    );
    expect(hits).toEqual([]);
  });
});
