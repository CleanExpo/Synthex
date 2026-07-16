/**
 * Platform OAuth Credentials Helper
 *
 * Retrieves OAuth client credentials for a given platform.
 * Checks the database first (admin-configured), then falls back to
 * environment variables. Includes a simple in-memory cache with 5-minute TTL.
 *
 * @module lib/platform-credentials
 */

import { prisma } from '@/lib/prisma';
import { decryptApiKey } from '@/lib/encryption/api-key-encryption';
import { logger } from '@/lib/logger';

// --- Types ---

interface PlatformCredentials {
  clientId: string;
  clientSecret: string;
}

/**
 * Non-secret shape verdict for an OAuth client id. X/Twitter OAuth 1.0a API
 * Keys (the "consumer key") are ~25-char; OAuth 2.0 Client IDs are ~34+ char.
 * Length alone separates them, so the verdict can be computed from a masked
 * value (see admin GET) without ever inspecting the raw characters.
 */
export type ClientIdShape = 'oauth1-shaped' | 'oauth2-shaped' | 'unknown';

interface CacheEntry {
  value: PlatformCredentials | null;
  expiresAt: number;
}

// --- In-memory cache (5 minute TTL) ---

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const credentialCache = new Map<string, CacheEntry>();

function getCached(platform: string): PlatformCredentials | null | undefined {
  const entry = credentialCache.get(platform);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    credentialCache.delete(platform);
    return undefined;
  }
  return entry.value;
}

