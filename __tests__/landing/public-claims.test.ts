/**
 * Claims this branch removed must not return to public copy — blocking
 * regression tripwire, source layer (SYN-1226).
 *
 * Orchestrator decision (round 5): a mechanical rule cannot establish that
 * natural-language copy is true, so the blocking guard is a tripwire, not a
 * fact-checker. It fails on:
 *  - an EXACT SEED (TRIPWIRE_SEEDS), matched in the whole normalised copy
 *    stream so markup, joins and spacing cannot hide it. The seeds are
 *    generated from Git history by scripts/claims-seeds.ts — every
 *    public-copy segment removed or rewritten since base 83243588
 *    (helpers/tripwire-seeds.generated.json; completeness enforced as a
 *    subset rule by public-claims-seeds.test.ts) — plus the drafted seeds the generator
 *    does not produce (reviewer mutants, copy outside its scope);
 *  - a HIGH-PRECISION PATTERN (TRIPWIRE_PATTERNS): SOC 2, ISO 27001,
 *    GDPR/CCPA compliance, Synthex "certified", money-back, world's first,
 *    customer counts, "N% more engagement", "saves N hours", uptime %,
 *    "trusted by N" — each with zero hits in the current public copy.
 * Nothing is allow-listed: a blocking test never blesses a sentence.
 * Every other number, credential or competitor mention goes to the advisory
 * audit (npm run copy:audit) for human review.
 *
 * This SOURCE layer is the complete layer for restored literal copy: it
 * judges the copy streams of every public file — route files, what they
 * import, the API routes they call and those routes' server modules,
 * llms.txt, the published video catalogue — including the static parts of
 * template literals. The blocking command `npm run claims:guard` runs it
 * together with two SUPPLEMENTARY layers that only add states a running
 * page or handler produces (public-claims-rendered.test.tsx,
 * public-claims-api.test.ts; each lists the states it exercises) and the
 * seed completeness check (public-claims-seeds.test.ts).
 */

import { readFileSync } from 'fs';
import path from 'path';
import {
  DRAFTED_SEEDS,
  EMPTY_SEEDS,
  GENERATED_SEEDS,
  NOT_CLAIMS,
  ROOT,
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
  SHORT_SEED_WORDS,
  seedPlainText,
  seedWords,
  tripwireHits,
  tripwireHitsInSource,
  tripwireSourceInventory,
  renderedSentencesText,
} from './helpers/public-claims';

