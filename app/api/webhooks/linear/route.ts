import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyLinearWebhook } from '@/lib/linear/webhook-verifier';
import { addJob, QUEUE_NAMES } from '@/lib/queue/bull-queue';
import {
  buildJobId,
  buildTaskEnvelope,
  contentHash,
  extractAcceptance,
} from '@/lib/tasks/task-envelope';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LinearStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
});

const LinearIssueLabelSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const LinearIssueDataSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  state: LinearStateSchema.optional(),
  labels: z
    .object({
      nodes: z.array(LinearIssueLabelSchema),
    })
    .optional(),
});

// SYN-MCP-005: `updatedFrom` carries the PREVIOUS values of properties changed
// by an `update` action (per Linear webhook docs — shape is defensive-parsed
// below because we have no recorded production fixture for every variant).
// `updatedFrom.labelIds` (previous label UUIDs) is what lets us detect "the
// autonomous label was NEWLY added" and re-enqueue only then.
const LinearWebhookSchema = z.object({
  type: z.string(),
  action: z.string(),
  data: z.record(z.string(), z.unknown()),
  updatedFrom: z.record(z.string(), z.unknown()).optional(),
  organizationId: z.string().optional(),
});

const PreviousLabelIdsSchema = z.array(z.string());

// Labels that mark an issue for autonomous execution, regardless of Linear
// project. Project-name coupling was brittle (SYN-1028) — detect by label.
const AUTONOMOUS_LABELS = new Set([
  'pi-dev:autonomous',
  'mesh:auto',
  'autonomous',
]);
// State types that are eligible to be queued: Backlog, Todo, In Progress.
// Completed/canceled issues are never (re)queued.
const ELIGIBLE_STATE_TYPES = new Set(['backlog', 'unstarted', 'started']);

type LinearIssueData = z.infer<typeof LinearIssueDataSchema>;

/**
 * True iff an autonomous label is present now but was NOT present before this
 * update (its id is missing from `updatedFrom.labelIds`). Conservative by
 * design: when `updatedFrom` is absent or does not include `labelIds` (labels
 * were not part of this update), returns false — an update that didn't touch
 * labels must never re-enqueue (that duplicate-run-per-update was the SYN-1081
 * defect).
 */
function autonomousLabelNewlyAdded(
  issue: LinearIssueData,
  updatedFrom: Record<string, unknown> | undefined
): boolean {
  if (!updatedFrom) return false;
  const prev = PreviousLabelIdsSchema.safeParse(updatedFrom.labelIds);
  if (!prev.success) return false;
  const previousIds = new Set(prev.data);
  return (
    issue.labels?.nodes?.some(
      label =>
        AUTONOMOUS_LABELS.has(label.name.toLowerCase()) &&
        !previousIds.has(label.id)
    ) ?? false
  );
}

export async function POST(request: NextRequest) {
  // Must read as text for HMAC verification
  const body = await request.text();
  const signature = request.headers.get('linear-signature') ?? '';

  const secret = process.env.LINEAR_WEBHOOK_SECRET ?? '';
  if (!verifyLinearWebhook(body, signature, secret)) {
    logger.warn('[linear-webhook] Invalid signature — rejecting');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(body);
  } catch {
    logger.warn('[linear-webhook] Invalid JSON body');
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parseResult = LinearWebhookSchema.safeParse(rawPayload);
  if (!parseResult.success) {
    // Unknown payload shape — acknowledge and move on
    return NextResponse.json({ ok: true });
  }

  const payload = parseResult.data;

  // SYN-MCP-005: enqueue on Issue CREATE only — an update re-enqueues ONLY
  // when the autonomous label was newly added by that update.
  if (
    payload.type === 'Issue' &&
    (payload.action === 'create' || payload.action === 'update')
  ) {
    const issueResult = LinearIssueDataSchema.safeParse(payload.data);
    if (issueResult.success) {
      const issue = issueResult.data;

      const stateType = issue.state?.type;
      const isEligibleState =
        stateType !== undefined && ELIGIBLE_STATE_TYPES.has(stateType);

      const hasAutonomousLabel = issue.labels?.nodes?.some(
        (label: z.infer<typeof LinearIssueLabelSchema>) =>
          AUTONOMOUS_LABELS.has(label.name.toLowerCase())
      );

      const actionAllowsEnqueue =
        payload.action === 'create' ||
        autonomousLabelNewlyAdded(issue, payload.updatedFrom);

      if (isEligibleState && hasAutonomousLabel && actionAllowsEnqueue) {
        // Deterministic job identity (SYN-MCP-005): the parsed payload has no
        // version field, so identity is content-addressed. Same issue + same
        // title/description → same jobId → BullMQ drops the duplicate while
        // the prior job record is retained (removeOnComplete 24h/1000,
        // removeOnFail 7d — see lib/tasks/task-envelope.ts for the dedupe-
        // window semantics). Edited content → new hash → runnable again.
        const hash = contentHash(issue.title, issue.description ?? null);
        const jobId = buildJobId(issue.id, hash);

        const envelope = buildTaskEnvelope({
          source: 'webhook',
          issueId: issue.id,
          identifier: issue.identifier,
          acceptance: extractAcceptance(issue.description),
        });

        await addJob(
          QUEUE_NAMES.AUTONOMOUS_TASKS,
          {
            type: 'autonomous:execute-task',
            issueId: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            description: issue.description ?? null,
            envelope,
          },
          { jobId }
        );
        logger.info(
          `[linear-webhook] Enqueued autonomous task for ${issue.identifier}`,
          { jobId, traceId: envelope.traceId, action: payload.action }
        );
      }
    }
  }

  return NextResponse.json({ ok: true });
}
