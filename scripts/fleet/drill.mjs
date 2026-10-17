#!/usr/bin/env node
/**
 * scripts/fleet/drill.mjs --all | --drill <name>
 * P9 drills, each a forced failure that must be caught before its ceiling:
 *   cost-loop      a simulated retry loop must abort at the abort line, never reach the ceiling
 *   kill-switch    a mid-run pause must stop further stub publishes and log a cause
 *   secret-halt    a planted key in scratch output must write STOP into a scratch halt dir
 *   fifth-state    a receipt with a fifth state must be rejected by attest-phase
 *   protected-edit verify-protected must fail a planted protected edit
 * Every drill writes a scratch ledger; nothing touches the real halt dir or ledger.
 */
import { policy, run, ROOT } from './lib.mjs';
import { scanForSecrets, haltOnHit } from './secret-scan.mjs';
import { evaluate as attest } from './attest-phase.mjs';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const pol = policy();
const drills = {
  'cost-loop': () => {
    let spent = 0,
      calls = 0,
      aborted = false;
    while (calls < 1000) {
      const next = 0.37;
      if (spent + next > pol.ceilings_usd.jev_abort_line) {
        aborted = true;
        break;
      }
      spent += next;
      calls++;
    }
    return {
      ok:
        aborted &&
        spent <= pol.ceilings_usd.jev_abort_line &&
        spent < pol.ceilings_usd.jev_daily,
      detail: `aborted after ${calls} calls at $${spent.toFixed(2)}`,
    };
  },
  'kill-switch': () => {
    const log = [];
    let paused = false;
    const publish = i => {
      if (paused) {
        log.push({ i, skipped: true });
        return;
      }
      log.push({ i, published: true });
    };
    for (let i = 0; i < 10; i++) {
      if (i === 4) {
        paused = true;
        log.push({ kind: 'kill-switch', cause: 'drill: pause mid-run' });
      }
      publish(i);
    }
    const after = log.filter(l => l.published && l.i >= 4).length;
    return {
      ok: after === 0 && log.some(l => l.kind === 'kill-switch' && l.cause),
      detail: `${log.filter(l => l.published).length} published before pause, ${after} after`,
    };
  },
  'secret-halt': () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'drill-halt-'));
    process.env.FLEET_HALT_DIR = dir;
    const hits = scanForSecrets('AKIA' + 'C'.repeat(16));
    const wrote = haltOnHit(hits, 'drill');
    delete process.env.FLEET_HALT_DIR;
    return {
      ok:
        wrote &&
        existsSync(path.join(dir, 'STOP')) &&
        !existsSync(path.join(ROOT, pol.halt_dir, 'STOP')),
      detail: `scratch STOP at ${dir}, real STOP absent`,
    };
  },
  'fifth-state': () => {
    const items = attest({
      commits: [],
      rows: [],
      receipt: { state: 'GREEN', gate: [{ cmd: 'x', state: 'OK' }] },
    });
    return {
      ok: items.find(i => i.id === 'states').state === 'FAIL',
      detail: 'GREEN/OK rejected',
    };
  },
  'protected-edit': () => {
    const r = run(
      process.execPath,
      ['scripts/fleet/verify-protected.mjs', '--control'],
      { timeout: 120000 }
    );
    return {
      ok: r.code === 0,
      detail: r.stdout.trim().split('\n').slice(-1)[0],
    };
  },
};
const a = process.argv.slice(2);
const names = a.includes('--all')
  ? Object.keys(drills)
  : [a[a.indexOf('--drill') + 1]].filter(n => drills[n]);
if (!names.length) {
  console.error(
    'usage: --all | --drill <' + Object.keys(drills).join('|') + '>'
  );
  process.exit(2);
}
let bad = 0;
for (const n of names) {
  let r;
  try {
    r = drills[n]();
  } catch (e) {
    r = { ok: false, detail: e.message };
  }
  console.log(`${r.ok ? 'PASS' : 'FAIL'} drill ${n}: ${r.detail}`);
  if (!r.ok) bad++;
}
console.log(`drill: ${names.length - bad} of ${names.length} PASS`);
process.exit(bad ? 1 : 0);
