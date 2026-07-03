/**
 * Creators (Influencer / UGC CRM) — List + Create (backlog #6).
 *
 *   GET  /api/creators   → list this org's creators
 *   POST /api/creators   → create a new creator record
 *
 * Org-scoped via withAuth's clientId; all rows carry organization_id and are
 * additionally RLS-gated at the database layer.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/auth/with-auth';
import { defineRoute } from '@/lib/api/define-route';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

const createSchema = z.object({
  name: z.string().min(1).max(200),
  handle: z.string().max(200).optional(),
  platform: z.string().max(60).optional(),
  email: z.string().email().max(320).optional(),
  followerCount: z.coerce.number().int().min(0).optional(),
  status: z.enum(['prospect', 'contacted', 'active', 'declined']).optional(),
  notes: z.string().max(5000).optional(),
});

export const GET = withAuth(async (_request, { clientId }) => {
  const creators = await prisma.creator.findMany({
    where: { organizationId: clientId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      handle: true,
      platform: true,
      email: true,
      followerCount: true,
      status: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json({ creators });
});

export const POST = defineRoute(
  {
    body: createSchema,
    serverErrorMessage: 'Failed to create creator',
    onError: error =>
      logger.error('creators: create failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
  },
  async ({ body }, { clientId }) => {
    const creator = await prisma.creator.create({
      data: {
        organizationId: clientId,
        name: body.name,
        handle: body.handle,
        platform: body.platform,
        email: body.email,
        followerCount: body.followerCount,
        status: body.status ?? 'prospect',
        notes: body.notes,
      },
    });
    return NextResponse.json({ creator }, { status: 201 });
  }
);
