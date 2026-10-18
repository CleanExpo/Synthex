#!/usr/bin/env node
/**
 * JEV deterministic verdict.
 *
 *   node tests/eval/jev/runner/aggregate.mjs [--family J3 ...] [--control]
 *
 * Reads tests/eval/jev/out/<FAMILY>.jsonl for every family in scope and
 * applies the rules in tests/eval/jev/README.md. Writes out/summary.json and,
 * only on a complete full run that exits 0, the measured floors proposal. Exit 0 only when every family
 * in scope is green; 1 otherwise. --control runs the planted self-test.
 */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const JEV_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.join(JEV_DIR, '../../..');
const STATES = ['PASS', 'FAIL', 'KNOWN_GAP', 'INCONCLUSIVE'];
const MIN_CONTROLS = 3;

export const DEFAULTS = {
  familiesFile: path.join(JEV_DIR, 'families.json'),
  outDir: path.join(JEV_DIR, 'out'),
  floorsFile: path.join(ROOT, 'proposals/P1/tests/eval/jev/floors.json'),
};

function readRows(file) {
  const rows = [];
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    try {
      rows.push(JSON.parse(lines[i]));
    } catch {
      return { rows, bad: `line ${i + 1} is not JSON` };
    }
  }
  return { rows };
}

/** Verdict for one family: { cases, pass, fail, known_gap, inconclusive, controls, controls_caught, state, reasons }. */
function judgeFamily(id, def, outDir) {
  const r = {
    cases: 0,
    pass: 0,
    fail: 0,
    known_gap: 0,
    inconclusive: 0,
    controls: 0,
    controls_caught: 0,
  };
  const file = path.join(outDir, `${id}.jsonl`);
  if (!fs.existsSync(file))
    return { ...r, state: 'MISSING', reasons: [`no ${path.basename(file)}`] };

  const reasons = [];
  const { rows, bad } = readRows(file);
  if (bad) reasons.push(bad);
  const seen = new Set();
  for (const row of rows) {
    if (
      row.family !== id ||
      !STATES.includes(row.state) ||
      !['case', 'control'].includes(row.kind) ||
      !row.id ||
      (row.state === 'KNOWN_GAP' && !row.gap_id)
    ) {
      reasons.push(`malformed row ${JSON.stringify(row).slice(0, 120)}`);
      continue;
    }
    if (seen.has(`${row.kind}:${row.id}`))
      reasons.push(`duplicate ${row.kind} id ${row.id}`);
    seen.add(`${row.kind}:${row.id}`);
    if (row.kind === 'control') {
      r.controls++;
      if (row.state === 'FAIL') r.controls_caught++;
      else reasons.push(`control ${row.id} not caught (${row.state})`);
      continue;
    }
    r.cases++;
    r[
      {
        PASS: 'pass',
        FAIL: 'fail',
        KNOWN_GAP: 'known_gap',
        INCONCLUSIVE: 'inconclusive',
      }[row.state]
    ]++;
  }
  if (r.controls < MIN_CONTROLS)
    reasons.push(`${r.controls} controls, need >= ${MIN_CONTROLS}`);
  if (r.cases !== def.expected_cases)
    reasons.push(`${r.cases} cases, expected ${def.expected_cases}`);
  if (reasons.length) return { ...r, state: 'BROKEN_CHECK', reasons };

  if (r.fail > 0 && def.hard_gate)
    return {
      ...r,
      state: 'FAIL',
      reasons: [`${r.fail} hard-gate case(s) FAIL`],
    };
  // A hard gate is not green on cases it never evaluated. Expected-red cases
  // belong in known-gaps/<FAMILY>.json (KNOWN_GAP), not in INCONCLUSIVE.
  if (r.inconclusive > 0 && def.hard_gate)
    return {
      ...r,
      state: 'INCONCLUSIVE',
      reasons: [`${r.inconclusive} hard-gate case(s) INCONCLUSIVE`],
    };
  return { ...r, state: r.fail > 0 ? 'RED_ADVISORY' : 'PASS', reasons: [] };
}

/**
 * Aggregate the families in scope. Returns { summary, exit }.
 * opts: { families?, runFailures?, familiesFile, outDir, floorsFile, write = true, log = console.log }
 * runFailures: run-level failures found before the rows were read (a red
 * Jest run); each one fails the run whatever the rows say.
 */
