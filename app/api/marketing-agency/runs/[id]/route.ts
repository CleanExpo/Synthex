/**
 * Marketing Agency Agent Run — Get one (with artifacts).
 *
 *   GET /api/marketing-agency/runs/[id]
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/auth/with-auth';

export const runtime = 'nodejs';

export const GET = withAuth(async (request, { clientId }) => {
  const id = extractRunId(request);
  if (!id) return NextResponse.json({ error: 'Invalid run id' }, { status: 400 });

  const run = await prisma.marketingAgentRun.findFirst({
    where: { id, organizationId: clientId },
    include: {
      agent: { select: { id: true, name: true, goal: true } },
      qaReport: {
        select: {
          id: true,
          status: true,
          blockedReasons: true,
          warnings: true,
          checks: true,
        },
      },
    },
  });
  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  return NextResponse.json({ run });
});

function extractRunId(request: NextRequest): string | null {
  const segments = request.nextUrl.pathname.split('/').filter(Boolean);
  const idx = segments.indexOf('runs');
  if (idx === -1) return null;
  return segments[idx + 1] ?? null;
}
