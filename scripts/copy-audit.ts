/**
 * Advisory public-copy audit (SYN-1226) — the founder's content-review queue.
 *
 *   npm run copy:audit            # one line per finding, then counts
 *   npm run copy:audit -- --json  # machine-readable
 *
 * Lists every quantity, certification/compliance/endorsement/superlative term
 * and competitor name in the copy of every public file (routes, what they
 * import, and the same-origin API routes they call), with file:line. A
 * mechanical kind annotates structural findings (dates, steps, prices equal to
 * the pricing source); the rest are marked REVIEW. Never fails: no rule can
 * establish that natural-language copy is true. The blocking regression
 * tripwire lives in __tests__/landing/public-claims*.test.ts.
 */

import { readFileSync } from 'fs';
import path from 'path';
import { classify } from '../__tests__/landing/helpers/copy-audit-kinds';
import {
  GENERATED_SEEDS,
  GENERATED_SEEDS_FILE,
  ROOT,
  claimHitsInSource,
  publicSourceInventory,
  rel,
  type RetiredSeed,
} from '../__tests__/landing/helpers/public-claims';

/**
 * Pricing pages are governed separately (docs/governance/CLAUDE.md:20): this
 * branch leaves them byte-identical to base, so their claims are listed here
 * for the founder as their own item, not edited or seeded.
 */
const PRICING_GOVERNED = [
  'app/(landing)/restoreassist/pricing/page.tsx',
  'app/(landing)/restoreassist/pricing/plan-data.ts',
  'app/(landing)/restoreassist/pricing/report-volume-picker.tsx',
];

type Cls = 'number' | 'credential' | 'competitor';
const ADVISORY = new Set<string>(['number', 'credential', 'competitor']);

const rows = publicSourceInventory().flatMap(file => {
  const relative = rel(file);
  return claimHitsInSource(readFileSync(file, 'utf8'), file)
    .filter(hit => ADVISORY.has(hit.rule))
    .map(hit => ({
      where: `${relative}:${hit.line ?? 0}`,
      cls: hit.rule as Cls,
      kinds: classify(hit.sentence, relative, hit.rule as Cls),
      sentence: hit.sentence,
      pricingGoverned: PRICING_GOVERNED.includes(relative),
    }));
});

const count = (pred: (r: (typeof rows)[number]) => boolean) =>
  rows.filter(pred).length;
const summary = {
  total: rows.length,
  files: new Set(rows.map(r => r.where.replace(/:\d+$/, ''))).size,
  needsReview: count(r => r.kinds.length === 0),
  structural: count(r => r.kinds.length > 0),
  byClass: Object.fromEntries(
    (['number', 'credential', 'competitor'] as const).map(c => [
      c,
      {
        total: count(r => r.cls === c),
        needsReview: count(r => r.cls === c && r.kinds.length === 0),
      },
    ])
  ),
  // Separately governed: live pricing-page claims for the founder to decide.
  pricingGoverned: {
    files: PRICING_GOVERNED,
    flaggedSentences: count(r => r.pricingGoverned),
    // Base copy restored on purpose, so retired from the tripwire.
    liveClaims: (
      (JSON.parse(readFileSync(path.join(ROOT, GENERATED_SEEDS_FILE), 'utf8'))
        .retired ?? []) as RetiredSeed[]
    ).map(r => r.text),
    // Wording this branch had proposed for those pages, reverted to base.
    revertedBranchWording: GENERATED_SEEDS.filter(s =>
      PRICING_GOVERNED.includes(s.file)
    )
      .filter(s => s.firstSeen !== 'base')
      .map(s => s.text),
  },
};

if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify({ summary, rows }, null, 2)}\n`);
} else {
  for (const r of rows) {
    const label = r.pricingGoverned
      ? 'PRICING-GOVERNED'
      : r.kinds.length
        ? r.kinds.join('+')
        : 'REVIEW';
    process.stdout.write(`${r.where}\t${r.cls}\t${label}\t${r.sentence}\n`);
  }
  process.stdout.write(`\n${JSON.stringify(summary, null, 2)}\n`);
}