export function aggregate(opts = {}) {
  const o = { ...DEFAULTS, write: true, log: console.log, ...opts };
  const table = JSON.parse(fs.readFileSync(o.familiesFile, 'utf8'));
  if (table.schema !== 'jev-families/1')
    throw new Error(`families.json: unexpected schema ${table.schema}`);
  const scope = o.families ?? Object.keys(table.families);

  const families = {};
  let exit = 0;
  const runFailures = o.runFailures ?? [];
  for (const failure of runFailures) {
    o.log(`FAIL run ${failure}`);
    exit = 1;
  }
  for (const id of scope) {
    const def = table.families[id];
    if (!def) {
      families[id] = { state: 'UNKNOWN_FAMILY' };
      o.log(`FAIL ${id} unknown family (not in families.json)`);
      exit = 1;
      continue;
    }
    const { reasons, ...verdict } = judgeFamily(id, def, o.outDir);
    families[id] = verdict;
    const green = verdict.state === 'PASS' || verdict.state === 'RED_ADVISORY';
    if (!green) exit = 1;
    const counts = `cases=${verdict.cases} pass=${verdict.pass} fail=${verdict.fail} known_gap=${verdict.known_gap} inconclusive=${verdict.inconclusive} controls=${verdict.controls_caught}/${verdict.controls}`;
    o.log(
      `${green ? 'PASS' : 'FAIL'} ${id} ${verdict.state} ${counts}${reasons.length ? ` — ${reasons.join('; ')}` : ''}`
    );
  }

  const at = new Date().toISOString();
  const summary = {
    run_id: `jev-det-${at.replace(/[-:.]/g, '')}`,
    at,
    families,
    total_cases: Object.values(families).reduce(
      (n, f) => n + (f.cases ?? 0),
      0
    ),
    run_failures: runFailures,
    exit,
  };
  if (o.write) {
    fs.mkdirSync(o.outDir, { recursive: true });
    fs.writeFileSync(
      path.join(o.outDir, 'summary.json'),
      `${JSON.stringify(summary, null, 2)}\n`
    );
    if (o.families) {
      o.log('floors proposal left as is: a --family run never rewrites it');
    } else if (exit !== 0 || !scope.length) {
      o.log(
        `floors proposal left as is: run exit ${exit}, not every family in families.json measured green`
      );
    } else {
      const measured = Object.fromEntries(
        Object.entries(families).map(([id, f]) => [
          id,
          {
            pass_rate: f.cases
              ? Math.floor((f.pass / f.cases) * 1000) / 1000
              : 0,
          },
        ])
      );
      let previous;
      try {
        previous = JSON.parse(fs.readFileSync(o.floorsFile, 'utf8')).families;
      } catch {}
      if (JSON.stringify(previous) === JSON.stringify(measured)) {
        o.log('floors proposal left as is: measured floors unchanged');
      } else {
        const floors = {
          schema: 'jev-floors/1',
          measured_at: at,
          note: `measured by npm run jev:det (${summary.run_id}, exit ${exit}); proposal only, adopting it into tests/eval/jev/floors.json is gated (rule B2)`,
          families: measured,
        };
        fs.mkdirSync(path.dirname(o.floorsFile), { recursive: true });
        fs.writeFileSync(o.floorsFile, `${JSON.stringify(floors, null, 2)}\n`);
      }
    }
  }
  return { summary, exit };
}

