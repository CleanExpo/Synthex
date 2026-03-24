/**
 * GSC Properties API
 *
 * GET  /api/seo/search-console/properties — List connected GSC properties
 * POST /api/seo/search-console/properties — Sync properties from Google
 *
 * @module app/api/seo/search-console/properties/route
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
import { listSites } from '@/lib/google/search-console-oauth';
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

  const properties = await prisma.gSCProperty.findMany({
    where: { organizationId },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    take: 100, // orgs rarely have > 10 GSC properties
  });

  return NextResponse.json({ success: true, properties });
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

    // Find OAuth connection
    const connectionId =
      parsed.data.connectionId ??
      (await findOAuthConnection(organizationId, 'searchconsole'));

    if (!connectionId) {
      return NextResponse.json(
        {
          error:
            'No Search Console connection found. Please connect Google Search Console first.',
        },
        { status: 400 }
      );
    }

    // Fetch sites from Google
    const sites = await listSites(connectionId);

    // Upsert each site as a GSCProperty
    const results = [];
    for (const site of sites) {
      const property = await prisma.gSCProperty.upsert({
        where: {
          organizationId_siteUrl: {
            organizationId,
            siteUrl: site.siteUrl,
          },
        },
        update: {
          permissionLevel: site.permissionLevel,
          connectionId,
          lastSyncedAt: new Date(),
        },
        create: {
          organizationId,
          connectionId,
          siteUrl: site.siteUrl,
          permissionLevel: site.permissionLevel,
          isPrimary: false,
          lastSyncedAt: new Date(),
        },
      });
      results.push(property);
    }

    // If only one property and none are primary, set it as primary
    if (results.length === 1) {
      await prisma.gSCProperty.update({
        where: { id: results[0].id },
        data: { isPrimary: true },
      });
      results[0].isPrimary = true;
    }

    return NextResponse.json({
      success: true,
      properties: results,
      synced: results.length,
    });
  } catch (error) {
    logger.error('GSC properties sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync GSC properties' },
      { status: 500 }
    );
  }
}
