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
import { ALLOW_LIST, allowKeys } from './helpers/public-claims-allowlist';
import {
  BANNED_CLAIMS,
  NOT_CLAIMS,
  claimHitsInSource,
  REMOVED_CLAIM_SEEDS,
  findClaims,
  findClaimsInSource,
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
    // Same-origin API routes public pages fetch, and what those routes import.
    'app/api/blog/[slug]/route.ts',
    'app/api/public/testimonials/[token]/route.ts',
    'app/api/collaborator/context/route.ts',
    'app/api/credential-intake/route.ts',
    'lib/clients/getClientBySlug.ts',
  ])('covers %s', file => {
    expect(inventory.map(rel)).toContain(file);
  });

  // Seeds are routes the proxy serves without auth. Files they import are
  // public by reach even when they live under app/dashboard (e.g. the
  // /vision-board-preview panels), so the closure is not filtered.
  // API routes enter only by reference from public code, never as seeds.
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

  it.each(NOT_CLAIMS)('does not flag %j', text => {
    expect(findClaims(text)).toEqual([]);
  });

  // False-positive probe: neutral product copy with a number is still a
  // finding, and passes only through an explicit allow-list entry.
  it('passes neutral product copy with a number only via the allow-list', () => {
    const probe = 'Up to 3 users on Starter';
    expect(findClaims(probe)).not.toEqual([]);
    expect(findClaims(probe, new Set(['upto3usersonstarter']))).toEqual([]);
  });

  it('allow-lists only with an approved reason and a note', () => {
    const reasons = new Set([
      'advice',
      'definition',
      'formula',
      'target',
      'product-ui',
    ]);
    expect(ALLOW_LIST.filter(e => !reasons.has(e.reason))).toEqual([]);
    expect(ALLOW_LIST.filter(e => !e.note || !e.sentence)).toEqual([]);
  });

  it('every pattern is exercised by at least one seed', () => {
    const unused = BANNED_CLAIMS.filter(
      ([, pattern]) =>
        !REMOVED_CLAIM_SEEDS.some(s => pattern.test(normaliseCopy(s)))
    ).map(([label]) => label);
    expect(unused).toEqual([]);
  });
});

describe('public copy — source extraction', () => {
  // Copy split across literals, expressions and elements reads as one string
  // to a visitor, so the source check must reassemble it the same way.
  it.each([
    ["<p>{'Synthex gets 45'}{'% more engagement.'}</p>", 'x.tsx'],
    ["<p>{'Synthex gets '}{'45'}{'% more engagement.'}</p>", 'x.tsx'],
    ['<p>Join <strong>5,000+</strong> Australian businesses</p>', 'x.tsx'],
    ["const t = 'Join 5,' + '000+ Australian businesses';", 'x.ts'],
    ["const t = `Synthex gets ${'45'}% more engagement`;", 'x.ts'],
    ["const post = { title: 'Synthex gets 45% more engagement.' };", 'x.ts'],
    [
      "<Hero description={'The bakery grew by ' + '10,000 followers'} />",
      'x.tsx',
    ],
    // Round-4 review mutant: a claim joined from an array in a ternary arm.
    [
      "<p>{true ? ['Synthex gets 45', '% more engagement.'].join('') : 'No links yet'}</p>",
      'x.tsx',
    ],
    // …and the other arm of a non-literal condition.
    [
      "<p>{links.length ? 'Links' : ['We pulled in 4', '50 leads'].join('')}</p>",
      'x.tsx',
    ],
  ])('flags %s', (source, file) => {
    expect(findClaimsInSource(source, file)).not.toEqual([]);
  });

  it('ignores comments, which never reach a visitor', () => {
    expect(
      findClaimsInSource('// grew by 10,000 followers\nconst a = 1;', 'x.ts')
    ).toEqual([]);
  });
});

describe('public copy — unsupported claims (source)', () => {
  const allow = allowKeys('source');
  const used = new Set<string>();

  it('no public page or anything it imports carries a banned claim', () => {
    const hits = inventory.flatMap(file =>
      claimHitsInSource(readFileSync(file, 'utf8'), file, new Set()).flatMap(
        hit => {
          const key = hit.sentence.replace(/\s+/g, '');
          if (hit.rule === 'quantified outcome' && allow.has(key)) {
            used.add(key);
            return [];
          }
          return [`${rel(file)}: ${hit.rule} — "${hit.sentence}"`];
        }
      )
    );
    expect(hits).toEqual([]);
  });

  // Every source allow-list entry must still be needed.
  it('has no stale source allow-list entries', () => {
    expect([...allow].filter(k => !used.has(k))).toEqual([]);
  });
});
