/**
 * AI Provider Factory
 *
 * Returns the configured AI provider based on the AI_PROVIDER env var.
 * Defaults to OpenAI (OpenAI-only direction).
 *
 * Supports user API key injection: pass { apiKey, provider } to create
 * a per-request provider instance using the user's own credentials.
 *
 * ENVIRONMENT VARIABLES:
 * - AI_PROVIDER: Provider selection (PUBLIC, optional)
 *   Values: "openai" (default) | "openrouter" | "anthropic" | "google"
 *
 * Usage:
 *   // Platform key (singleton, cached)
 *   const ai = getAIProvider();
 *
 *   // User key (per-request, not cached)
 *   const ai = getAIProvider({ apiKey: userKey, provider: 'openai' });
 *
 *   const response = await ai.complete({ model: ai.models.balanced, messages: [...] });
 */

import { logger } from '@/lib/logger';
import type { AIProvider } from './base-provider';
import { OpenAIProvider } from './openai-provider';
import { OpenRouterProvider } from './openrouter-provider';
import { AnthropicProvider } from './anthropic-provider';
import { GoogleProvider } from './google-provider';
import { OllamaProvider } from './ollama-provider';

export type {
  AIProvider,
  AIMessage,
  AICompletionRequest,
  AICompletionResponse,
  ModelPresets,
} from './base-provider';
export { OllamaUnavailableError } from './ollama-provider';

type ProviderName = 'openai' | 'openrouter' | 'anthropic' | 'google' | 'ollama';

/** Default provider used when AI_PROVIDER is unset (OpenAI-only direction). */
const DEFAULT_PROVIDER: ProviderName = 'openai';

function resolvePlatformProviderName(): ProviderName {
  const configured = process.env.AI_PROVIDER as ProviderName | undefined;
  if (configured && providerFactories[configured]) return configured;
  if (process.env.OPENAI_API_KEY?.trim()) return 'openai';
  if (process.env.OPENROUTER_API_KEY?.trim()) return 'openrouter';
  if (process.env.ANTHROPIC_API_KEY?.trim()) return 'anthropic';
  if (process.env.GOOGLE_AI_API_KEY?.trim()) return 'google';
  return DEFAULT_PROVIDER;
}

interface UserKeyOptions {
  /** User's own API key (decrypted). Creates a fresh provider instance. */
  apiKey: string;
  /** Which provider this key is for. Defaults to AI_PROVIDER env var. */
  provider?: ProviderName;
}

const providerFactories: Record<ProviderName, (apiKey?: string) => AIProvider> =
  {
    openai: (key?) => new OpenAIProvider(key),
    openrouter: (key?) => new OpenRouterProvider(key),
    anthropic: (key?) => new AnthropicProvider(key),
    google: (key?) => new GoogleProvider(key),
    // Ollama is a local-only provider; the apiKey arg is accepted for
    // factory-signature compatibility but not used.
    ollama: (key?) => new OllamaProvider(key),
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
    const name = (options.provider ||
      resolvePlatformProviderName()) as ProviderName;
    const factory = providerFactories[name];
    if (!factory) {
      logger.warn('Unknown provider for user key, falling back to openai', {
        provider: name,
      });
      return new OpenAIProvider(options.apiKey);
    }
    return factory(options.apiKey);
  }

  // --- Platform key path: singleton, cached ---
  const name = resolvePlatformProviderName();

  // Return cached if same provider
  if (cachedProvider && cachedProviderName === name) {
    return cachedProvider;
  }

  const factory = providerFactories[name];
  if (!factory) {
    logger.warn('Unknown AI_PROVIDER value, falling back to openai', {
      configured: name,
    });
    cachedProvider = new OpenAIProvider();
    cachedProviderName = 'openai';
    return cachedProvider;
  }

  cachedProvider = factory();
  cachedProviderName = name;
  logger.info('AI provider initialized', { provider: cachedProvider.name });
  return cachedProvider;
}
