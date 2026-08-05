/**
 * GET /api/agency/tier1-report — latest Tier-1 weekly snapshot (SYN-PM-107)
 * POST — generate snapshot for current org (executive / analytics:export)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { withAuth } from '@/lib/auth/with-auth';
import {
  AGENCY_TIER1_READ,
  AGENCY_TIER1_WRITE,
  enforceAgencyPermission,
} from '@/lib/agency/agency-api-auth';
import { buildTier1Snapshot } from '@/lib/agency/tier1-snapshot';
import { loadAgencyGateCounts } from '@/lib/agency/load-agency-gate-counts';
import { logger } from '@/lib/logger';
import { writeDefault } from '@/lib/rate-limit';

const TIER1_REPORT_TYPE = 'agency_tier1';

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
          type: TIER1_REPORT_TYPE,
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
      logger.error('GET /api/agency/tier1-report failed', { error });
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: 'Failed to load Tier-1 report',
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
        const parsed = z
          .object({
            claimsProcessed: z.number().int().min(0).optional(),
          })
          .safeParse(body);

        if (!parsed.success) {
          return NextResponse.json(
            { error: 'Validation Error', details: parsed.error.issues },
            { status: 400 }
          );
        }

        // Real agency-loop Gate counts for this org (SYN-PM-107 + SYN-972) —
        // how the human Gate decided on the OS's work. Secret-free status counts.
        const gateCounts = await loadAgencyGateCounts(clientId);

        const snapshot = buildTier1Snapshot({
          claimsProcessed: parsed.data.claimsProcessed ?? null,
          gateCounts,
        });

        const report = await prisma.report.create({
          data: {
            userId,
            organizationId: clientId,
            name: `Tier-1 Weekly — ${snapshot.weekEnding}`,
            type: TIER1_REPORT_TYPE,
            status: 'completed',
            format: 'json',
            data: snapshot as object,
            generatedAt: new Date(),
          },
        });

        return NextResponse.json(
          { data: { id: report.id, snapshot } },
          { status: 201 }
        );
      } catch (error) {
        logger.error('POST /api/agency/tier1-report failed', { error });
        return NextResponse.json(
          {
            error: 'Internal Server Error',
            message: 'Failed to generate Tier-1 report',
          },
          { status: 500 }
        );
      }
    });
  }
);

export const runtime = 'nodejs';
