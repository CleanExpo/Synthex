/**
 * Twitter/X OAuth credential resolution.
 *
 * Synthex stores OAuth 2.0 (PKCE) connections in PlatformConnection with a
 * genuine refresh_token in `refreshToken`. Legacy OAuth 1.0a connections stored
 * the user access-token secret in the same column. Consumers must distinguish
 * the two before passing credentials to TwitterSyncService.
 */

import type { PlatformCredentials } from './base-platform-service';

export type TwitterOAuthVersion = '1.0a' | '2.0';

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Resolve whether a persisted Twitter connection uses OAuth 2.0 or legacy 1.0a.
 *
 * OAuth 2.0 rows written by the integration callback carry `metadata.tokenType:
 * 'bearer'` and an `expiresAt`. Legacy OAuth 1.0a rows stored the access-token
 * secret in `refreshToken` without expiry metadata.
 */
export function resolveTwitterOAuthVersion(
  metadata: unknown,
  expiresAt?: Date | null
): TwitterOAuthVersion {
  const meta = asRecord(metadata);
  if (meta.oauthVersion === '2.0' || meta.oauthVersion === '1.0a') {
    return meta.oauthVersion;
  }
  const tokenType =
    typeof meta.tokenType === 'string' ? meta.tokenType.toLowerCase() : '';
  if (tokenType === 'bearer') return '2.0';
  if (expiresAt) return '2.0';
  return '1.0a';
}

export function isTwitterOAuth2Connection(
  metadata: unknown,
  expiresAt?: Date | null
): boolean {
  return resolveTwitterOAuthVersion(metadata, expiresAt) === '2.0';
}

export interface BuildTwitterPlatformCredentialsInput {
  accessToken: string;
  refreshTokenDecrypted?: string;
  /** OAuth 1.0a access-token secret when stored separately from refreshToken. */
  accessSecretDecrypted?: string;
  expiresAt?: Date | null;
  metadata?: unknown;
  platformUserId?: string;
  platformUsername?: string;
}

/** Map a decrypted PlatformConnection row into TwitterSyncService credentials. */
export function buildTwitterPlatformCredentials(
  input: BuildTwitterPlatformCredentialsInput
): PlatformCredentials {
  const oauthVersion = resolveTwitterOAuthVersion(
    input.metadata,
    input.expiresAt
  );

  if (oauthVersion === '2.0') {
    return {
      accessToken: input.accessToken,
      refreshToken: input.refreshTokenDecrypted,
      expiresAt: input.expiresAt ?? undefined,
      oauthVersion: '2.0',
      platformUserId: input.platformUserId,
      platformUsername: input.platformUsername,
    };
  }

  const accessSecret =
    input.accessSecretDecrypted ?? input.refreshTokenDecrypted ?? '';

  return {
    accessToken: input.accessToken,
    accessSecret,
    oauthVersion: '1.0a',
    platformUserId: input.platformUserId,
    platformUsername: input.platformUsername,
  };
}
