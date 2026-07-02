import { decryptApiKey } from '@/lib/encryption/api-key-encryption';
import { decryptField } from '@/lib/security/field-encryption';

const FIELD_ENCRYPTION_PREFIX = 'enc:v1:';
const PLACEHOLDER_TOKENS = new Set([
  'PENDING_OAUTH',
  'PENDING_CONNECTION',
  'PENDING_TOKEN',
  'PLACEHOLDER',
  'TODO',
  'TBD',
]);

export interface PlatformTokenReadiness {
  ok: boolean;
  accessToken?: string;
  reason?: string;
  /**
   * True when a stored, non-placeholder token EXISTS but could not be
   * decrypted — i.e. the encryption key is wrong/rotated/missing. This is
   * distinct from "no token / pending OAuth": the account WAS connected, the
   * key just changed underneath it. Callers must surface this as a
   * "reconnect needed / key mismatch" signal, NOT as a silent "not connected".
   */
  keyMismatch?: boolean;
}

export function isPlaceholderPlatformToken(
  value: string | null | undefined
): boolean {
  if (!value) return true;
  const normalised = value.trim().toUpperCase();
  return (
    normalised === '' ||
    PLACEHOLDER_TOKENS.has(normalised) ||
    normalised.startsWith('PENDING_')
  );
}

export function resolvePlatformAccessToken(
  storedToken: string | null | undefined
): PlatformTokenReadiness {
  if (!storedToken) {
    return { ok: false, reason: 'Missing platform access token' };
  }

  if (isPlaceholderPlatformToken(storedToken)) {
    return { ok: false, reason: 'Platform connection is pending OAuth' };
  }

  let accessToken: string | null = null;

  try {
    if (storedToken.startsWith(FIELD_ENCRYPTION_PREFIX)) {
      accessToken = decryptField(storedToken);
    } else if (storedToken.trim().startsWith('{')) {
      accessToken = decryptApiKey(storedToken);
    } else {
      accessToken = storedToken;
    }
  } catch (error) {
    // A stored, non-placeholder ciphertext that won't decrypt means the
    // encryption key is wrong/rotated/missing — the connection is NOT absent,
    // it is undecryptable. Flag keyMismatch so callers surface "reconnect
    // needed" instead of silently treating it as no-connection.
    return {
      ok: false,
      keyMismatch: true,
      reason:
        error instanceof Error
          ? `Platform token could not be decrypted (encryption key mismatch?): ${error.message}`
          : 'Platform token could not be decrypted (encryption key mismatch?)',
    };
  }

  if (isPlaceholderPlatformToken(accessToken)) {
    return { ok: false, reason: 'Platform connection is pending OAuth' };
  }

  return { ok: true, accessToken: accessToken ?? undefined };
}
