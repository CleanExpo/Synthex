/**
 * OpenRouter API Wrapper
 *
 * @description Re-exports from openrouter-client for backward compatibility
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - OPENROUTER_API_KEY: OpenRouter API key (SECRET)
 */

import { openRouterClient, OpenRouterClient, OpenRouterMessage, OpenRouterRequest, OpenRouterResponse } from './openrouter-client';
import { logger } from '@/lib/logger';

// Re-export types
export type { OpenRouterMessage, OpenRouterRequest, OpenRouterResponse };

// Export client
export { openRouterClient, OpenRouterClient };

/**
 * Call OpenRouter API (backward compatible function)
 */
export async function callOpenRouter(
  prompt: string,
  options: {
    model?: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
  } = {}
): Promise<string> {
  const {
    model = openRouterClient.models.balanced,
    systemPrompt = 'You are a helpful AI assistant.',
    temperature = 0.7,
    maxTokens = 1000,
  } = options;

  try {
    const response = await openRouterClient.complete({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature,
      max_tokens: maxTokens,
    });

    return response.choices[0]?.message?.content || '';
  } catch (error) {
    logger.error('OpenRouter call failed', { error, model });
    throw error;
  }
}

export default callOpenRouter;
