/**
 * GOVERNOR — BYOK key resolution, fail-closed (SYN-1196).
 *
 * The whole point of this module is what it does NOT contain: there is no
 * reference to process.env anywhere in it, and no default, fallback or
 * "platform key" branch. A brand pays for its own AI or it does not get any.
 *
 * Why that is structural rather than a convention: the pre-existing bridge,
 * lib/ai/api-credential-injector.ts, returns `null` when a user has no stored
 * key, and its documented call pattern is
 *
 *     const userKey = await getUserProviderApiKey(userId, 'openrouter');
 *     const ai = getAIProvider({ apiKey: userKey || undefined });
 *
 * — where `undefined` makes the provider factory fall back to the platform
 * environment key. That is a fallback by omission: nobody wrote "use the
 * platform key", it is what happens when nothing is returned. So this resolver
 * never returns a nullable key. It returns a discriminated result, and the
 * only shape carrying a key is the one where the brand's own key was found,
 * active and decryptable.
 *
 * It also does not reuse api-credential-injector's PROVIDER_MAP, which routes
 * 'openai' credentials through OpenRouter. That is a second, quieter fallback:
 * a brand that revoked its OpenAI key would keep spending through its
 * OpenRouter one. Provider match here is strict 1:1.
 *
 * Refusals are classified — missing, revoked, inactive and undecryptable are
 * four distinct outcomes — so a test can tell them apart, and so an operator
 * reading a receipt knows whether to ask for a key or to re-issue one.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { decryptApiKey } from '@/lib/encryption/api-key-encryption';
import type { GovernorOutcome, GovernorProvider } from './types';

export type ByokResolution =
  | { ok: true; apiKey: string; verdict: 'byok_present'; credentialId: string }
  | { ok: false; verdict: string; outcome: GovernorOutcome };

/**
 * Resolve the brand's own key for `provider`, scoped to `organizationId`.
 *
 * The query deliberately does NOT filter on isActive / revokedAt. Filtering
 * would collapse "no key was ever added", "the key was revoked" and "the key
 * was disabled" into one empty result, and the goal card asks specifically for
 * "revoked key = refusal" as its own observable behaviour. We fetch, then
 * classify.
 */
export async function resolveBrandApiKey(
  organizationId: string,
  provider: GovernorProvider
): Promise<ByokResolution> {
  let credential;
  try {
    credential = await prisma.aPICredential.findFirst({
      where: { organizationId, provider },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        encryptedKey: true,
        isActive: true,
        revokedAt: true,
      },
    });
  } catch (error) {
    logger.error('Governor BYOK read failed — refusing (fail-closed)', {
      organizationId,
      provider,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return {
      ok: false,
      verdict: 'control_plane_error',
      outcome: 'refused_control_plane_error',
    };
  }

  if (!credential) {
    return {
      ok: false,
      verdict: 'byok_missing',
      outcome: 'refused_byok_missing',
    };
  }

  if (credential.revokedAt !== null) {
    return {
      ok: false,
      verdict: 'byok_revoked',
      outcome: 'refused_byok_revoked',
    };
  }

  if (!credential.isActive) {
    return {
      ok: false,
      verdict: 'byok_inactive',
      outcome: 'refused_byok_inactive',
    };
  }

  let apiKey: string;
  try {
    apiKey = decryptApiKey(credential.encryptedKey);
  } catch (error) {
    // A key we cannot decrypt is a key we do not have. It is NOT a reason to
    // reach for a platform key.
    logger.error('Governor BYOK decrypt failed — refusing (fail-closed)', {
      organizationId,
      provider,
      credentialId: credential.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return {
      ok: false,
      verdict: 'byok_undecryptable',
      outcome: 'refused_byok_undecryptable',
    };
  }

  if (!apiKey) {
    return {
      ok: false,
      verdict: 'byok_undecryptable',
      outcome: 'refused_byok_undecryptable',
    };
  }

  return {
    ok: true,
    apiKey,
    verdict: 'byok_present',
    credentialId: credential.id,
  };
}
