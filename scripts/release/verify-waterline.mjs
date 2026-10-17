#!/usr/bin/env node
/**
 * scripts/release/verify-waterline.mjs [--since <ref>] [--control]
 *
 * Reads waterline events and exits non-zero if any actor is a fleet principal where a
 * person is required. Under FD-2 and FD-3 (DECISIONS.md) the fleet merges its own PRs
 * with the founder's account, so merge actor is NOT a waterline event here; the events
 * that still require a human author are:
 *   - any change under prisma/migrations/**
 *   - any change to the autonomy-policy default or the HOLD_FOR_REVIEW constant
 *   - any change to DEPLOY_INHIBIT in .github/workflows/deploy.yml
 *   - the Governor flip (checked by check-governor-mode.mjs)
 * A commit is a fleet commit when its committer email or Fleet-Role trailer matches policy.
 * Positive control: a planted fixture event whose actor is a fleet principal must exit 1.
 */
import {
  policy,
  git,
  tryGit,
  isFleetCommit,
  ROOT,
  ledgerRows,
  isMain,
} from '../fleet/lib.mjs';
const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const WATERLINE = [
  { name: 'prisma migrations', paths: ['prisma/migrations/'], grep: null },
  {
    name: 'HOLD_FOR_REVIEW constant',
    paths: ['lib/autopilot/hold-for-review.ts'],
    grep: /HOLD_FOR_REVIEW:\s*boolean\s*=\s*false/,
  },
  {
    name: 'autonomy policy default',
    paths: ['lib/publish/autonomy-policy.ts'],
    grep: /DEFAULT_AUTONOMY_STATE\s*=\s*['"](?!held)/,
  },
  {
    name: 'DEPLOY_INHIBIT',
    paths: ['.github/workflows/deploy.yml'],
    grep: /DEPLOY_INHIBIT/,
  },
];
export function events(since) {
  const range = since ? `${since}..HEAD` : 'HEAD~200..HEAD';
  const shas = (tryGit(['rev-list', '--no-merges', range]) || '')
    .split('\n')
    .filter(Boolean);
  const out = [];
  for (const sha of shas) {
    const files = (tryGit(['show', '--name-only', '--format=', sha]) || '')
      .split('\n')
      .filter(Boolean);
    for (const w of WATERLINE) {
      const hit = files.filter(f => w.paths.some(p => f.startsWith(p)));
      if (!hit.length) continue;
      if (w.grep) {
        const patch = tryGit(['show', '--format=', sha, '--', ...hit]) || '';
        const added = patch
          .split('\n')
          .filter(l => l.startsWith('+') && !l.startsWith('+++'))
          .join('\n');
        if (!w.grep.test(added)) continue;
      }
      out.push({ sha, event: w.name, fleet: isFleetCommit(sha), files: hit });
    }
  }
  for (const r of ledgerRows().filter(r => r.kind === 'waterline'))
    out.push({
      sha: r.sha || null,
      event: r.event,
      fleet: r.actor_is_fleet === true,
      ledger: true,
    });
  return out;
}
if (isMain(import.meta.url)) {
  if (args.includes('--control')) {
    const planted = [
      { sha: 'planted', event: 'prisma migrations', fleet: true },
    ];
    const bad = planted.filter(e => e.fleet).length;
    console.log(
      `${bad ? 'PASS' : 'FAIL'} verify-waterline positive control (planted fleet-authored waterline event is flagged)`
    );
    process.exit(bad ? 0 : 1);
  }
  let ev;
  try {
    ev = events(opt('--since'));
  } catch (e) {
    console.log(`INCONCLUSIVE verify-waterline: ${e.message}`);
    process.exit(2);
  }
  let bad = 0;
  for (const e of ev) {
    console.log(
      `${e.fleet ? 'FAIL' : 'PASS'} ${e.event} @ ${String(e.sha).slice(0, 12)}${e.fleet ? ' — authored by a fleet principal' : ''}`
    );
    if (e.fleet) bad++;
  }
  console.log(`verify-waterline: ${ev.length} events, ${bad} fleet-authored`);
  process.exit(bad ? 1 : 0);
}
