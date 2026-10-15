/**
 * Unit tests for the advisory copy audit's mechanical kinds (npm run
 * copy:audit). A kind annotates a finding for the human review queue; it
 * never blesses copy, and no blocking guard reads it.
 */

import { readFileSync } from 'fs';
import path from 'path';
import {
  checkEntry,
  classify,
  type AllowEntry,
} from './helpers/copy-audit-kinds';
import {
  ROOT,
  claimHitsInSource,
  normaliseCopy,
} from './helpers/public-claims';

describe('copy audit — mechanical kinds', () => {
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
});

describe('copy audit — classify and lines', () => {
  it('leaves an outcome claim for human review', () => {
    expect(
      classify(
        normaliseCopy('Synthex delivered 8,200 qualified leads.'),
        'app/page.tsx',
        'number'
      )
    ).toEqual([]);
  });

  it('annotates a dated sentence as date-time', () => {
    expect(
      classify(
        normaliseCopy('Updated 14 October 2026'),
        'app/page.tsx',
        'number'
      )
    ).toEqual(['date-time']);
  });

  it('reports the source line of each finding', () => {
    const source = "const a = 1;\nexport const t = 'Plans from $49 a month';\n";
    expect(claimHitsInSource(source, 'x.ts')[0]?.line).toBe(2);
  });

  it('is wired as npm run copy:audit', () => {
    const pkg = JSON.parse(
      readFileSync(path.join(ROOT, 'package.json'), 'utf8')
    );
    expect(pkg.scripts['copy:audit']).toBe('tsx scripts/copy-audit.ts');
  });
});
