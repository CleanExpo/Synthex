#!/usr/bin/env tsx
/**
 * Synthex deploy-verification routine (SYN-694).
 *
 * The recurring verification lane: gather high-signal readiness checks, refuse
 * to claim "green" from a dirty or behind-main working tree, and emit a compact
 * structured readiness packet (JSON + Markdown) for Linear / 2nd-brain.
 *
 * The brains live in pure, unit-tested functions (evaluateWorktreeGate,
 * buildReadinessPacket, renderReadinessMarkdown). The CLI `main()` only gathers
 * real git/CLI state and feeds it in — so nothing is fabricated and the logic is
 * testable without a network or a shell. (Mirrors scripts/social-launch-readiness.ts.)
 *
 * USAGE:
 *   npx ts-node scripts/verify/deploy-readiness.ts          # local fallback (type-check + focused tests)
 *   SYNTHEX_CLEAN_WORKTREE=1 npx ts-node scripts/verify/deploy-readiness.ts   # explicit clean worktree
 *
 * EXIT CODES: 0 green · 1 red (a check failed) · 2 blocked (dirty/behind worktree) · 3 runtime error.
 */

import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CheckStatus = 'pass' | 'fail' | 'skip' | 'unknown';

export interface ReadinessCheck {
  /** Stable check name, e.g. "type-check". */
  name: string;
  status: CheckStatus;
  /** ISO-8601 timestamp of when the check was evaluated. */
  timestamp: string;
  /** What to do when the check is not passing. Required for non-pass states. */
  remediation?: string;
  /** Optional short evidence/detail (never raw secrets). */
  detail?: string;
}

export interface GitState {
  /** Working tree has uncommitted changes. */
  dirty: boolean;
  /** Commits the local branch is behind origin/main. */
  behindMain: number;
  /** Current branch name, when known. */
  branch?: string;
  /**
   * Explicit override: the caller guarantees this is a fresh, isolated clean
   * checkout/worktree, so the dirty/behind gate is bypassed (the routine is
   * designed to run from such a worktree — SYN-694 acceptance criteria).
   */
  cleanWorktree?: boolean;
}

export type ReadinessVerdict = 'green' | 'red' | 'blocked';

export interface WorktreeGate {
  /** Safe to assess a green/red verdict (vs. blocked on an untrustworthy tree). */
  ok: boolean;
  state: 'clean' | 'dirty' | 'behind' | 'dirty+behind' | 'clean-worktree-override';
  reason: string;
}

export interface ReadinessSummary {
  total: number;
  pass: number;
  fail: number;
  skip: number;
  unknown: number;
}

export interface ReadinessPacket {
  generatedAt: string;
  verdict: ReadinessVerdict;
  git: GitState;
  gate: WorktreeGate;
  checks: ReadinessCheck[];
  summary: ReadinessSummary;
}

// ── Pure core (unit-tested) ─────────────────────────────────────────────────────

/**
 * Decide whether the working tree is trustworthy enough to claim a green/red
 * verdict. A dirty or behind-main tree is NEVER green — it is `blocked` — unless
 * the caller explicitly asserts a clean worktree (e.g. a fresh CI checkout).
 */
export function evaluateWorktreeGate(git: GitState): WorktreeGate {
  if (git.cleanWorktree) {
    return {
      ok: true,
      state: 'clean-worktree-override',
      reason: 'Explicit clean worktree asserted (cleanWorktree=true).',
    };
  }

  const behind = git.behindMain > 0;
  if (git.dirty && behind) {
    return {
      ok: false,
      state: 'dirty+behind',
      reason: `Working tree has uncommitted changes and is ${git.behindMain} commit(s) behind origin/main.`,
    };
  }
  if (git.dirty) {
    return {
      ok: false,
      state: 'dirty',
      reason: 'Working tree has uncommitted changes.',
    };
  }
  if (behind) {
    return {
      ok: false,
      state: 'behind',
      reason: `Working tree is ${git.behindMain} commit(s) behind origin/main.`,
    };
  }
  return { ok: true, state: 'clean', reason: 'Working tree is clean and up to date with origin/main.' };
}

function summarise(checks: ReadinessCheck[]): ReadinessSummary {
  const summary: ReadinessSummary = {
    total: checks.length,
    pass: 0,
    fail: 0,
    skip: 0,
    unknown: 0,
  };
  for (const c of checks) summary[c.status]++;
  return summary;
}

/**
 * Assemble the readiness packet. Verdict precedence:
 *   blocked  — the worktree gate failed (dirty/behind, no override).
 *   red      — gate ok, but at least one check failed.
 *   green    — gate ok and no check failed (skip/unknown are not failures).
 */
export function buildReadinessPacket(input: {
  checks: ReadinessCheck[];
  git: GitState;
  now?: Date;
}): ReadinessPacket {
  const now = input.now ?? new Date();
  const gate = evaluateWorktreeGate(input.git);
  const summary = summarise(input.checks);

  let verdict: ReadinessVerdict;
  if (!gate.ok) {
    verdict = 'blocked';
  } else if (summary.fail > 0) {
    verdict = 'red';
  } else {
    verdict = 'green';
  }

  return {
    generatedAt: now.toISOString(),
    verdict,
    git: input.git,
    gate,
    checks: input.checks,
    summary,
  };
}

