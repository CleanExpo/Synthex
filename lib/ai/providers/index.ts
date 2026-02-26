/**
 * AI Provider Factory
 *
 * Returns the configured AI provider based on the AI_PROVIDER env var.
 * Defaults to OpenRouter for backward compatibility.
 *
 * Supports user API key injection: pass { apiKey, provider } to create
 * a per-request provider instance using the user's own credentials.
 *
 * ENVIRONMENT VARIABLES:
 * - AI_PROVIDER: Provider selection (PUBLIC, optional)
 *   Values: "openrouter" (default) | "anthropic" | "google"
 *
 * Usage:
 *   // Platform key (singleton, cached)
 *   const ai = getAIProvider();
 *
 *   // User key (per-request, not cached)
 *   const ai = getAIProvider({ apiKey: userKey, provider: 'openrouter' });
 *
 *   const response = await ai.complete({ model: ai.models.balanced, messages: [...] });
 */

import { logger } from '@/lib/logger';
import type { AIProvider } from './base-provider';
import { OpenRouterProvider } from './openrouter-provider';
import { AnthropicProvider } from './anthropic-provider';
import { GoogleProvider } from './google-provider';

export type { AIProvider, AIMessage, AICompletionRequest, AICompletionResponse, ModelPresets } from './base-provider';

type ProviderName = 'openrouter' | 'anthropic' | 'google';

interface UserKeyOptions {
  /** User's own API key (decrypted). Creates a fresh provider instance. */
  apiKey: string;
  /** Which provider this key is for. Defaults to AI_PROVIDER env var. */
  provider?: ProviderName;
}

const providerFactories: Record<ProviderName, (apiKey?: string) => AIProvider> = {
  openrouter: (key?) => new OpenRouterProvider(key),
  anthropic: (key?) => new AnthropicProvider(key),
  google: (key?) => new GoogleProvider(key),
};

let cachedProvider: AIProvider | null = null;
let cachedProviderName: string | null = null;

/**
 * Get the active AI provider.
 *
 * Without options: returns singleton using platform env vars (cached per process).
 * With options.apiKey: returns a fresh instance using the user's key (NOT cached).
 */
export function getAIProvider(options?: UserKeyOptions): AIProvider {
  // --- User key path: create fresh instance, never cached ---
  if (options?.apiKey) {
    const name = (options.provider || process.env.AI_PROVIDER || 'openrouter') as ProviderName;
    const factory = providerFactories[name];
    if (!factory) {
      logger.warn('Unknown provider for user key, falling back to openrouter', { provider: name });
      return new OpenRouterProvider(options.apiKey);
    }
    return factory(options.apiKey);
  }

  // --- Platform key path: singleton, cached ---
  const name = (process.env.AI_PROVIDER || 'openrouter') as ProviderName;

  // Return cached if same provider
  if (cachedProvider && cachedProviderName === name) {
    return cachedProvider;
  }

  const factory = providerFactories[name];
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
