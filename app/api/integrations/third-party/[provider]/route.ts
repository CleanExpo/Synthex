/**
 * Third-Party Integration Provider Route
 *
 * @description
 * POST:   Connect a third-party integration (Canva, Buffer, Zapier)
 * GET:    Check connection status and validate credentials
 * DELETE: Disconnect a third-party integration (soft-delete)
 *
 * Auth: getUserIdFromCookies() from lib/auth/jwt-utils
 * Data: Prisma PlatformConnection model
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromCookies, unauthorizedResponse } from '@/lib/auth/jwt-utils';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  isValidProvider,
  createIntegrationService,
  INTEGRATION_REGISTRY,
  type IntegrationProvider,
  type IntegrationCredentials,
} from '@/lib/integrations';

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

const canvaCredentialsSchema = z.object({
  accessToken: z.string().min(1, 'Access token is required'),
  refreshToken: z.string().optional(),
});

const bufferCredentialsSchema = z.object({
  accessToken: z.string().min(1, 'Access token is required'),
  refreshToken: z.string().optional(),
});

const zapierCredentialsSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  webhookUrl: z.string().url('Must be a valid URL').optional(),
});

function getCredentialsSchema(provider: IntegrationProvider) {
  switch (provider) {
    case 'canva':
      return canvaCredentialsSchema;
    case 'buffer':
      return bufferCredentialsSchema;
    case 'zapier':
      return zapierCredentialsSchema;
  }
}

// ============================================================================
// POST — Connect an integration
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;

    // Validate provider
    if (!isValidProvider(provider)) {
      return NextResponse.json(
        { error: 'Invalid provider', message: `'${provider}' is not a supported integration provider` },
        { status: 400 }
      );
    }

    // Auth
    const userId = await getUserIdFromCookies();
    if (!userId) {
      return unauthorizedResponse();
    }

    // Parse and validate body
    const body = await request.json();
    const schema = getCredentialsSchema(provider);
    const validation = schema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid credentials', details: validation.error.issues },
        { status: 400 }
      );
    }

    const credentials = validation.data;

    // Build IntegrationCredentials for the service
    const integrationCredentials: IntegrationCredentials = {
      accessToken: 'accessToken' in credentials ? credentials.accessToken : undefined,
      apiKey: 'apiKey' in credentials ? credentials.apiKey : undefined,
      webhookUrl: 'webhookUrl' in credentials ? credentials.webhookUrl : undefined,
      refreshToken: 'refreshToken' in credentials ? credentials.refreshToken : undefined,
    };

    // Validate credentials with the service
    const service = createIntegrationService(provider, integrationCredentials);
    const validationResult = await service.validateCredentials();

    if (!validationResult.valid) {
      return NextResponse.json(
        { error: 'Credential validation failed', message: validationResult.error },
        { status: 400 }
      );
    }

    // Check for existing connection
    const existing = await prisma.platformConnection.findFirst({
      where: {
        userId,
        platform: provider,
      },
    });

    let connection;

    if (existing) {
      // Reactivate / update existing connection
      connection = await prisma.platformConnection.update({
        where: { id: existing.id },
        data: {
          accessToken: integrationCredentials.accessToken || integrationCredentials.apiKey || '',
          refreshToken: integrationCredentials.refreshToken || null,
          isActive: true,
          lastSync: new Date(),
          metadata: {
            ...(existing.metadata as Record<string, unknown> || {}),
            webhookUrl: integrationCredentials.webhookUrl || null,
            category: INTEGRATION_REGISTRY[provider].category,
          },
        },
      });
    } else {
      // Create new connection
      connection = await prisma.platformConnection.create({
        data: {
          userId,
          platform: provider,
          accessToken: integrationCredentials.accessToken || integrationCredentials.apiKey || '',
          refreshToken: integrationCredentials.refreshToken || null,
          isActive: true,
          lastSync: new Date(),
          metadata: {
            webhookUrl: integrationCredentials.webhookUrl || null,
            category: INTEGRATION_REGISTRY[provider].category,
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      connection: {
        id: connection.id,
        provider,
        connected: true,
        lastSync: connection.lastSync,
      },
      message: `Connected to ${INTEGRATION_REGISTRY[provider].name} successfully`,
    });
  } catch (error) {
    logger.error('Failed to connect integration:', error);
    return NextResponse.json(
      { error: 'Failed to connect integration', message: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET — Check connection status
// ============================================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;

    if (!isValidProvider(provider)) {
      return NextResponse.json(
        { error: 'Invalid provider', message: `'${provider}' is not a supported integration provider` },
        { status: 400 }
      );
    }

    const userId = await getUserIdFromCookies();
    if (!userId) {
      return unauthorizedResponse();
    }

    const connection = await prisma.platformConnection.findFirst({
      where: {
        userId,
        platform: provider,
        isActive: true,
      },
    });

    if (!connection) {
      return NextResponse.json({
        connected: false,
        provider,
        config: INTEGRATION_REGISTRY[provider],
        lastSync: null,
        tokenValid: false,
      });
    }

    // Attempt to validate credentials
    const credentials: IntegrationCredentials = {
      accessToken: connection.accessToken || undefined,
      refreshToken: connection.refreshToken || undefined,
      metadata: (connection.metadata as Record<string, unknown>) || undefined,
    };

    const service = createIntegrationService(provider, credentials);
    const validationResult = await service.validateCredentials();

    return NextResponse.json({
      connected: true,
      provider,
      lastSync: connection.lastSync,
      tokenValid: validationResult.valid,
      error: validationResult.error || null,
    });
  } catch (error) {
    logger.error('Failed to check integration status:', error);
    return NextResponse.json(
      { error: 'Failed to check integration status', message: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE — Disconnect an integration
// ============================================================================

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;

    if (!isValidProvider(provider)) {
      return NextResponse.json(
        { error: 'Invalid provider', message: `'${provider}' is not a supported integration provider` },
        { status: 400 }
      );
    }

    const userId = await getUserIdFromCookies();
    if (!userId) {
      return unauthorizedResponse();
    }

    const connection = await prisma.platformConnection.findFirst({
      where: {
        userId,
        platform: provider,
        isActive: true,
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Not connected', message: `No active connection found for ${provider}` },
        { status: 404 }
      );
    }

    // Soft-delete: deactivate and clear tokens
    await prisma.platformConnection.update({
      where: { id: connection.id },
      data: {
        isActive: false,
        accessToken: '',
        refreshToken: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Disconnected from ${INTEGRATION_REGISTRY[provider].name} successfully`,
    });
  } catch (error) {
    logger.error('Failed to disconnect integration:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect integration', message: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
