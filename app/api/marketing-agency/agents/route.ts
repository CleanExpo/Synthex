/**
 * Marketing Agency Agents — List + Create.
 *
 *   GET  /api/marketing-agency/agents       → list this org's agents
 *   POST /api/marketing-agency/agents       → create a new agent (tier-gated)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/auth/with-auth';
import { logger } from '@/lib/logger';
import { checkMarketingAgentTier } from '@/lib/marketing-agency/agent/tier-gate';

export const runtime = 'nodejs';

const createSchema = z.object({
  name: z.string().min(1).max(120),
  goal: z.string().min(3).max(2000),
  maxClaimsPerRun: z.coerce.number().int().min(1).max(10).optional(),
  cadence: z.enum(['manual', 'daily', 'weekly']).optional(),
});

export const GET = withAuth(async (_request, { clientId }) => {
  const agents = await prisma.marketingAgent.findMany({
    where: { organizationId: clientId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      goal: true,
      status: true,
      cadence: true,
      maxClaimsPerRun: true,
      lastRunAt: true,
      nextRunAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json({ agents });
});

export const POST = withAuth(async (request, { userId, clientId }) => {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const gate = await checkMarketingAgentTier(clientId);
  if (!gate.allowed) {
    return NextResponse.json(
      { error: gate.reason, plan: gate.plan, limit: gate.limit, current: gate.current },
      { status: 402 },
    );
  }

  try {
    const agent = await prisma.marketingAgent.create({
      data: {
        organizationId: clientId,
        createdById: userId,
        name: parsed.data.name,
        goal: parsed.data.goal,
        maxClaimsPerRun: parsed.data.maxClaimsPerRun ?? 5,
        cadence: parsed.data.cadence ?? 'manual',
      },
    });
    return NextResponse.json({ agent }, { status: 201 });
  } catch (error) {
    logger.error('marketing-agency: agent create failed', {
      organizationId: clientId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 });
  }
});
