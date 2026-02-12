/**
 * PKCE (Proof Key for Code Exchange) Utilities
 *
 * Implements RFC 7636 for secure OAuth 2.0 authorization code flow.
 * Prevents authorization code interception attacks.
 *
 * @module lib/auth/pkce
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - REDIS_URL: Optional Redis connection for distributed storage (recommended for production)
 *   Falls back to in-memory storage in development
 *
 * FAILURE MODE: Falls back to in-memory storage if Redis unavailable
 */

import crypto from 'crypto';
import type { PKCEChallenge, PKCEState, AuthProvider } from '@/types/auth';

// ==========================================
// PKCE Code Generation
// ==========================================

/**
 * Generate a cryptographically random code verifier
 * Per RFC 7636, must be 43-128 characters from [A-Z, a-z, 0-9, -, ., _, ~]
 */
export function generateCodeVerifier(): string {
  // Generate 32 bytes = 256 bits of entropy, base64url encoded = 43 chars
  const buffer = crypto.randomBytes(32);
  return base64UrlEncode(buffer);
}

/**
 * Generate the code challenge from a code verifier using SHA-256
 * Per RFC 7636 Section 4.2
 */
export function generateCodeChallenge(verifier: string): string {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return base64UrlEncode(hash);
}

/**
 * Generate a complete PKCE challenge pair
 */
export function generatePKCEChallenge(): PKCEChallenge {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256',
  };
}

/**
 * Generate a secure state parameter for OAuth flow
 * Includes CSRF protection
 */
export function generateState(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ==========================================
// Base64 URL Encoding (RFC 7636)
// ==========================================

/**
 * Base64 URL encode without padding (RFC 7636 requirement)
 */
function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ==========================================
// PKCE State Storage
// Uses Redis in production, in-memory Map for development
// ==========================================

// In-memory storage for development (not suitable for production multi-instance)
const memoryStorage = new Map<string, PKCEState>();

// Storage TTL: 10 minutes (OAuth flows should complete quickly)
const PKCE_STATE_TTL_MS = 10 * 60 * 1000;

/**
 * Store PKCE state for later retrieval during callback
 */
export async function storePKCEState(
  state: string,
  codeVerifier: string,
  provider: AuthProvider,
  redirectUri: string,
  linkToUserId?: string
): Promise<void> {
  const pkceState: PKCEState = {
    state,
    codeVerifier,
    provider,
    redirectUri,
    linkToUserId,
    createdAt: Date.now(),
    expiresAt: Date.now() + PKCE_STATE_TTL_MS,
  };

  // Try Redis first if available
  if (await isRedisAvailable()) {
    await storeInRedis(state, pkceState);
    return;
  }

  // Fallback to in-memory storage
  memoryStorage.set(state, pkceState);

  // Clean up expired entries periodically
  cleanupExpiredEntries();
}

/**
 * Retrieve and consume PKCE state (one-time use)
 */
export async function retrievePKCEState(state: string): Promise<PKCEState | null> {
  // Try Redis first
  if (await isRedisAvailable()) {
    return retrieveFromRedis(state);
  }

  // Fallback to in-memory
  const pkceState = memoryStorage.get(state);

  if (!pkceState) {
    return null;
  }

  // Check expiration
  if (Date.now() > pkceState.expiresAt) {
    memoryStorage.delete(state);
    return null;
  }

  // Delete after retrieval (one-time use)
  memoryStorage.delete(state);

  return pkceState;
}

/**
 * Get the code verifier for a given state (convenience method)
 */
export async function getCodeVerifier(state: string): Promise<string | null> {
  const pkceState = await retrievePKCEState(state);
  return pkceState?.codeVerifier ?? null;
}

// ==========================================
// Redis Integration (Optional)
// ==========================================

/** Redis client interface for PKCE state storage */
interface RedisClientLike {
  connect: () => Promise<unknown>;
  setEx: (key: string, ttl: number, value: string) => Promise<unknown>;
  get: (key: string) => Promise<string | null>;
  del: (key: string) => Promise<unknown>;
}

let redisClient: RedisClientLike | null = null;
let redisAvailable: boolean | null = null;

async function isRedisAvailable(): Promise<boolean> {
  if (redisAvailable !== null) {
    return redisAvailable;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    redisAvailable = false;
    return false;
  }

  try {
    // Dynamic import to avoid requiring redis in development
    const { createClient } = await import('redis');
    redisClient = createClient({ url: redisUrl });
    await redisClient.connect();
    redisAvailable = true;
    return true;
  } catch (error) {
    console.warn('[PKCE] Redis not available, using in-memory storage:', error);
    redisAvailable = false;
    return false;
  }
}

async function storeInRedis(state: string, pkceState: PKCEState): Promise<void> {
  if (!redisClient) return;

  const key = `pkce:${state}`;
  const ttlSeconds = Math.ceil(PKCE_STATE_TTL_MS / 1000);

  await redisClient.setEx(key, ttlSeconds, JSON.stringify(pkceState));
}

async function retrieveFromRedis(state: string): Promise<PKCEState | null> {
  if (!redisClient) return null;

  const key = `pkce:${state}`;
  const data = await redisClient.get(key);

  if (!data) return null;

  // Delete after retrieval (one-time use)
  await redisClient.del(key);

  try {
    return JSON.parse(data) as PKCEState;
  } catch {
    return null;
  }
}

// ==========================================
// Cleanup Utilities
// ==========================================

let lastCleanup = 0;
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

function cleanupExpiredEntries(): void {
  const now = Date.now();

  // Rate limit cleanup
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) {
    return;
  }
  lastCleanup = now;

  for (const [key, value] of memoryStorage.entries()) {
    if (now > value.expiresAt) {
      memoryStorage.delete(key);
    }
  }
}

// ==========================================
// Validation Utilities
// ==========================================

/**
 * Validate that a code verifier meets RFC 7636 requirements
 */
export function isValidCodeVerifier(verifier: string): boolean {
  // Length: 43-128 characters
  if (verifier.length < 43 || verifier.length > 128) {
    return false;
  }

  // Characters: [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
  const validPattern = /^[A-Za-z0-9\-._~]+$/;
  return validPattern.test(verifier);
}

/**
 * Verify that a code challenge matches the code verifier
 */
export function verifyCodeChallenge(
  codeVerifier: string,
  codeChallenge: string
): boolean {
  const expectedChallenge = generateCodeChallenge(codeVerifier);
  return codeChallenge === expectedChallenge;
}
