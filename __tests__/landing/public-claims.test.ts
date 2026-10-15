/**
 * Claims this branch removed must not return to public copy — blocking
 * regression tripwire, source layer (SYN-1226).
 *
 * Orchestrator decision (round 5): a mechanical rule cannot establish that
 * natural-language copy is true, so the blocking guard is a tripwire, not a
 * fact-checker. It fails on:
 *  - an EXACT SEED: every claim this branch removed or neutralised and every
 *    reviewer mutant from rounds 1–5 (TRIPWIRE_SEEDS), matched in the whole
 *    normalised copy stream, so markup, joins and spacing cannot hide it;
 *  - a HIGH-PRECISION PATTERN (TRIPWIRE_PATTERNS): SOC 2, ISO 27001,
 *    GDPR/CCPA compliance, Synthex "certified", money-back, world's first,
 *    customer counts, "N% more engagement", "saves N hours", uptime %,
 *    "trusted by N" — each with zero hits in the current public copy.
 * Nothing is allow-listed: a blocking test never blesses a sentence.
 * Every other number, credential or competitor mention goes to the advisory
 * audit (npm run copy:audit) for human review.
 *
 * Same tripwire, other layers: public-claims-rendered.test.tsx (every public
 * page, every fixture state, tabs opened) and public-claims-api.test.ts
 * (every string of every same-origin API response public code reads).
 */

import { readFileSync } from 'fs';
import {
  EMPTY_SEEDS,
  NOT_CLAIMS,
  REVIEWER_MUTANTS,
  ROUND_5_REMOVED,
  ROUND_5_SEEDS,
  REMOVED_CLAIM_SEEDS,
  TRIPWIRE_PATTERNS,
  TRIPWIRE_SEEDS,
  normaliseCopy,
  publicAppFiles,
  publicSourceInventory,
  rel,
  tripwireHits,
  tripwireHitsInSource,
} from './helpers/public-claims';

const inventory = publicSourceInventory();

describe('public copy — inventory', () => {
  it.each([
    'app/compare/page.tsx',
    'app/compare/hootsuite/page.tsx',
    'app/add-ons/page.tsx',
    'app/add-ons/mcp-app-development/page.tsx',
    'app/agencies/page.tsx',
    'app/security/page.tsx',
    'components/marketing/MarketingLayout.tsx',
    'components/demo/CaptionDemo.tsx',
    'lib/remotion/help-videos.ts',
    'lib/seo/metadata.ts',
    'public/llms.txt',
    // Same-origin API route files public code references.
    'app/api/blog/[slug]/route.ts',
    'app/api/public/testimonials/[token]/route.ts',
    'app/api/collaborator/context/route.ts',
    'app/api/credential-intake/route.ts',
    'app/api/analytics/route.ts',
    'lib/clients/getClientBySlug.ts',
  ])('covers %s', file => {
    expect(inventory.map(rel)).toContain(file);
  });

  // The YouTube marketing catalogue is not bundled into public pages: they
  // play only in-app help videos (lib/remotion/help-videos.ts).
  it('does not ship the marketing video catalogue on public pages', () => {
    expect(inventory.map(rel)).not.toContain(
      'lib/remotion/educational-content.ts'
    );
  });

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
    ['no one', 'no one'],
  ])('normalises %j', (raw, expected) => {
    expect(normaliseCopy(raw)).toBe(expected);
  });
});

