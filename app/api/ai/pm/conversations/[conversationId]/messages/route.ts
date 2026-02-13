/**
 * AI PM Messages API — Streaming Chat
 *
 * POST /api/ai/pm/conversations/[conversationId]/messages
 * Send a message and receive a streaming AI PM response via SSE
 *
 * Pattern: Same as app/api/notifications/stream/route.ts
 * (runtime='nodejs', dynamic='force-dynamic', ReadableStream SSE)
 *
 * Access: Business plan only ($399/month)
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - OPENROUTER_API_KEY: AI service key (SECRET)
 */

import { NextRequest } from 'next/server';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { subscriptionService } from '@/lib/stripe/subscription-service';
import prisma from '@/lib/prisma';
import {
  generatePMResponse,
  extractStructuredData,
} from '@/lib/ai/project-manager';

// Required for SSE streaming on Vercel
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/pm/conversations/[conversationId]/messages
 * Send user message → stream AI PM response via SSE
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

    // Check subscription
    const subscription = await subscriptionService.getOrCreateSubscription(userId);
    if (subscription.plan !== 'business' && subscription.plan !== 'custom') {
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error: 'AI Project Manager requires a Business subscription',
          upgradeRequired: true,
          requiredPlan: 'business',
        },
        402
      );
    }

    const { conversationId } = await params;

    // Validate conversation belongs to user
    const conversation = await prisma.aIConversation.findFirst({
      where: { id: conversationId, userId, status: 'active' },
    });

    if (!conversation) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Conversation not found' },
        404
      );
    }

    // Parse request body
    const body = await request.json();
    const userMessage = typeof body.message === 'string' ? body.message.trim() : '';

    if (!userMessage || userMessage.length === 0) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Message cannot be empty' },
        400
      );
    }

    if (userMessage.length > 5000) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Message too long (max 5000 characters)' },
        400
      );
    }

    // Store user message immediately
    const userMsg = await prisma.aIMessage.create({
      data: {
        conversationId,
        role: 'user',
        content: userMessage,
      },
    });

    // Start streaming AI response
    const startTime = Date.now();
    const { stream, contextSnapshot } = await generatePMResponse(
      userId,
      conversationId,
      userMessage
    );

    // Create SSE ReadableStream
    const encoder = new TextEncoder();
    let fullResponse = '';

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial event with user message ID
          controller.enqueue(
            encoder.encode(`event: message_start\ndata: ${JSON.stringify({ userMessageId: userMsg.id })}\n\n`)
          );

          // Stream AI tokens
          for await (const token of stream) {
            fullResponse += token;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ token })}\n\n`)
            );
          }

          const latencyMs = Date.now() - startTime;

          // Extract structured data from full response (non-blocking)
          const extracted = await extractStructuredData(fullResponse).catch(() => ({
            actionItems: [],
            suggestions: [],
          }));

          // Store assistant message in DB
          const assistantMsg = await prisma.aIMessage.create({
            data: {
              conversationId,
              role: 'assistant',
              content: fullResponse,
              model: 'claude-sonnet', // PM uses creative tier
              latencyMs,
              actionItems: extracted.actionItems.length > 0 ? JSON.parse(JSON.stringify(extracted.actionItems)) : undefined,
              suggestions: extracted.suggestions.length > 0 ? JSON.parse(JSON.stringify(extracted.suggestions)) : undefined,
            },
          });

          // Update conversation metadata
          await prisma.aIConversation.update({
            where: { id: conversationId },
            data: {
              messageCount: { increment: 2 }, // user + assistant
              lastMessageAt: new Date(),
              contextSnapshot: contextSnapshot as any,
              // Auto-title from first user message if still default
              ...(conversation.title === 'New Conversation'
                ? { title: userMessage.substring(0, 80) + (userMessage.length > 80 ? '...' : '') }
                : {}),
            },
          });

          // Send completion event with metadata
          controller.enqueue(
            encoder.encode(
              `event: message_complete\ndata: ${JSON.stringify({
                assistantMessageId: assistantMsg.id,
                latencyMs,
                actionItems: extracted.actionItems,
                suggestions: extracted.suggestions,
              })}\n\n`
            )
          );

          controller.close();
        } catch (error) {
          console.error('AI PM streaming error:', error);
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('AI PM message POST error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to process message' },
      500
    );
  }
}
