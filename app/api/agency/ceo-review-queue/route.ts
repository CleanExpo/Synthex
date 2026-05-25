/**
 * GET /api/agency/ceo-review-queue — SYN-972
 * Lists workflow executions awaiting human approval (CEO batched-review queue).
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/auth/with-auth';
import {
  AGENCY_CEO_QUEUE_READ,
  enforceAgencyPermission,
} from '@/lib/agency/agency-api-auth';
import { logger } from '@/lib/logger';

export const GET = withAuth(
  async (request: NextRequest, { userId, clientId }) => {
    try {
      const permDenied = await enforceAgencyPermission(
        userId,
        clientId,
        AGENCY_CEO_QUEUE_READ
      );
      if (permDenied) return permDenied;

      const limit = Math.min(
        50,
        Number(new URL(request.url).searchParams.get('limit') ?? 20)
      );

      const items = await prisma.workflowExecution.findMany({
        where: {
          organizationId: clientId,
          status: 'waiting_approval',
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          title: true,
          status: true,
          currentStepIndex: true,
          totalSteps: true,
          updatedAt: true,
          createdAt: true,
          triggerType: true,
        },
      });

      return NextResponse.json({
        data: {
          queue: items,
          count: items.length,
        },
      });
    } catch (error) {
      logger.error('GET /api/agency/ceo-review-queue failed', { error });
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: 'Failed to load CEO review queue',
        },
        { status: 500 }
      );
    }
  }
);

export const runtime = 'nodejs';
