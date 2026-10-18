#!/usr/bin/env node
/**
 * scripts/jev/check-ratchet.mjs --base <ref> [--head <ref>] [--proposal <path>] | --control
 * Exit 0 when no floor in tests/eval/jev/floors.json (or the proposal overlay) is lower than at
 * base, and no case file was deleted without a tombstone entry in tests/eval/jev/tombstones.json.
 */
import { readJson, tryGit, git, ROOT, isMain } from '../fleet/lib.mjs';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
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
// Leaf values in a case file. A case file that stops parsing, or loses entries, is a deletion
// in all but name (emptying it to {} used to pass; verifier audit).
export function leafCount(v) {
  if (Array.isArray(v)) return v.reduce((n, x) => n + leafCount(x), 0);
  if (v && typeof v === 'object')
    return Object.values(v).reduce((n, x) => n + leafCount(x), 0);
  return 1;
}
// Stable case keys: every array element is a case. An object element is keyed by the first of
// id/file/route/slug/m it carries (else its canonical JSON), a string element by itself. Every key
// at base must still exist at head unless the file is tombstoned: two cases merged into one padded
// case keeps the leaf count but loses a key (verifier audit, second pass).
const KEY_FIELDS = ['id', 'file', 'route', 'slug', 'm'];
export function caseKeys(v, at = '$', out = new Set()) {
  if (Array.isArray(v)) {
    for (const x of v) {
      if (x && typeof x === 'object' && !Array.isArray(x)) {
        const k = KEY_FIELDS.find(f => typeof x[f] === 'string');
        out.add(`${at}[${k ? `${k}=${x[k]}` : JSON.stringify(x)}]`);
      } else if (!Array.isArray(x)) out.add(`${at}[${JSON.stringify(x)}]`);
      caseKeys(x, `${at}[]`, out);
    }
  } else if (v && typeof v === 'object')
    for (const [k, x] of Object.entries(v)) caseKeys(x, `${at}.${k}`, out);
  return out;
}
const atRef = (ref, file) => tryGit(['show', `${ref}:${file}`]);
// A case path at head must be a regular file (mode 100644): a symlink or submodule in its place is
// a deletion (type change T used to escape both D and M).
const regularAt = (ref, file) =>
  /^100644 blob /.test(tryGit(['ls-tree', ref, '--', file]) || '');
