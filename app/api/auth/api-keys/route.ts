/**
 * API Keys Management Route
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - FIELD_ENCRYPTION_KEY: 32-byte hex key for API key encryption (CRITICAL)
 * - JWT_SECRET: For validating auth tokens (CRITICAL)
 *
 * NOTE: API keys are encrypted at rest using AES-256-GCM
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';
import { encryptField } from '@/lib/security/field-encryption';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { auditLogger } from '@/lib/security/audit-logger';
import { logger } from '@/lib/logger';

// Lazy getter to avoid module load crash
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET required');
  return secret;
}

// Zod schemas for validation
const GetApiKeysSchema = z.object({
  email: z.string().email().optional(),
});

const PostApiKeysSchema = z.object({
  openrouterApiKey: z.string().min(1).optional(),
  anthropicApiKey: z.string().min(1).optional(),
}).refine(data => data.openrouterApiKey || data.anthropicApiKey, {
  message: 'At least one API key must be provided',
});

// Helper to extract user ID from request
async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  const token =
    request.cookies.get('auth-token')?.value ||
    request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, getJWTSecret()) as {
      sub?: string;
      userId?: string;
      id?: string;
    };
    return decoded.sub || decoded.userId || decoded.id || null;
  } catch {
    return null;
  }
}

/**
 * GET /api/auth/api-keys
 * Returns flags indicating whether keys exist for the authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_READ
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        403
      );
    }

    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check database availability
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({
        success: true,
        data: { apiKeys: { hasOpenRouterKey: false, hasAnthropicKey: false } },
        persisted: false,
      });
    }

    // Get user by ID, not email (more secure)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { openrouterApiKey: true, anthropicApiKey: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        apiKeys: {
          hasOpenRouterKey: !!user.openrouterApiKey,
          hasAnthropicKey: !!user.anthropicApiKey,
        },
      },
      persisted: true,
    });
  } catch (error) {
    logger.error('GET /api/auth/api-keys error', { error });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch API key status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/api-keys
 * Body: { openrouterApiKey?, anthropicApiKey? }
 * Stores provided keys for the authenticated user. Returns flags.
 */
export async function POST(request: NextRequest) {
  try {
    // Security check - use WRITE policy for mutations
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_WRITE
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        403
      );
    }

    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse and validate body with Zod
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const parseResult = PostApiKeysSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { openrouterApiKey, anthropicApiKey } = parseResult.data;

    // Check database availability
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({
        success: true,
        data: {
          apiKeys: {
            hasOpenRouterKey: !!openrouterApiKey,
            hasAnthropicKey: !!anthropicApiKey,
          },
        },
        persisted: false,
      });
    }

    // Encrypt API keys before storing
    const encryptedOpenRouterKey = openrouterApiKey
      ? encryptField(openrouterApiKey)
      : undefined;
    const encryptedAnthropicKey = anthropicApiKey
      ? encryptField(anthropicApiKey)
      : undefined;

    // Update user with encrypted keys
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(encryptedOpenRouterKey && { openrouterApiKey: encryptedOpenRouterKey }),
        ...(encryptedAnthropicKey && { anthropicApiKey: encryptedAnthropicKey }),
      },
      select: { openrouterApiKey: true, anthropicApiKey: true },
    });

    // Audit log the key update
    await auditLogger.log({
      userId,
      action: 'auth.api_keys_updated',
      resource: 'user',
      resourceId: userId,
      category: 'security',
      severity: 'high',
      outcome: 'success',
      details: {
        openrouterKeyUpdated: !!openrouterApiKey,
        anthropicKeyUpdated: !!anthropicApiKey,
      },
    });

    logger.info('API keys updated', { userId, keysUpdated: { openrouter: !!openrouterApiKey, anthropic: !!anthropicApiKey } });

    return NextResponse.json({
      success: true,
      data: {
        apiKeys: {
          hasOpenRouterKey: !!updated.openrouterApiKey,
          hasAnthropicKey: !!updated.anthropicApiKey,
        },
      },
      persisted: true,
    });
  } catch (error) {
    logger.error('POST /api/auth/api-keys error', { error });
    return NextResponse.json(
      { success: false, error: 'Failed to save API keys' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/api-keys
 * Body: { keyType: 'openrouter' | 'anthropic' }
 * Removes the specified API key for the authenticated user.
 */
export async function DELETE(request: NextRequest) {
  try {
    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_WRITE
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        403
      );
    }

    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse body
    let body: { keyType?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const keyType = body.keyType;
    if (!keyType || !['openrouter', 'anthropic'].includes(keyType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid keyType. Must be "openrouter" or "anthropic"' },
        { status: 400 }
      );
    }

    // Remove the specified key
    const updateData = keyType === 'openrouter'
      ? { openrouterApiKey: null }
      : { anthropicApiKey: null };

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    // Audit log the key deletion
    await auditLogger.log({
      userId,
      action: 'auth.api_key_deleted',
      resource: 'user',
      resourceId: userId,
      category: 'security',
      severity: 'high',
      outcome: 'success',
      details: { keyType },
    });

    logger.info('API key deleted', { userId, keyType });

    return NextResponse.json({
      success: true,
      message: `${keyType} API key removed`,
    });
  } catch (error) {
    logger.error('DELETE /api/auth/api-keys error', { error });
    return NextResponse.json(
      { success: false, error: 'Failed to delete API key' },
      { status: 500 }
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
