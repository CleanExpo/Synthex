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
 *
 * IT ALSO FETCHES EVERY ROW, NOT THE NEWEST ONE. APICredential is unique on
 * [userId, provider, organizationId], so one organisation can legitimately
 * hold several credentials for the same provider — one per user. An earlier
 * revision took `findFirst ... orderBy createdAt desc` and classified whatever
 * came back, which meant a newer REVOKED row belonging to one user masked an
 * older ACTIVE row belonging to another: the org was refused while holding a
 * perfectly good key. (Independent review, cursor lane, finding
 * P1-BYOK-NEWEST-REVOKED-SHADOWS-ACTIVE.)
 *
 * So: prefer any usable credential; only when NONE is usable does the newest
 * unusable row decide which refusal is reported. Note what this does not do —
 * it never widens to another provider and never reaches for an environment
 * key. Selecting a different key the BRAND owns is not a fallback; substituting
 * a key the brand does not own is, and that path does not exist here.
 */
export async function resolveBrandApiKey(
  organizationId: string,
  provider: GovernorProvider
): Promise<ByokResolution> {
  let credentials;
  try {
    credentials = await prisma.aPICredential.findMany({
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

  const rows = Array.isArray(credentials) ? credentials : [];

  if (rows.length === 0) {
    return {
      ok: false,
      verdict: 'byok_missing',
      outcome: 'refused_byok_missing',
    };
  }

  // Usable = the brand still owns it and has not turned it off. Newest first,
  // inherited from the query's ordering.
  const usable = rows.filter(row => row.revokedAt === null && row.isActive);

  if (usable.length === 0) {
    // Nothing usable. The NEWEST row decides which refusal is reported, so the
    // operator is told the most recent thing that happened to their keys.
    const newest = rows[0];
    if (newest.revokedAt !== null) {
      return {
        ok: false,
        verdict: 'byok_revoked',
        outcome: 'refused_byok_revoked',
      };
    }
    return {
      ok: false,
      verdict: 'byok_inactive',
      outcome: 'refused_byok_inactive',
    };
  }

  // Try each usable credential in turn. A single corrupted ciphertext must not
  // shadow another valid key the brand owns — that is the same defect class as
  // the newest-row bug above, one layer down.
  for (const candidate of usable) {
    let apiKey: string;
    try {
      apiKey = decryptApiKey(candidate.encryptedKey);
    } catch (error) {
      // A key we cannot decrypt is a key we do not have. It is NOT a reason to
      // reach for a platform key.
      logger.error('Governor BYOK decrypt failed — trying next brand key', {
        organizationId,
        provider,
        credentialId: candidate.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      continue;
    }
    if (apiKey) {
      return {
        ok: true,
        apiKey,
        verdict: 'byok_present',
        credentialId: candidate.id,
      };
    }
  }

  return {
    ok: false,
    verdict: 'byok_undecryptable',
    outcome: 'refused_byok_undecryptable',
  };
}
