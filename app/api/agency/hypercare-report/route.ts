/**
 * GET /api/agency/hypercare-report — latest Hyper-Care daily snapshot (AT-006)
 * POST — generate snapshot for the current organisation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/auth/with-auth';
import {
  AGENCY_TIER1_READ,
  AGENCY_TIER1_WRITE,
  enforceAgencyPermission,
} from '@/lib/agency/agency-api-auth';
import {
  buildHyperCareSnapshot,
  HYPERCARE_REPORT_TYPE,
} from '@/lib/agency/hypercare-snapshot';
import { logger } from '@/lib/logger';
import { writeDefault } from '@/lib/rate-limit';

const generateHyperCareReportSchema = z.object({}).strict();

const WINDOW_MS = 24 * 60 * 60 * 1000;

async function generateHyperCareReport(userId: string, organizationId: string) {
  const runs = await prisma.aeoGateRun.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - WINDOW_MS) },
    },
    select: { pass: true, reasons: true },
  });
  const snapshot = buildHyperCareSnapshot(runs);
  const report = await prisma.report.create({
    data: {
      userId,
      organizationId,
      name: `Hyper-Care Daily — ${snapshot.dayEnding}`,
      type: HYPERCARE_REPORT_TYPE,
      status: 'completed',
      format: 'json',
      data: snapshot as object,
      generatedAt: new Date(),
    },
  });

  return { report, snapshot };
}

export const GET = withAuth(
  async (_request: NextRequest, { userId, clientId }) => {
    try {
      const permDenied = await enforceAgencyPermission(userId, clientId, [
        AGENCY_TIER1_READ,
      ]);
      if (permDenied) return permDenied;

      const latest = await prisma.report.findFirst({
        where: {
          organizationId: clientId,
          type: HYPERCARE_REPORT_TYPE,
          status: 'completed',
        },
        orderBy: { generatedAt: 'desc' },
      });

      return NextResponse.json({
        data: latest
          ? {
              id: latest.id,
              name: latest.name,
              generatedAt: latest.generatedAt,
              snapshot: latest.data,
            }
          : null,
      });
    } catch (error) {
      logger.error('GET /api/agency/hypercare-report failed', { error });
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: 'Failed to load Hyper-Care report',
        },
        { status: 500 }
      );
    }
  }
);

export const POST = withAuth(
  async (request: NextRequest, { userId, clientId }) => {
    return writeDefault(request, async () => {
      try {
        const permDenied = await enforceAgencyPermission(
          userId,
          clientId,
          AGENCY_TIER1_WRITE
        );
        if (permDenied) return permDenied;

        const body = await request.json().catch(() => ({}));
        const parsed = generateHyperCareReportSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: 'Validation Error', details: parsed.error.issues },
            { status: 400 }
          );
        }

        const { report, snapshot } = await generateHyperCareReport(
          userId,
          clientId
        );
        return NextResponse.json(
          { data: { id: report.id, snapshot } },
          { status: 201 }
        );
      } catch (error) {
        logger.error('POST /api/agency/hypercare-report failed', { error });
        return NextResponse.json(
          {
            error: 'Internal Server Error',
            message: 'Failed to generate Hyper-Care report',
          },
          { status: 500 }
        );
      }
    });
  }
);

export const runtime = 'nodejs';
