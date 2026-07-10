/**
 * Interim cron drain for the verified task lifecycle (SYN-MCP-005 / SYN-1081).
 *
 * SCOPE (bench must_fix 5): a Vercel lambda cannot spawn the `claude` CLI, so
 * this cron drains ONLY:
 *   A. completion-verification transitions — sweep "In Review" issues that
 *      carry an autonomous label and a linked GitHub PR, run
 *      lib/tasks/completion-verifier.ts, and move to Done ONLY on a green
 *      verdict (PR exists + all check-runs succeeded). Rejects leave the
 *      issue In Review with an idempotent explanatory comment.
 *   B. stale queued-job dead-lettering — autonomous jobs still waiting after
 *      TASK_STALE_DAYS (default 3) are removed from the queue and the issue
 *      gets a comment; queue depth is logged every run.
 *
 * It NEVER executes agent work. Agent execution stays owner-gated on a
 * persistent worker host (see lib/queue/workers/autonomous-task-worker.ts).
 *
 * State machine: enqueued → running → in_review → { verify-pass → done |
 * verify-fail → in_review }. Single Done-writer: completion-verifier.
 *
 * vercel.json schedule: every 30 minutes.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/auth/cron-auth';
import { getLinearClient } from '@/lib/linear/client';
import { getQueue, QUEUE_NAMES } from '@/lib/queue/bull-queue';
import type { AutonomousTaskJobData } from '@/lib/queue/bull-queue';
import {
  transitionIssueDone,
  verifierCommentMarker,
  verifyCompletion,
} from '@/lib/tasks/completion-verifier';
import {
  buildTaskEnvelope,
  extractAcceptance,
} from '@/lib/tasks/task-envelope';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Same label set as the webhook — an issue in any project qualifies by label. */
const AUTONOMOUS_LABELS = ['pi-dev:autonomous', 'mesh:auto', 'autonomous'];

const MAX_SWEEP = 20;
const MAX_STALE_JOBS = 100;

const PR_URL_RE = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+$/;

interface SweepResults {
  swept: number;
  transitionedDone: number;
  rejected: number;
  skippedNoPr: number;
  staleDeadLettered: number;
  queueDepth: Record<string, number> | null;
  errors: string[];
}

function staleCutoffMs(): number {
  const days = Number(process.env.TASK_STALE_DAYS ?? '3');
  const safeDays = Number.isFinite(days) && days > 0 ? days : 3;
  return safeDays * 24 * 60 * 60 * 1000;
}

async function sweepInReview(results: SweepResults): Promise<void> {
  const linear = getLinearClient();
  const issues = await linear.issues({
    filter: {
      labels: { name: { in: AUTONOMOUS_LABELS } },
      state: { name: { eq: 'In Review' } },
    },
    first: MAX_SWEEP,
  });

  for (const issue of issues.nodes) {
    results.swept++;

    // Find a linked GitHub PR attachment.
    const attachments = await issue.attachments();
    const prUrl = attachments.nodes
      .map((a: { url: string }) => a.url)
      .find((url: string) => PR_URL_RE.test(url));

    if (!prUrl) {
      results.skippedNoPr++;
      continue;
    }

    const envelope = buildTaskEnvelope({
      source: 'cron',
      issueId: issue.id,
      identifier: issue.identifier,
      acceptance: extractAcceptance(issue.description ?? null),
    });

    const verdict = await verifyCompletion(envelope, { prUrl });

    if (verdict.verdict === 'accept') {
      const done = await transitionIssueDone(issue.id, verdict.evidence);
      if (done.ok) {
        results.transitionedDone++;
      } else {
        results.errors.push(
          `${issue.identifier}: done-transition ${done.reason}`
        );
      }
      continue;
    }

    results.rejected++;
    // verify-fail → stay In Review + idempotent comment (marker prevents the
    // 30-minute cadence from spamming the same rejection).
    const headSha = (verdict.evidence && verdict.evidence.headSha) ?? 'no-sha';
    const marker = verifierCommentMarker(`reject-${verdict.reason}`, headSha);
    try {
      const comments = await issue.comments({ first: 25 });
      const alreadyPosted = comments.nodes.some((c: { body: string }) =>
        c.body.includes(marker)
      );
      if (!alreadyPosted) {
        await linear.createComment({
          issueId: issue.id,
          body: `${marker}\n## ⏳ Completion not verified — staying In Review\n\n**PR:** ${prUrl}\n**Reason:** \`${verdict.reason}\`${verdict.detail ? ` (${verdict.detail})` : ''}\n\nDone requires CompletionEvidence: PR exists + all GitHub check-runs green. The sweep re-verifies every 30 minutes.`,
        });
      }
    } catch (err) {
      results.errors.push(
        `${issue.identifier}: reject-comment ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}

async function drainStaleJobs(results: SweepResults): Promise<void> {
  const queue = getQueue(QUEUE_NAMES.AUTONOMOUS_TASKS);

  // Ops visibility: log the queue depth every run (workers are not booted —
  // depth growth is the early-warning signal).
  const depth = (await queue.getJobCounts(
    'waiting',
    'delayed',
    'active',
    'failed'
  )) as Record<string, number>;
  results.queueDepth = depth;
  logger.info('[task-lifecycle] autonomous queue depth', depth);

  const cutoff = Date.now() - staleCutoffMs();
  const jobs = await queue.getJobs(['waiting', 'delayed'], 0, MAX_STALE_JOBS);

  for (const job of jobs) {
    if (!job || job.timestamp >= cutoff) continue;
    const data = job.data as AutonomousTaskJobData;
    try {
      await job.remove();
      results.staleDeadLettered++;
      logger.warn('[task-lifecycle] dead-lettered stale autonomous job', {
        jobId: job.id,
        identifier: data.identifier,
        queuedAt: new Date(job.timestamp).toISOString(),
      });
      try {
        const linear = getLinearClient();
        await linear.createComment({
          issueId: data.issueId,
          body: `## 🪦 Autonomous job dead-lettered\n\nJob \`${job.id}\` for **${data.identifier}** sat queued since ${new Date(job.timestamp).toISOString()} with no worker to run it (the persistent worker host is owner-gated). It has been removed from the queue — re-add the autonomous label to re-enqueue once a worker host exists.`,
        });
      } catch (commentErr) {
        results.errors.push(
          `dead-letter-comment ${data.identifier}: ${commentErr instanceof Error ? commentErr.message : String(commentErr)}`
        );
      }
    } catch (err) {
      results.errors.push(
        `dead-letter ${job.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}

export async function GET(request: NextRequest) {
  const auth = verifyCronRequest(request, 'TASK_LIFECYCLE');
  if (!auth.ok) return auth.response;

  const results: SweepResults = {
    swept: 0,
    transitionedDone: 0,
    rejected: 0,
    skippedNoPr: 0,
    staleDeadLettered: 0,
    queueDepth: null,
    errors: [],
  };

  // Leg A: verification transitions (the only path to Done).
  try {
    await sweepInReview(results);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.errors.push(`sweep: ${msg}`);
    logger.error('[task-lifecycle] In Review sweep failed', { error: msg });
  }

  // Leg B: stale-job dead-letter + queue depth. Redis may be unreachable from
  // this runtime — degrade gracefully, the verification leg is the priority.
  try {
    await drainStaleJobs(results);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.errors.push(`drain: ${msg}`);
    logger.warn('[task-lifecycle] stale-job drain unavailable', { error: msg });
  }

  return NextResponse.json({ ok: true, ...results });
}
