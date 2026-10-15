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
  seedKeyOf,
  type GeneratedSeed,
  type RetiredSeed,
} from './helpers/public-claims';

const BASE = '83243588f2505c556a215dee6f275dcd10626caa';

// Keys are always derived from text — the text the guard matches on — never
// read from the file.
const keys = (seeds: GeneratedSeed[]) =>
  seeds.map(s => seedKeyOf(s.text)).sort();
const seedFile = (json: string) =>
  JSON.parse(json) as {
    seeds: Array<GeneratedSeed & { key?: string }>;
    retired?: RetiredSeed[];
  };
const current = () =>
  seedFile(readFileSync(path.join(ROOT, GENERATED_SEEDS_FILE), 'utf8'));
const committedSeeds = () => current().seeds;
const retiredKeys = () =>
  new Set((current().retired ?? []).map(r => seedKeyOf(r.text)));

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

  // A stored key could disagree with the text the guard matches on; none may
  // be stored, and any that is must equal seedKeyOf(text).
  it('stores no key that diverges from its seed text', () => {
    const diverging = committedSeeds()
      .filter(s => s.key !== undefined && s.key !== seedKeyOf(s.text))
      .map(s => ({ text: s.text, storedKey: s.key }));
    expect({
      storedKeys: committedSeeds().filter(s => s.key !== undefined).length,
      diverging,
    }).toEqual({ storedKeys: 0, diverging: [] });
  });

  it('has no duplicate committed seed', () => {
    const committed = committedSeeds();
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
    const have = new Set([...keys(committedSeeds()), ...retiredKeys()]);
    // Regenerated (text, key) pairs the committed file omits, keys derived
    // from text on both sides. An edited seed text derives a different key,
    // so the original segment shows up here. (Extra committed seeds pass.)
    expect({
      missingFromCommitted: regenerated
        .map(s => ({ text: s.text, key: seedKeyOf(s.text) }))
        .filter(pair => !have.has(pair.key)),
    }).toEqual({ missingFromCommitted: [] });
  }, 300_000);

  // Append-only: every seed any earlier commit since base carried must still
  // be a seed, or be retired with a reason. Editing a seed's text removes the
  // old text, so it fails here even when the same change restores the claim
  // (which would make the generator stop listing it). After a squash merge
  // there are no earlier versions to compare.
  it('keeps every seed earlier commits carried, unless retired with a reason', () => {
    const shas = execFileSync(
      'git',
      ['log', '--format=%H', `${BASE}..HEAD`, '--', GENERATED_SEEDS_FILE],
      { cwd: ROOT, encoding: 'utf8' }
    )
      .split('\n')
      .filter(Boolean);
    const have = new Set([...keys(committedSeeds()), ...retiredKeys()]);
    const dropped = new Map<string, string>();
    for (const sha of shas) {
      for (const seed of seedFile(
        execFileSync('git', ['show', `${sha}:${GENERATED_SEEDS_FILE}`], {
          cwd: ROOT,
          encoding: 'utf8',
          maxBuffer: 1 << 28,
        })
      ).seeds) {
        const key = seedKeyOf(seed.text);
        if (!have.has(key))
          dropped.set(key, `${seed.text} (in ${sha.slice(0, 8)})`);
      }
    }
    expect({ dropped: [...dropped.values()] }).toEqual({ dropped: [] });
    const unexplained = (current().retired ?? []).filter(
      r => !r.text || !r.reason || r.reason.trim().length < 10
    );
    expect(unexplained).toEqual([]);
  });
});