/** Planted self-test: each scenario must produce the expected verdict. */
function runControls() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jev-control-'));
  const familiesFile = path.join(dir, 'families.json');
  const families = {
    C1: { name: 'control stayed PASS', expected_cases: 2, hard_gate: true },
    C2: { name: 'hard-gate FAIL case', expected_cases: 2, hard_gate: true },
    C3: { name: 'wrong case count', expected_cases: 3, hard_gate: false },
    C4: { name: 'clean', expected_cases: 2, hard_gate: true },
    C5: {
      name: 'hard-gate all INCONCLUSIVE',
      expected_cases: 2,
      hard_gate: true,
    },
    C6: {
      name: 'advisory INCONCLUSIVE',
      expected_cases: 2,
      hard_gate: false,
    },
    C7: {
      name: 'KNOWN_GAP with no gap id',
      expected_cases: 2,
      hard_gate: true,
    },
  };
  fs.writeFileSync(
    familiesFile,
    JSON.stringify({ schema: 'jev-families/1', families })
  );
  const row = (family, kind, id, state) => ({
    id,
    family,
    kind,
    state,
    ...(state === 'KNOWN_GAP' ? { gap_id: 'M0' } : {}),
  });
  const controls = (f, last = 'FAIL') => [
    row(f, 'control', 'k1', 'FAIL'),
    row(f, 'control', 'k2', 'FAIL'),
    row(f, 'control', 'k3', last),
  ];
  const planted = {
    C1: [
      row('C1', 'case', 'a', 'PASS'),
      row('C1', 'case', 'b', 'PASS'),
      ...controls('C1', 'PASS'),
    ],
    C2: [
      row('C2', 'case', 'a', 'PASS'),
      row('C2', 'case', 'b', 'FAIL'),
      ...controls('C2'),
    ],
    C3: [
      row('C3', 'case', 'a', 'PASS'),
      row('C3', 'case', 'b', 'PASS'),
      ...controls('C3'),
    ],
    C4: [
      row('C4', 'case', 'a', 'PASS'),
      row('C4', 'case', 'b', 'KNOWN_GAP'),
      ...controls('C4'),
    ],
    C5: [
      row('C5', 'case', 'a', 'INCONCLUSIVE'),
      row('C5', 'case', 'b', 'INCONCLUSIVE'),
      ...controls('C5'),
    ],
    C6: [
      row('C6', 'case', 'a', 'PASS'),
      row('C6', 'case', 'b', 'INCONCLUSIVE'),
      ...controls('C6'),
    ],
    C7: [
      row('C7', 'case', 'a', 'PASS'),
      { id: 'b', family: 'C7', kind: 'case', state: 'KNOWN_GAP' },
      ...controls('C7'),
    ],
  };
  for (const [f, rows] of Object.entries(planted)) {
    fs.writeFileSync(
      path.join(dir, `${f}.jsonl`),
      rows.map(r => JSON.stringify(r)).join('\n') + '\n'
    );
  }
  const expect = {
    C1: [1, 'BROKEN_CHECK'],
    C2: [1, 'FAIL'],
    C3: [1, 'BROKEN_CHECK'],
    C4: [0, 'PASS'],
    C5: [1, 'INCONCLUSIVE'],
    C6: [0, 'PASS'],
    C7: [1, 'BROKEN_CHECK'],
  };
  let ok = true;
  for (const [f, [wantExit, wantState]] of Object.entries(expect)) {
    const { summary, exit } = aggregate({
      families: [f],
      familiesFile,
      outDir: dir,
      write: false,
      log: () => {},
    });
    const got = summary.families[f].state;
    const good = exit === wantExit && got === wantState;
    if (!good) ok = false;
    console.log(
      `${good ? 'PASS' : 'FAIL'} control ${f} (${families[f].name}): exit=${exit} state=${got}, want exit=${wantExit} state=${wantState}`
    );
  }
  // Every --family given is in scope, not only the first.
  {
    const { summary, exit } = aggregate({
      ...parseArgs(['--family', 'C4', '--family', 'C2']),
      familiesFile,
      outDir: dir,
      write: false,
      log: () => {},
    });
    const got = Object.keys(summary.families).join(',');
    const good = exit === 1 && got === 'C4,C2';
    if (!good) ok = false;
    console.log(
      `${good ? 'PASS' : 'FAIL'} control --family C4 --family C2: exit=${exit} scope=${got}, want exit=1 scope=C4,C2`
    );
  }
  if (!proposalControls(dir, familiesFile)) ok = false;
  if (!runDetControls()) ok = false;
  fs.rmSync(dir, { recursive: true, force: true });
  return ok ? 0 : 1;
}

/**
 * Planted self-test for the floors proposal: a failed, partial or --family run
 * leaves it byte-identical; only a complete green run with new floors rewrites it.
 */
function proposalControls(dir, brokenFamiliesFile) {
  const floorsFile = path.join(dir, 'proposal', 'floors.json');
  const cleanFamiliesFile = path.join(dir, 'families-clean.json');
  fs.writeFileSync(
    cleanFamiliesFile,
    JSON.stringify({
      schema: 'jev-families/1',
      families: { C4: { name: 'clean', expected_cases: 2, hard_gate: true } },
    })
  );
  const partialFamiliesFile = path.join(dir, 'families-partial.json');
  fs.writeFileSync(
    partialFamiliesFile,
    JSON.stringify({
      schema: 'jev-families/1',
      families: {
        C4: { name: 'clean', expected_cases: 2, hard_gate: true },
        C9: { name: 'never ran', expected_cases: 2, hard_gate: false },
      },
    })
  );
  const seed = '{"planted":"measured baseline"}\n';
  const run = opts =>
    aggregate({ outDir: dir, floorsFile, log: () => {}, ...opts });
  const scenarios = [
    ['failed full run', { familiesFile: brokenFamiliesFile }, false],
    ['partial full run', { familiesFile: partialFamiliesFile }, false],
    [
      '--family run',
      { familiesFile: cleanFamiliesFile, families: ['C4'] },
      false,
    ],
    [
      'Jest red full run',
      { familiesFile: cleanFamiliesFile, runFailures: ['jest exit 1'] },
      false,
    ],
    ['complete green run', { familiesFile: cleanFamiliesFile }, true],
  ];
  let ok = true;
  for (const [name, opts, wantWrite] of scenarios) {
    fs.mkdirSync(path.dirname(floorsFile), { recursive: true });
    fs.writeFileSync(floorsFile, seed);
    run(opts);
    const wrote = fs.readFileSync(floorsFile, 'utf8') !== seed;
    const good = wrote === wantWrite;
    if (!good) ok = false;
    console.log(
      `${good ? 'PASS' : 'FAIL'} control proposal (${name}): rewritten=${wrote}, want ${wantWrite}`
    );
  }
  // Same floors again: the proposal is not churned for a new timestamp.
  const before = fs.readFileSync(floorsFile, 'utf8');
  run({ familiesFile: cleanFamiliesFile });
  const same = fs.readFileSync(floorsFile, 'utf8') === before;
  if (!same) ok = false;
  console.log(
    `${same ? 'PASS' : 'FAIL'} control proposal (unchanged floors): rewritten=${!same}, want false`
  );
  return ok;
}

