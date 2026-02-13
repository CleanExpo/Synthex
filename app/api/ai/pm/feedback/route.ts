/**
 * AI PM Feedback API
 *
 * POST /api/ai/pm/feedback - Rate/feedback on AI message
 *
 * Access: Business plan only ($399/month)
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import prisma from '@/lib/prisma';

const FeedbackSchema = z.object({
  messageId: z.string().min(1),
  rating: z.number().int().min(1).max(5).optional(),
  feedback: z.string().max(1000).optional(),
});

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

    const body = await request.json();
    const validation = FeedbackSchema.safeParse(body);

    if (!validation.success) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Invalid request', details: validation.error.errors },
        400
      );
    }

    const { messageId, rating, feedback } = validation.data;

    // Verify the message belongs to a conversation owned by this user
    const message = await prisma.aIMessage.findFirst({
      where: {
        id: messageId,
        role: 'assistant',
        conversation: { userId },
      },
    });

    if (!message) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Message not found' },
        404
      );
    }

    // Update message with feedback
    await prisma.aIMessage.update({
      where: { id: messageId },
      data: {
        ...(rating !== undefined ? { rating } : {}),
        ...(feedback !== undefined ? { feedback } : {}),
      },
    });

    return APISecurityChecker.createSecureResponse({
      success: true,
      message: 'Feedback recorded',
    });
  } catch (error) {
    console.error('AI PM feedback POST error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to save feedback' },
      500
    );
  }
}
