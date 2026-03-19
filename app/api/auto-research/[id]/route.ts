/**
 * Auto-Research Run Detail API
 * GET /api/auto-research/[id]
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) return unauthorizedResponse();

  const orgId = await getEffectiveOrganizationId(userId);
  const { id } = await params;

  try {
    const run = await prisma.autoResearchRun.findFirst({
      where: {
        id,
        OR: [
          { organizationId: null },
          ...(orgId ? [{ organizationId: orgId }] : []),
        ],
      },
      include: {
        insights: {
          orderBy: { confidence: 'desc' },
          take: 50,
        },
      },
    });

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    return NextResponse.json(run);
  } catch (err) {
    logger.error('auto-research [id] GET failed', { error: err, id });
    return NextResponse.json({ error: 'Failed to fetch run' }, { status: 500 });
  }
}
