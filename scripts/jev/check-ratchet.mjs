#!/usr/bin/env node
/**
 * scripts/jev/check-ratchet.mjs --base <ref> [--head <ref>] [--proposal <path>] | --control
 * Exit 0 when no floor in tests/eval/jev/floors.json (or the proposal overlay) is lower than at
 * base, and no case file was deleted without a tombstone entry in tests/eval/jev/tombstones.json.
 */
import { readJson, tryGit, git, ROOT } from '../fleet/lib.mjs';
import { existsSync } from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
export function compare(baseFloors, headFloors) {
  const problems = [];
  for (const [fam, b] of Object.entries(baseFloors.families || {})) {
    const h = (headFloors.families || {})[fam];
    if (!h) {
      problems.push(`family ${fam} removed`);
      continue;
    }
    for (const [k, v] of Object.entries(b))
      if (typeof v === 'number' && typeof h[k] === 'number' && h[k] < v)
        problems.push(`floor ${fam}.${k} lowered ${v} -> ${h[k]}`);
  }
  return problems;
}
export function deletedCases(base, head) {
  const out =
    tryGit([
      'diff',
      '--diff-filter=D',
      '--name-only',
      base,
      head,
      '--',
      'tests/eval/jev/cases',
    ]) || '';
  const deleted = out.split('\n').filter(Boolean);
  const tomb = readJson('tests/eval/jev/tombstones.json', { cases: [] });
  return deleted.filter(f => !tomb.cases.some(t => t.file === f));
}
if (import.meta.url === `file://${process.argv[1]}`) {
  if (args.includes('--control')) {
    const p = compare(
      { families: { J1: { pass_rate: 0.9 } } },
      { families: { J1: { pass_rate: 0.8 } } }
    );
    const up = compare(
      { families: { J1: { pass_rate: 0.8 } } },
      { families: { J1: { pass_rate: 0.9 } } }
    );
    const ok = p.length === 1 && up.length === 0;
    console.log(
      `${ok ? 'PASS' : 'FAIL'} check-ratchet controls (lowering exits 1, raising passes)`
    );
    process.exit(ok ? 0 : 1);
  }
  const base = opt('--base');
  if (!base) {
    console.error(
      'usage: --base <ref> [--head <ref>] [--proposal <path>] | --control'
    );
    process.exit(2);
  }
  const head = opt('--head', 'HEAD');
  let baseFloors;
  const raw = tryGit(['show', `${base}:tests/eval/jev/floors.json`]);
  if (raw === null) {
    console.log('INCONCLUSIVE check-ratchet: no floors.json at base');
    process.exit(2);
  }
  try {
    baseFloors = JSON.parse(raw);
  } catch {
    console.log('INCONCLUSIVE check-ratchet: base floors not JSON');
    process.exit(2);
  }
  const prop = opt('--proposal');
  let headFloors = readJson('tests/eval/jev/floors.json');
  if (prop) {
    if (!existsSync(path.join(ROOT, prop))) {
      console.log(`INCONCLUSIVE check-ratchet: proposal ${prop} absent`);
      process.exit(2);
    }
    headFloors = readJson(prop);
  }
  const problems = [
    ...compare(baseFloors, headFloors),
    ...deletedCases(base, head).map(
      f => `case deleted without tombstone: ${f}`
    ),
  ];
  for (const p of problems) console.log(`FAIL check-ratchet: ${p}`);
  if (!problems.length)
    console.log(
      `PASS check-ratchet: ${Object.keys(headFloors.families || {}).length} families, no floor lowered, no untombstoned deletion${prop ? ' (proposal overlay)' : ''}`
    );
  process.exit(problems.length ? 1 : 0);
}
