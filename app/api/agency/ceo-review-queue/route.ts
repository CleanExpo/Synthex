/**
 * GET /api/agency/ceo-review-queue — SYN-972 / AT-004
 * Lists workflow executions awaiting CEO approval that have cleared the
 * senior-strategist final-gate (pass stamp on a completed step).
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/auth/with-auth';
import {
  AGENCY_CEO_QUEUE_READ,
  enforceAgencyPermission,
} from '@/lib/agency/agency-api-auth';
import { isStrategistClearance } from '@/lib/agency/strategist-gate';
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

      // Prefetch a wider window — strategist filter is applied in-process so
      // ad-hoc waiting_approval rows without an AT-004 stamp stay out of the
      // CEO batch. Cap the scan to avoid unbounded reads.
      const candidates = await prisma.workflowExecution.findMany({
        where: {
          organizationId: clientId,
          status: 'waiting_approval',
          stepExecutions: {
            some: {
              status: 'completed',
              outputData: {
                path: ['gate'],
                equals: 'senior-strategist',
              },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: Math.min(100, limit * 3),
        select: {
          id: true,
          title: true,
          status: true,
          currentStepIndex: true,
          totalSteps: true,
          updatedAt: true,
          createdAt: true,
          triggerType: true,
          stepExecutions: {
            where: { status: 'completed' },
            select: { outputData: true, stepName: true, stepIndex: true },
          },
        },
      });

      const queue = candidates
        .filter(item =>
          item.stepExecutions.some(step =>
            isStrategistClearance(step.outputData)
          )
        )
        .slice(0, limit)
        .map(item => ({
          id: item.id,
          title: item.title,
          status: item.status,
          currentStepIndex: item.currentStepIndex,
          totalSteps: item.totalSteps,
          updatedAt: item.updatedAt,
          createdAt: item.createdAt,
          triggerType: item.triggerType,
          strategistCleared: true as const,
          agencyTaskId: 'AT-004' as const,
        }));

      return NextResponse.json({
        data: {
          queue,
          count: queue.length,
          gate: 'senior-strategist',
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
