/**
 * AI Chat Auto-Title API
 *
 * POST /api/ai/chat/conversations/[conversationId]/auto-title
 *
 * Called after the first assistant response in a new conversation.
 * Generates a title from the first user message (up to 60 chars).
 * Skips silently if the conversation has already been renamed.
 *
 * Access: Same user, same conversation — no subscription gate needed.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import prisma from '@/lib/prisma';

// No body needed — all data fetched from DB
const schema = z.object({});

/**
 * POST /api/ai/chat/conversations/[conversationId]/auto-title
 * Generate title from first user message if still at default "New Chat"
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      security.error === 'Authentication required' ? 401 : 403
    );
  }

  try {
    const userId = security.context.userId;
    if (!userId) {
      return APISecurityChecker.createSecureResponse(
        { error: 'User ID not found' },
        401
      );
    }

    // Validate body (empty — no body needed)
    const body = await request.json().catch(() => ({}));
    const validation = schema.safeParse(body);
    if (!validation.success) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Invalid request data' },
        400
      );
    }

    const { conversationId } = await params;

    // Verify ownership
    const conversation = await prisma.aIConversation.findFirst({
      where: { id: conversationId, userId, status: { not: 'deleted' } },
      select: { id: true, title: true },
    });

    if (!conversation) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Conversation not found' },
        404
      );
    }

    // Skip if already renamed from default
    if (conversation.title !== 'New Conversation') {
      return APISecurityChecker.createSecureResponse({
        success: true,
        skipped: true,
        title: conversation.title,
      });
    }

    // Fetch the first user message
    const firstMessage = await prisma.aIMessage.findFirst({
      where: { conversationId, role: 'user' },
      orderBy: { createdAt: 'asc' },
      select: { content: true },
    });

    if (!firstMessage) {
      return APISecurityChecker.createSecureResponse({
        success: true,
        skipped: true,
        title: conversation.title,
      });
    }

    // Generate title: strip newlines, trim to 60 chars
    const title = firstMessage.content
      .replace(/\n+/g, ' ')
      .trim()
      .substring(0, 60);

    if (!title) {
      return APISecurityChecker.createSecureResponse({
        success: true,
        skipped: true,
        title: conversation.title,
      });
    }

    // Update conversation title
    await prisma.aIConversation.update({
      where: { id: conversationId },
      data: { title, updatedAt: new Date() },
    });

    return APISecurityChecker.createSecureResponse({
      success: true,
      title,
    });
  } catch (error) {
    console.error('AI Chat auto-title POST error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to generate title' },
      500
    );
  }
}

export const runtime = 'nodejs';
