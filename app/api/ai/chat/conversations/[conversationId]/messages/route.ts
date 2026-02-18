/**
 * AI Chat Messages API — Streaming Chat
 *
 * POST /api/ai/chat/conversations/[conversationId]/messages
 * Send a message and receive a streaming AI response via SSE
 *
 * Pattern: Same as app/api/ai/pm/conversations/[conversationId]/messages/route.ts
 * (runtime='nodejs', dynamic='force-dynamic', ReadableStream SSE)
 *
 * Access: Professional plan and above ($99/month+)
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - OPENROUTER_API_KEY: AI service key (SECRET)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { subscriptionService } from '@/lib/stripe/subscription-service';
import prisma from '@/lib/prisma';
import { generateChatResponse } from '@/lib/ai/chat-assistant';

// Required for SSE streaming on Vercel
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Allowed subscription plans for chat assistant
const ALLOWED_PLANS = ['professional', 'business', 'custom'];

// Shorter message limit than PM (3000 vs 5000)
const sendMessageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(3000, 'Message too long (max 3000 characters)'),
});

/**
 * POST /api/ai/chat/conversations/[conversationId]/messages
 * Send user message -> stream AI response via SSE
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

    const { conversationId } = await params;

    // Validate conversation belongs to user and is active
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
    const validation = sendMessageSchema.safeParse(body);
    if (!validation.success) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Invalid request data', details: validation.error.issues },
        400
      );
    }
    const userMessage = validation.data.message.trim();

    if (!userMessage) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Message cannot be empty' },
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
    const { stream } = await generateChatResponse(
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

          // Store assistant message in DB (no extractStructuredData — simpler than PM)
          const assistantMsg = await prisma.aIMessage.create({
            data: {
              conversationId,
              role: 'assistant',
              content: fullResponse,
              model: 'claude-haiku', // Chat uses balanced tier
              latencyMs,
            },
          });

          // Update conversation metadata
          await prisma.aIConversation.update({
            where: { id: conversationId },
            data: {
              messageCount: { increment: 2 }, // user + assistant
              lastMessageAt: new Date(),
              // Auto-title from first user message if still default
              ...(conversation.title === 'New Chat'
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
              })}\n\n`
            )
          );

          controller.close();
        } catch (error) {
          console.error('AI Chat streaming error:', error);
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
    console.error('AI Chat message POST error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to process message' },
      500
    );
  }
}
