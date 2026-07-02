/**
 * UGC submissions — Intake + Moderation (backlog #6).
 *
 *   GET   /api/ugc            → list this org's submissions (optional ?status= filter)
 *   POST  /api/ugc            → intake a new submission (asset + caption)
 *   PATCH /api/ugc            → moderate a submission { id, status: approved | rejected }
 *
 * Org-scoped via withAuth's clientId; all rows carry organization_id and are
 * additionally RLS-gated at the database layer. An `approved` row is the feed
 * the future content-pipeline worker promotes (status flow: pending → approved | rejected).
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/auth/with-auth';
import { defineRoute } from '@/lib/api/define-route';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

const STATUSES = ['pending', 'approved', 'rejected'] as const;

const querySchema = z.object({
  status: z.enum(STATUSES).optional(),
});

const intakeSchema = z
  .object({
    creatorId: z.string().min(1).max(64).optional(),
    assetUrl: z.string().url().max(2048).optional(),
    caption: z.string().max(5000).optional(),
  })
  .refine(b => Boolean(b.assetUrl) || Boolean(b.caption), {
    message: 'Provide an assetUrl or a caption',
    path: ['assetUrl'],
  });

const moderateSchema = z.object({
  id: z.string().min(1).max(64),
  status: z.enum(['approved', 'rejected']),
});

export const GET = defineRoute(
  { query: querySchema },
  async ({ query }, { clientId }) => {
    const submissions = await prisma.ugcSubmission.findMany({
      where: {
        organizationId: clientId,
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true,
        creatorId: true,
        assetUrl: true,
        caption: true,
        status: true,
        submittedAt: true,
        createdAt: true,
        creator: { select: { id: true, name: true, handle: true } },
      },
    });
    return NextResponse.json({ submissions });
  }
);

export const POST = defineRoute(
  {
    body: intakeSchema,
    serverErrorMessage: 'Failed to record UGC submission',
    onError: error =>
      logger.error('ugc: intake failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
  },
  async ({ body }, { clientId }) => {
    // If a creator is attached, it must belong to the caller's org (no cross-org linking).
    if (body.creatorId) {
      const creator = await prisma.creator.findFirst({
        where: { id: body.creatorId, organizationId: clientId },
        select: { id: true },
      });
      if (!creator) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: { creatorId: ['Unknown creator'] },
          },
          { status: 400 }
        );
      }
    }

    const submission = await prisma.ugcSubmission.create({
      data: {
        organizationId: clientId,
        creatorId: body.creatorId,
        assetUrl: body.assetUrl,
        caption: body.caption,
        status: 'pending',
      },
    });
    return NextResponse.json({ submission }, { status: 201 });
  }
);

export const PATCH = defineRoute(
  {
    body: moderateSchema,
    serverErrorMessage: 'Failed to moderate UGC submission',
    onError: error =>
      logger.error('ugc: moderate failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
  },
  async ({ body }, { clientId }) => {
    // Org-scoped update — only flips a row this org owns; 404 otherwise.
    const result = await prisma.ugcSubmission.updateMany({
      where: { id: body.id, organizationId: clientId },
      data: { status: body.status },
    });
    if (result.count === 0) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }
    const submission = await prisma.ugcSubmission.findUnique({
      where: { id: body.id },
    });
    return NextResponse.json({ submission });
  }
);
