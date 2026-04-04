/**
 * GBP Location Details API
 *
 * GET   — Get location details
 * PATCH — Update location (hours, phone, website)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { findOAuthConnection } from '@/lib/google/google-auth';
import {
  getLocationDetails,
  updateLocation,
} from '@/lib/google/business-profile';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );
  if (!security.allowed) {
    return NextResponse.json({ error: security.error }, { status: 401 });
  }

  const userId = security.context.userId!;
  const organizationId = await getEffectiveOrganizationId(userId);
  const { locationId } = await params;

  if (!organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 400 }
    );
  }

  const location = await prisma.gBPLocation.findFirst({
    where: { id: locationId, organizationId },
  });

  if (!location) {
    return NextResponse.json({ error: 'Location not found' }, { status: 404 });
  }

  // Optionally fetch fresh data from Google
  const refresh = request.nextUrl.searchParams.get('refresh') === 'true';
  if (refresh) {
    try {
      const connectionId = await findOAuthConnection(
        organizationId,
        'googlebusiness'
      );
      if (connectionId) {
        const fresh = await getLocationDetails(
          connectionId,
          location.locationId
        );
        return NextResponse.json({
          success: true,
          location: { ...location, live: fresh },
        });
      }
    } catch (refreshError) {
      logger.warn('GBP location refresh failed:', {
        error:
          refreshError instanceof Error
            ? refreshError.message
            : String(refreshError),
      });
    }
  }

  return NextResponse.json({ success: true, location });
}

const UpdateSchema = z.object({
  phone: z.string().optional(),
  website: z.string().url().optional(),
  hours: z.record(z.string(), z.unknown()).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );
  if (!security.allowed) {
    return NextResponse.json({ error: security.error }, { status: 401 });
  }

  const userId = security.context.userId!;
  const organizationId = await getEffectiveOrganizationId(userId);
  const { locationId } = await params;

  if (!organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const location = await prisma.gBPLocation.findFirst({
      where: { id: locationId, organizationId },
    });

    if (!location) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      );
    }

    const connectionId = await findOAuthConnection(
      organizationId,
      'googlebusiness'
    );
    if (!connectionId) {
      return NextResponse.json(
        { error: 'No GBP connection found' },
        { status: 400 }
      );
    }

    // Update on Google
    const updated = await updateLocation(connectionId, location.locationId, {
      primaryPhone: parsed.data.phone,
      websiteUri: parsed.data.website,
      regularHours: parsed.data.hours as GBPLocationUpdate['regularHours'],
    });

    // Update local record
    await prisma.gBPLocation.update({
      where: { id: locationId },
      data: {
        phone: parsed.data.phone ?? location.phone,
        website: parsed.data.website ?? location.website,
        hours:
          parsed.data.hours !== undefined
            ? (parsed.data.hours as object)
            : undefined,
        lastSyncedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, location: updated });
  } catch (error) {
    logger.error('GBP location update error:', error);
    return NextResponse.json(
      { error: 'Failed to update location' },
      { status: 500 }
    );
  }
}

// Type helper for the update call
type GBPLocationUpdate = Parameters<typeof updateLocation>[2];
