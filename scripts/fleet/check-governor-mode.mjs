#!/usr/bin/env node
/**
 * scripts/fleet/check-governor-mode.mjs [--control]
 * The AI Governor is in shadow mode until a human-authored change flips it (P5/P9).
 * Reads lib/ai/governor/mode.ts (created by P5). Absent file = governor not wired = shadow = PASS.
 * mode 'enforcing' passes only when the commit that introduced it is not a fleet commit.
 */
import { ROOT, tryGit, isFleetCommit, isMain } from './lib.mjs';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
const a = process.argv.slice(2);
export function evaluate(src, flipSha, fleetAuthored) {
  if (src === null)
    return { state: 'PASS', detail: 'governor not wired: shadow by absence' };
  const m =
    /GOVERNOR_MODE\s*(?::\s*[A-Za-z'" |]+)?=\s*['"](shadow|enforcing)['"]/.exec(
      src
    );
  if (!m)
    return {
      state: 'FAIL',
      detail: 'mode.ts holds no GOVERNOR_MODE of shadow|enforcing',
    };
  if (m[1] === 'shadow') return { state: 'PASS', detail: 'shadow' };
  if (!flipSha)
    return { state: 'FAIL', detail: 'enforcing but no commit introduced it' };
  return fleetAuthored
    ? {
        state: 'FAIL',
        detail: `enforcing flip ${flipSha.slice(0, 12)} authored by a fleet principal`,
      }
    : {
        state: 'PASS',
        detail: `enforcing, flipped by a person at ${flipSha.slice(0, 12)}`,
      };
}
if (isMain(import.meta.url)) {
  if (a.includes('--control')) {
    const ok =
      evaluate("export const GOVERNOR_MODE = 'enforcing'", 'abc123456789', true)
        .state === 'FAIL' &&
      evaluate("export const GOVERNOR_MODE = 'shadow'", null, false).state ===
        'PASS' &&
      evaluate(null).state === 'PASS';
    console.log(
      `${ok ? 'PASS' : 'FAIL'} check-governor-mode controls (fleet-authored flip fails, shadow passes)`
    );
    process.exit(ok ? 0 : 1);
  }
  const f = path.join(ROOT, 'lib/ai/governor/mode.ts');
  const src = existsSync(f) ? readFileSync(f, 'utf8') : null;
  let sha = null,
    fleet = false;
  if (src && /enforcing/.test(src)) {
    sha = tryGit([
      'log',
      '-S',
      "'enforcing'",
      '--format=%H',
      '-n',
      '1',
      '--',
      'lib/ai/governor/mode.ts',
    ]);
    if (sha) fleet = isFleetCommit(sha);
  }
  const r = evaluate(src, sha, fleet);
  console.log(`${r.state} check-governor-mode: ${r.detail}`);
  process.exit(r.state === 'PASS' ? 0 : 1);
}
