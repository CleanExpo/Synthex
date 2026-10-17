#!/usr/bin/env node
/**
 * scripts/fleet/next-row.mjs [--phase P<n>] [--control]
 * Picks one open row from the fleet block in BACKLOG.md and prints a unit contract as JSON:
 * { id, phase, inputs, branch, proving_command }. Exit 0 with a contract; exit 3 when the block
 * holds no open row for the phase (a stop condition, never a failure).
 */
import { policy, ROOT, isMain } from './lib.mjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
const a = process.argv.slice(2);
const opt = (k, d) => {
  const i = a.indexOf(k);
  return i >= 0 ? a[i + 1] : d;
};
export function parseBlock(md, markers) {
  const s = md.indexOf(markers.begin),
    e = md.indexOf(markers.end);
  if (s < 0 || e < 0 || e < s) return null;
  return md
    .slice(s + markers.begin.length, e)
    .split('\n')
    .filter(l => l.startsWith('| ') && !l.startsWith('| fleet |'))
    .map(l => {
      const c = l.split('|').map(x => x.trim());
      return {
        id: c[1],
        phase: c[2],
        status: c[3],
        inputs: (c[4] || '')
          .split(',')
          .map(x => x.trim())
          .filter(Boolean),
        proving_command: c[5] || '',
        evidence: c[6] || '',
      };
    });
}
export function pick(rows, phase) {
  return (
    rows.find(r => r.status === 'open' && (!phase || r.phase === phase)) || null
  );
}
if (isMain(import.meta.url)) {
  const pol = policy();
  if (a.includes('--control')) {
    const rows = parseBlock(
      '<!-- fleet:begin -->\n| u1 | P2 | open | lib/a.ts | node x.mjs | |\n| u2 | P2 | done | lib/b.ts | node y.mjs | |\n<!-- fleet:end -->',
      pol.backlog_markers
    );
    const ok =
      rows.length === 2 &&
      pick(rows, 'P2').id === 'u1' &&
      pick(rows, 'P3') === null &&
      parseBlock('no markers', pol.backlog_markers) === null;
    console.log(
      `${ok ? 'PASS' : 'FAIL'} next-row controls (open row picked, exhausted phase returns none, missing markers rejected)`
    );
    process.exit(ok ? 0 : 1);
  }
  const rows = parseBlock(
    readFileSync(path.join(ROOT, 'BACKLOG.md'), 'utf8'),
    pol.backlog_markers
  );
  if (rows === null) {
    console.log('INCONCLUSIVE next-row: fleet markers absent from BACKLOG.md');
    process.exit(2);
  }
  const phase = opt('--phase');
  const row = pick(rows, phase);
  if (!row) {
    console.log(`next-row: no open row${phase ? ' for ' + phase : ''}`);
    process.exit(3);
  }
  const ph = pol.phases.find(p => p.id === row.phase);
  console.log(
    JSON.stringify({
      ...row,
      branch: ph ? `feature/fleet-${ph.id.toLowerCase()}-${ph.slug}` : null,
    })
  );
  process.exit(0);
}
