/**
 * AI Project Manager Engine
 *
 * Core logic for the per-client AI Senior Project Manager.
 * Handles conversation responses (streaming), weekly digests, and proactive suggestions.
 *
 * Uses OpenRouter via the unified provider abstraction layer.
 * Business plan only ($399/month).
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - OPENROUTER_API_KEY: AI service key (SECRET)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { getAIProvider } from '@/lib/ai/providers';
import { buildPMContext, serializeContext, type PMContext } from './context-builder';
import {
  PM_PERSONA_PROMPT,
  WEEKLY_DIGEST_PROMPT,
  PROACTIVE_INSIGHT_PROMPT,
  EXTRACTION_PROMPT,
} from './system-prompts';
import prisma from '@/lib/prisma';

// Use creative tier (Claude Sonnet) for PM quality
const PM_MODEL_TIER = 'creative';

interface PMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ActionItem {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

interface Suggestion {
  type: 'content' | 'growth' | 'optimization' | 'feature';
  title: string;
  description: string;
  actionUrl?: string;
}

interface ExtractedData {
  actionItems: ActionItem[];
  suggestions: Suggestion[];
}

interface PMStreamResult {
  stream: AsyncGenerator<string, void, unknown>;
  contextSnapshot: PMContext;
}

interface WeeklyDigestResult {
  summary: string;
  highlights: Array<{ metric: string; value: string; change: string; trend: string }>;
  actionItems: Array<{ title: string; description: string; priority: string; actionUrl?: string }>;
  opportunities: Array<{ title: string; description: string; potentialImpact: string }>;
}

interface ProactiveSuggestion {
  type: string;
  headline: string;
  body: string;
  action: string;
  featureTip?: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Generate a streaming PM response for a user message.
 *
 * Flow:
 * 1. Build fresh user context from database
 * 2. Construct system prompt with persona + context
 * 3. Load last 20 messages from conversation for continuity
 * 4. Stream response via OpenRouter (Claude Sonnet)
 *
 * @returns Stream of content tokens + context snapshot for storage
 */
