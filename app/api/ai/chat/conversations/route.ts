/**
 * AI Chat Conversations API
 *
 * GET /api/ai/chat/conversations - List conversations (paginated, newest first)
 * POST /api/ai/chat/conversations - Create new conversation
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

// Allowed subscription plans for chat assistant (more accessible than PM)
const ALLOWED_PLANS = ['professional', 'business', 'custom'];

/**
 * GET /api/ai/chat/conversations
 * List user's chat conversations, newest first
 */
export async function GET(request: NextRequest) {
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

    // Check subscription — Professional plan or higher required
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

    // Pagination
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const skip = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      prisma.aIConversation.findMany({
        where: { userId, status: { not: 'deleted' } },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          status: true,
          messageCount: true,
          lastMessageAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.aIConversation.count({
        where: { userId, status: { not: 'deleted' } },
      }),
    ]);

    return APISecurityChecker.createSecureResponse({
      success: true,
      conversations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('AI Chat conversations GET error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch conversations' },
      500
    );
  }
}

const createConversationSchema = z.object({
  title: z.string().max(200).optional(),
});

/**
 * POST /api/ai/chat/conversations
 * Create a new conversation
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json().catch(() => ({}));
    const validation = createConversationSchema.safeParse(body);
    const title = validation.success && validation.data.title
      ? validation.data.title
      : 'New Chat';

    const conversation = await prisma.aIConversation.create({
      data: {
        userId,
        title,
      },
      select: {
        id: true,
        title: true,
        status: true,
        messageCount: true,
        createdAt: true,
      },
    });

    return APISecurityChecker.createSecureResponse({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error('AI Chat conversations POST error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to create conversation' },
      500
    );
  }
}

export const runtime = 'nodejs';
