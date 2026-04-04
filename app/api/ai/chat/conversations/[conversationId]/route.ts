/**
 * AI Chat Single Conversation API
 *
 * GET /api/ai/chat/conversations/[conversationId] - Get conversation with messages
 * PATCH /api/ai/chat/conversations/[conversationId] - Update title/status
 * DELETE /api/ai/chat/conversations/[conversationId] - Soft delete conversation
 *
 * Access: Professional plan and above ($99/month+)
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { subscriptionService } from '@/lib/stripe/subscription-service';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

// Allowed subscription plans for chat assistant
const ALLOWED_PLANS = ['professional', 'business', 'custom'];

/**
 * GET /api/ai/chat/conversations/[conversationId]
 * Get single conversation with recent messages
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
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

    // Check subscription
    const subscription = await subscriptionService.getOrCreateSubscription(userId);
    if (!ALLOWED_PLANS.includes(subscription.plan)) {
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error: 'AI Chat Assistant requires a Professional subscription or higher',
          upgradeRequired: true,
          requiredPlan: 'professional',
        },
        402
      );
    }

    const { conversationId } = await params;

    // Fetch conversation with ownership check
    const conversation = await prisma.aIConversation.findFirst({
      where: { id: conversationId, userId, status: { not: 'deleted' } },
      select: {
        id: true,
        title: true,
        status: true,
        messageCount: true,
        lastMessageAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!conversation) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Conversation not found' },
        404
      );
    }

    // Fetch last 20 messages in chronological order
    const messages = await prisma.aIMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: {
        id: true,
        role: true,
        content: true,
        model: true,
        latencyMs: true,
        createdAt: true,
      },
    });

    return APISecurityChecker.createSecureResponse({
      success: true,
      conversation,
      messages,
    });
  } catch (error) {
    logger.error('AI Chat conversation GET error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch conversation' },
      500
    );
  }
}

const updateConversationSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  status: z.enum(['active', 'archived']).optional(),
});

/**
 * PATCH /api/ai/chat/conversations/[conversationId]
 * Update conversation title or status
 */
export async function PATCH(
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

    // Check subscription
    const subscription = await subscriptionService.getOrCreateSubscription(userId);
    if (!ALLOWED_PLANS.includes(subscription.plan)) {
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error: 'AI Chat Assistant requires a Professional subscription or higher',
          upgradeRequired: true,
          requiredPlan: 'professional',
        },
        402
      );
    }

    const { conversationId } = await params;

    // Verify ownership
    const existing = await prisma.aIConversation.findFirst({
      where: { id: conversationId, userId, status: { not: 'deleted' } },
    });

    if (!existing) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Conversation not found' },
        404
      );
    }

    // Parse and validate body
    const body = await request.json();
    const validation = updateConversationSchema.safeParse(body);
    if (!validation.success) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Invalid request data', details: validation.error.issues },
        400
      );
    }

    const { title, status } = validation.data;

    // Update only provided fields
    const updated = await prisma.aIConversation.update({
      where: { id: conversationId },
      data: {
        ...(title !== undefined && { title }),
        ...(status !== undefined && { status }),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        title: true,
        status: true,
        messageCount: true,
        lastMessageAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return APISecurityChecker.createSecureResponse({
      success: true,
      conversation: updated,
    });
  } catch (error) {
    logger.error('AI Chat conversation PATCH error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to update conversation' },
      500
    );
  }
}

/**
 * DELETE /api/ai/chat/conversations/[conversationId]
 * Soft delete conversation (set status to 'deleted')
 */
export async function DELETE(
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

    // Check subscription
    const subscription = await subscriptionService.getOrCreateSubscription(userId);
    if (!ALLOWED_PLANS.includes(subscription.plan)) {
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error: 'AI Chat Assistant requires a Professional subscription or higher',
          upgradeRequired: true,
          requiredPlan: 'professional',
        },
        402
      );
    }

    const { conversationId } = await params;

    // Verify ownership
    const existing = await prisma.aIConversation.findFirst({
      where: { id: conversationId, userId, status: { not: 'deleted' } },
    });

    if (!existing) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Conversation not found' },
        404
      );
    }

    // Soft delete
    await prisma.aIConversation.update({
      where: { id: conversationId },
      data: {
        status: 'deleted',
        updatedAt: new Date(),
      },
    });

    return APISecurityChecker.createSecureResponse({
      success: true,
    });
  } catch (error) {
    logger.error('AI Chat conversation DELETE error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to delete conversation' },
      500
    );
  }
}

export const runtime = 'nodejs';
