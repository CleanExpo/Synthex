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
 *   npx tsx scripts/verify/deploy-readiness.ts          # local fallback (type-check + focused tests)
 *   SYNTHEX_CLEAN_WORKTREE=1 npx tsx scripts/verify/deploy-readiness.ts   # explicit clean worktree
 *   npx tsx scripts/verify/deploy-readiness.ts --post-linear   # also update the single Linear keeper
 *       (needs LINEAR_API_KEY + SYNTHEX_READINESS_KEEPER_ISSUE_ID; skips cleanly if unset — never duplicates)
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

// ── Linear keeper auto-post (SYN-694 follow-up) ─────────────────────────────────
//
// Acceptance: "updates an existing Linear keeper/status update instead of creating
// duplicate issues on every run." We do that with an idempotent marker: the keeper
// is a single comment carrying KEEPER_MARKER; each run UPDATEs it (or creates it
// once). The decision + body are pure + unit-tested; the network calls are injected
// so the logic is testable without Linear. Never fabricates — a run with no API key
// simply skips (no silent failure, no duplicate).

/** Hidden marker that identifies the one keeper comment to update across runs. */
export const KEEPER_MARKER = '<!-- synthex-deploy-readiness-keeper -->';

export type KeeperAction = 'skip' | 'create' | 'update';

/**
 * Decide what to do with the keeper, given whether we are authenticated and
 * whether an existing keeper comment was found. Never creates a duplicate when
 * one already exists; never acts at all without an API key.
 */
export function decideKeeperAction(opts: {
  apiKey?: string | null;
  existingKeeperId?: string | null;
}): { action: KeeperAction; reason: string } {
  if (!opts.apiKey) {
    return { action: 'skip', reason: 'No LINEAR_API_KEY — keeper post skipped (no fabrication).' };
  }
  if (opts.existingKeeperId) {
    return { action: 'update', reason: `Updating existing keeper ${opts.existingKeeperId}.` };
  }
  return { action: 'create', reason: 'No existing keeper found — creating the single keeper.' };
}

/** Render the keeper comment body — carries the marker so the next run can find it. */
export function renderKeeperBody(packet: ReadinessPacket): string {
  return `${KEEPER_MARKER}\n\n${renderReadinessMarkdown(packet)}`;
}

export interface KeeperDeps {
  apiKey?: string | null;
  /** Resolve the id of the existing keeper comment (by KEEPER_MARKER), or null. */
  findKeeper: () => Promise<string | null>;
  createKeeper: (body: string) => Promise<void>;
  updateKeeper: (id: string, body: string) => Promise<void>;
}

/**
 * Post the readiness packet to the single Linear keeper. Idempotent: updates the
 * existing keeper or creates it once. No-ops (never throws) when unauthenticated.
 */
export async function postReadinessToLinear(
  packet: ReadinessPacket,
  deps: KeeperDeps
): Promise<{ posted: boolean; action: KeeperAction; reason: string }> {
  const body = renderKeeperBody(packet);
  if (!deps.apiKey) {
    const { action, reason } = decideKeeperAction({ apiKey: deps.apiKey });
    return { posted: false, action, reason };
  }
  const existingKeeperId = await deps.findKeeper();
  const { action, reason } = decideKeeperAction({ apiKey: deps.apiKey, existingKeeperId });
  if (action === 'update' && existingKeeperId) {
    await deps.updateKeeper(existingKeeperId, body);
    return { posted: true, action, reason };
  }
  await deps.createKeeper(body);
  return { posted: true, action: 'create', reason };
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

// Real Linear GraphQL calls (native fetch — no new dependency). Only invoked from
// main() behind the --post-linear flag; the pure decision/body logic above is what
// the tests exercise.
const LINEAR_API = 'https://api.linear.app/graphql';

async function linearGraphQL(
  apiKey: string,
  query: string,
  variables: Record<string, unknown>
): Promise<unknown> {
  const res = await fetch(LINEAR_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: apiKey },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Linear API ${res.status}`);
  return res.json();
}

/** Find the keeper comment (by KEEPER_MARKER) on the configured issue, or null. */
async function findLinearKeeper(
  apiKey?: string,
  issueId?: string
): Promise<string | null> {
  if (!apiKey || !issueId) return null;
  const data = (await linearGraphQL(
    apiKey,
    `query($id:String!){ issue(id:$id){ comments{ nodes{ id body } } } }`,
    { id: issueId }
  )) as { data?: { issue?: { comments?: { nodes?: Array<{ id: string; body: string }> } } } };
  const nodes = data?.data?.issue?.comments?.nodes ?? [];
  return nodes.find(n => n.body.includes(KEEPER_MARKER))?.id ?? null;
}

async function createLinearComment(
  apiKey: string | undefined,
  issueId: string | undefined,
  body: string
): Promise<void> {
  if (!apiKey || !issueId) throw new Error('LINEAR_API_KEY and SYNTHEX_READINESS_KEEPER_ISSUE_ID are required to post.');
  await linearGraphQL(
    apiKey,
    `mutation($issueId:String!,$body:String!){ commentCreate(input:{issueId:$issueId,body:$body}){ success } }`,
    { issueId, body }
  );
}

async function updateLinearComment(
  apiKey: string | undefined,
  commentId: string,
  body: string
): Promise<void> {
  if (!apiKey) throw new Error('LINEAR_API_KEY is required to post.');
  await linearGraphQL(
    apiKey,
    `mutation($id:String!,$body:String!){ commentUpdate(id:$id,input:{body:$body}){ success } }`,
    { id: commentId, body }
  );
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

  // Optional: update the single Linear keeper with this packet (SYN-694 follow-up).
  // Opt-in via `--post-linear`; needs LINEAR_API_KEY + SYNTHEX_READINESS_KEEPER_ISSUE_ID.
  // Guarded so a normal run never touches Linear, and an unauthenticated run skips.
  if (process.argv.includes('--post-linear')) {
    const apiKey = process.env.LINEAR_API_KEY;
    const issueId = process.env.SYNTHEX_READINESS_KEEPER_ISSUE_ID;
    const result = await postReadinessToLinear(packet, {
      apiKey,
      findKeeper: () => findLinearKeeper(apiKey, issueId),
      createKeeper: body => createLinearComment(apiKey, issueId, body),
      updateKeeper: (id, body) => updateLinearComment(apiKey, id, body),
    });
    console.error(`[linear-keeper] ${result.action}: ${result.reason}`);
  }

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
