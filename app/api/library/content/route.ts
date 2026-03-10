/**
 * @internal Server-only endpoint — not called directly by frontend UI.
 * Used by: content library CRUD; the active frontend caller uses /api/content-library instead.
 * This path (/api/library/content) is a duplicate route — prefer /api/content-library.
 */

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

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { logger } from '@/lib/logger';

// Validation schema for creating content
const createContentSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(50000),
  contentType: z.enum(['post', 'caption', 'story', 'thread', 'template', 'snippet']),
  platform: z.string().optional(),
  category: z.string().optional(),
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

  const userId = security.context.userId;
  if (!userId) {
    return APISecurityChecker.createSecureResponse(
      { error: 'User ID not found in auth context' },
      401,
      security.context
    );
  }

  try {
    // Parse query parameters
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const contentType = url.searchParams.get('contentType');
    const platform = url.searchParams.get('platform');
    const category = url.searchParams.get('category');
    const search = url.searchParams.get('search');

    // Build where clause with IDOR protection (always filter by userId)
    const where: {
      userId: string;
      status: { not: string };
      contentType?: string;
      platform?: string;
      category?: string;
      OR?: Array<{ title?: { contains: string; mode: 'insensitive' }; content?: { contains: string; mode: 'insensitive' } }>;
    } = {
      userId,
      status: { not: 'deleted' },
    };

    if (contentType) {
      where.contentType = contentType;
    }
    if (platform) {
      where.platform = platform;
    }
    if (category) {
      where.category = category;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Query with pagination
    const [items, total] = await Promise.all([
      prisma.contentLibrary.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.contentLibrary.count({ where }),
    ]);

    return APISecurityChecker.createSecureResponse(
      {
        data: items,
        pagination: {
          limit,
          offset,
          total,
          hasMore: offset + items.length < total,
        },
      },
      200,
      security.context
    );
  } catch (error) {
    logger.error('Error fetching content library:', error);
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

  const userId = security.context.userId;
  if (!userId) {
    return APISecurityChecker.createSecureResponse(
      { error: 'User ID not found in auth context' },
      401,
      security.context
    );
  }

  try {
    const body = await request.json();
    const validation = createContentSchema.safeParse(body);

    if (!validation.success) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Invalid request body', details: validation.error.flatten() },
        400,
        security.context
      );
    }

    const { title, content, contentType, platform, category, tags, metadata } = validation.data;

    const item = await prisma.contentLibrary.create({
      data: {
        userId,
        title,
        content,
        contentType,
        platform,
        category,
        tags,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });

    return APISecurityChecker.createSecureResponse(item, 201, security.context);
  } catch (error) {
    logger.error('Error creating content library item:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to create content library item' },
      500,
      security.context
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
