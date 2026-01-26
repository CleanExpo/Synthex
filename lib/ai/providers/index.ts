/**
 * AI Provider Factory
 *
 * Returns the configured AI provider based on the AI_PROVIDER env var.
 * Defaults to OpenRouter for backward compatibility.
 *
 * ENVIRONMENT VARIABLES:
 * - AI_PROVIDER: Provider selection (PUBLIC, optional)
 *   Values: "openrouter" (default) | "anthropic" | "google"
 *
 * Usage:
 *   import { getAIProvider } from '@/lib/ai/providers';
 *   const ai = getAIProvider();
 *   const response = await ai.complete({ model: ai.models.balanced, messages: [...] });
 */

import { logger } from '@/lib/logger';
import type { AIProvider } from './base-provider';
import { OpenRouterProvider } from './openrouter-provider';
import { AnthropicProvider } from './anthropic-provider';
import { GoogleProvider } from './google-provider';

export type { AIProvider, AIMessage, AICompletionRequest, AICompletionResponse, ModelPresets } from './base-provider';

type ProviderName = 'openrouter' | 'anthropic' | 'google';

const providers: Record<ProviderName, () => AIProvider> = {
  openrouter: () => new OpenRouterProvider(),
  anthropic: () => new AnthropicProvider(),
  google: () => new GoogleProvider(),
};

let cachedProvider: AIProvider | null = null;
let cachedProviderName: string | null = null;

/**
 * Get the active AI provider (singleton per process).
 * The provider is selected via the AI_PROVIDER env var.
 */
export function getAIProvider(): AIProvider {
  const name = (process.env.AI_PROVIDER || 'openrouter') as ProviderName;

  // Return cached if same provider
  if (cachedProvider && cachedProviderName === name) {
    return cachedProvider;
  }

  const factory = providers[name];
  if (!factory) {
    logger.warn('Unknown AI_PROVIDER value, falling back to openrouter', {
      configured: name,
    });
    cachedProvider = new OpenRouterProvider();
    cachedProviderName = 'openrouter';
    return cachedProvider;
  }

  cachedProvider = factory();
  cachedProviderName = name;
  logger.info('AI provider initialized', { provider: cachedProvider.name });
  return cachedProvider;
}
