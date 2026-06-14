/**
 * Encryption Key Enforcement & Self-Test
 *
 * Synthex encrypts connected-account OAuth tokens at rest with AES-256-GCM.
 * There are THREE non-interchangeable encryption keys, each owned by a
 * different util and each used to encrypt a different class of secret:
 *
 *   1. FIELD_ENCRYPTION_KEY   → lib/security/field-encryption.ts
 *      Encrypts OAuth access/refresh tokens (the `enc:v1:` field format).
 *      This is THE key for the team's connected social accounts.
 *
 *   2. ENCRYPTION_KEY_V1      → lib/encryption/api-key-encryption.ts
 *      Encrypts stored API keys (JSON `{iv,ciphertext,authTag,...}` format).
 *
 *   3. ENCRYPTION_KEY         → lib/encryption.ts (via lib/supabase.ts)
 *      Encrypts legacy social-integration credentials.
 *
 * WHY THIS MODULE EXISTS — the silent-drop failure mode:
 * Format validation alone (correct length / hex) is NOT enough. A key that is
 * the right shape but the WRONG VALUE (rotated, swapped between environments,
 * or copy-pasted from another key) passes every format check yet fails to
 * decrypt existing ciphertext. Without a round-trip self-test that failure is
 * silent: stored tokens can no longer be decrypted, every connected account
 * reads back as "not connected", and nobody sees an error.
 *
 * This module adds an encrypt→decrypt round-trip self-test per key so a wrong
 * key is detected at startup and surfaced LOUDLY, instead of silently dropping
 * every connection.
 *
 * SECURITY: never logs key material. Self-test uses a throwaway sentinel value.
 */

import { encryptField, decryptField } from '@/lib/security/field-encryption';
import {
  encryptApiKey,
  decryptApiKey,
} from '@/lib/encryption/api-key-encryption';
import { encrypt, decrypt } from '@/lib/encryption';

/** Sentinel value used for the round-trip self-test. Not a secret. */
const SELF_TEST_PLAINTEXT = 'synthex-encryption-self-test';

export interface EncryptionKeyCheck {
  /** Canonical env var name for this key. */
  key: string;
  /** Human-readable description of what this key protects. */
  purpose: string;
  /** Whether the env var is set at all. */
  present: boolean;
  /** Whether the value is well-formed (correct length/format). */
  wellFormed: boolean;
  /** Whether an encrypt→decrypt round-trip succeeds with this key. */
  selfTestPassed: boolean;
  /** True when the key passes presence + format + round-trip. */
  ok: boolean;
  /**
   * Failure reason, safe to log (never contains key material).
   * Undefined when ok === true.
   */
  reason?: string;
  /** Whether this key is required for the app to function correctly. */
  required: boolean;
}

export interface EncryptionKeysReport {
  ok: boolean;
  checks: EncryptionKeyCheck[];
  /** Keys that are required but failed (present/format/round-trip). */
  failedRequired: string[];
}

const HEX_64 = /^[A-Fa-f0-9]{64}$/;

/**
 * Validate FIELD_ENCRYPTION_KEY — the OAuth-token key.
 * Required. Must be 64 hex chars and must round-trip via field-encryption.
 */
