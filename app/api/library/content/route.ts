/**
 * Content Library API
 *
 * @description Manage user's content library items
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token verification (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 *
 * FAILURE MODE: Returns appropriate error responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Validation schema for content creation
const createContentSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().max(50000),
  type: z.enum(['post', 'template', 'draft', 'asset']).optional().default('draft'),
  tags: z.array(z.string()).optional().default([]),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * GET /api/library/content
 * Get user's content library items
 */
export async function GET(request: NextRequest) {
  // Security check - requires authentication
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
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

    // Parse query parameters
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Build where clause
    const where: Record<string, unknown> = { userId };
    if (type) {
      where.type = type;
    }

    // Fetch content items (using a generic content model - adjust as needed)
    // Note: This is a placeholder - adjust to your actual schema
    const data: unknown[] = [];

    return APISecurityChecker.createSecureResponse(
      {
        data,
        pagination: {
          limit,
          offset,
          total: 0,
          hasMore: false,
        },
      },
      200,
      security.context
    );
  } catch (error) {
    console.error('Error fetching content library:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch content library' },
      500,
      security.context
    );
  }
}

/**
 * POST /api/library/content
 * Create a new content library item
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
    const validation = createContentSchema.safeParse(body);
    if (!validation.success) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation failed', details: validation.error.errors },
        400,
        security.context
      );
    }

    const contentData = validation.data;

    // Create content item (placeholder - adjust to your actual schema)
    const contentId = `content_${Date.now()}_${(userId || 'unknown').substring(0, 8)}`;

    return APISecurityChecker.createSecureResponse(
      {
        success: true,
        id: contentId,
        data: {
          id: contentId,
          ...contentData,
          userId,
          createdAt: new Date().toISOString(),
        },
      },
      201,
      security.context
    );
  } catch (error) {
    console.error('Error creating content:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to create content' },
      500,
      security.context
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';

