import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyLinearWebhook } from '@/lib/linear/webhook-verifier';
import { addJob, QUEUE_NAMES } from '@/lib/queue/bull-queue';
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

const LinearWebhookSchema = z.object({
  type: z.string(),
  action: z.string(),
  data: z.record(z.string(), z.unknown()),
  organizationId: z.string().optional(),
});

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

  // Act on Issue create or update events
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

      if (isEligibleState && hasAutonomousLabel) {
        await addJob(QUEUE_NAMES.AUTONOMOUS_TASKS, {
          type: 'autonomous:execute-task',
          issueId: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          description: issue.description ?? null,
        });
        logger.info(
          `[linear-webhook] Enqueued autonomous task for ${issue.identifier}`
        );
      }
    }
  }

  return NextResponse.json({ ok: true });
}