/**
 * Planted self-test for run-det.mjs, at its exit code: a family whose Jest
 * test records valid rows and then fails an assertion must not exit 0, and
 * neither may a run where a later --family never produced rows. The clean
 * twin must exit 0, so the reds are the plants, not a broken fixture. It must
 * also exit 0 with no npx on PATH: a bare 'npx' spawn is ENOENT there, as it
 * is on Windows (npx.cmd needs a shell).
 */
function runDetControls() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jev-run-det-'));
  const outDir = path.join(dir, 'out');
  const familiesFile = path.join(dir, 'families.json');
  const jestConfig = path.join(dir, 'jest.config.json');
  fs.mkdirSync(path.join(dir, 'families'));
  fs.writeFileSync(
    familiesFile,
    JSON.stringify({
      schema: 'jev-families/1',
      families: {
        CJ: { name: 'Jest red after rows', expected_cases: 1, hard_gate: true },
        CK: { name: 'clean twin', expected_cases: 1, hard_gate: true },
        CM: { name: 'no test file', expected_cases: 1, hard_gate: true },
      },
    })
  );
  fs.writeFileSync(
    jestConfig,
    JSON.stringify({
      rootDir: dir,
      testEnvironment: 'node',
      testRegex: 'families[\\\\/][^\\\\/]+\\.jev\\.test\\.ts$',
      transform: {},
    })
  );
  for (const [f, red] of [
    ['CJ', true],
    ['CK', false],
  ]) {
    const rows = [
      { id: 'a', family: f, kind: 'case', state: 'PASS' },
      ...['k1', 'k2', 'k3'].map(id => ({
        id,
        family: f,
        kind: 'control',
        state: 'FAIL',
      })),
    ];
    const out = path.join(outDir, `${f}.jsonl`);
    fs.writeFileSync(
      path.join(dir, 'families', `${f.toLowerCase()}.jev.test.ts`),
      `const fs = require('fs');
afterAll(() => {
  fs.mkdirSync(${JSON.stringify(outDir)}, { recursive: true });
  fs.writeFileSync(${JSON.stringify(out)}, ${JSON.stringify(rows.map(r => `${JSON.stringify(r)}\n`).join(''))});
});
it('records valid rows, then asserts', () => {
  expect(${red}).toBe(false);
});
`
    );
  }
  const runDet = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'run-det.mjs'
  );
  const scenarios = [
    ['Jest red after valid rows', ['CJ'], false],
    ['clean twin', ['CK'], true],
    ['second --family has no rows', ['CK', 'CM'], false],
    ['clean twin, no npx on PATH', ['CK'], true, { PATH: dir }],
  ];
  let ok = true;
  for (const [name, scope, wantZero, env] of scenarios) {
    const r = spawnSync(
      process.execPath,
      [
        runDet,
        ...scope.flatMap(f => ['--family', f]),
        '--families-file',
        familiesFile,
        '--out-dir',
        outDir,
        '--jest-config',
        jestConfig,
      ],
      { encoding: 'utf8', env: { ...process.env, ...env } }
    );
    const good = (r.status === 0) === wantZero;
    if (!good) ok = false;
    console.log(
      `${good ? 'PASS' : 'FAIL'} control run-det (${name}): exit=${r.status ?? r.signal}, want ${wantZero ? '0' : 'non-zero'}`
    );
    if (!good)
      console.log(`${r.stdout}${r.stderr}`.split('\n').slice(-15).join('\n'));
  }
  fs.rmSync(dir, { recursive: true, force: true });
  return ok;
}

/** --family may repeat; every value is in scope. families is undefined on a full run. */
export function parseArgs(argv) {
  const args = { control: argv.includes('--control') };
  argv.forEach((a, i) => {
    if (a !== '--family') return;
    const id = argv[i + 1];
    if (!id || id.startsWith('--'))
      throw new Error('--family needs a value, e.g. --family J3');
    args.families = [...new Set([...(args.families ?? []), id])];
  });
  return args;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = parseArgs(process.argv.slice(2));
  process.exit(
    args.control ? runControls() : aggregate({ families: args.families }).exit
  );
}
