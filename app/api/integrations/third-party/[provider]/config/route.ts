/**
 * Third-Party Integration Provider Config Route
 *
 * @description
 * GET: Return provider-specific configuration + user overrides
 * PUT: Update provider-specific settings in PlatformConnection.metadata
 *
 * Auth: getUserIdFromCookies() from lib/auth/jwt-utils
 * Data: Prisma PlatformConnection model (metadata JSON field)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromCookies, unauthorizedResponse } from '@/lib/auth/jwt-utils';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  isValidProvider,
  INTEGRATION_REGISTRY,
  type IntegrationProvider,
} from '@/lib/integrations';

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

const canvaConfigSchema = z.object({
  defaultExportFormat: z.enum(['png', 'jpg', 'pdf']).optional(),
  autoImport: z.boolean().optional(),
});

const bufferConfigSchema = z.object({
  defaultProfileId: z.string().optional(),
  autoSchedule: z.boolean().optional(),
  defaultScheduleTime: z.string().optional(),
});

const zapierConfigSchema = z.object({
  subscribedEvents: z.array(z.string()).optional(),
  webhookUrl: z.string().url().optional(),
  notifyOnTrigger: z.boolean().optional(),
});

function getConfigSchema(provider: IntegrationProvider) {
  switch (provider) {
    case 'canva':
      return canvaConfigSchema;
    case 'buffer':
      return bufferConfigSchema;
    case 'zapier':
      return zapierConfigSchema;
  }
}

// ============================================================================
// GET — Return provider config + user overrides
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

    const config = INTEGRATION_REGISTRY[provider];

    // Get user-specific overrides from PlatformConnection metadata
    const connection = await prisma.platformConnection.findFirst({
      where: {
        userId,
        platform: provider,
      },
    });

    const metadata = (connection?.metadata as Record<string, unknown>) || {};
    const userConfig = (metadata.userConfig as Record<string, unknown>) || {};

    return NextResponse.json({
      provider,
      config,
      userConfig,
      connected: connection?.isActive || false,
    });
  } catch (error) {
    logger.error('Failed to get integration config:', error);
    return NextResponse.json(
      { error: 'Failed to get configuration', message: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT — Update provider-specific settings
// ============================================================================

export async function PUT(
  request: NextRequest,
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

    // Parse and validate body
    const body = await request.json();
    const schema = getConfigSchema(provider);
    const validation = schema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid configuration', details: validation.error.issues },
        { status: 400 }
      );
    }

    const newConfig = validation.data;

    // Find existing connection
    const connection = await prisma.platformConnection.findFirst({
      where: {
        userId,
        platform: provider,
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Not connected', message: `No connection found for ${provider}. Connect first before updating config.` },
        { status: 404 }
      );
    }

    // Merge new config into existing metadata
    const existingMetadata = (connection.metadata as Record<string, unknown>) || {};
    const existingUserConfig = (existingMetadata.userConfig as Record<string, unknown>) || {};

    const updatedMetadata = {
      ...existingMetadata,
      userConfig: {
        ...existingUserConfig,
        ...newConfig,
      },
    };

    await prisma.platformConnection.update({
      where: { id: connection.id },
      data: {
        metadata: updatedMetadata,
      },
    });

    return NextResponse.json({
      success: true,
      provider,
      userConfig: updatedMetadata.userConfig,
      message: 'Configuration updated successfully',
    });
  } catch (error) {
    logger.error('Failed to update integration config:', error);
    return NextResponse.json(
      { error: 'Failed to update configuration', message: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