// Deleted or shrunk case files without a tombstone at head. A failed diff throws (it used to read
// as "no deletions"; verifier audit).
export function deletedCases(base, head) {
  const list = filter =>
    git([
      '-c',
      'core.quotePath=false',
      'diff',
      '--no-renames',
      `--diff-filter=${filter}`,
      '--name-only',
      '-z',
      base,
      head,
      '--',
      'tests/eval/jev/cases',
    ])
      .split('\0')
      .filter(Boolean);
  const tombRaw = atRef(head, 'tests/eval/jev/tombstones.json');
  const tomb = tombRaw === null ? { cases: [] } : JSON.parse(tombRaw);
  const shrunk = list('MT').filter(f => {
    if (!regularAt(head, f)) return true;
    let before, after;
    try {
      before = JSON.parse(atRef(base, f));
    } catch {
      return false;
    }
    try {
      after = JSON.parse(atRef(head, f));
    } catch {
      return true;
    }
    if (leafCount(after) < leafCount(before)) return true;
    const keep = caseKeys(after);
    return [...caseKeys(before)].some(k => !keep.has(k));
  });
  return [...list('D'), ...shrunk].filter(
    f => !tomb.cases.some(t => t.file === f)
  );
}
// End-to-end controls: run this script in a scratch repo (ROOT is the cwd).
function scratchControls() {
  const dir = mkdtempSync(path.join(tmpdir(), 'ratchet-control-'));
  const sh = (args, opts = {}) =>
    spawnSync('git', args, { cwd: dir, encoding: 'utf8', ...opts });
  const id = ['-c', 'user.name=control', '-c', 'user.email=control@local'];
  const put = (f, v) => {
    mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    writeFileSync(path.join(dir, f), JSON.stringify(v));
  };
  const commit = m => {
    sh(['add', '-A']);
    sh([...id, 'commit', '-q', '-m', m]);
  };
  const ratchet = (...a) =>
    spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...a], {
      cwd: dir,
      encoding: 'utf8',
    }).status;
  try {
    sh(['init', '-q', '-b', 'main']);
    put('scripts/fleet/policy.json', { protected_paths: [] });
    put('tests/eval/jev/families.json', { families: { J1: {} } });
    put('tests/eval/jev/floors.json', { families: { J1: { pass_rate: 0.9 } } });
    put('tests/eval/jev/cases/J1/c.json', {
      cases: [{ id: 'a' }, { id: 'b' }],
    });
    commit('base');
    sh(['checkout', '-q', '-b', 'clean']);
    put('tests/eval/jev/floors.json', {
      families: { J1: { pass_rate: 0.95 } },
    });
    commit('raise');
    sh(['checkout', '-q', '-b', 'lower', 'main']);
    put('tests/eval/jev/floors.json', { families: { J1: { pass_rate: 0.1 } } });
    commit('lower');
    sh(['checkout', '-q', '-b', 'padded', 'main']);
    put('tests/eval/jev/cases/J1/c.json', { cases: [{ id: 'a', extra: 'b' }] });
    commit('merge two cases into one padded case');
    sh(['checkout', '-q', '-b', 'symlinked', 'main']);
    rmSync(path.join(dir, 'tests/eval/jev/cases/J1/c.json'));
    symlinkSync(
      '../../floors.json',
      path.join(dir, 'tests/eval/jev/cases/J1/c.json')
    );
    commit('replace a case file with a symlink');
    // As on real main: no committed floors, so only the family set holds an empty proposal.
    sh(['checkout', '-q', '-b', 'nofloors', 'main']);
    put('tests/eval/jev/floors.json', { families: {} });
    commit('no committed floors');
    sh(['checkout', '-q', '-b', 'nofamilies', 'nofloors']);
    put('tests/eval/jev/families.json', { families: {} });
    commit('empty families.json');
    sh(['checkout', '-q', '-b', 'emptied', 'main']);
    put('tests/eval/jev/cases/J1/c.json', {});
    commit('empty a case file');
    sh(['checkout', '-q', 'main']);
    const got = {
      clean: ratchet('--base', 'main', '--head', 'clean'),
      badBase: ratchet('--base', 'no-such-ref', '--head', 'clean'),
      badHead: ratchet('--base', 'main', '--head', 'no-such-ref'),
      lowerFromElsewhere: ratchet('--base', 'main', '--head', 'lower'),
      emptied: ratchet('--base', 'main', '--head', 'emptied'),
      padded: ratchet('--base', 'main', '--head', 'padded'),
      symlinked: ratchet('--base', 'main', '--head', 'symlinked'),
      noFamiliesEmptyProposal: (() => {
        sh(['checkout', '-q', 'nofamilies']);
        writeFileSync(path.join(dir, 'proposal.json'), '{"families":{}}');
        const c = ratchet(
          '--base',
          'nofloors',
          '--head',
          'nofamilies',
          '--proposal',
          'proposal.json'
        );
        sh(['checkout', '-q', '-f', 'main']);
        return c;
      })(),
    };
    const want = {
      clean: 0,
      badBase: 2,
      badHead: 2,
      lowerFromElsewhere: 1,
      emptied: 1,
      padded: 1,
      symlinked: 1,
      noFamiliesEmptyProposal: 1,
    };
    const bad = Object.keys(want).filter(k => got[k] !== want[k]);
    for (const k of bad)
      console.log(`FAIL control ${k}: exit ${got[k]}, want ${want[k]}`);
    return bad.length === 0;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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
      full.length === 0 &&
      scratchControls();
    console.log(
      `${ok ? 'PASS' : 'FAIL'} check-ratchet controls (lowering exits 1, raising passes, empty or partial proposal exits 1, unresolvable base/head exit 2, head read from git not the checkout, emptied case file, padded merge of two cases, symlinked case file and emptied families.json with an empty proposal exit 1)`
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
  // Both refs must resolve. An unresolvable base used to read as "no floors at base" and pass
  // lowered floors (verifier audit); an unresolvable head reported zero deletions.
  for (const [name, ref] of [
    ['base', base],
    ['head', head],
  ])
    if (tryGit(['rev-parse', '--verify', '-q', `${ref}^{commit}`]) === null) {
      console.log(
        `INCONCLUSIVE check-ratchet: ${name} ${ref} does not resolve to a commit`
      );
      process.exit(2);
    }
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
  // Committed floors and families come from --head, never the working tree (a checkout elsewhere
  // used to hide a head that lowered them; verifier audit).
  let committedFloors, familiesAtHead, familiesAtBase;
  // The families a proposal must measure: base and head together, so a PR that empties
  // families.json cannot shrink the requirement (verifier audit, second pass).
  try {
    familiesAtBase = JSON.parse(atRef(base, 'tests/eval/jev/families.json'));
  } catch {
    familiesAtBase = { families: {} };
  }
  try {
    committedFloors = JSON.parse(atRef(head, 'tests/eval/jev/floors.json'));
    familiesAtHead = JSON.parse(atRef(head, 'tests/eval/jev/families.json'));
  } catch {
    console.log(
      `INCONCLUSIVE check-ratchet: floors.json or families.json unreadable at ${head}`
    );
    process.exit(2);
  }
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
      ? incompleteProposal(headFloors, {
          families: {
            ...(familiesAtBase?.families || {}),
            ...(familiesAtHead?.families || {}),
          },
        }).map(p => `proposal: ${p}`)
      : []),
    ...(() => {
      try {
        return deletedCases(base, head).map(
          f => `case deleted or shrunk without tombstone: ${f}`
        );
      } catch (e) {
        console.log(
          `INCONCLUSIVE check-ratchet: case diff failed: ${String(e.message).split('\n')[0]}`
        );
        process.exit(2);
      }
    })(),
  ];
  for (const p of problems) console.log(`FAIL check-ratchet: ${p}`);
  if (!problems.length)
    console.log(
      `PASS check-ratchet: ${Object.keys(headFloors.families || {}).length} families, no floor lowered, no untombstoned deletion${prop ? ' (proposal overlay)' : ''}`
    );
  process.exit(problems.length ? 1 : 0);
}
