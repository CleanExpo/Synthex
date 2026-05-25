/**
 * Marketing Agency Agent — Run History.
 *
 *   GET /api/marketing-agency/agents/[id]/runs?limit=20
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/auth/with-auth';

export const runtime = 'nodejs';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const GET = withAuth(async (request, { clientId }) => {
  const id = extractAgentId(request);
  if (!id) return NextResponse.json({ error: 'Invalid agent id' }, { status: 400 });

  const agent = await prisma.marketingAgent.findFirst({
    where: { id, organizationId: clientId },
    select: { id: true },
  });
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  const limit = parsed.success ? parsed.data.limit : 20;

  const runs = await prisma.marketingAgentRun.findMany({
    where: { agentId: id, organizationId: clientId },
    orderBy: { startedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      status: true,
      startedAt: true,
      completedAt: true,
      opportunitiesConsidered: true,
      claimsProposed: true,
      evidenceGapsFlagged: true,
      qaReportId: true,
      summary: true,
      errorMessage: true,
    },
  });

  return NextResponse.json({ runs });
});

function extractAgentId(request: NextRequest): string | null {
  const segments = request.nextUrl.pathname.split('/').filter(Boolean);
  const idx = segments.indexOf('agents');
  if (idx === -1) return null;
  return segments[idx + 1] ?? null;
}