function setCache(platform: string, value: PlatformCredentials | null): void {
  credentialCache.set(platform, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

// --- Credential-shape heuristics ---

/**
 * Heuristic: does this value look like an X/Twitter OAuth 1.0a API Key
 * (a.k.a. Consumer Key) rather than an OAuth 2.0 Client ID?
 *
 * X OAuth 1.0a API Keys are ~25-character, purely-alphanumeric strings. X
 * OAuth 2.0 Client IDs are longer (~34 chars) base64url strings that usually
 * contain `-`/`_` and decode to a colon-delimited structure. Synthex's X flow
 * is OAuth 2.0 only, so an OAuth 1.0a-shaped value is always the wrong
 * credential and returns invalid_client at token exchange. The conservative
 * bounds (alphanumeric-only, length ≤ 30) avoid false-positives on real
 * OAuth 2.0 Client IDs. X/Twitter only — never applied to other platforms.
 */
export function isLikelyOAuth1ApiKey(clientId: string): boolean {
  return /^[A-Za-z0-9]{18,30}$/.test(clientId.trim());
}

// --- Environment variable mapping ---

const ENV_VAR_MAP: Record<
  string,
  { clientIdVars: string[]; clientSecretVars: string[] }
> = {
  twitter: {
    // OAuth 2.0 Client ID/Secret ONLY. TWITTER_CLIENT_ID is canonical; X_CLIENT_ID
    // is an accepted alias. Do NOT add X_CONSUMER_KEY/X_SECRET_KEY here — those are
    // the app's OAuth 1.0a API Key/Secret and feeding them to the OAuth 2.0 token
    // exchange returns invalid_client (the misconfiguration guard below catches it).
    clientIdVars: ['TWITTER_CLIENT_ID', 'X_CLIENT_ID'],
    clientSecretVars: ['TWITTER_CLIENT_SECRET', 'X_CLIENT_SECRET'],
  },
  linkedin: {
    clientIdVars: ['LINKEDIN_CLIENT_ID'],
    clientSecretVars: ['LINKEDIN_CLIENT_SECRET'],
  },
  instagram: {
    // META_CLIENT_ID is the canonical env var name for Meta apps — alias INSTAGRAM for backward compat
    clientIdVars: ['INSTAGRAM_CLIENT_ID', 'META_CLIENT_ID'],
    clientSecretVars: ['INSTAGRAM_CLIENT_SECRET', 'META_CLIENT_SECRET'],
  },
  facebook: {
    // META_CLIENT_ID is the canonical env var name for Meta apps — alias FACEBOOK for backward compat
    clientIdVars: ['FACEBOOK_CLIENT_ID', 'META_CLIENT_ID'],
    clientSecretVars: ['FACEBOOK_CLIENT_SECRET', 'META_CLIENT_SECRET'],
  },
  tiktok: {
    clientIdVars: ['TIKTOK_CLIENT_KEY'],
    clientSecretVars: ['TIKTOK_CLIENT_SECRET'],
  },
  youtube: {
    clientIdVars: ['YOUTUBE_CLIENT_ID', 'GOOGLE_CLIENT_ID'],
    clientSecretVars: ['YOUTUBE_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET'],
  },
  pinterest: {
    clientIdVars: ['PINTEREST_CLIENT_ID'],
    clientSecretVars: ['PINTEREST_CLIENT_SECRET'],
  },
  reddit: {
    clientIdVars: ['REDDIT_CLIENT_ID'],
    clientSecretVars: ['REDDIT_CLIENT_SECRET'],
  },
  threads: {
    clientIdVars: ['THREADS_CLIENT_ID', 'INSTAGRAM_CLIENT_ID'],
    clientSecretVars: ['THREADS_CLIENT_SECRET', 'INSTAGRAM_CLIENT_SECRET'],
  },
  // Google platforms share the same GCP OAuth client as YouTube
  searchconsole: {
    clientIdVars: [
      'SEARCHCONSOLE_CLIENT_ID',
      'YOUTUBE_CLIENT_ID',
      'GOOGLE_CLIENT_ID',
    ],
    clientSecretVars: [
      'SEARCHCONSOLE_CLIENT_SECRET',
      'YOUTUBE_CLIENT_SECRET',
      'GOOGLE_CLIENT_SECRET',
    ],
  },
  googleanalytics: {
    clientIdVars: [
      'GOOGLEANALYTICS_CLIENT_ID',
      'YOUTUBE_CLIENT_ID',
      'GOOGLE_CLIENT_ID',
    ],
    clientSecretVars: [
      'GOOGLEANALYTICS_CLIENT_SECRET',
      'YOUTUBE_CLIENT_SECRET',
      'GOOGLE_CLIENT_SECRET',
    ],
  },
  // Google Drive uses the same GCP OAuth client as YouTube
  googledrive: {
    clientIdVars: [
      'GOOGLEDRIVE_CLIENT_ID',
      'YOUTUBE_CLIENT_ID',
      'GOOGLE_CLIENT_ID',
    ],
    clientSecretVars: [
      'GOOGLEDRIVE_CLIENT_SECRET',
      'YOUTUBE_CLIENT_SECRET',
      'GOOGLE_CLIENT_SECRET',
    ],
  },
  // Google Business Profile uses the same GCP OAuth client
  googlebusiness: {
    clientIdVars: [
      'GOOGLEBUSINESS_CLIENT_ID',
      'YOUTUBE_CLIENT_ID',
      'GOOGLE_CLIENT_ID',
    ],
    clientSecretVars: [
      'GOOGLEBUSINESS_CLIENT_SECRET',
      'YOUTUBE_CLIENT_SECRET',
      'GOOGLE_CLIENT_SECRET',
    ],
  },
};

/**
 * Resolve the first defined environment variable from a list of candidates.
 * Returns undefined if none are set.
 */
function resolveEnvVar(varNames: string[]): string | undefined {
  for (const name of varNames) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

/**
 * Classify an OAuth client id by SHAPE using its length only. This function
 * deliberately takes a length (a number), never the value — so it is
 * structurally incapable of leaking a secret. X/Twitter OAuth 1.0a API Keys are
 * ~15-29 char; OAuth 2.0 Client IDs are ~34+ char. Length cleanly separates the
 * two credential types and is safe to compute from a masked value.
 */
export function classifyClientIdShape(clientIdLen: number): ClientIdShape {
  if (clientIdLen >= 15 && clientIdLen <= 29) return 'oauth1-shaped';
  if (clientIdLen >= 30) return 'oauth2-shaped';
  return 'unknown';
}

/**
 * Whether the platform's OAuth client-id env var is set (names only, never the
 * value). Used to detect a DB row shadowing a configured env var.
 */
export function isPlatformEnvClientIdSet(platform: string): boolean {
  const mapping = ENV_VAR_MAP[platform];
  if (!mapping) return false;
  return resolveEnvVar(mapping.clientIdVars) !== undefined;
}

/**
 * Warn when an X/Twitter client id looks like an OAuth 1.0a API Key (the
 * "consumer key") rather than an OAuth 2.0 Client ID. Generalizes the shape
 * check from PR #776 through classifyClientIdShape. X's OAuth 1.0a API keys are
 * ~25-char alphanumeric; OAuth 2.0 Client IDs are longer (~34+ char base64url).
 * Synthex's X flow is OAuth 2.0 only, so an OAuth1-shaped value here makes X's
 * authorize endpoint reject the request ("Something went wrong — you weren't
 * able to give access to the App") — a silent, all-day dead end. Warn only;
 * never throw or alter resolution. Only the leading 4 chars and the length are
 * logged, never the full value.
 */
function warnIfOAuth1ShapedTwitterClientId(clientId: string): void {
  if (
    classifyClientIdShape(clientId.length) === 'oauth1-shaped' &&
    /^[A-Za-z0-9]+$/.test(clientId)
  ) {
    logger.warn(
      `X/Twitter client id "${clientId.slice(0, 4)}…" is ${clientId.length} chars — ` +
        'this is the shape of an OAuth 1.0a API Key, not an OAuth 2.0 Client ID ' +
        '(~34+ chars). Synthex uses OAuth 2.0; X will reject this at authorize. ' +
        'Copy the "OAuth 2.0 Client ID and Client Secret" from the same X app\'s ' +
        'Keys-and-tokens page.'
    );
  }
}

/**
 * Get credentials from environment variables for a platform.
 * Returns null if either clientId or clientSecret is missing.
 */
function getCredentialsFromEnv(platform: string): PlatformCredentials | null {
  const mapping = ENV_VAR_MAP[platform];
  if (!mapping) return null;

  const clientId = resolveEnvVar(mapping.clientIdVars);
  const clientSecret = resolveEnvVar(mapping.clientSecretVars);

  if (!clientId || !clientSecret) {
    // Actionable diagnosis for the single most common X misconfiguration: the
    // OAuth 1.0a API Key/Secret (X_CONSUMER_KEY/X_SECRET_KEY) are set but the
    // OAuth 2.0 Client ID/Secret are not. Synthex's X flow is OAuth 2.0 only, so
    // those are the wrong credential type. Warn (don't throw — callers rely on the
    // null contract) with the exact remedy so this never becomes portal guesswork.
    if (
      platform === 'twitter' &&
      process.env.X_CONSUMER_KEY &&
      process.env.X_SECRET_KEY
    ) {
      logger.warn(
        'X/Twitter is configured with OAuth 1.0a consumer keys (X_CONSUMER_KEY/X_SECRET_KEY), ' +
          'but Synthex uses OAuth 2.0. Copy the "OAuth 2.0 Client ID and Client Secret" from the ' +
          "same X app's Keys-and-tokens page and set them as TWITTER_CLIENT_ID / TWITTER_CLIENT_SECRET."
      );
    }
    return null;
  }

  return { clientId, clientSecret };
}

// --- Main export ---

/**
 * Get OAuth credentials for a platform.
 * Checks database first (admin-configured via /api/admin/platform-credentials),
 * falls back to environment variables.
 *
 * Results are cached in memory for 5 minutes to avoid repeated DB queries.
 *
 * @param platform - Platform identifier (e.g. 'twitter', 'youtube')
 * @returns { clientId, clientSecret } or null if not configured
 */
export async function getPlatformOAuthCredentials(
  platform: string
): Promise<PlatformCredentials | null> {
  const normalizedPlatform = platform.toLowerCase().trim();

  // Check in-memory cache first
  const cached = getCached(normalizedPlatform);
  if (cached !== undefined) {
    return cached;
  }

  // Try database (admin-configured credentials)
  let dbCredentials: PlatformCredentials | null = null;
  try {
    if (
      prisma != null &&
      typeof prisma.platformOAuthCredential?.findUnique === 'function'
    ) {
      const record = await prisma.platformOAuthCredential.findUnique({
        where: { platform: normalizedPlatform },
      });

      if (
        record &&
        record.isActive &&
        record.encryptedClientId &&
        record.encryptedClientSecret
      ) {
        const clientId = decryptApiKey(record.encryptedClientId);
        const clientSecret = decryptApiKey(record.encryptedClientSecret);

        if (clientId && clientSecret) {
          dbCredentials = { clientId, clientSecret };
        }
      }
    }
  } catch (error) {
    // DB lookup failed — log and fall through to env vars. Keep the format string
    // a static literal and pass the (user-controlled) platform as a separate
    // argument so it can never act as a format string (js/tainted-format-string).
    console.warn(
      '[Platform Credentials] DB lookup failed for platform:',
      normalizedPlatform,
      error instanceof Error ? error.message : String(error)
    );
  }

  if (dbCredentials) {
    // Observability: name WHICH source won and the non-secret shape verdict, so
    // a stale DB row can never silently shadow env without leaving a trace.
    const shadowsEnv = isPlatformEnvClientIdSet(normalizedPlatform);
    logger.info('Platform OAuth credential resolved', {
      platform: normalizedPlatform,
      source: 'db',
      clientIdShape: classifyClientIdShape(dbCredentials.clientId.length),
      clientIdLen: dbCredentials.clientId.length,
      shadowsEnv,
    });
    if (shadowsEnv) {
      logger.warn('DB platform credential is shadowing a set env var', {
        platform: normalizedPlatform,
        // names only — never the values
        envClientIdVars: (
          ENV_VAR_MAP[normalizedPlatform]?.clientIdVars ?? []
        ).filter(name => process.env[name]?.trim()),
      });
    }
    if (normalizedPlatform === 'twitter') {
      warnIfOAuth1ShapedTwitterClientId(dbCredentials.clientId);
    }
    setCache(normalizedPlatform, dbCredentials);
    return dbCredentials;
  }

  // Fall back to environment variables
  const envCredentials = getCredentialsFromEnv(normalizedPlatform);

  if (envCredentials) {
    logger.info('Platform OAuth credential resolved', {
      platform: normalizedPlatform,
      source: 'env',
      clientIdShape: classifyClientIdShape(envCredentials.clientId.length),
      clientIdLen: envCredentials.clientId.length,
      shadowsEnv: false,
    });
    if (normalizedPlatform === 'twitter') {
      warnIfOAuth1ShapedTwitterClientId(envCredentials.clientId);
    }
  }

  // Cache the result (including null — avoids repeated lookups for unconfigured platforms)
  setCache(normalizedPlatform, envCredentials);

  return envCredentials;
}
