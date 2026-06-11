/**
 * Marketing Agency Agent — Run Trigger.
 *
 *   POST /api/marketing-agency/agents/[id]/run
 *
 * Default: async — enqueues a MARKETING_AGENT_RUN job and returns
 * immediately with a placeholder run row at status='queued'. The worker
 * (lib/marketing-agency/agent/queue-handler.ts) processes the job and
 * the runner writes status='completed' or 'failed' when done. Resolves
 * code-review finding #2 (Vercel 60s timeout on synchronous LLM calls).
 *
 * Optional: synchronous — `POST .../run?sync=true` preserves the
 * pre-SYN-976 behavior where the route holds open the function for the
 * full duration of the LLM calls. Useful for smoke tests and small
 * agents where the operator wants the result inline. maxDuration=60.
 *
 * In both modes, the route returns the run record so the UI can poll.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/auth/with-auth';
import { logger } from '@/lib/logger';
import { runAgent } from '@/lib/marketing-agency/agent/runner';
import {
  queueMarketingAgentRun,
  registerMarketingAgentHandler,
} from '@/lib/marketing-agency/agent/queue-handler';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Idempotent — registers once per process.
registerMarketingAgentHandler();

export const POST = withAuth(async (request, { userId, clientId }) => {
  const id = extractAgentId(request);
  if (!id)
    return NextResponse.json({ error: 'Invalid agent id' }, { status: 400 });

  const agent = await prisma.marketingAgent.findFirst({
    where: { id, organizationId: clientId },
    select: { id: true, status: true },
  });
  if (!agent)
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  if (agent.status !== 'active') {
    return NextResponse.json(
      { error: `Agent is ${agent.status}; only active agents can be run` },
      { status: 409 }
    );
  }

  const sync = request.nextUrl.searchParams.get('sync') === 'true';

  if (sync) {
    try {
      const result = await runAgent({ agentId: id, triggeredById: userId });
      const run = await prisma.marketingAgentRun.findUnique({
        where: { id: result.runId },
      });
      return NextResponse.json({
        run,
        summary: result.summary,
        status: result.status,
        mode: 'sync',
      });
    } catch (error) {
      logger.error('marketing-agency: sync agent run failed at API boundary', {
        agentId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return NextResponse.json(
        { error: 'Failed to run agent' },
        { status: 500 }
      );
    }
  }

  // Async path: enqueue the job and create a placeholder run record at
  // status='queued' so the UI can immediately link to it and poll.
  try {
    const placeholderRun = await prisma.marketingAgentRun.create({
      data: {
        agentId: id,
        organizationId: clientId,
        triggeredById: userId,
        status: 'queued',
        summary: 'Queued for processing — agent will pick up shortly.',
      },
    });

    const job = await queueMarketingAgentRun({
      agentId: id,
      triggeredById: userId,
      trigger: 'manual',
    });

    logger.info('marketing-agency: enqueued agent run', {
      agentId: id,
      placeholderRunId: placeholderRun.id,
      jobId: job.id,
    });

    return NextResponse.json(
      {
        run: placeholderRun,
        summary: placeholderRun.summary,
        status: 'queued',
        mode: 'async',
        jobId: job.id,
      },
      { status: 202 }
    );
  } catch (error) {
    logger.error('marketing-agency: async enqueue failed at API boundary', {
      agentId: id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Failed to enqueue agent run' },
      { status: 500 }
    );
  }
});

function extractAgentId(request: NextRequest): string | null {
  const segments = request.nextUrl.pathname.split('/').filter(Boolean);
  const idx = segments.indexOf('agents');
  if (idx === -1) return null;
  return segments[idx + 1] ?? null;
}
