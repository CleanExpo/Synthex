/**
 * Mobile Data Sync API
 *
 * @description Handles data synchronization between mobile app and server
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token verification (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 *
 * FAILURE MODE: Returns appropriate error responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { z } from 'zod';

// Validation schema for sync data
const syncDataSchema = z.object({
  lastSyncTimestamp: z.string().datetime().optional(),
  changes: z.array(z.object({
    type: z.enum(['create', 'update', 'delete']),
    entity: z.string(),
    id: z.string(),
    data: z.record(z.unknown()).optional(),
    timestamp: z.string().datetime(),
  })).optional().default([]),
  deviceId: z.string().max(100).optional(),
});

/**
 * POST /api/mobile/sync
 * Synchronize mobile app data with server
 */
export async function POST(request: NextRequest) {
  // Security check - requires authentication with write permissions
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error || 'Authentication required' },
      security.error?.includes('Rate limit') ? 429 : 401,
      security.context
    );
  }

  try {
    const userId = security.context.userId;
    const body = await request.json();

    // Validate input
    const validation = syncDataSchema.safeParse(body);
    if (!validation.success) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation failed', details: validation.error.errors },
        400,
        security.context
      );
    }

    const syncData = validation.data;

    // Process sync data (placeholder - implement actual sync logic)
    const processedChanges = syncData.changes.length;
    const serverTimestamp = new Date().toISOString();

    // Return sync result
    return APISecurityChecker.createSecureResponse(
      {
        success: true,
        syncResult: {
          processedChanges,
          serverTimestamp,
          conflicts: [],
          serverChanges: [],
        },
        userId,
      },
      200,
      security.context
    );
  } catch (error) {
    console.error('Error processing mobile sync:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to process sync' },
      500,
      security.context
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';