const inventory = publicSourceInventory();
// The tripwire also reads what API routes import, and off-site published copy.
const tripwireInventory = tripwireSourceInventory();

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
  it('seeds the generated set and every drafted seed', () => {
    expect(GENERATED_SEEDS.length).toBeGreaterThan(0);
    const plain = (seed: string) =>
      seedPlainText(seed).replace(/\s+/g, ' ').trim();
    expect(TRIPWIRE_SEEDS).toEqual(
      expect.arrayContaining([
        ...GENERATED_SEEDS.map(seed => seed.text),
        ...[
          ...DRAFTED_SEEDS,
          ...REMOVED_CLAIM_SEEDS,
          ...ROUND_5_SEEDS.map(([seed]) => seed),
          ...REVIEWER_MUTANTS,
          ...ROUND_5_REMOVED,
        ].map(plain),
      ])
    );
  });

  it('has no seed without plain text', () => {
    expect(EMPTY_SEEDS).toEqual([]);
  });

  // One test over all seeds (there are over a thousand): each must trip
  // as plain text, restored as a source literal, and — where it is plain
  // prose — restored in JSX split across two elements.
  it('catches every seed as text', () => {
    expect(
      TRIPWIRE_SEEDS.filter(seed => tripwireHits(seed).length === 0)
    ).toEqual([]);
  });

  it('catches every seed restored as a source literal', () => {
    const missed = TRIPWIRE_SEEDS.filter(
      seed =>
        tripwireHitsInSource(
          `export const copy = ${JSON.stringify(seed)};`,
          'x.ts'
        ).length === 0
    );
    expect(missed).toEqual([]);
  });

  // A seed of SHORT_SEED_WORDS+ words matches as a substring, so it must
  // also survive being split across elements. (A shorter seed matches only
  // as one whole segment — the rule that keeps false positives at zero.)
  it('catches every long prose seed restored in JSX across two elements', () => {
    const missed = TRIPWIRE_SEEDS.filter(seed => {
      const text = seed;
      if (seedWords(text) < SHORT_SEED_WORDS) return false;
      if (/[{}<>`]/.test(text)) return false; // not JSX text as written
      const words = text.split(/\s+/).filter(Boolean);
      const half = Math.ceil(words.length / 2);
      const jsx = `export const P = () => <p>${words.slice(0, half).join(' ')} <strong>${words.slice(half).join(' ')}</strong></p>;`;
      return tripwireHitsInSource(jsx, 'x.tsx').length === 0;
    });
    expect(missed).toEqual([]);
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

// The rendered layer's reader: what it treats as visitor copy (runs on this
// suite's jsdom DOM).
describe('public copy — rendered text reader', () => {
  const lines = (markup: string) =>
    renderedSentencesText(markup)
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

  it('reads visible text, nested inline elements included', () => {
    expect(
      lines(
        '<main><p>Plans <strong>start <em>here</em></strong> today</p></main>'
      )
    ).toContain('Plans start here today');
  });

  it('reads alt, title and aria-label as copy', () => {
    expect(
      lines(
        '<img alt="Alt copy" /><a title="Title copy" aria-label="Aria copy">x</a>'
      )
    ).toEqual(expect.arrayContaining(['Alt copy', 'Title copy', 'Aria copy']));
  });

  it('reads each JSON-LD string value, whatever the type attribute case', () => {
    expect(
      lines(
        '<script type=" Application/LD+JSON ">{"@type":"Offer","description":"JSON-LD copy","n":3}</script>'
      )
    ).toEqual(['Offer', 'JSON-LD copy']);
  });

  it('ignores ordinary scripts and style sheets by element type', () => {
    expect(
      lines(
        '<p>Visible</p><script>var claim = "Synthex gets 45% more engagement."</script>' +
          '<script type="module">window.x = "Join 5,000+ businesses"</script>' +
          '<style>.a::after { content: "99.99% uptime"; }</style>'
      )
    ).toEqual(['Visible']);
  });

  it('fails loudly on malformed JSON-LD instead of scanning it as text', () => {
    expect(() =>
      renderedSentencesText(
        '<script type="application/ld+json">{"description": "Synthex gets 45% more</script>'
      )
    ).toThrow('Malformed JSON-LD');
  });
});

describe('public copy — the blocking command', () => {
  // The guarantee is the union of the layers this one command runs.
  it('runs every claims suite in npm run claims:guard', () => {
    const pkg = JSON.parse(
      readFileSync(path.join(ROOT, 'package.json'), 'utf8')
    );
    const command: string = pkg.scripts['claims:guard'];
    expect(
      [
        '__tests__/landing/public-claims.test.ts',
        '__tests__/landing/public-claims-rendered.test.tsx',
        '__tests__/landing/public-claims-api.test.ts',
        '__tests__/landing/public-claims-seeds.test.ts',
      ].filter(suite => !command.includes(suite))
    ).toEqual([]);
  });
});

describe('public copy — removed claims (source)', () => {
  it('reads server modules behind API routes and off-site copy', () => {
    const files = tripwireInventory.map(rel);
    expect(files).toEqual(
      expect.arrayContaining([
        'lib/ai/content-scorer.ts',
        'lib/remotion/educational-content.ts',
      ])
    );
  });

  it('no public file carries a removed claim or a banned pattern', () => {
    const hits = tripwireInventory.flatMap(file =>
      tripwireHitsInSource(readFileSync(file, 'utf8'), file).map(
        hit =>
          `${rel(file)}:${hit.line ?? '?'}: ${hit.rule} — "${hit.sentence}"`
      )
    );
    expect(hits).toEqual([]);
  });
});
