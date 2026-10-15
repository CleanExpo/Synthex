/**
 * Every removed public-copy segment must be a committed tripwire seed —
 * completeness check, a SUBSET rule (SYN-1226).
 *
 * scripts/claims-seeds.ts enumerates public-copy segments at base 83243588
 * and at every snapshot since, and lists every segment the working tree no
 * longer carries. This fails when a regenerated seed is missing from the
 * committed seed file: copy removed without regenerating, or a seed deleted
 * by hand. Extra committed seeds are allowed — after a squash merge the
 * history is shorter, so regeneration yields a subset and main stays green.
 * Duplicate committed seeds fail.
 *
 * Needs the full Git history back to 83243588 (CI checks out with
 * fetch-depth: 0). Without it the test fails, and says so: an unavailable
 * check must not pass.
 *
 * Fix a failure with: npm run claims:seeds -- --write (it keeps every
 * committed seed and only adds new ones).
 */

import { execFileSync, spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';
import {
  GENERATED_SEEDS_FILE,
  ROOT,
  type GeneratedSeed,
} from './helpers/public-claims';

const BASE = '83243588f2505c556a215dee6f275dcd10626caa';

const keys = (seeds: GeneratedSeed[]) => seeds.map(s => s.key).sort();

describe('public copy — committed tripwire seeds cover the Git-history generator', () => {
  it('has the history the generator reads', () => {
    let reachable = false;
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', BASE, 'HEAD'], {
        cwd: ROOT,
        stdio: 'ignore',
      });
      reachable = true;
    } catch {
      reachable = false;
    }
    expect({ baseIsAncestorOfHead: reachable }).toEqual({
      baseIsAncestorOfHead: true,
    });
  });

  it('has no duplicate committed seed', () => {
    const committed = JSON.parse(
      readFileSync(path.join(ROOT, GENERATED_SEEDS_FILE), 'utf8')
    ).seeds as GeneratedSeed[];
    const seen = new Set<string>();
    const duplicates = keys(committed).filter(k => {
      const dup = seen.has(k);
      seen.add(k);
      return dup;
    });
    expect(duplicates).toEqual([]);
  });

  it('commits every seed the history regenerates', () => {
    const run = spawnSync(
      process.execPath,
      [
        path.join(ROOT, 'node_modules/tsx/dist/cli.mjs'),
        'scripts/claims-seeds.ts',
      ],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }
    );
    expect({ exit: run.status, stderr: run.status ? run.stderr : '' }).toEqual({
      exit: 0,
      stderr: '',
    });
    const regenerated = JSON.parse(run.stdout).seeds as GeneratedSeed[];
    const committed = JSON.parse(
      readFileSync(path.join(ROOT, GENERATED_SEEDS_FILE), 'utf8')
    ).seeds as GeneratedSeed[];

    const have = new Set(keys(committed));
    // Removed copy the committed file omits. (Extra committed seeds pass.)
    expect({
      missingFromCommitted: keys(regenerated).filter(k => !have.has(k)),
    }).toEqual({ missingFromCommitted: [] });
  }, 300_000);
});
