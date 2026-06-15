/**
 * GET /api/paid-ads
 * Returns ad performance snapshots for the authenticated user's org.
 * Supports optional ?platform=google_ads|meta_ads and ?days=7|30|90 filters.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/auth/with-auth';

const QuerySchema = z.object({
  platform: z.enum(['google_ads', 'meta_ads']).optional(),
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export const GET = withAuth(async (req: NextRequest, auth) => {
  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    platform: searchParams.get('platform') ?? undefined,
    days: searchParams.get('days') ?? 30,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { platform, days } = parsed.data;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const accounts = await prisma.adAccount.findMany({
    where: {
      organizationId: auth.clientId,
      isActive: true,
      ...(platform ? { platform } : {}),
    },
    select: {
      id: true,
      platform: true,
      name: true,
      currencyCode: true,
      snapshots: {
        where: { dateStart: { gte: since } },
        orderBy: { dateStart: 'desc' },
        select: {
          id: true,
          dateStart: true,
          dateEnd: true,
          impressions: true,
          clicks: true,
          spend: true,
          conversions: true,
          revenue: true,
          roas: true,
          ctr: true,
          cpc: true,
          campaignId: true,
          campaignName: true,
        },
      },
    },
  });

  return NextResponse.json({ accounts });
});
