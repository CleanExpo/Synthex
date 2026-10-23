#!/usr/bin/env node
/**
 * npm run jev:sweep [-- --goal G1 [--goal G2 ...]] [--seed N] [--as-of YYYY-MM-DD]
 *                   [--out-dir DIR] [--disarm-control G1-C01[,G2-C01]]
 *
 * The JEV goal sweep: high-volume, seeded, offline, script-judged cases, each
 * tagged with the goal (G1..G5) and criterion it measures. Separate from
 * `npm run jev:det`: it never reads or changes families.json / floors.json.
 *
 * Clears the in-scope <out-dir>/<goal>.jsonl, runs the goal tests under
 * config/jest/jest.jev-sweep.cjs, then aggregates per goal and per criterion
 * in the four JEV states and writes <out-dir>/summary.json.
 *
 * Exit codes:
 *   0  every case PASS or KNOWN_GAP and every control caught
 *   1  harness broken: a goal file missing or malformed, a duplicate id,
 *      fewer than 3 controls, a control not caught (BROKEN_CHECK), or Jest red
 *   2  harness sound, and the goals measured at least one FAIL or INCONCLUSIVE
 *
 * --disarm-control runs the named controls WITHOUT their planted defect; a
 * sound sweep then reports BROKEN_CHECK and exits 1 (the run's self-test).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SWEEP_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(SWEEP_DIR, '../../../..');
const GOALS = ['G1', 'G2', 'G3', 'G4', 'G5'];
const STATES = ['PASS', 'FAIL', 'KNOWN_GAP', 'INCONCLUSIVE'];
const KEY = {
  PASS: 'pass',
  FAIL: 'fail',
  KNOWN_GAP: 'known_gap',
  INCONCLUSIVE: 'inconclusive',
};
const MIN_CONTROLS = 3;

const argv = process.argv.slice(2);
const all = name =>
  argv.flatMap((a, i) => {
    if (a !== name) return [];
    if (argv[i + 1] === undefined) throw new Error(`${name} needs a value`);
    return [argv[i + 1]];
  });
const one = name => all(name).at(-1);

const goals = all('--goal').length ? all('--goal') : GOALS;
for (const g of goals)
  if (!GOALS.includes(g)) throw new Error(`unknown goal ${g}`);
const outDir = path.resolve(
  one('--out-dir') ?? path.join(SWEEP_DIR, '../out/sweep')
);
const seed = Number(one('--seed') ?? 20261022);
const asOf = one('--as-of') ?? new Date().toLocaleDateString('en-CA');
const disarm = all('--disarm-control')
  .flatMap(s => s.split(','))
  .filter(Boolean);
if (!Number.isInteger(seed)) throw new Error('--seed needs an integer');
if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf))
  throw new Error('--as-of needs YYYY-MM-DD');

fs.mkdirSync(outDir, { recursive: true });
// <goal>.jsonl or <goal>.<part>.jsonl. Plain string tests, never a RegExp built
// from a command-line argument (CodeQL js/regex-injection).
const PART = /^[a-z0-9-]+$/;
const isGoalFile = (g, f) => {
  if (!f.endsWith('.jsonl')) return false;
  const stem = f.slice(0, -'.jsonl'.length);
  if (stem === g) return true;
  return stem.startsWith(`${g}.`) && PART.test(stem.slice(g.length + 1));
};
const goalFiles = g =>
  fs.existsSync(outDir)
    ? fs
        .readdirSync(outDir)
        .filter(f => isGoalFile(g, f))
        .sort()
    : [];
for (const g of goals)
  for (const f of goalFiles(g))
    fs.rmSync(path.join(outDir, f), { force: true });

const head = spawnSync('git', ['rev-parse', 'HEAD'], {
  cwd: ROOT,
  encoding: 'utf8',
});
const branch = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
  cwd: ROOT,
  encoding: 'utf8',
});

const started = Date.now();
const jest = spawnSync(
  process.execPath,
  [
    createRequire(import.meta.url).resolve('jest/bin/jest'),
    '--config',
    'config/jest/jest.jev-sweep.cjs',
    '--testPathPattern',
    `sweep[\\\\/](${goals.map(g => g.toLowerCase()).join('|')})(-[a-z0-9]+)?\\.sweep\\.test\\.ts$`,
  ],
  {
    stdio: 'inherit',
    cwd: ROOT,
    env: {
      ...process.env,
      SWEEP_OUT_DIR: outDir,
      SWEEP_SEED: String(seed),
      SWEEP_AS_OF: asOf,
      SWEEP_DISARM: disarm.join(','),
    },
  }
);
const runtimeMs = Date.now() - started;
const jestExit = jest.status ?? jest.signal ?? jest.error?.message;
const runFailures = jest.status === 0 ? [] : [`jest exit ${jestExit}`];

const counts = () => ({
  cases: 0,
  pass: 0,
  fail: 0,
  known_gap: 0,
  inconclusive: 0,
});
const summary = {
  schema: 'jev-sweep/1',
  head: head.stdout.trim() || null,
  branch: branch.stdout.trim() || null,
  seed,
  as_of: asOf,
  disarmed: disarm,
  runtime_ms: runtimeMs,
  total_cases: 0,
  total_controls: 0,
  run_failures: runFailures,
  goals: {},
};

let broken = runFailures.length > 0;
let measuredRed = false;
for (const g of goals) {
  const r = {
    ...counts(),
    controls: 0,
    controls_caught: 0,
    criteria: {},
    controls_list: [],
    reasons: [],
  };
  const files = goalFiles(g);
  if (!files.length) {
    summary.goals[g] = { ...r, state: 'MISSING', reasons: [`no ${g}.jsonl`] };
    broken = true;
    continue;
  }
  const seen = new Set();
  const lines = files.flatMap(f =>
    fs
      .readFileSync(path.join(outDir, f), 'utf8')
      .split('\n')
      .filter(l => l.trim())
  );
  for (const [i, line] of lines.entries()) {
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      r.reasons.push(`line ${i + 1} is not JSON`);
      continue;
    }
    if (
      row.goal !== g ||
      row.family !== g ||
      !row.id ||
      !row.criterion ||
      !STATES.includes(row.state) ||
      !['case', 'control'].includes(row.kind) ||
      (row.state === 'KNOWN_GAP' && !row.gap_id)
    ) {
      r.reasons.push(`malformed row ${line.slice(0, 120)}`);
      continue;
    }
    const k = `${row.kind}:${row.id}`;
    if (seen.has(k)) r.reasons.push(`duplicate ${k}`);
    seen.add(k);
    if (row.kind === 'control') {
      r.controls++;
      const caught = row.state === 'FAIL';
      if (caught) r.controls_caught++;
      else r.reasons.push(`control ${row.id} not caught (${row.state})`);
      r.controls_list.push({
        id: row.id,
        criterion: row.criterion,
        state: row.state,
        detail: row.detail,
      });
      continue;
    }
    r.cases++;
    r[KEY[row.state]]++;
    const c = (r.criteria[row.criterion] ??= counts());
    c.cases++;
    c[KEY[row.state]]++;
  }
  if (r.controls < MIN_CONTROLS)
    r.reasons.push(`${r.controls} controls, need >= ${MIN_CONTROLS}`);
  if (r.cases === 0) r.reasons.push('no cases');
  let state;
  if (r.reasons.length) {
    state = 'BROKEN_CHECK';
    broken = true;
  } else if (r.fail > 0) state = 'FAIL';
  else if (r.inconclusive > 0) state = 'INCONCLUSIVE';
  else state = 'PASS';
  if (state === 'FAIL' || state === 'INCONCLUSIVE') measuredRed = true;
  summary.goals[g] = { state, ...r };
  summary.total_cases += r.cases;
  summary.total_controls += r.controls;
}

const exit = broken ? 1 : measuredRed ? 2 : 0;
summary.exit = exit;
fs.writeFileSync(
  path.join(outDir, 'summary.json'),
  `${JSON.stringify(summary, null, 2)}\n`
);

console.log(
  `\nJEV sweep  head=${summary.head} branch=${summary.branch} seed=${seed} as_of=${asOf} runtime=${(runtimeMs / 1000).toFixed(1)}s`
);
for (const failure of runFailures) console.log(`FAIL run ${failure}`);
for (const [g, r] of Object.entries(summary.goals)) {
  console.log(
    `${g} ${r.state} cases=${r.cases} pass=${r.pass} fail=${r.fail} known_gap=${r.known_gap} inconclusive=${r.inconclusive} controls=${r.controls_caught}/${r.controls}`
  );
  for (const [c, n] of Object.entries(r.criteria))
    console.log(
      `  ${c} cases=${n.cases} pass=${n.pass} fail=${n.fail} known_gap=${n.known_gap} inconclusive=${n.inconclusive}`
    );
  for (const why of r.reasons.slice(0, 10)) console.log(`  ! ${why}`);
}
console.log(
  `total cases=${summary.total_cases} controls=${summary.total_controls} exit=${exit} summary=${path.join(outDir, 'summary.json')}`
);
process.exit(exit);
