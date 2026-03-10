/**
 * @internal Server-only endpoint — not called directly by frontend UI.
 * Used by: quote/citation management for content creation; no dashboard page exists yet.
 * Wire when a quotes/citations UI is built.
 */

/**
 * Quote API Endpoint
 * CRUD operations for content quotes
 *
 * @task UNI-418 - Implement Quote Module Integration Tests
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { extractUserId } from '@/lib/middleware/withAuth';
import { logger } from '@/lib/logger';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Quote categories for validation
const VALID_CATEGORIES = [
  'inspirational',
  'motivational',
  'business',
  'humor',
  'wisdom',
  'leadership',
  'success',
  'creativity',
  'marketing',
  'general',
] as const;

type QuoteCategory = (typeof VALID_CATEGORIES)[number];

const createQuoteSchema = z.object({
  text: z.string().min(1, 'Quote text is required').max(1000, 'Quote text exceeds maximum length of 1000 characters'),
  author: z.string().optional(),
  source: z.string().optional(),
  category: z.enum(VALID_CATEGORIES),
  tags: z.array(z.string()).optional(),
  isCustom: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  language: z.string().optional(),
  aiGenerated: z.boolean().optional(),
  sentiment: z.string().optional(),
  readingLevel: z.string().optional(),
  expiresAt: z.string().optional(),
  campaignId: z.string().optional(),
});

const deleteQuotesSchema = z.object({
  ids: z.array(z.string()).min(1, 'Quote IDs array is required').max(100, 'Cannot delete more than 100 quotes at once'),
});

interface CreateQuoteRequest {
  text: string;
  author?: string;
  source?: string;
  category: QuoteCategory;
  tags?: string[];
  isCustom?: boolean;
  isPublic?: boolean;
  language?: string;
  aiGenerated?: boolean;
  sentiment?: string;
  readingLevel?: string;
  expiresAt?: string;
  campaignId?: string;
}

interface QuoteFilters {
  category?: string;
  tags?: string[];
  aiGenerated?: boolean;
  isPublic?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * GET /api/quotes
 * Retrieve quotes with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const filters: QuoteFilters = {
      category: searchParams.get('category') || undefined,
      tags: searchParams.get('tags')?.split(',').filter(Boolean) || undefined,
      aiGenerated: searchParams.get('aiGenerated')
        ? searchParams.get('aiGenerated') === 'true'
        : undefined,
      isPublic: searchParams.get('isPublic')
        ? searchParams.get('isPublic') === 'true'
        : undefined,
      search: searchParams.get('search') || undefined,
      limit: parseInt(searchParams.get('limit') || '20', 10),
      offset: parseInt(searchParams.get('offset') || '0', 10),
    };

    // Validate limit
    if (filters.limit! > 100) {
      filters.limit = 100;
    }
    if (filters.limit! < 1) {
      filters.limit = 1;
    }

    // Build where clause
    const where: Record<string, unknown> = {};

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.tags && filters.tags.length > 0) {
      where.tags = { hasSome: filters.tags };
    }

    if (filters.aiGenerated !== undefined) {
      where.aiGenerated = filters.aiGenerated;
    }

    if (filters.isPublic !== undefined) {
      where.isPublic = filters.isPublic;
    }

    if (filters.search) {
      where.OR = [
        { text: { contains: filters.search, mode: 'insensitive' } },
        { author: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Check for expired quotes - exclude by default
    where.OR = where.OR || [];
    where.AND = [
      {
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    ];

    // Get total count
    const total = await prisma.quote.count({ where });

    // Get quotes
    const quotes = await prisma.quote.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters.limit,
      skip: filters.offset,
    });

    return NextResponse.json({
      success: true,
      data: quotes,
      pagination: {
        total,
        limit: filters.limit,
        offset: filters.offset,
        hasMore: filters.offset! + quotes.length < total,
      },
    });
  } catch (error) {
    logger.error('GET /api/quotes error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch quotes',
        message: error instanceof Error ? error.message : 'An error occurred',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/quotes
 * Create a new quote
 */
export async function POST(request: NextRequest) {
  try {
    // Extract authenticated user ID
    const userId = await extractUserId(request);

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const rawBody = await request.json();
    const validation = createQuoteSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }
    const body = validation.data;

    // Validate expiration date if provided
    let expiresAt: Date | null = null;
    if (body.expiresAt) {
      expiresAt = new Date(body.expiresAt);
      if (isNaN(expiresAt.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid expiration date format' },
          { status: 400 }
        );
      }
      if (expiresAt <= new Date()) {
        return NextResponse.json(
          { success: false, error: 'Expiration date must be in the future' },
          { status: 400 }
        );
      }
    }

    // Create quote using authenticated userId
    const quote = await prisma.quote.create({
      data: {
        text: body.text.trim(),
        author: body.author?.trim() || null,
        source: body.source?.trim() || null,
        category: body.category,
        tags: body.tags || [],
        isCustom: body.isCustom ?? true,
        isPublic: body.isPublic ?? true,
        language: body.language || 'en',
        aiGenerated: body.aiGenerated ?? false,
        sentiment: body.sentiment || null,
        readingLevel: body.readingLevel || null,
        expiresAt,
        userId,
        campaignId: body.campaignId || null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: quote,
        message: 'Quote created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('POST /api/quotes error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create quote',
        message: error instanceof Error ? error.message : 'An error occurred',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/quotes
 * Bulk delete quotes (admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    // Extract authenticated user ID
    const userId = await extractUserId(request);

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const rawDeleteBody = await request.json();
    const deleteValidation = deleteQuotesSchema.safeParse(rawDeleteBody);
    if (!deleteValidation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: deleteValidation.error.issues },
        { status: 400 }
      );
    }
    const { ids } = deleteValidation.data;

    // Delete only quotes owned by the user (security: prevent unauthorized deletion)
    const result = await prisma.quote.deleteMany({
      where: {
        id: { in: ids },
        userId: userId, // Only delete user's own quotes
      },
    });

    return NextResponse.json({
      success: true,
      deleted: result.count,
      message: `${result.count} quote(s) deleted successfully`,
    });
  } catch (error) {
    logger.error('DELETE /api/quotes error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete quotes',
        message: error instanceof Error ? error.message : 'An error occurred',
      },
      { status: 500 }
    );
  }
}
