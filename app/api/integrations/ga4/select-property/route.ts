/**
 * POST /api/integrations/ga4/select-property
 *
 * Records the GA4 property the caller wants to sync for their active
 * organization. Upserts a row in GA4Property keyed on (organizationId, propertyId).
 *
 * Requires an authenticated user who belongs to an organization — personal
 * (null org) connections are rejected with 403 because GA4Property is
 * org-scoped.
 *
 * SYN-793
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { logger } from '@/lib/logger';

const selectPropertySchema = z.object({
  propertyId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^\d+$/, 'propertyId must be the numeric GA4 property ID'),
  measurementId: z
    .string()
    .regex(/^G-[A-Z0-9]{4,20}$/, 'measurementId must look like G-XXXXXXX')
    .optional(),
  displayName: z.string().min(1).max(255).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = selectPropertySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const organizationId = await getEffectiveOrganizationId(userId);
    if (!organizationId) {
      return NextResponse.json(
        {
          error:
            'GA4 properties require an active organization. Select or create one first.',
        },
        { status: 403 }
      );
    }

    const { propertyId, measurementId, displayName } = parsed.data;

    const property = await prisma.gA4Property.upsert({
      where: {
        organizationId_propertyId: {
          organizationId,
          propertyId,
        },
      },
      update: {
        measurementId: measurementId ?? null,
        displayName: displayName ?? null,
        syncStatus: 'active',
      },
      create: {
        organizationId,
        propertyId,
        measurementId: measurementId ?? null,
        displayName: displayName ?? null,
        syncStatus: 'active',
      },
    });

    return NextResponse.json({ property }, { status: 200 });
  } catch (error) {
    logger.error('GA4 select-property error:', error);
    return NextResponse.json(
      { error: 'Failed to save GA4 property selection' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
