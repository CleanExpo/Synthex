#!/usr/bin/env node

/**
 * Consolidated Synthex /shipit gate reporter.
 *
 * Default mode is local-only and safe to run repeatedly. Use --live to also
 * run public production smoke, deployed SHA parity, and Vercel env metadata
 * checks. Use --run-rls to execute the read-only adversarial RLS check when a
 * Supabase/Postgres connection string is present. No production mutation is
 * performed.
 */

import { existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';

const STALE_PARTIAL_ARTIFACT =
  '/Users/phill-mac/Documents/Synthex_PARTIAL_ORPHAN_20260526-230400';
const ARCHIVED_PARTIAL_ARTIFACT =
  '/Users/phill-mac/Documents/.Synthex_PARTIAL_ORPHAN_20260526-230400_ARCHIVED_DO_NOT_USE';

function hasFlag(flag) {
  return process.argv.slice(2).includes(flag);
}

function runGit(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function runCommand(command, args, env = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

function printResult(result) {
  const label = result.status.padEnd(5, ' ');
  console.log(`${label} ${result.name}`);
  if (result.detail) {
    console.log(`      ${result.detail}`);
  }
}

function gitStatusGate() {
  const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  const shortStatus = runGit(['status', '--short']);
  const head = runGit(['rev-parse', 'HEAD']);

  let ahead = 0;
  try {
    const counts = runGit(['rev-list', '--left-right', '--count', 'origin/main...HEAD']);
    ahead = Number(counts.split(/\s+/)[1] || 0);
  } catch {
    ahead = 0;
  }

  const results = [
    {
      status: shortStatus ? 'FAIL' : 'PASS',
      name: 'Git working tree clean',
      detail: shortStatus || 'no uncommitted files',
      blocking: Boolean(shortStatus),
    },
    {
      status: branch === 'main' ? 'PASS' : 'WARN',
      name: 'On main branch',
      detail: `branch=${branch}`,
      blocking: false,
    },
    {
      status: ahead === 0 ? 'PASS' : 'BLOCK',
      name: 'Local commits pushed to origin/main',
      detail:
        ahead === 0
          ? `HEAD=${head.slice(0, 8)}`
          : `HEAD=${head.slice(0, 8)} is ahead of origin/main by ${ahead} commit(s)`,
      blocking: ahead > 0,
    },
  ];

  return { head, results };
}

function localArtifactGate() {
  const exists = existsSync(STALE_PARTIAL_ARTIFACT);
  const archived = existsSync(ARCHIVED_PARTIAL_ARTIFACT);
  return {
    status: exists ? 'WARN' : 'PASS',
    name: exists
      ? 'Stale partial Documents artifact still present'
      : archived
        ? 'Stale partial Documents artifact archived'
        : 'No stale partial Documents artifact',
    detail: exists
      ? `${STALE_PARTIAL_ARTIFACT} still exists outside the canonical repo`
      : archived
        ? `${ARCHIVED_PARTIAL_ARTIFACT} is preserved outside the active repo`
        : 'no stale partial artifact found',
    blocking: false,
  };
}

function readinessPacketGate() {
  const packetPath = 'docs/sign-off/SYNTHEX-SHIPIT-READY-2026-05-28.md';
  const exists = existsSync(packetPath);
  return {
    status: exists ? 'PASS' : 'FAIL',
    name: 'Current shipit readiness packet present',
    detail: packetPath,
    blocking: !exists,
  };
}

function liveSmokeGate(head) {
  const result = runCommand('node', ['scripts/verify-deployment.js'], {
    EXPECTED_GIT_SHA: head,
  });

  return {
    status: result.status === 0 ? 'PASS' : 'BLOCK',
    name: 'Live production serves local release commit',
    detail:
      result.status === 0
        ? 'public smoke and /api/health.buildId release parity passed'
        : firstFailLine(result.stdout) ||
          lastInterestingLine(result.stdout) ||
          lastInterestingLine(result.stderr),
    blocking: result.status !== 0,
  };
}

function liveEnvGate() {
  const result = runCommand('node', ['scripts/verify-vercel-production-env.js']);
  const warningLine = result.stdout
    .split('\n')
    .find((line) => line.startsWith('Recommended provider groups:'));

  return {
    status: result.status === 0 ? 'PASS' : 'FAIL',
    name: 'Vercel production env metadata required names',
    detail:
      result.status === 0
        ? warningLine || 'required production env names present'
        : lastInterestingLine(result.stdout) || lastInterestingLine(result.stderr),
    blocking: result.status !== 0,
  };
}

function rlsCoverageGate() {
  const result = runCommand('npm', ['run', 'rls:coverage']);
  return {
    status: result.status === 0 ? 'PASS' : 'FAIL',
    name: 'RLS schema coverage',
    detail:
      result.status === 0
        ? lastInterestingLine(result.stdout) || 'all Prisma models covered'
        : firstLineContaining(result.stderr, '[rls-coverage] FAIL') ||
          firstLineContaining(result.stdout, '[rls-coverage] uncovered:') ||
          lastInterestingLine(result.stdout) ||
          lastInterestingLine(result.stderr),
    blocking: result.status !== 0,
  };
}

function rlsAdversarialGate() {
  const hasDbUrl = Boolean(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL);
  const shouldRun = hasFlag('--run-rls');

  if (!hasDbUrl) {
    return {
      status: 'BLOCK',
      name: 'Supabase live RLS adversarial gate',
      detail: 'SUPABASE_DB_URL or DATABASE_URL is required to run npm run rls:adversarial',
      blocking: true,
    };
  }

  if (!shouldRun) {
    return {
      status: 'BLOCK',
      name: 'Supabase live RLS adversarial gate',
      detail: 'DB URL is present, but --run-rls was not set; run shipit status with --run-rls before signoff',
      blocking: true,
    };
  }

  const result = runCommand('npm', ['run', 'rls:adversarial'], {
    RLS_ADVERSARIAL: 'true',
  });

  return {
    status: result.status === 0 ? 'PASS' : 'FAIL',
    name: 'Supabase live RLS adversarial gate',
    detail:
      result.status === 0
        ? lastInterestingLine(result.stdout) || 'adversarial RLS baseline passed'
        : firstFailLine(result.stdout) ||
          lastInterestingLine(result.stdout) ||
          lastInterestingLine(result.stderr),
    blocking: result.status !== 0,
  };
}

function lastInterestingLine(output = '') {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-1)[0];
}

function firstFailLine(output = '') {
  return output
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('FAIL '));
}

function firstLineContaining(output = '', text) {
  return output
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.includes(text));
}

function main() {
  const live = hasFlag('--live');
  const results = [];
  const { head, results: gitResults } = gitStatusGate();

  results.push(...gitResults);
  results.push(readinessPacketGate());
  results.push(localArtifactGate());
  results.push(rlsCoverageGate());
  results.push(rlsAdversarialGate());

  if (live) {
    results.push(liveEnvGate());
    results.push(liveSmokeGate(head));
  } else {
    results.push({
      status: 'WARN',
      name: 'Live production gates skipped',
      detail: 'run npm run shipit:status:live for Vercel env and deployed SHA parity checks; add -- --run-rls when DB access is present',
      blocking: false,
    });
  }

  console.log(`Synthex /shipit gate status (${live ? 'live' : 'local'} mode)`);
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('');

  for (const result of results) {
    printResult(result);
  }

  const blocking = results.filter((result) => result.blocking);
  const warnings = results.filter((result) => result.status === 'WARN');

  console.log('');
  console.log(`Blocking gates: ${blocking.length}`);
  console.log(`Warnings: ${warnings.length}`);

  if (blocking.length > 0) {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
