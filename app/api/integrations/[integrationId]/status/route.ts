import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromCookies, unauthorizedResponse } from '@/lib/auth/jwt-utils';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  try {
    const { integrationId } = await params;

    // Get authenticated user ID from JWT in cookie
    const userId = await getUserIdFromCookies();
    if (!userId) {
      return unauthorizedResponse();
    }

    // Query real connection from database
    const connection = await prisma.platformConnection.findFirst({
      where: {
        userId,
        platform: integrationId,
        isActive: true,
      },
    });

    if (!connection) {
      return NextResponse.json({
        connected: false,
        integration: {
          id: integrationId,
          name: integrationId.charAt(0).toUpperCase() + integrationId.slice(1),
        },
      });
    }

    // Prefer actual OAuth scopes from connection, fall back to default descriptions
    const permissions = connection.scope
      ? connection.scope.split(',').map((s: string) => s.trim())
      : getPermissionsForIntegration(integrationId);

    return NextResponse.json({
      connected: true,
      integration: {
        id: integrationId,
        name: connection.profileName || integrationId.charAt(0).toUpperCase() + integrationId.slice(1),
        profileId: connection.profileId,
        profileName: connection.profileName,
        connectedAt: connection.createdAt,
        lastSync: connection.lastSync,
        status: 'active',
        permissions,
      },
    });
  } catch (error) {
    logger.error('Error checking integration status:', error);
    return NextResponse.json(
      { error: 'Failed to check integration status' },
      { status: 500 }
    );
  }
}

// Default permission descriptions per platform — can be overridden by actual OAuth scopes
function getPermissionsForIntegration(integrationId: string): string[] {
  const permissions: Record<string, string[]> = {
    twitter: ['Post tweets', 'Read analytics', 'Schedule posts'],
    linkedin: ['Post updates', 'Read analytics', 'Manage pages'],
    instagram: ['Post content', 'View insights', 'Manage comments'],
    facebook: ['Manage pages', 'Post content', 'Read insights'],
    tiktok: ['Post videos', 'View analytics', 'Manage account'],
    youtube: ['Upload videos', 'View analytics', 'Manage playlists'],
    pinterest: ['Create pins', 'Read analytics', 'Manage boards'],
    reddit: ['Submit posts', 'Read analytics', 'Manage communities'],
  };

  return permissions[integrationId] || [];
}
