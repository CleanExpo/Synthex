/**
 * Unsupported marketing claims must not return to public copy — source check.
 *
 * Deny by default (SYN-1226, round 5). Two classes, no vocabulary of outcomes:
 *  - NUMBER: every quantity in public copy is a finding;
 *  - CREDENTIAL: certification, compliance, endorsement and superlative
 *    terms are findings, with or without a number.
 * A finding passes only through an allow-list entry whose kind the guard
 * checks mechanically (helpers/public-claims-allowlist.ts → checkEntry).
 *
 * Layers, sharing one normaliser and rule set (helpers/public-claims.ts):
 *  - this file: the copy streams of every public file (UI code reachable
 *    from public routes, plus the API route files they reference);
 *  - public-claims-rendered.test.tsx: every public page, rendered in every
 *    fixture state with tabs and accordions opened;
 *  - public-claims-api.test.ts: every string field of every same-origin API
 *    response public code reads, whatever UI state would show it.
 */

import { readFileSync } from 'fs';
import {
  ALLOW_LIST,
  allowIndex,
  checkEntry,
  type AllowEntry,
} from './helpers/public-claims-allowlist';
import {
  NOT_CLAIMS,
  REMOVED_CLAIM_SEEDS,
  ROUND_5_SEEDS,
  claimHits,
  claimHitsInSource,
  findClaims,
  findClaimsInSource,
  normaliseCopy,
  publicAppFiles,
  publicSourceInventory,
  rel,
  sentenceKey,
  type AllowIndex,
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

describe('public copy — positive controls', () => {
  it.each(REMOVED_CLAIM_SEEDS)('catches the removed claim %j', seed => {
    expect(findClaims(seed)).not.toEqual([]);
  });

  it.each(ROUND_5_SEEDS)('catches %j as a %s finding', (seed, rule) => {
    expect(claimHits(seed).map(h => h.rule)).toContain(rule);
  });

  it.each(NOT_CLAIMS)('does not flag %j', text => {
    expect(findClaims(text)).toEqual([]);
  });
});

describe('public copy — mechanical allow-list kinds', () => {
  const entry = (
    sentence: string,
    kinds: string[],
    cls: 'number' | 'credential' | 'competitor' = 'number',
    extra: Partial<AllowEntry> = {}
  ) =>
    ({
      sentence: normaliseCopy(sentence),
      layer: 'source',
      file: 'app/page.tsx',
      class: cls,
      kinds,
      ...extra,
    }) as AllowEntry;

  type Case = [
    string,
    string[],
    ('number' | 'credential' | 'competitor')?,
    Partial<AllowEntry>?,
  ];

  it.each([
    ['Synthex delivered 8,200 qualified leads.', ['product-limit']],
    [
      'Synthex delivered 8,200 qualified leads.',
      ['date-time', 'ordinal-step-version', 'contact-legal', 'price'],
    ],
    ['Plans from $59 a month', ['price']],
    ['Up to 3 users on Starter', ['date-time']],
    ['Join 50 businesses', ['product-limit']],
    ['Saves 10 hours in the last 7 days', ['date-time']],
    ['Scored #/100', ['date-time']],
    ['Scored 40/100', ['date-time']],
    ['ISO 27001 certified.', ['neutral'], 'credential'],
    ['We are GDPR compliant.', ['neutral'], 'credential'],
    ['GDPR compliant.', ['neutral'], 'credential'],
    ['Independently audited security', ['neutral'], 'credential'],
    ['Most chosen', ['neutral'], 'credential'],
    ['Award-winning platform', ['neutral'], 'credential'],
    [
      'Hootsuite just schedules what you write manually.',
      ['neutral'],
      'competitor',
    ],
    [
      'Synthex vs Hootsuite: Hootsuite has no brand voice.',
      ['neutral'],
      'competitor',
    ],
    ['Is Synthex cheaper than Hootsuite?', ['neutral'], 'competitor'],
    [
      'Synthex delivered 8,200 qualified leads.',
      ['evidence'],
      'number',
      { source: 'docs/x.md', retrieved: '2026-10-15' },
    ],
  ] as Case[])(
    'rejects %j as %j',
    (sentence, kinds, cls = 'number', extra = {}) => {
      expect(checkEntry(entry(sentence, kinds, cls, extra))).not.toBeNull();
    }
  );

  it.each([
    ['Plans from $49 a month', ['price']],
    ['Updated 14 October 2026', ['date-time']],
    ['Step 2: define your audience.', ['ordinal-step-version']],
    ['Scored #/100', ['ordinal-step-version']],
    ['Card expires 12/25', ['date-time']],
    ['Call +61 2 9000 0000', ['contact-legal']],
    [
      'For example, 100 interactions on a post seen by 2,000 people.',
      ['hypothetical-example'],
    ],
    ['Synthex returns 3 ranked growth directions.', ['product-limit']],
    [
      'The GDPR is the EU regulation on personal data.',
      ['neutral'],
      'credential',
    ],
    ['Start date must be a valid ISO date string', ['neutral'], 'credential'],
    ['Your best posts based on engagement', ['neutral'], 'credential'],
    ['Synthex vs Hootsuite', ['neutral'], 'competitor'],
    [
      'What Synthex does, for teams considering Hootsuite.',
      ['neutral'],
      'competitor',
    ],
  ] as Case[])('accepts %j as %j', (sentence, kinds, cls = 'number') => {
    expect(checkEntry(entry(sentence, kinds, cls))).toBeNull();
  });

  it('every allow-list entry passes its own kind check', () => {
    const failures = ALLOW_LIST.flatMap(e => {
      const why = checkEntry(e);
      return why ? [`${e.layer} ${e.file}: "${e.sentence}" — ${why}`] : [];
    });
    expect(failures).toEqual([]);
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
      "<Hero description={'The bakery grew by ' + '10,000 followers'} />",
      'x.tsx',
    ],
    [
      "<p>{true ? ['Synthex gets 45', '% more engagement.'].join('') : 'No links yet'}</p>",
      'x.tsx',
    ],
    [
      "<p>{links.length ? 'Links' : ['We pulled in 4', '50 leads'].join('')}</p>",
      'x.tsx',
    ],
    ['<p>ISO 27001 certified.</p>', 'x.tsx'],
    ["const badge = { label: 'Independently audited security' };", 'x.ts'],
  ])('flags %s', (source, file) => {
    expect(findClaimsInSource(source, file)).not.toEqual([]);
  });

  it('ignores comments, which never reach a visitor', () => {
    expect(
      findClaimsInSource('// grew by 10,000 followers\nconst a = 1;', 'x.ts')
    ).toEqual([]);
  });

  it('ignores AI prompt text, which is sent to a model, not served', () => {
    expect(
      findClaimsInSource(
        "const r = { messages: [{ role: 'user', content: `Write 3 captions for ${n}.` }] };",
        'x.ts'
      )
    ).toEqual([]);
  });
});

describe('public copy — unsupported claims (source)', () => {
  const allow = allowIndex('source');
  const used = new Set<string>();

  it('no public file carries an unreviewed number or credential', () => {
    const hits = inventory.flatMap(file =>
      claimHitsInSource(readFileSync(file, 'utf8'), file).flatMap(hit => {
        const key = sentenceKey(hit.sentence);
        if (allow[hit.rule as keyof AllowIndex]?.has(key)) {
          used.add(`${hit.rule}|${key}`);
          return [];
        }
        return [`${rel(file)}: ${hit.rule} — "${hit.sentence}"`];
      })
    );
    expect(hits).toEqual([]);
  });

  it('has no stale source allow-list entries', () => {
    const stale = ALLOW_LIST.filter(
      e =>
        e.layer === 'source' &&
        !used.has(`${e.class}|${sentenceKey(e.sentence)}`)
    ).map(e => `${e.file}: ${e.sentence}`);
    expect(stale).toEqual([]);
  });
});
