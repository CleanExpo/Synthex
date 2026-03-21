/**
 * Shared Google Auth Utility
 *
 * Provides two auth strategies:
 * 1. Per-business OAuth tokens (via PlatformConnection) — preferred
 * 2. Shared Service Account (legacy fallback) — for orgs without OAuth
 *
 * @module lib/google/google-auth
 */

import prisma from '@/lib/prisma';
import {
  decryptFieldSafe,
  encryptField,
} from '@/lib/security/field-encryption';
import { getPlatformOAuthCredentials } from '@/lib/platform-credentials';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

interface ServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
}

// ============================================================================
// Constants
// ============================================================================

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

// ============================================================================
// OAuth Access Token (per-business)
// ============================================================================

/**
 * Get an OAuth access token for a PlatformConnection.
 * Automatically refreshes if the token is expired or about to expire.
 *
 * @param connectionId - PlatformConnection ID
 * @returns Decrypted access token string
 * @throws Error if connection not found or tokens cannot be decrypted
 */
export async function getOAuthAccessToken(
  connectionId: string
): Promise<string> {
  const connection = await prisma.platformConnection.findUnique({
    where: { id: connectionId },
    select: {
      id: true,
      platform: true,
      accessToken: true,
      refreshToken: true,
      expiresAt: true,
      isActive: true,
    },
  });

  if (!connection) {
    throw new Error(`PlatformConnection ${connectionId} not found`);
  }

  if (!connection.isActive) {
    throw new Error(
      `PlatformConnection ${connectionId} is inactive — reconnection required`
    );
  }

  const accessToken = decryptFieldSafe(connection.accessToken);
  if (!accessToken) {
    throw new Error(
      `Cannot decrypt access token for connection ${connectionId}`
    );
  }

  // Check if token needs refresh (expired or expiring within 5 minutes)
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (connection.expiresAt && connection.expiresAt < fiveMinutesFromNow) {
    const refreshToken = connection.refreshToken
      ? decryptFieldSafe(connection.refreshToken)
      : null;

    if (!refreshToken) {
      throw new Error(
        `Token expired and no refresh token available for connection ${connectionId}`
      );
    }

    // Refresh the token
    const creds = await getPlatformOAuthCredentials(connection.platform);
    if (!creds) {
      throw new Error(
        `No OAuth credentials configured for platform ${connection.platform}`
      );
    }

    const refreshResponse = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      }),
    });

    if (!refreshResponse.ok) {
      const errorText = await refreshResponse.text();
      logger.error('[google-auth] Token refresh failed', {
        connectionId,
        platform: connection.platform,
        status: refreshResponse.status,
        error: errorText.substring(0, 200),
      });
      throw new Error(`Token refresh failed: ${refreshResponse.status}`);
    }

    const tokenData = await refreshResponse.json();
    const newAccessToken = tokenData.access_token as string;
    const newExpiresAt = tokenData.expires_in
      ? new Date(Date.now() + (tokenData.expires_in as number) * 1000)
      : null;

    // Persist refreshed token
    await prisma.platformConnection.update({
      where: { id: connectionId },
      data: {
        accessToken: encryptField(newAccessToken) ?? newAccessToken,
        ...(tokenData.refresh_token && {
          refreshToken:
            encryptField(tokenData.refresh_token as string) ??
            tokenData.refresh_token,
        }),
        expiresAt: newExpiresAt,
        updatedAt: new Date(),
      },
    });

    return newAccessToken;
  }

  return accessToken;
}

// ============================================================================
// Service Account Access Token (legacy fallback)
// ============================================================================

/**
 * Get an access token using the shared service account.
 * Falls back to this when no org-specific OAuth connection exists.
 *
 * @param scope - Space-separated OAuth scopes
 * @returns Access token string
 * @throws Error if service account credentials not configured
 */
export async function getServiceAccountAccessToken(
  scope: string
): Promise<string> {
  const credentials = loadServiceAccountCredentials();
  if (!credentials) {
    throw new Error(
      'GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON not configured. Set the environment variable or connect via OAuth.'
    );
  }

  const jwt = createServiceAccountJWT(credentials, scope);

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Service account token exchange failed: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

// ============================================================================
// Helpers
// ============================================================================

function loadServiceAccountCredentials(): ServiceAccountCredentials | null {
  const json = process.env.GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON;
  if (!json) return null;

  try {
    return JSON.parse(json);
  } catch {
    logger.warn('Invalid JSON in GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON');
    return null;
  }
}

function createServiceAccountJWT(
  credentials: ServiceAccountCredentials,
  scope: string
): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: credentials.client_email,
    scope,
    aud: TOKEN_ENDPOINT,
    iat: now,
    exp: now + 3600,
  };

  const base64url = (obj: object) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  const headerEncoded = base64url(header);
  const payloadEncoded = base64url(payload);
  const signInput = `${headerEncoded}.${payloadEncoded}`;

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signInput);
  const signature = sign
    .sign(credentials.private_key, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${signInput}.${signature}`;
}

/**
 * Find an active PlatformConnection for a given org and platform.
 * Returns the connection ID or null if not connected.
 */
export async function findOAuthConnection(
  organizationId: string,
  platform: string
): Promise<string | null> {
  const connection = await prisma.platformConnection.findFirst({
    where: {
      organizationId,
      platform,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  });

  return connection?.id ?? null;
}

/**
 * Check if service account credentials are available.
 */
export function hasServiceAccountCredentials(): boolean {
  return !!process.env.GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON;
}
