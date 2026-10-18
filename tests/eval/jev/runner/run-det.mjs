#!/usr/bin/env node
/**
 * npm run jev:det [-- --family J3 [--family J8 ...]]
 *
 * Clears the in-scope out/<FAMILY>.jsonl files so a stale result can never be
 * read as this run's, runs the family tests under config/jest/jest.jev.cjs,
 * then hands the verdict to aggregate.mjs. A red Jest run (non-zero status,
 * a signal, or no Jest at all) fails the run even when the rows it left
 * behind would aggregate green: family afterAll hooks record rows whether or
 * not an assertion failed. The aggregate summary is still printed.
 *
 * --families-file, --out-dir and --jest-config point a --family run at a
 * planted fixture (aggregate.mjs --control); they are refused on a full run
 * so a fixture can never rewrite the floors proposal.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { aggregate, parseArgs, DEFAULTS } from './aggregate.mjs';

const argv = process.argv.slice(2);
const args = parseArgs(argv);
const flag = name => {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
};
const fixture = {
  familiesFile: flag('--families-file'),
  outDir: flag('--out-dir'),
  jestConfig: flag('--jest-config'),
};
if (Object.values(fixture).some(Boolean) && !args.families)
  throw new Error('--families-file/--out-dir/--jest-config need --family');
const familiesFile = fixture.familiesFile ?? DEFAULTS.familiesFile;
const outDir = fixture.outDir ?? DEFAULTS.outDir;

const table = JSON.parse(fs.readFileSync(familiesFile, 'utf8'));
const scope = args.families ?? Object.keys(table.families);
for (const id of scope)
  fs.rmSync(path.join(outDir, `${id}.jsonl`), { force: true });

const jestArgs = [
  'jest',
  '--config',
  fixture.jestConfig ?? 'config/jest/jest.jev.cjs',
  '--passWithNoTests',
];
if (args.families) {
  const ids = args.families.map(id =>
    id.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  jestArgs.push(
    '--testPathPattern',
    `families[\\\\/](${ids.join('|')})\\.jev\\.test\\.ts$`
  );
}
const jest = spawnSync('npx', jestArgs, {
  stdio: 'inherit',
  cwd: path.join(DEFAULTS.outDir, '../../../..'),
});
const jestExit = jest.status ?? jest.signal ?? jest.error?.message;
console.log(`jest exit ${jestExit}`);

const runFailures = jest.status === 0 ? [] : [`jest exit ${jestExit}`];
process.exit(
  aggregate({ families: args.families, runFailures, familiesFile, outDir }).exit
);
