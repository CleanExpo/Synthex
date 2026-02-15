import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromCookies, unauthorizedResponse } from '@/lib/auth/jwt-utils';

// Mock database for demo purposes (shared with connect route)
const integrationConnections = new Map();

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

    // Check if integration is connected
    const connectionKey = `${userId}-${integrationId}`;
    const connection = integrationConnections.get(connectionKey);

    if (!connection) {
      return NextResponse.json({
        connected: false,
        integration: {
          id: integrationId,
          name: integrationId.charAt(0).toUpperCase() + integrationId.slice(1)
        }
      });
    }

    return NextResponse.json({
      connected: true,
      integration: {
        id: integrationId,
        name: integrationId.charAt(0).toUpperCase() + integrationId.slice(1),
        accountName: connection.accountName,
        connectedAt: connection.connectedAt,
        status: connection.status,
        permissions: getPermissionsForIntegration(integrationId)
      }
    });
  } catch (error) {
    console.error('Error checking integration status:', error);
    return NextResponse.json(
      { error: 'Failed to check integration status' },
      { status: 500 }
    );
  }
}

function getPermissionsForIntegration(integrationId: string): string[] {
  const permissions: Record<string, string[]> = {
    twitter: ['Post tweets', 'Read analytics', 'Schedule posts'],
    linkedin: ['Post updates', 'Read analytics', 'Manage pages'],
    instagram: ['Post content', 'View insights', 'Manage comments'],
    facebook: ['Manage pages', 'Post content', 'Read insights'],
    tiktok: ['Post videos', 'View analytics', 'Manage account']
  };
  
  return permissions[integrationId] || [];
}