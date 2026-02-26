/**
 * API Credential Injector
 *
 * Bridges user-stored API credentials (from onboarding/settings) into AI provider calls.
 * Decrypts the stored key and returns it for use with getAIProvider().
 *
 * Usage:
 *   const userKey = await getUserProviderApiKey(userId, 'openrouter');
 *   const ai = getAIProvider({ apiKey: userKey || undefined });
 *   const response = await ai.complete({ ... });
 */

import { prisma } from '@/lib/prisma';
import { decryptApiKey } from '@/lib/encryption/api-key-encryption';
import { logger } from '@/lib/logger';

/**
 * Maps our credential provider names to the provider factory names.
 * Users may store keys under 'openai' which should route through OpenRouter.
 */
const PROVIDER_MAP: Record<string, string> = {
  openrouter: 'openrouter',
  openai: 'openrouter', // OpenAI keys work through OpenRouter
  anthropic: 'anthropic',
  google: 'google',
};

/**
 * Get the decrypted API key for a user's preferred AI provider.
 *
 * @param userId - Authenticated user ID
 * @param provider - Provider name ('openrouter', 'anthropic', 'google', 'openai')
 * @returns Decrypted API key string, or null if no valid key is stored
 */
export async function getUserProviderApiKey(
  userId: string,
  provider: string
): Promise<string | null> {
  try {
    const credential = await prisma.aPICredential.findFirst({
      where: {
        userId,
        provider,
        isActive: true,
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' }, // Most recently added key wins
    });

    if (!credential) {
      return null;
    }

    // Check if key was validated and is still valid
    if (credential.isValid === false && credential.lastValidatedAt) {
      logger.warn('User API key was previously marked invalid', {
        userId,
        provider,
        credentialId: credential.id,
      });
      // Still attempt to use it — it may have been fixed since validation
    }

    const decryptedKey = decryptApiKey(credential.encryptedKey);
    return decryptedKey;
  } catch (error) {
    logger.error('Failed to retrieve user API credential', {
      userId,
      provider,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Get the appropriate provider name for factory use.
 * Maps user-facing provider names to internal provider names.
 */
export function resolveProviderName(userProvider: string): string {
  return PROVIDER_MAP[userProvider.toLowerCase()] || userProvider.toLowerCase();
}

/**
 * Convenience: get user key and resolved provider in one call.
 * Falls through providers in preference order if the primary has no key.
 */
export async function getUserAICredentials(
  userId: string
): Promise<{ provider: string; apiKey: string } | null> {
  // Try providers in order of preference
  const providerOrder = ['openrouter', 'anthropic', 'google', 'openai'];

  for (const provider of providerOrder) {
    const key = await getUserProviderApiKey(userId, provider);
    if (key) {
      return {
        provider: resolveProviderName(provider),
        apiKey: key,
      };
    }
  }

  return null;
}
