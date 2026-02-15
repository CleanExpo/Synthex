/**
 * Quote API Endpoint - Individual Quote Operations
 * GET, PUT, DELETE for specific quote by ID
 *
 * @task UNI-418 - Implement Quote Module Integration Tests
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const updateQuoteSchema = z.object({
  text: z.string().min(1).max(1000).optional(),
  author: z.string().optional(),
  source: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
  sentiment: z.string().optional(),
  readingLevel: z.string().optional(),
  expiresAt: z.string().nullable().optional(),
});

const quoteActionSchema = z.object({
  action: z.enum(['like', 'unlike', 'share', 'use']),
});

interface UpdateQuoteRequest {
  text?: string;
  author?: string;
  source?: string;
  category?: string;
  tags?: string[];
  isPublic?: boolean;
  sentiment?: string;
  readingLevel?: string;
  expiresAt?: string | null;
}

/**
 * GET /api/quotes/[id]
 * Get a specific quote by ID
 * Public quotes are accessible to all, private quotes require ownership
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Quote ID is required' },
        { status: 400 }
      );
    }

    const quote = await prisma.quote.findUnique({
      where: { id },
    });

    if (!quote) {
      return NextResponse.json(
        { success: false, error: 'Quote not found' },
        { status: 404 }
      );
    }

    // Check if quote is private - require ownership
    if (!quote.isPublic) {
      const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_READ);
      if (!security.allowed) {
        return NextResponse.json(
          { success: false, error: 'Authentication required for private quotes' },
          { status: 401 }
        );
      }
      // Verify ownership for private quotes
      if (quote.userId && quote.userId !== security.context?.userId) {
        return NextResponse.json(
          { success: false, error: 'Not authorized to view this quote' },
          { status: 403 }
        );
      }
    }

    // Check if quote has expired
    if (quote.expiresAt && quote.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Quote has expired' },
        { status: 410 } // Gone
      );
    }

    // Increment usage count (fire and forget)
    prisma.quote.update({
      where: { id },
      data: { usageCount: { increment: 1 } },
    }).catch(() => {}); // Ignore errors for usage tracking

    return NextResponse.json({
      success: true,
      data: quote,
    });
  } catch (error: unknown) {
    console.error('GET /api/quotes/[id] error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch quote',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/quotes/[id]
 * Update a specific quote - requires ownership
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check authentication using security checker
    const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_WRITE);
    if (!security.allowed) {
      return NextResponse.json(
        { success: false, error: security.error || 'Authentication required' },
        { status: 401 }
      );
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Quote ID is required' },
        { status: 400 }
      );
    }

    // Check if quote exists
    const existingQuote = await prisma.quote.findUnique({
      where: { id },
    });

    if (!existingQuote) {
      return NextResponse.json(
        { success: false, error: 'Quote not found' },
        { status: 404 }
      );
    }

    // IDOR Fix: Verify ownership - user can only update their own quotes
    if (existingQuote.userId && existingQuote.userId !== security.context?.userId) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to update this quote' },
        { status: 403 }
      );
    }

    // Parse request body
    const rawBody = await request.json();
    const putValidation = updateQuoteSchema.safeParse(rawBody);
    if (!putValidation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: putValidation.error.issues },
        { status: 400 }
      );
    }
    const body: UpdateQuoteRequest = putValidation.data;

    // Validate expiration date if provided
    let expiresAt: Date | null | undefined = undefined;
    if (body.expiresAt !== undefined) {
      if (body.expiresAt === null) {
        expiresAt = null;
      } else {
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
    }

    // Build update data
    const updateData: {
      text?: string;
      author?: string | null;
      source?: string | null;
      category?: string;
      tags?: string[];
      isPublic?: boolean;
      sentiment?: string;
      readingLevel?: string;
      expiresAt?: Date | null;
    } = {};

    if (body.text !== undefined) updateData.text = body.text.trim();
    if (body.author !== undefined) updateData.author = body.author?.trim() || null;
    if (body.source !== undefined) updateData.source = body.source?.trim() || null;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.isPublic !== undefined) updateData.isPublic = body.isPublic;
    if (body.sentiment !== undefined) updateData.sentiment = body.sentiment;
    if (body.readingLevel !== undefined) updateData.readingLevel = body.readingLevel;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt;

    // Update quote
    const updatedQuote = await prisma.quote.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: updatedQuote,
      message: 'Quote updated successfully',
    });
  } catch (error: unknown) {
    console.error('PUT /api/quotes/[id] error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update quote',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/quotes/[id]
 * Delete a specific quote - requires ownership
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check authentication using security checker
    const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_WRITE);
    if (!security.allowed) {
      return NextResponse.json(
        { success: false, error: security.error || 'Authentication required' },
        { status: 401 }
      );
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Quote ID is required' },
        { status: 400 }
      );
    }

    // Check if quote exists
    const existingQuote = await prisma.quote.findUnique({
      where: { id },
    });

    if (!existingQuote) {
      return NextResponse.json(
        { success: false, error: 'Quote not found' },
        { status: 404 }
      );
    }

    // IDOR Fix: Verify ownership - user can only delete their own quotes
    if (existingQuote.userId && existingQuote.userId !== security.context?.userId) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to delete this quote' },
        { status: 403 }
      );
    }

    // Delete quote
    await prisma.quote.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Quote deleted successfully',
    });
  } catch (error: unknown) {
    console.error('DELETE /api/quotes/[id] error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete quote',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/quotes/[id]
 * Partial update for engagement metrics (like, share)
 * Requires authentication to prevent anonymous metric manipulation
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check authentication to prevent anonymous metric manipulation
    const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_WRITE);
    if (!security.allowed) {
      return NextResponse.json(
        { success: false, error: security.error || 'Authentication required' },
        { status: 401 }
      );
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Quote ID is required' },
        { status: 400 }
      );
    }

    // Check if quote exists
    const existingQuote = await prisma.quote.findUnique({
      where: { id },
    });

    if (!existingQuote) {
      return NextResponse.json(
        { success: false, error: 'Quote not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const patchBody = await request.json();
    const patchValidation = quoteActionSchema.safeParse(patchBody);
    if (!patchValidation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: patchValidation.error.issues },
        { status: 400 }
      );
    }
    const { action } = patchValidation.data;

    // Handle engagement actions
    let updateData: {
      likeCount?: { increment: number } | { decrement: number };
      shareCount?: { increment: number };
      usageCount?: { increment: number };
    } = {};

    switch (action) {
      case 'like':
        updateData = { likeCount: { increment: 1 } };
        break;
      case 'unlike':
        updateData = { likeCount: { decrement: 1 } };
        break;
      case 'share':
        updateData = { shareCount: { increment: 1 } };
        break;
      case 'use':
        updateData = { usageCount: { increment: 1 } };
        break;
    }

    // Update quote
    const updatedQuote = await prisma.quote.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updatedQuote.id,
        likeCount: updatedQuote.likeCount,
        shareCount: updatedQuote.shareCount,
        usageCount: updatedQuote.usageCount,
      },
      message: `Quote ${action} recorded`,
    });
  } catch (error: unknown) {
    console.error('PATCH /api/quotes/[id] error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update quote engagement',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
