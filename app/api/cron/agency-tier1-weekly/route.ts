/**
 * GET /api/cron/agency-tier1-weekly — Monday Tier-1 snapshot for in-house workspace (SYN-PM-107)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyCronRequest } from '@/lib/auth/cron-auth';
import { buildTier1Snapshot } from '@/lib/agency/tier1-snapshot';
import { UNITE_WORKSPACE_SLUG } from '@/lib/agency/portfolio-brand-configs';
import { logger } from '@/lib/logger';

const TIER1_REPORT_TYPE = 'agency_tier1';

export async function GET(request: NextRequest) {
  const auth = verifyCronRequest(request, 'AGENCY_TIER1_WEEKLY');
  if (!auth.ok) return auth.response;

  try {
    const workspace = await prisma.organization.findUnique({
      where: { slug: UNITE_WORKSPACE_SLUG },
      select: { id: true },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found', slug: UNITE_WORKSPACE_SLUG },
        { status: 404 }
      );
    }

    const adminUser = await prisma.user.findFirst({
      where: { organizationId: workspace.id },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!adminUser) {
      return NextResponse.json(
        { error: 'No workspace user for report ownership' },
        { status: 404 }
      );
    }

    const snapshot = buildTier1Snapshot();
    const report = await prisma.report.create({
      data: {
        userId: adminUser.id,
        organizationId: workspace.id,
        name: `Tier-1 Weekly — ${snapshot.weekEnding}`,
        type: TIER1_REPORT_TYPE,
        status: 'completed',
        format: 'json',
        data: snapshot as object,
        generatedAt: new Date(),
      },
    });

    logger.info('cron:agency-tier1-weekly:created', { reportId: report.id });

    return NextResponse.json({
      success: true,
      reportId: report.id,
      weekEnding: snapshot.weekEnding,
    });
  } catch (error) {
    logger.error('cron:agency-tier1-weekly failed', { error });
    return NextResponse.json({ error: 'Tier-1 cron failed' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
