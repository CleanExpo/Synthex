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
    // DB lookup failed — log and fall through to env vars
    console.warn(
      `[Platform Credentials] DB lookup failed for ${normalizedPlatform}:`,
      error instanceof Error ? error.message : String(error)
    );
  }

  if (dbCredentials) {
    setCache(normalizedPlatform, dbCredentials);
    return dbCredentials;
  }

  // Fall back to environment variables
  const envCredentials = getCredentialsFromEnv(normalizedPlatform);

  // Cache the result (including null — avoids repeated lookups for unconfigured platforms)
  setCache(normalizedPlatform, envCredentials);

  return envCredentials;
}
