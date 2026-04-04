/**
 * AI Chat Assistant Engine
 *
 * Core logic for the conversational AI chat assistant.
 * Lighter than the full AI PM — uses balanced tier (Haiku) for cost efficiency.
 *
 * Professional plan and above ($99/month+).
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - OPENROUTER_API_KEY: AI service key (SECRET)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { getAIProvider } from '@/lib/ai/providers';
import { buildChatContext, serializeChatContext, type ChatContext } from './context-builder';
import { CHAT_ASSISTANT_PROMPT } from './system-prompts';
import prisma from '@/lib/prisma';

// Use balanced tier (Claude Haiku) for cost efficiency
const CHAT_MODEL_TIER = 'balanced';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatStreamResult {
  stream: AsyncGenerator<string, void, unknown>;
  contextSnapshot: ChatContext;
}

/**
 * Generate a streaming chat response for a user message.
 *
 * Flow:
 * 1. Build lightweight user context from database
 * 2. Construct system prompt with persona + context
 * 3. Load last 15 messages from conversation for continuity
 * 4. Stream response via AI provider (balanced tier)
 *
 * @returns Stream of content tokens + context snapshot (not stored)
 */
export async function generateChatResponse(
  userId: string,
  conversationId: string,
  userMessage: string
): Promise<ChatStreamResult> {
  const provider = getAIProvider();

  // Build lightweight context (faster than PM context)
  const context = await buildChatContext(userId);
  const contextString = serializeChatContext(context);

  // Load conversation history (last 15 messages — less than PM's 20)
  const history = await prisma.aIMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: 15,
    select: {
      role: true,
      content: true,
    },
  });

  // Build message array (system -> history -> new message)
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `${CHAT_ASSISTANT_PROMPT}\n\n${contextString}`,
    },
    // History is fetched newest-first, reverse to chronological
    ...history.reverse().map((msg) => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
    })),
    {
      role: 'user',
      content: userMessage,
    },
  ];

  // Get the model name from the provider's presets
  const modelName = provider.models[CHAT_MODEL_TIER];

  // Create streaming response
  const stream = provider.stream({
    model: modelName,
    messages,
    temperature: 0.7,
    max_tokens: 800, // Shorter than PM's 1500 — chat is more concise
  });

  return {
    stream,
    contextSnapshot: context,
  };
}

// Re-export types and utilities for convenience
export { CHAT_ASSISTANT_PROMPT, QUICK_SUGGESTION_PROMPT } from './system-prompts';
export { buildChatContext, serializeChatContext, type ChatContext } from './context-builder';