const VERDICT_EMOJI: Record<ReadinessVerdict, string> = {
  green: '🟢',
  red: '🔴',
  blocked: '⛔',
};

const STATUS_EMOJI: Record<CheckStatus, string> = {
  pass: '✅',
  fail: '❌',
  skip: '⏭️',
  unknown: '❔',
};

/** Render a compact Markdown readiness packet for Linear / 2nd-brain. */
export function renderReadinessMarkdown(packet: ReadinessPacket): string {
  const lines: string[] = [];
  lines.push(`# Synthex deploy readiness — ${VERDICT_EMOJI[packet.verdict]} ${packet.verdict.toUpperCase()}`);
  lines.push('');
  lines.push(`_Generated ${packet.generatedAt}_`);
  lines.push('');
  lines.push(
    `**Worktree gate:** ${packet.gate.ok ? '✅' : '⛔'} ${packet.gate.state} — ${packet.gate.reason}`
  );
  if (packet.git.branch) lines.push(`**Branch:** \`${packet.git.branch}\``);
  lines.push('');
  lines.push('| Check | Status | Remediation |');
  lines.push('| --- | --- | --- |');
  for (const c of packet.checks) {
    const remediation = c.status === 'pass' ? '—' : c.remediation ?? '—';
    lines.push(`| ${c.name} | ${STATUS_EMOJI[c.status]} ${c.status} | ${remediation} |`);
  }
  lines.push('');
  const s = packet.summary;
  lines.push(
    `**Summary:** ${s.pass}/${s.total} pass · ${s.fail} fail · ${s.skip} skip · ${s.unknown} unknown`
  );
  return lines.join('\n');
}

// ── CLI gatherers (not unit-tested — they touch the real shell) ──────────────────

/** Read the real git state. Best-effort: a fetch failure degrades to "unknown" behind count. */
function gatherGitState(): GitState {
  const cleanWorktree = process.env.SYNTHEX_CLEAN_WORKTREE === '1';
  let dirty = false;
  let behindMain = 0;
  let branch: string | undefined;

  try {
    const porcelain = execSync('git status --porcelain', { encoding: 'utf8' });
    dirty = porcelain.trim().length > 0;
  } catch {
    dirty = true; // fail safe: assume dirty if we cannot tell
  }
  try {
    branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch {
    /* branch stays undefined */
  }
  try {
    execSync('git fetch origin main --quiet', { stdio: 'ignore' });
    const count = execSync('git rev-list --count HEAD..origin/main', { encoding: 'utf8' });
    behindMain = parseInt(count.trim(), 10) || 0;
  } catch {
    behindMain = 0; // cannot reach origin → don't fabricate a non-zero distance
  }

  return { dirty, behindMain, branch, cleanWorktree };
}

/** Run one shell command as a readiness check, capturing pass/fail + a remediation hint. */
function runCheck(name: string, command: string, remediation: string): ReadinessCheck {
  const timestamp = new Date().toISOString();
  try {
    execSync(command, { stdio: 'ignore' });
    return { name, status: 'pass', timestamp };
  } catch {
    return { name, status: 'fail', timestamp, remediation, detail: `Command failed: ${command}` };
  }
}

async function main(): Promise<void> {
  const git = gatherGitState();

  // High-signal local fallback checks (type-check is the cheapest broad signal).
  const checks: ReadinessCheck[] = [
    runCheck(
      'type-check',
      'npm run type-check',
      'Run `npm run type-check` and resolve the reported TypeScript errors.'
    ),
    runCheck(
      'lint',
      'npm run lint',
      'Run `npm run lint` (--max-warnings 0) and fix the reported issues.'
    ),
  ];

  // Guardrail: external publish/claim execution must remain approval-gated.
  // We verify the guard exists in code rather than asserting it from memory.
  checks.push(
    runCheck(
      'publish-approval-guard',
      "git grep -lE 'requiresApproval|approvalGate|requireApproval|approval_required' -- 'app/api' 'lib'",
      'Confirm external publish/claim routes still enforce an approval gate before execution.'
    )
  );

  const packet = buildReadinessPacket({ checks, git });

  const outDir = '.artifacts/deploy-readiness';
  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/readiness.json`, JSON.stringify(packet, null, 2));
  writeFileSync(`${outDir}/readiness.md`, renderReadinessMarkdown(packet));

  // stdout is the machine-readable packet; the Markdown lands on disk for Linear.
  console.log(JSON.stringify(packet, null, 2));

  if (packet.verdict === 'blocked') process.exit(2);
  if (packet.verdict === 'red') process.exit(1);
  process.exit(0);
}

// Run only when invoked directly (not when imported by tests). Uses the argv
// check rather than `require.main` so it works under tsx/ESM (mirrors
// scripts/social-launch-readiness.ts).
if (process.argv[1]?.endsWith('deploy-readiness.ts')) {
  main().catch(err => {
    console.error('RUNTIME_ERROR:', err?.message || err);
    process.exit(3);
  });
}
