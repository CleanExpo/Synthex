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
import { classify } from '../__tests__/landing/helpers/copy-audit-kinds';
import {
  claimHitsInSource,
  publicSourceInventory,
  rel,
} from '../__tests__/landing/helpers/public-claims';

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
};

if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify({ summary, rows }, null, 2)}\n`);
} else {
  for (const r of rows) {
    const label = r.kinds.length ? r.kinds.join('+') : 'REVIEW';
    process.stdout.write(`${r.where}\t${r.cls}\t${label}\t${r.sentence}\n`);
  }
  process.stdout.write(`\n${JSON.stringify(summary, null, 2)}\n`);
}
