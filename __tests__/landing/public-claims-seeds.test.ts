/**
 * The committed tripwire seed set must equal what the Git-history generator
 * produces now (SYN-1226).
 *
 * scripts/claims-seeds.ts enumerates public-copy segments at base 83243588
 * and at every snapshot since, and lists every claim-bearing segment the
 * working tree no longer carries. A claim removed without regenerating the
 * seed file — or a seed deleted by hand — fails here, so the tripwire can
 * never silently omit a removed claim.
 *
 * Needs the full Git history back to 83243588 (CI checks out with
 * fetch-depth: 0). Without it the test fails, and says so: an unavailable
 * check must not pass.
 *
 * Fix a failure with: npm run claims:seeds -- --write
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

describe('public copy — tripwire seeds equal the Git-history generator', () => {
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

  it('regenerates exactly the committed seed set', () => {
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
    const want = new Set(keys(regenerated));
    // Removed claims the committed file omits, and seeds it has that the
    // generator does not produce.
    expect({
      missingFromCommitted: [...want].filter(k => !have.has(k)),
      notGenerated: [...have].filter(k => !want.has(k)),
    }).toEqual({ missingFromCommitted: [], notGenerated: [] });
    expect(committed).toEqual(regenerated);
  }, 300_000);
});
