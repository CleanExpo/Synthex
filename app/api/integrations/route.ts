/**
 * Integrations API Route
 * GET /api/integrations - Get user integrations (scoped by active organization)
 * POST /api/integrations - Connect a new integration (manual)
 * DELETE /api/integrations - Disconnect an integration
 *
 * AUTH: Uses `getUserIdFromRequestOrCookies()` for cookie-based JWT auth.
 * DB: Uses Prisma to query `platform_connections` table (same table OAuth callback writes to).
 *
 * MULTI-BUSINESS: Connections are scoped by organizationId.
 * - Multi-business owners: filtered by activeOrganizationId
 * - Regular users: filtered by user's organizationId (or null for personal)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const connectIntegrationSchema = z.object({
  platform: z.string().min(1),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  profile: z.record(z.unknown()).optional(),
});

// All supported platforms
const ALL_PLATFORMS = ['twitter', 'linkedin', 'instagram', 'facebook', 'tiktok', 'youtube', 'pinterest', 'reddit', 'threads'] as const;

// Default empty integrations response
const emptyIntegrations = {
  integrations: Object.fromEntries(ALL_PLATFORMS.map(p => [p, false])),
  details: {} as Record<string, { profileName: string | null; profileId: string | null }>,
  raw: [],
};

// GET user integrations (scoped by active organization)
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Determine organization scope for multi-business support
    const organizationId = await getEffectiveOrganizationId(userId);

    // Query platform_connections via Prisma, scoped by organization
    const connections = await prisma.platformConnection.findMany({
      where: { userId, organizationId: organizationId ?? null, isActive: true },
      select: {
        platform: true,
        profileName: true,
        profileId: true,
        accountType: true,
        isActive: true,
        organizationId: true,
      },
    });

    // Format integrations for frontend — all supported platforms
    const formattedIntegrations: Record<string, boolean> = Object.fromEntries(
      ALL_PLATFORMS.map(p => [p, false])
    );

    const connectionDetails: Record<string, { profileName: string | null; profileId: string | null }> = {};

    connections.forEach(conn => {
      const platform = conn.platform.toLowerCase();
      formattedIntegrations[platform] = true;
      connectionDetails[platform] = {
        profileName: conn.profileName,
        profileId: conn.profileId,
      };
    });

    return NextResponse.json({
      integrations: formattedIntegrations,
      details: connectionDetails,
      organizationId: organizationId ?? null,
      raw: connections,
    });
  } catch (error) {
    logger.error('Integrations fetch error:', error);
    // Return empty integrations instead of 500 — non-critical feature
    return NextResponse.json(emptyIntegrations);
  }
}

// POST - Connect a new integration (manual token entry)
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = connectIntegrationSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }
    const { platform, accessToken, refreshToken, profile } = validation.data;

    // Determine organization scope for multi-business support
    const organizationId = await getEffectiveOrganizationId(userId);
    // Use empty string for null orgId — must match composite unique constraint
    const orgIdForDb = organizationId ?? '';

    // Upsert platform connection via Prisma (scoped by organization)
    const connection = await prisma.platformConnection.upsert({
      where: {
        unique_user_platform_org: {
          userId,
          platform,
          organizationId: orgIdForDb,
        },
      },
      update: {
        accessToken: accessToken || '',
        refreshToken: refreshToken || null,
        profileId: 'manual',
        isActive: true,
        updatedAt: new Date(),
        metadata: profile ? ({ profile } as any) : undefined,
      },
      create: {
        userId,
        organizationId: orgIdForDb || null,
        platform,
        accessToken: accessToken || '',
        refreshToken: refreshToken || null,
        scope: '',
        profileId: 'manual',
        isActive: true,
        metadata: profile ? ({ profile } as any) : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      integration: connection,
      message: `Connected to ${platform} successfully`,
    });
  } catch (error) {
    logger.error('Integration connection error:', error);
    return NextResponse.json(
      { error: 'Failed to connect integration', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// DELETE - Disconnect an integration
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');

    if (!platform) {
      return NextResponse.json({ error: 'Platform is required' }, { status: 400 });
    }

    // Determine organization scope for multi-business support
    const organizationId = await getEffectiveOrganizationId(userId);

    // Soft delete - mark as inactive and clear tokens (scoped by organization)
    await prisma.platformConnection.updateMany({
      where: { userId, platform, organizationId: organizationId ?? null },
      data: {
        isActive: false,
        accessToken: '',
        refreshToken: null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Disconnected from ${platform} successfully`,
    });
  } catch (error) {
    logger.error('Integration disconnection error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect integration', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