describe('public copy — tripwire positive controls', () => {
  it('seeds every removed claim and every reviewer mutant', () => {
    expect(TRIPWIRE_SEEDS).toEqual(
      expect.arrayContaining([
        ...REMOVED_CLAIM_SEEDS,
        ...ROUND_5_SEEDS.map(([seed]) => seed),
        ...REVIEWER_MUTANTS,
        ...ROUND_5_REMOVED,
      ])
    );
  });

  it('has no seed without plain text', () => {
    expect(EMPTY_SEEDS).toEqual([]);
  });

  it.each(TRIPWIRE_SEEDS)('catches the seed %j as text', seed => {
    expect(tripwireHits(seed).length).toBeGreaterThan(0);
  });

  // Restored into a page exactly as written, split across elements.
  it.each(TRIPWIRE_SEEDS)('catches the seed %j restored in JSX', seed => {
    const words = seed
      .replace(/<[^>]*>|\{\s*'\s*'\s*\}/g, ' ')
      .replace(/[{}<>`]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    const half = Math.ceil(words.length / 2);
    const jsx = `export const P = () => <p>${words.slice(0, half).join(' ')} <strong>${words.slice(half).join(' ')}</strong></p>;`;
    expect(tripwireHitsInSource(jsx, 'x.tsx').length).toBeGreaterThan(0);
  });

  it.each([
    ['SOC 2 claim', 'Synthex is SOC 2 Type II audited.'],
    ['ISO 27001 claim', 'Hosted under ISO 27001 controls.'],
    ['privacy-law compliance claim', 'Fully GDPR-compliant.'],
    ['privacy-law compliance claim', 'Compliant with the CCPA.'],
    ['Synthex certification claim', 'Synthex is a certified partner.'],
    ['money-back guarantee', '14-day money back promise'],
    ["world's first claim", "The world's first AI agency for florists"],
    ['customer-count claim', 'Join 2,500+ local businesses'],
    ['unsourced results claim', 'Posts get 30% more engagement.'],
    ['unsourced results claim', 'Saves 6 hours every week.'],
    ['uptime guarantee', '99.9% uptime, guaranteed.'],
    ['trusted-by count', 'Trusted by 300 agencies.'],
    ['follower-growth claim', 'From 50 to 5,000 followers'],
    ['case-study result claim', 'Case study: 70% more leads'],
    [
      'unsourced hours-per-week stat',
      'The average small business spends 6 hours',
    ],
  ])('pattern %s catches a fresh phrasing: %j', (label, text) => {
    expect(tripwireHits(text).map(h => h.rule)).toContain(label);
  });

  it('exercises every tripwire pattern above', () => {
    const tested = new Set([
      'SOC 2 claim',
      'ISO 27001 claim',
      'privacy-law compliance claim',
      'Synthex certification claim',
      'money-back guarantee',
      "world's first claim",
      'customer-count claim',
      'unsourced results claim',
      'uptime guarantee',
      'trusted-by count',
      'follower-growth claim',
      'case-study result claim',
      'unsourced hours-per-week stat',
    ]);
    expect(
      TRIPWIRE_PATTERNS.map(([label]) => label).filter(l => !tested.has(l))
    ).toEqual([]);
  });

  it.each(NOT_CLAIMS)('does not flag %j', text => {
    expect(tripwireHits(text)).toEqual([]);
  });
});

describe('public copy — source extraction', () => {
  // Copy split across literals, expressions and elements reads as one string
  // to a visitor, so the source streams must reassemble it.
  it.each([
    ["<p>{'Synthex gets 45'}{'% more engagement.'}</p>", 'x.tsx'],
    ["<p>{'Synthex gets '}{'45'}{'% more engagement.'}</p>", 'x.tsx'],
    ['<p>Join <strong>5,000+</strong> Australian businesses</p>', 'x.tsx'],
    ["const t = 'Join 5,' + '000+ Australian businesses';", 'x.ts'],
    ["const t = `Synthex gets ${'45'}% more engagement`;", 'x.ts'],
    ["const post = { title: 'Synthex gets 45% more engagement.' };", 'x.ts'],
    [
      "<Hero description={'The bakery grew by ' + '10,000 Instagram followers'} />",
      'x.tsx',
    ],
    [
      "<p>{true ? ['Synthex gets 45', '% more engagement.'].join('') : 'No links yet'}</p>",
      'x.tsx',
    ],
    [
      "<p>{links.length ? 'Links' : ['Synthex pulled in 4', '50 qualified leads'].join('')}</p>",
      'x.tsx',
    ],
    ['<p>ISO 27001 certified.</p>', 'x.tsx'],
    [
      '<PublicPageHero description="Join 5,000+ Australian businesses using Synthex." />',
      'x.tsx',
    ],
    ["const badge = { label: 'Independently audited security' };", 'x.ts'],
  ])('flags %s', (source, file) => {
    expect(tripwireHitsInSource(source, file)).not.toEqual([]);
  });

  it('ignores comments, which never reach a visitor', () => {
    expect(
      tripwireHitsInSource(
        '// Synthex gets 45% more engagement.\nconst a = 1;',
        'x.ts'
      )
    ).toEqual([]);
  });

  it('ignores AI prompt text, which is sent to a model, not served', () => {
    expect(
      tripwireHitsInSource(
        "const r = { messages: [{ role: 'user', content: 'Example: Synthex gets 45% more engagement.' }] };",
        'x.ts'
      )
    ).toEqual([]);
  });
});

describe('public copy — removed claims (source)', () => {
  it('no public file carries a removed claim or a banned pattern', () => {
    const hits = inventory.flatMap(file =>
      tripwireHitsInSource(readFileSync(file, 'utf8'), file).map(
        hit =>
          `${rel(file)}:${hit.line ?? '?'}: ${hit.rule} — "${hit.sentence}"`
      )
    );
    expect(hits).toEqual([]);
  });
});
