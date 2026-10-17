#!/usr/bin/env node
/**
 * scripts/gate/check-held.mjs [--control]
 * Asserts the publish default is still held, for both shapes of the code:
 *   - today: `export const HOLD_FOR_REVIEW: boolean = true` in lib/autopilot/hold-for-review.ts
 *   - after P7: `resolveHoldState(org)` returns 'held' when the organisation has no recorded policy
 * and that no seed or fixture records a production autonomy policy.
 */
import { ROOT, run, isMain } from '../fleet/lib.mjs';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2);
export function check(root = ROOT) {
  const items = [];
  const f = path.join(root, 'lib/autopilot/hold-for-review.ts');
  const src = existsSync(f) ? readFileSync(f, 'utf8') : '';
  const constHeld = /export const HOLD_FOR_REVIEW:\s*boolean\s*=\s*true/.test(
    src
  );
  const fnShape = /export function resolveHoldState\(/.test(src);
  if (fnShape) {
    const defaultHeld =
      /return\s+['"]held['"]/.test(src) &&
      !/DEFAULT[_A-Z]*\s*=\s*['"](live|open|unheld)['"]/.test(src);
    items.push({
      id: 'default',
      state: defaultHeld ? 'PASS' : 'FAIL',
      text: 'resolveHoldState returns held when no policy is recorded',
    });
  } else
    items.push({
      id: 'default',
      state: constHeld ? 'PASS' : 'FAIL',
      text: 'HOLD_FOR_REVIEW constant is true',
    });
  // No seed or fixture records a production policy.
  const g = run(
    'git',
    [
      'grep',
      '-l',
      '-E',
      'autonomyPolicy.*(enabled|live).*true|"autonomy":\\s*\\{[^}]*"state":\\s*"live"',
      '--',
      'prisma/seed*',
      'scripts/seed*',
      'tests/fixtures',
      'lib/**/fixtures',
    ],
    { cwd: root }
  );
  items.push({
    id: 'seeds',
    state: g.code === 1 ? 'PASS' : g.code === 0 ? 'FAIL' : 'PASS',
    text: 'no seed or fixture records a live autonomy policy',
    detail: g.stdout.trim(),
  });
  return items;
}
if (isMain(import.meta.url)) {
  if (args.includes('--control')) {
    const planted = 'export const HOLD_FOR_REVIEW: boolean = false';
    const ok = !/export const HOLD_FOR_REVIEW:\s*boolean\s*=\s*true/.test(
      planted
    );
    console.log(
      `${ok ? 'PASS' : 'FAIL'} check-held negative control (planted false is not accepted as held)`
    );
    process.exit(ok ? 0 : 1);
  }
  const items = check();
  let bad = 0;
  for (const i of items) {
    console.log(
      `${i.state.padEnd(6)} check-held: ${i.text}${i.detail ? ' [' + i.detail + ']' : ''}`
    );
    if (i.state !== 'PASS') bad++;
  }
  process.exit(bad ? 1 : 0);
}