function checkFieldEncryptionKey(): EncryptionKeyCheck {
  const purpose = 'OAuth access/refresh token encryption (connected accounts)';
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  const present = !!raw;

  if (!present) {
    return {
      key: 'FIELD_ENCRYPTION_KEY',
      purpose,
      present: false,
      wellFormed: false,
      selfTestPassed: false,
      ok: false,
      required: true,
      reason: 'FIELD_ENCRYPTION_KEY is missing. Generate with: openssl rand -hex 32',
    };
  }

  const wellFormed = HEX_64.test(raw!) && !/^0+$/.test(raw!);
  if (!wellFormed) {
    return {
      key: 'FIELD_ENCRYPTION_KEY',
      purpose,
      present: true,
      wellFormed: false,
      selfTestPassed: false,
      ok: false,
      required: true,
      reason: `FIELD_ENCRYPTION_KEY is malformed (expected 64 hex chars, got ${raw!.length}, non-zero). Generate with: openssl rand -hex 32`,
    };
  }

  // Round-trip self-test: encrypt then decrypt a sentinel value.
  try {
    const encrypted = encryptField(SELF_TEST_PLAINTEXT);
    const decrypted = decryptField(encrypted);
    const selfTestPassed = decrypted === SELF_TEST_PLAINTEXT;
    return {
      key: 'FIELD_ENCRYPTION_KEY',
      purpose,
      present: true,
      wellFormed: true,
      selfTestPassed,
      ok: selfTestPassed,
      required: true,
      reason: selfTestPassed
        ? undefined
        : 'FIELD_ENCRYPTION_KEY round-trip self-test failed: decrypt did not return the original value.',
    };
  } catch (error) {
    return {
      key: 'FIELD_ENCRYPTION_KEY',
      purpose,
      present: true,
      wellFormed: true,
      selfTestPassed: false,
      ok: false,
      required: true,
      reason: `FIELD_ENCRYPTION_KEY round-trip self-test threw: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

/**
 * Validate ENCRYPTION_KEY_V1 — the stored-API-key key.
 * Required. Must be 64 hex chars and must round-trip via api-key-encryption.
 */
function checkApiKeyEncryptionKey(): EncryptionKeyCheck {
  const purpose = 'Stored API key encryption';
  const raw = process.env.ENCRYPTION_KEY_V1?.trim();
  const present = !!raw;

  if (!present) {
    return {
      key: 'ENCRYPTION_KEY_V1',
      purpose,
      present: false,
      wellFormed: false,
      selfTestPassed: false,
      ok: false,
      required: true,
      reason: 'ENCRYPTION_KEY_V1 is missing. Generate with: openssl rand -hex 32',
    };
  }

  const wellFormed = HEX_64.test(raw!) && !/^0+$/.test(raw!);
  if (!wellFormed) {
    return {
      key: 'ENCRYPTION_KEY_V1',
      purpose,
      present: true,
      wellFormed: false,
      selfTestPassed: false,
      ok: false,
      required: true,
      reason: `ENCRYPTION_KEY_V1 is malformed (expected 64 hex chars, got ${raw!.length}, non-zero). Generate with: openssl rand -hex 32`,
    };
  }

  try {
    const encrypted = encryptApiKey(SELF_TEST_PLAINTEXT, 1);
    const decrypted = decryptApiKey(encrypted);
    const selfTestPassed = decrypted === SELF_TEST_PLAINTEXT;
    return {
      key: 'ENCRYPTION_KEY_V1',
      purpose,
      present: true,
      wellFormed: true,
      selfTestPassed,
      ok: selfTestPassed,
      required: true,
      reason: selfTestPassed
        ? undefined
        : 'ENCRYPTION_KEY_V1 round-trip self-test failed: decrypt did not return the original value.',
    };
  } catch (error) {
    return {
      key: 'ENCRYPTION_KEY_V1',
      purpose,
      present: true,
      wellFormed: true,
      selfTestPassed: false,
      ok: false,
      required: true,
      reason: `ENCRYPTION_KEY_V1 round-trip self-test threw: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

/**
 * Validate ENCRYPTION_KEY — the legacy social-integration credential key.
 * Required (env-validator marks it CRITICAL). Must round-trip via lib/encryption.
 *
 * NOTE: lib/encryption.ts pads/truncates any string to 32 bytes, so it never
 * throws on a malformed key — which is exactly why a round-trip self-test is
 * essential here: a wrong key "succeeds" at encrypt but produces ciphertext
 * that will not decrypt against real stored data.
 */
function checkLegacyEncryptionKey(): EncryptionKeyCheck {
  const purpose = 'Legacy social-integration credential encryption';
  const raw = process.env.ENCRYPTION_KEY;
  const present = !!raw;

  if (!present) {
    return {
      key: 'ENCRYPTION_KEY',
      purpose,
      present: false,
      wellFormed: false,
      selfTestPassed: false,
      ok: false,
      required: true,
      reason: 'ENCRYPTION_KEY is missing. Generate with: openssl rand -hex 32',
    };
  }

  // lib/encryption pads to 32 bytes, so any non-empty value is "usable", but a
  // too-short / all-zero key is still a misconfiguration worth flagging.
  const wellFormed = raw!.length >= 16 && !/^0+$/.test(raw!);
  if (!wellFormed) {
    return {
      key: 'ENCRYPTION_KEY',
      purpose,
      present: true,
      wellFormed: false,
      selfTestPassed: false,
      ok: false,
      required: true,
      reason: `ENCRYPTION_KEY is too weak (got ${raw!.length} chars; need >=16, non-zero). Generate with: openssl rand -hex 32`,
    };
  }

  try {
    const encrypted = encrypt(SELF_TEST_PLAINTEXT, raw!);
    const decrypted = decrypt(encrypted, raw!);
    const selfTestPassed = decrypted === SELF_TEST_PLAINTEXT;
    return {
      key: 'ENCRYPTION_KEY',
      purpose,
      present: true,
      wellFormed: true,
      selfTestPassed,
      ok: selfTestPassed,
      required: true,
      reason: selfTestPassed
        ? undefined
        : 'ENCRYPTION_KEY round-trip self-test failed: decrypt did not return the original value.',
    };
  } catch (error) {
    return {
      key: 'ENCRYPTION_KEY',
      purpose,
      present: true,
      wellFormed: true,
      selfTestPassed: false,
      ok: false,
      required: true,
      reason: `ENCRYPTION_KEY round-trip self-test threw: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

/**
 * Validate all encryption keys: presence + format + encrypt→decrypt round-trip.
 *
 * This is the LOUD replacement for the silent failure mode. Call at startup
 * (instrumentation.ts) and from a health endpoint. Detects a wrong/rotated key
 * that format checks alone would miss.
 *
 * Never logs key material. The returned reasons are safe to log.
 */
export function validateEncryptionKeys(): EncryptionKeysReport {
  const checks: EncryptionKeyCheck[] = [
    checkFieldEncryptionKey(),
    checkApiKeyEncryptionKey(),
    checkLegacyEncryptionKey(),
  ];

  const failedRequired = checks
    .filter(c => c.required && !c.ok)
    .map(c => c.key);

  return {
    ok: failedRequired.length === 0,
    checks,
    failedRequired,
  };
}

/**
 * Assert all encryption keys are valid, throwing a clear error if not.
 * Use in contexts where a hard fail is appropriate (e.g. CLI scripts, tests).
 * Do NOT use inside Next.js instrumentation register() — that must not throw.
 *
 * The thrown message lists the failing key NAMES and reasons, never values.
 */
export function assertEncryptionKeysValid(): void {
  const report = validateEncryptionKeys();
  if (report.ok) return;

  const detail = report.checks
    .filter(c => !c.ok)
    .map(c => `  - ${c.key}: ${c.reason}`)
    .join('\n');

  throw new Error(
    `Encryption key validation failed for: ${report.failedRequired.join(
      ', '
    )}.\n${detail}\n` +
      'A wrong or rotated key silently drops every connected account. ' +
      'Fix the key(s) above before serving traffic.'
  );
}