export async function generatePMResponse(
  userId: string,
  conversationId: string,
  userMessage: string
): Promise<PMStreamResult> {
  const provider = getAIProvider();

  // Build fresh context
  const context = await buildPMContext(userId);
  const contextString = serializeContext(context);

  // Load conversation history (last 20 messages)
  const history = await prisma.aIMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      role: true,
      content: true,
    },
  });

  // Build message array (system → history → new message)
  const messages: PMMessage[] = [
    {
      role: 'system',
      content: `${PM_PERSONA_PROMPT}\n\n${contextString}`,
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
  const modelName = provider.models[PM_MODEL_TIER];

  // Create streaming response
  const stream = provider.stream({
    model: modelName,
    messages,
    temperature: 0.7,
    max_tokens: 1500,
  });

  return {
    stream,
    contextSnapshot: context,
  };
}

/**
 * Extract structured action items and suggestions from an AI response.
 * Uses a fast model (GPT-3.5) for efficient parsing.
 */
export async function extractStructuredData(
  aiResponse: string
): Promise<ExtractedData> {
  try {
    const provider = getAIProvider();
    const fastModel = provider.models['fast'];

    const response = await provider.complete({
      model: fastModel,
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content: aiResponse },
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || '{}';

    // Try to parse JSON from the response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);
    return {
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems.slice(0, 3) : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3) : [],
    };
  } catch (error) {
    // Extraction failure is non-critical — return empty
    console.error('Failed to extract structured data from PM response:', error);
    return { actionItems: [], suggestions: [] };
  }
}

/**
 * Generate a weekly digest for a user.
 * Called by the Monday 8 AM cron job.
 */
export async function generateWeeklyDigest(
  userId: string
): Promise<WeeklyDigestResult> {
  const provider = getAIProvider();
  const context = await buildPMContext(userId);
  const contextString = serializeContext(context);

  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const response = await provider.complete({
    model: provider.models[PM_MODEL_TIER],
    messages: [
      {
        role: 'system',
        content: `${WEEKLY_DIGEST_PROMPT}\n\n${contextString}\n\nWeek: ${weekStart.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}`,
      },
      {
        role: 'user',
        content: 'Generate my weekly digest for this past week.',
      },
    ],
    temperature: 0.6,
    max_tokens: 1200,
  });

  const digestText = response.choices[0]?.message?.content || '';

  // Parse structured sections from the digest
  // Use extraction on the digest for structured format
  const structured = await extractStructuredData(digestText);

  // Build the digest result — use the full text as summary, with extracted items
  return {
    summary: digestText,
    highlights: [], // Will be populated from AI extraction in production
    actionItems: structured.actionItems.map((item) => ({
      title: item.title,
      description: item.description,
      priority: item.priority,
    })),
    opportunities: structured.suggestions.map((s) => ({
      title: s.title,
      description: s.description,
      potentialImpact: s.type,
    })),
  };
}

/**
 * Generate proactive suggestions based on detected anomalies.
 * Called by the 6-hour cron job.
 */
export async function generateProactiveSuggestions(
  userId: string,
  anomalies: Array<{ type: string; data: Record<string, unknown> }>
): Promise<ProactiveSuggestion[]> {
  if (anomalies.length === 0) return [];

  const provider = getAIProvider();
  const context = await buildPMContext(userId);
  const contextString = serializeContext(context);

  const suggestions: ProactiveSuggestion[] = [];

  // Process each anomaly (max 3 at a time to stay within rate limits)
  for (const anomaly of anomalies.slice(0, 3)) {
    try {
      const response = await provider.complete({
        model: provider.models['balanced'], // Use balanced tier for efficiency
        messages: [
          {
            role: 'system',
            content: `${PROACTIVE_INSIGHT_PROMPT}\n\n${contextString}`,
          },
          {
            role: 'user',
            content: `Anomaly detected: ${anomaly.type}\nData: ${JSON.stringify(anomaly.data)}`,
          },
        ],
        temperature: 0.5,
        max_tokens: 300,
      });

      const insightText = response.choices[0]?.message?.content || '';

      // Parse the insight into structured format
      const lines = insightText.split('\n').filter((l) => l.trim());
      suggestions.push({
        type: anomaly.type,
        headline: lines[0]?.replace(/^#+\s*/, '').replace(/\*+/g, '') || anomaly.type,
        body: insightText,
        action: lines.find((l) => l.toLowerCase().includes('action') || l.toLowerCase().includes('recommend'))
          || lines[lines.length - 1] || '',
        priority: anomaly.type.includes('spike') || anomaly.type.includes('viral')
          ? 'high'
          : anomaly.type.includes('drop') || anomaly.type.includes('decline')
            ? 'high'
            : 'medium',
      });
    } catch (error) {
      console.error(`Failed to generate insight for anomaly ${anomaly.type}:`, error);
    }
  }

  return suggestions;
}

/**
 * Get a quick greeting/summary for the dashboard widget.
 * Lighter than a full conversation — single completion, fast model.
 */
export async function generateDashboardGreeting(
  userId: string
): Promise<{ greeting: string; suggestions: Suggestion[] }> {
  try {
    const provider = getAIProvider();
    const context = await buildPMContext(userId);
    const contextString = serializeContext(context);

    const response = await provider.complete({
      model: provider.models['balanced'],
      messages: [
        {
          role: 'system',
          content: `You are the user's AI Project Manager. Generate a brief, personalized greeting (1-2 sentences) and 2 proactive suggestions based on their current data. Be specific — reference their actual metrics and activity.

${contextString}

Respond in this EXACT JSON format (no markdown, no code blocks):
{"greeting": "...", "suggestions": [{"type": "content|growth|optimization|feature", "title": "...", "description": "...", "actionUrl": "/dashboard/..."}]}`,
        },
        {
          role: 'user',
          content: 'What should I focus on today?',
        },
      ],
      temperature: 0.7,
      max_tokens: 400,
    });

    const content = response.choices[0]?.message?.content || '';

    try {
      let jsonStr = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(jsonStr);
      return {
        greeting: parsed.greeting || 'Welcome back! Let me check your latest data.',
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 2) : [],
      };
    } catch {
      // If JSON parsing fails, return the raw text as greeting
      return {
        greeting: content.substring(0, 200),
        suggestions: [],
      };
    }
  } catch (error) {
    console.error('Failed to generate dashboard greeting:', error);
    return {
      greeting: 'Welcome back! Open the chat to see what your AI PM has for you today.',
      suggestions: [],
    };
  }
}
