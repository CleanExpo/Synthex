/**
 * GBP Locations API
 *
 * GET  — List connected GBP locations
 * POST — Sync locations from Google Business Profile
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
import { listLocations } from '@/lib/google/business-profile';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );
  if (!security.allowed) {
    return NextResponse.json({ error: security.error }, { status: 401 });
  }

  const userId = security.context.userId!;
  const organizationId = await getEffectiveOrganizationId(userId);

  if (!organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 400 }
    );
  }

  const locations = await prisma.gBPLocation.findMany({
    where: { organizationId },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json({ success: true, locations });
}

const SyncSchema = z.object({
  connectionId: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );
  if (!security.allowed) {
    return NextResponse.json({ error: security.error }, { status: 401 });
  }

  const userId = security.context.userId!;
  const organizationId = await getEffectiveOrganizationId(userId);

  if (!organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const parsed = SyncSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const connectionId =
      parsed.data.connectionId ??
      (await findOAuthConnection(organizationId, 'googlebusiness'));

    if (!connectionId) {
      return NextResponse.json(
        {
          error:
            'No Google Business Profile connection found. Please connect first.',
        },
        { status: 400 }
      );
    }

    const locations = await listLocations(connectionId);

    const results = [];
    for (const loc of locations) {
      const location = await prisma.gBPLocation.upsert({
        where: {
          organizationId_locationId: {
            organizationId,
            locationId: loc.name,
          },
        },
        update: {
          locationName: loc.locationName,
          connectionId,
          address: loc.address ?? undefined,
          phone: loc.primaryPhone,
          website: loc.websiteUri,
          categories: {
            primaryCategory: loc.primaryCategory,
            additionalCategories: loc.additionalCategories,
          },
          hours: loc.regularHours ?? undefined,
          newReviewUri: loc.metadata?.newReviewUri ?? undefined,
          lastSyncedAt: new Date(),
        },
        create: {
          organizationId,
          connectionId,
          locationId: loc.name,
          locationName: loc.locationName,
          address: loc.address ?? undefined,
          phone: loc.primaryPhone,
          website: loc.websiteUri,
          categories: {
            primaryCategory: loc.primaryCategory,
            additionalCategories: loc.additionalCategories,
          },
          hours: loc.regularHours ?? undefined,
          newReviewUri: loc.metadata?.newReviewUri ?? undefined,
          isPrimary: false,
          lastSyncedAt: new Date(),
        },
      });
      results.push(location);
    }

    // If only one location, set as primary
    if (results.length === 1) {
      await prisma.gBPLocation.update({
        where: { id: results[0].id },
        data: { isPrimary: true },
      });
    }

    return NextResponse.json({
      success: true,
      locations: results,
      synced: results.length,
    });
  } catch (error) {
    logger.error('GBP locations sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync GBP locations' },
      { status: 500 }
    );
  }
}
