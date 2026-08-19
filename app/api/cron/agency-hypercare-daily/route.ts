/**
 * GET /api/cron/agency-hypercare-daily — daily Hyper-Care AEO snapshot (AT-006)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyCronRequest } from '@/lib/auth/cron-auth';
import {
  buildHyperCareSnapshot,
  HYPERCARE_REPORT_TYPE,
} from '@/lib/agency/hypercare-snapshot';
import { UNITE_WORKSPACE_SLUG } from '@/lib/agency/portfolio-brand-configs';
import { logger } from '@/lib/logger';

const WINDOW_MS = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const auth = verifyCronRequest(request, 'AGENCY_HYPERCARE_DAILY');
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
        createdAt: { gte: new Date(Date.now() - WINDOW_MS) },
      },
      select: { pass: true, reasons: true },
    });
    const snapshot = buildHyperCareSnapshot(runs);
    const report = await prisma.report.create({
      data: {
        userId: adminUser.id,
        organizationId: workspace.id,
        name: `Hyper-Care Daily — ${snapshot.dayEnding}`,
        type: HYPERCARE_REPORT_TYPE,
        status: 'completed',
        format: 'json',
        data: snapshot as object,
        generatedAt: new Date(),
      },
    });

    logger.info('cron:agency-hypercare-daily:created', {
      reportId: report.id,
      breachSurfaced: snapshot.breachSurfaced,
    });
    return NextResponse.json({
      success: true,
      reportId: report.id,
      dayEnding: snapshot.dayEnding,
      breachSurfaced: snapshot.breachSurfaced,
    });
  } catch (error) {
    logger.error('cron:agency-hypercare-daily failed', { error });
    return NextResponse.json(
      { error: 'Hyper-Care cron failed' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
