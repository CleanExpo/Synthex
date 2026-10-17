#!/usr/bin/env node
/**
 * scripts/fleet/check-soak.mjs --days <n> [--control]
 * Exit 0 when, for each of the last n UTC days, the ledger holds a scheduler start row
 * (nightly run) and every merged phase receipt has a start row within 24 hours of its merge.
 * Days without a start row FAIL: a silent scheduler is a failed soak, not a quiet one.
 */
import { policy, ledgerRows, report, utcDate, ROOT, isMain } from './lib.mjs';
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
const a = process.argv.slice(2);
const di = a.indexOf('--days');
const days = di >= 0 ? Number(a[di + 1]) : 14;
export function evaluate(rows, receipts, now = new Date()) {
  const items = [];
  const starts = rows.filter(r => r.kind === 'start');
  for (let i = days - 1; i >= 0; i--) {
    const d = utcDate(new Date(now.getTime() - i * 86400000));
    items.push({
      id: d,
      text: 'scheduler start row present',
      state: starts.some(s => (s.ts || '').startsWith(d)) ? 'PASS' : 'FAIL',
    });
  }
  for (const r of receipts) {
    const merged = rows.find(x => x.kind === 'merge' && x.phase === r.phase);
    if (!merged) {
      items.push({
        id: `receipt:${r.phase}`,
        text: 'merged receipt has a merge row',
        state: 'FAIL',
      });
      continue;
    }
    const t = new Date(merged.ts).getTime();
    const ok =
      starts.some(s => {
        const st = new Date(s.ts).getTime();
        return st >= t && st - t <= 86400000;
      }) || now.getTime() - t < 86400000;
    items.push({
      id: `receipt:${r.phase}`,
      text: 'start row within 24h of merge',
      state: ok ? 'PASS' : 'FAIL',
    });
  }
  return items;
}
if (isMain(import.meta.url)) {
  if (a.includes('--control')) {
    const now = new Date('2026-01-10T12:00:00Z');
    const good = evaluate(
      [{ kind: 'start', ts: '2026-01-10T01:00:00Z' }],
      [],
      now
    );
    const bad = evaluate([], [], now);
    const ok =
      good.length === days &&
      good[days - 1].state === 'PASS' &&
      bad.every(i => i.state === 'FAIL');
    console.log(
      `${ok ? 'PASS' : 'FAIL'} check-soak controls (start row passes its day, silent day fails)`
    );
    process.exit(ok ? 0 : 1);
  }
  const dir = path.join(ROOT, policy().receipts_dir);
  const receipts = existsSync(dir)
    ? readdirSync(dir)
        .filter(f => /^P-?\d+\.json$/.test(f))
        .map(f => ({ phase: f.replace('.json', '') }))
    : [];
  process.exit(report('check-soak', evaluate(ledgerRows(), receipts)));
}
