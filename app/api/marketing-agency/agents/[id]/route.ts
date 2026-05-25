/**
 * Marketing Agency Agent — Get / Update / Delete.
 *
 *   GET    /api/marketing-agency/agents/[id]  → get one
 *   PATCH  /api/marketing-agency/agents/[id]  → update fields
 *   DELETE /api/marketing-agency/agents/[id]  → soft delete (status='archived')
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/auth/with-auth';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  goal: z.string().min(3).max(2000).optional(),
  status: z.enum(['active', 'paused', 'archived']).optional(),
  maxClaimsPerRun: z.coerce.number().int().min(1).max(10).optional(),
  cadence: z.enum(['manual', 'daily', 'weekly']).optional(),
});

async function loadAgent(agentId: string, organizationId: string) {
  return prisma.marketingAgent.findFirst({
    where: { id: agentId, organizationId },
  });
}

export const GET = withAuth(async (request, { clientId }) => {
  const id = extractId(request);
  if (!id) return NextResponse.json({ error: 'Invalid agent id' }, { status: 400 });
  const agent = await loadAgent(id, clientId);
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  return NextResponse.json({ agent });
});

export const PATCH = withAuth(async (request, { clientId }) => {
  const id = extractId(request);
  if (!id) return NextResponse.json({ error: 'Invalid agent id' }, { status: 400 });
  const existing = await loadAgent(id, clientId);
  if (!existing) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const updated = await prisma.marketingAgent.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json({ agent: updated });
  } catch (error) {
    logger.error('marketing-agency: agent update failed', {
      agentId: id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 });
  }
});

export const DELETE = withAuth(async (request, { clientId }) => {
  const id = extractId(request);
  if (!id) return NextResponse.json({ error: 'Invalid agent id' }, { status: 400 });
  const existing = await loadAgent(id, clientId);
  if (!existing) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  try {
    await prisma.marketingAgent.update({
      where: { id },
      data: { status: 'archived' },
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error('marketing-agency: agent delete failed', {
      agentId: id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Failed to delete agent' }, { status: 500 });
  }
});

function extractId(request: NextRequest): string | null {
  const segments = request.nextUrl.pathname.split('/').filter(Boolean);
  // /api/marketing-agency/agents/[id]
  const idx = segments.indexOf('agents');
  if (idx === -1) return null;
  const id = segments[idx + 1];
  return id && id !== 'runs' ? id : null;
}
