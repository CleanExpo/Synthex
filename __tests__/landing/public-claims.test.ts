/**
 * Unsupported marketing claims must not return to public copy.
 *
 * None of these is backed by anything in the repo: there is no customer count
 * behind "5,000+ businesses", no refund policy behind a "money-back guarantee",
 * and nothing that substantiates "world's first fully autonomous". /case-studies
 * itself says case studies are still being prepared. Copy that states them on a
 * public page is an Australian Consumer Law exposure, so this suite pins the
 * files that used to carry them.
 */

import { readFileSync } from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '../..');

const PUBLIC_COPY_FILES = [
  'app/agencies/page.tsx',
  'components/marketing/MarketingLayout.tsx',
  'components/landing/cta-section.tsx',
  'components/landing/DemoConversionCard.tsx',
  'lib/seo/metadata.ts',
];

const BANNED_CLAIMS: Array<[string, RegExp]> = [
  ['customer-count claim', /\b\d{1,3}(,\d{3})\+\s*(Australian\s+)?business/i],
  ['money-back guarantee', /money[- ]back/i],
  ["world's first claim", /world['’]s first/i],
  ['unsourced hours-per-week stat', /average SMB spends/i],
];

describe('public copy — unsupported claims', () => {
  it.each(PUBLIC_COPY_FILES)('%s carries no unsupported claim', file => {
    const source = readFileSync(path.join(ROOT, file), 'utf8');
    for (const [label, pattern] of BANNED_CLAIMS) {
      expect({ label, match: source.match(pattern)?.[0] ?? null }).toEqual({
        label,
        match: null,
      });
    }
  });

  it('the patterns still catch the original wording', () => {
    const original = [
      'Join 5,000+ Australian businesses posting to 9 platforms',
      '30-day money-back guarantee · Cancel anytime',
      "The world's first fully autonomous AI marketing agency.",
      'The average SMB spends 10+ hours per week on social media.',
    ];
    original.forEach((line, i) => {
      expect(BANNED_CLAIMS[i][1].test(line)).toBe(true);
    });
  });
});
