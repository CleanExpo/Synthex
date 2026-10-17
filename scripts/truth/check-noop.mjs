#!/usr/bin/env node
/**
 * scripts/truth/check-noop.mjs --base <sha> [--head <ref>] [--expect-base <n>] | --control
 * Exit 0 only when `git grep -l "platform/noop-client" -- app lib services` lists no file at
 * head AND the same command at base lists at least one (positive control: 88 on 2026-10-17).
 */
import { git, tryGit, ROOT, isMain } from '../fleet/lib.mjs';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
export function count(ref) {
  const out = tryGit([
    'grep',
    '-l',
    'platform/noop-client',
    ref,
    '--',
    'app',
    'lib',
    'services',
  ]);
  return out ? out.split('\n').filter(Boolean).length : 0;
}
if (isMain(import.meta.url)) {
  if (args.includes('--control')) {
    // Positive control independent of HEAD (CodeRabbit on PR #997: it must keep passing after the
    // migration reaches zero importers): plant one importer in a scratch dir and prove the same
    // grep finds exactly it.
    const dir = mkdtempSync(path.join(ROOT, '.noop-control-'));
    let found = 0;
    try {
      writeFileSync(
        path.join(dir, 'probe.ts'),
        "import { noop } from '@/lib/platform/noop-client';\n"
      );
      const out = tryGit([
        'grep',
        '--no-index',
        '-l',
        'platform/noop-client',
        '--',
        path.relative(ROOT, dir),
      ]);
      found = out ? out.split('\n').filter(Boolean).length : 0;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    const ok = found === 1;
    console.log(
      `${ok ? 'PASS' : 'FAIL'} check-noop positive control: grep finds ${found} planted importer (expected 1); HEAD currently has ${count('HEAD')}`
    );
    process.exit(ok ? 0 : 1);
  }
  const base = opt('--base');
  if (!base) {
    console.error('usage: --base <sha> [--head <ref>] | --control');
    process.exit(2);
  }
  let atBase, atHead;
  try {
    atBase = count(base);
    atHead = count(opt('--head', 'HEAD'));
  } catch (e) {
    console.log(`INCONCLUSIVE check-noop: ${e.message}`);
    process.exit(2);
  }
  const expect = Number(opt('--expect-base', '1'));
  console.log(`check-noop: importers at base=${atBase}, at head=${atHead}`);
  if (atBase < expect) {
    console.log(
      `INCONCLUSIVE check-noop: positive control failed, base lists ${atBase} < ${expect}`
    );
    process.exit(2);
  }
  if (atHead > 0) {
    console.log(`FAIL check-noop: ${atHead} importer(s) remain`);
    process.exit(1);
  }
  console.log(
    'PASS check-noop: zero importers at head, positive control satisfied at base'
  );
  process.exit(0);
}
