/**
 * Integrations API Route
 * GET /api/integrations - Get user integrations
 * POST /api/integrations - Connect a new integration (manual)
 * DELETE /api/integrations - Disconnect an integration
 *
 * AUTH: Uses `getUserIdFromRequestOrCookies()` for cookie-based JWT auth.
 * DB: Uses Prisma to query `platform_connections` table (same table OAuth callback writes to).
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { z } from 'zod';

const connectIntegrationSchema = z.object({
  platform: z.string().min(1),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  profile: z.record(z.unknown()).optional(),
});

// Default empty integrations response
const emptyIntegrations = {
  integrations: {
    twitter: false,
    linkedin: false,
    instagram: false,
    facebook: false,
    tiktok: false,
  },
  details: {} as Record<string, { profileName: string | null; profileId: string | null }>,
  raw: [],
};

// GET user integrations
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Query platform_connections via Prisma (same table OAuth callback writes to)
    const connections = await prisma.platformConnection.findMany({
      where: { userId, isActive: true },
      select: {
        platform: true,
        profileName: true,
        profileId: true,
        isActive: true,
      },
    });

    // Format integrations for frontend
    const formattedIntegrations: Record<string, boolean> = {
      twitter: false,
      linkedin: false,
      instagram: false,
      facebook: false,
      tiktok: false,
    };

    const connectionDetails: Record<string, { profileName: string | null; profileId: string | null }> = {};

    connections.forEach(conn => {
      const platform = conn.platform.toLowerCase();
      if (platform in formattedIntegrations) {
        formattedIntegrations[platform] = true;
        connectionDetails[platform] = {
          profileName: conn.profileName,
          profileId: conn.profileId,
        };
      }
    });

    return NextResponse.json({
      integrations: formattedIntegrations,
      details: connectionDetails,
      raw: connections,
    });
  } catch (error) {
    console.error('Integrations fetch error:', error);
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

    // Upsert platform connection via Prisma
    const connection = await prisma.platformConnection.upsert({
      where: {
        userId_platform_profileId: {
          userId,
          platform,
          profileId: 'manual',
        },
      },
      update: {
        accessToken: accessToken || '',
        refreshToken: refreshToken || null,
        isActive: true,
        updatedAt: new Date(),
        metadata: profile ? ({ profile } as any) : undefined,
      },
      create: {
        userId,
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
    console.error('Integration connection error:', error);
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

    // Soft delete - mark as inactive and clear tokens
    await prisma.platformConnection.updateMany({
      where: { userId, platform },
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
    console.error('Integration disconnection error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect integration', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
