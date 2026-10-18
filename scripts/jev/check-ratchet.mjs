#!/usr/bin/env node
/**
 * scripts/jev/check-ratchet.mjs --base <ref> [--head <ref>] [--proposal <path>] | --control
 * Exit 0 when no floor in tests/eval/jev/floors.json (or the proposal overlay) is lower than at
 * base, and no case file was deleted without a tombstone entry in tests/eval/jev/tombstones.json.
 */
import { readJson, tryGit, git, ROOT, isMain } from '../fleet/lib.mjs';
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
    for (const [k, v] of Object.entries(b)) {
      if (typeof v !== 'number') continue;
      if (typeof h[k] !== 'number')
        problems.push(`floor ${fam}.${k} removed or non-numeric (was ${v})`);
      else if (h[k] < v)
        problems.push(`floor ${fam}.${k} lowered ${v} -> ${h[k]}`);
    }
  }
  return problems;
}
// A proposal stands in for measured floors, so it must measure every family in families.json; an
// empty or partial one (a failed jev:det run) would pass compare() against an empty base (Codex on P1).
export function incompleteProposal(proposal, familiesTable) {
  const fams = proposal?.families || {};
  return Object.keys(familiesTable?.families || {})
    .filter(f => typeof fams[f]?.pass_rate !== 'number')
    .map(f => `family ${f} not measured`);
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
if (isMain(import.meta.url)) {
  if (args.includes('--control')) {
    const p = compare(
      { families: { J1: { pass_rate: 0.9 } } },
      { families: { J1: { pass_rate: 0.8 } } }
    );
    const up = compare(
      { families: { J1: { pass_rate: 0.8 } } },
      { families: { J1: { pass_rate: 0.9 } } }
    );
    const table = { families: { J1: {}, J2: {} } };
    const empty = incompleteProposal({ families: {} }, table);
    const partial = incompleteProposal(
      { families: { J1: { pass_rate: 0.9 } } },
      table
    );
    const full = incompleteProposal(
      { families: { J1: { pass_rate: 0.9 }, J2: { pass_rate: 1 } } },
      table
    );
    const ok =
      p.length === 1 &&
      up.length === 0 &&
      empty.length === 2 &&
      partial.length === 1 &&
      full.length === 0;
    console.log(
      `${ok ? 'PASS' : 'FAIL'} check-ratchet controls (lowering exits 1, raising passes, empty or partial proposal exits 1)`
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
    // No floors at base (the bootstrap PR introduces the file): no floor exists to lower, so the
    // ratchet compares against an empty baseline; deletions are still checked below.
    console.log('NOTE check-ratchet: no floors.json at base; empty baseline');
    baseFloors = { families: {} };
  }
  try {
    if (raw !== null) baseFloors = JSON.parse(raw);
  } catch {
    console.log('INCONCLUSIVE check-ratchet: base floors not JSON');
    process.exit(2);
  }
  const prop = opt('--proposal');
  const committedFloors = readJson('tests/eval/jev/floors.json');
  let headFloors = committedFloors;
  if (prop) {
    if (!existsSync(path.join(ROOT, prop))) {
      console.log(`INCONCLUSIVE check-ratchet: proposal ${prop} absent`);
      process.exit(2);
    }
    headFloors = readJson(prop);
  }
  const problems = [
    // The committed floors are ratcheted against base regardless of any proposal overlay
    // (CodeRabbit on PR #997: a PR could lower a committed floor behind an unchanged proposal).
    ...compare(baseFloors, committedFloors).map(p => `committed floors: ${p}`),
    ...(prop ? compare(baseFloors, headFloors).map(p => `proposal: ${p}`) : []),
    ...(prop
      ? incompleteProposal(
          headFloors,
          readJson('tests/eval/jev/families.json', { families: {} })
        ).map(p => `proposal: ${p}`)
      : []),
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
