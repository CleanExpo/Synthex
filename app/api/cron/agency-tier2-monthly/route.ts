/**
 * GET /api/cron/agency-tier2-monthly — monthly Tier-2 AEO snapshot (AT-007)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyCronRequest } from '@/lib/auth/cron-auth';
import {
  buildTier2Snapshot,
  TIER2_REPORT_TYPE,
} from '@/lib/agency/tier2-snapshot';
import { UNITE_WORKSPACE_SLUG } from '@/lib/agency/portfolio-brand-configs';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const auth = verifyCronRequest(request, 'AGENCY_TIER2_MONTHLY');
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

    const runs = await prisma.aeoGateRun.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      select: { pass: true, reasons: true },
    });
    const snapshot = buildTier2Snapshot(runs);
    const report = await prisma.report.create({
      data: {
        userId: adminUser.id,
        organizationId: workspace.id,
        name: `Tier-2 Monthly — ${snapshot.monthEnding}`,
        type: TIER2_REPORT_TYPE,
        status: 'completed',
        format: 'json',
        data: snapshot as object,
        generatedAt: new Date(),
      },
    });

    logger.info('cron:agency-tier2-monthly:created', { reportId: report.id });
    return NextResponse.json({
      success: true,
      reportId: report.id,
      monthEnding: snapshot.monthEnding,
    });
  } catch (error) {
    logger.error('cron:agency-tier2-monthly failed', { error });
    return NextResponse.json({ error: 'Tier-2 cron failed' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
