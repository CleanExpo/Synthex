/**
 * Marketing Agency Agent — Manual Run Trigger.
 *
 *   POST /api/marketing-agency/agents/[id]/run
 *
 * Synchronous for MVP — returns when the run completes (or fails). Future
 * cadence-driven runs will enqueue via lib/queue.ts; the runner itself is
 * already queue-friendly (pure async function, no HTTP coupling).
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/auth/with-auth';
import { logger } from '@/lib/logger';
import { runAgent } from '@/lib/marketing-agency/agent/runner';

export const runtime = 'nodejs';
export const maxDuration = 60;

export const POST = withAuth(async (request, { userId, clientId }) => {
  const id = extractAgentId(request);
  if (!id) return NextResponse.json({ error: 'Invalid agent id' }, { status: 400 });

  const agent = await prisma.marketingAgent.findFirst({
    where: { id, organizationId: clientId },
    select: { id: true, status: true },
  });
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  if (agent.status !== 'active') {
    return NextResponse.json(
      { error: `Agent is ${agent.status}; only active agents can be run` },
      { status: 409 },
    );
  }

  try {
    const result = await runAgent({ agentId: id, triggeredById: userId });
    const run = await prisma.marketingAgentRun.findUnique({ where: { id: result.runId } });
    return NextResponse.json({ run, summary: result.summary, status: result.status });
  } catch (error) {
    logger.error('marketing-agency: agent run failed at API boundary', {
      agentId: id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Failed to run agent' }, { status: 500 });
  }
});

function extractAgentId(request: NextRequest): string | null {
  const segments = request.nextUrl.pathname.split('/').filter(Boolean);
  const idx = segments.indexOf('agents');
  if (idx === -1) return null;
  return segments[idx + 1] ?? null;
}
