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
    return {
      ok: false,
      reason:
        error instanceof Error
          ? `Platform token could not be decrypted: ${error.message}`
          : 'Platform token could not be decrypted',
    };
  }

  if (isPlaceholderPlatformToken(accessToken)) {
    return { ok: false, reason: 'Platform connection is pending OAuth' };
  }

  return { ok: true, accessToken: accessToken ?? undefined };
}
