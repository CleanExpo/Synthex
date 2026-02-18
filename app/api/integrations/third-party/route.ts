/**
 * Third-Party Integrations List Route
 *
 * @description GET: List all third-party integrations for the current user.
 * Returns connected integrations with status and disconnected providers with config-only entries.
 *
 * Auth: getUserIdFromCookies() from lib/auth/jwt-utils
 * Data: Prisma PlatformConnection model
 */

import { NextResponse } from 'next/server';
import { getUserIdFromCookies, unauthorizedResponse } from '@/lib/auth/jwt-utils';
import { prisma } from '@/lib/prisma';
import {
  SUPPORTED_PROVIDERS,
  INTEGRATION_REGISTRY,
  type IntegrationProvider,
  type IntegrationStatus,
} from '@/lib/integrations';

// ============================================================================
// GET — List all third-party integrations
// ============================================================================

export async function GET() {
  try {
    const userId = await getUserIdFromCookies();
    if (!userId) {
      return unauthorizedResponse();
    }

    // Query all third-party connections for this user
    const connections = await prisma.platformConnection.findMany({
      where: {
        userId,
        platform: { in: SUPPORTED_PROVIDERS },
      },
    });

    // Build status list for all supported providers
    const integrations: IntegrationStatus[] = SUPPORTED_PROVIDERS.map(
      (provider: IntegrationProvider) => {
        const connection = connections.find(
          (c) => c.platform === provider && c.isActive
        );

        const config = INTEGRATION_REGISTRY[provider];

        if (connection) {
          return {
            connected: true,
            provider,
            config,
            lastSync: connection.lastSync,
            error: null,
          };
        }

        return {
          connected: false,
          provider,
          config,
          lastSync: null,
          error: null,
        };
      }
    );

    return NextResponse.json({ integrations });
  } catch (error) {
    console.error('Failed to list third-party integrations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch integrations', message: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
