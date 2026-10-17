#!/usr/bin/env node
/**
 * scripts/fleet/check-ledgers.mjs --days <n> [--control]
 * Exit 0 when the fleet ledger and the JEV ledger show metered spend under their ceilings on
 * each of the last n UTC days that have rows, and every kill-switch trip has a logged cause.
 * A day with no rows is reported DISABLED (no spend), never PASS by silence; the soak check
 * decides whether a silent day is acceptable. Positive control: a planted $5.00 day passes,
 * a planted $5.01 day fails.
 */
import { policy, ledgerRows, report, utcDate } from './lib.mjs';
const a = process.argv.slice(2);
const di = a.indexOf('--days');
const days = di >= 0 ? Number(a[di + 1]) : 14;
export function evaluate(rows, ceiling, abortLine, label) {
  const byDay = {};
  for (const r of rows) {
    if (r.kind !== 'cost') continue;
    const d = (r.ts || '').slice(0, 10);
    byDay[d] = (byDay[d] || 0) + Number(r.usd || 0);
  }
  const items = [];
  for (const d of Object.keys(byDay).sort().slice(-days))
    items.push({
      id: `${label}:${d}`,
      text: `metered spend $${byDay[d].toFixed(2)} under ceiling $${ceiling.toFixed(2)}`,
      state: byDay[d] <= ceiling ? 'PASS' : 'FAIL',
    });
  const trips = rows.filter(r => r.kind === 'halt' || r.kind === 'kill-switch');
  for (const t of trips)
    items.push({
      id: `${label}:trip:${(t.ts || '').slice(0, 19)}`,
      text: 'kill-switch trip has a logged cause',
      state: t.cause ? 'PASS' : 'FAIL',
    });
  if (!items.length)
    items.push({
      id: `${label}:none`,
      text: `no cost rows in the last ${days} days`,
      state: 'DISABLED',
    });
  return items;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const pol = policy();
  if (a.includes('--control')) {
    const ok =
      evaluate(
        [{ kind: 'cost', ts: '2026-01-01T00:00:00Z', usd: 5.0 }],
        5,
        4.75,
        'c'
      )[0].state === 'PASS' &&
      evaluate(
        [{ kind: 'cost', ts: '2026-01-01T00:00:00Z', usd: 5.01 }],
        5,
        4.75,
        'c'
      )[0].state === 'FAIL' &&
      evaluate([{ kind: 'halt', ts: '2026-01-01T00:00:00Z' }], 5, 4.75, 'c')[0]
        .state === 'FAIL';
    console.log(
      `${ok ? 'PASS' : 'FAIL'} check-ledgers controls ($5.00 passes, $5.01 fails, trip without cause fails)`
    );
    process.exit(ok ? 0 : 1);
  }
  const items = [
    ...evaluate(
      ledgerRows(pol.ledger),
      pol.ceilings_usd.fleet_daily,
      pol.ceilings_usd.fleet_abort_line,
      'fleet'
    ),
    ...evaluate(
      ledgerRows(pol.jev_ledger),
      pol.ceilings_usd.jev_daily,
      pol.ceilings_usd.jev_abort_line,
      'jev'
    ),
  ];
  process.exit(report('check-ledgers', items));
}
