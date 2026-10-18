#!/usr/bin/env node
/**
 * npm run jev:det [-- --family J3]
 *
 * Clears the in-scope out/<FAMILY>.jsonl files so a stale result can never be
 * read as this run's, runs the family tests under config/jest/jest.jev.cjs,
 * then hands the verdict to aggregate.mjs. The Jest exit code is not the
 * verdict: it is printed and ignored.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { aggregate, parseArgs, DEFAULTS } from './aggregate.mjs';

const args = parseArgs(process.argv.slice(2));
const table = JSON.parse(fs.readFileSync(DEFAULTS.familiesFile, 'utf8'));
const scope = args.family ? [args.family] : Object.keys(table.families);
for (const id of scope)
  fs.rmSync(path.join(DEFAULTS.outDir, `${id}.jsonl`), { force: true });

const jestArgs = [
  'jest',
  '--config',
  'config/jest/jest.jev.cjs',
  '--passWithNoTests',
];
if (args.family)
  jestArgs.push(
    '--testPathPattern',
    `families[\\\\/]${args.family.toLowerCase()}\\.jev\\.test\\.ts$`
  );
const jest = spawnSync('npx', jestArgs, {
  stdio: 'inherit',
  cwd: path.join(DEFAULTS.outDir, '../../../..'),
});
console.log(`jest exit ${jest.status ?? jest.signal} (not the verdict)`);

process.exit(aggregate({ family: args.family }).exit);
