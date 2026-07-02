/**
 * Unit Tests for Encryption Key Enforcement & Self-Test
 *
 * lib/security/encryption-keys.ts + lib/platform-connections/token-readiness.ts
 *
 * Covers the P1 silent-drop fix:
 * - missing key            → not ok, clear reason (no key material logged)
 * - wrong-length/malformed → not ok, clear reason
 * - WRONG-value key on stored ciphertext → surfaced as keyMismatch, NOT silent null
 * - correct key            → round-trip self-test passes
 * - assertEncryptionKeysValid throws a clear error naming the failing key
 */

import {
  validateEncryptionKeys,
  assertEncryptionKeysValid,
} from '@/lib/security/encryption-keys';
import { encryptField } from '@/lib/security/field-encryption';
import { resolvePlatformAccessToken } from '@/lib/platform-connections/token-readiness';

// Two distinct valid 64-hex-char (256-bit) keys
const GOOD_KEY_A =
  'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
const GOOD_KEY_B =
  'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
const LEGACY_KEY = 'a-strong-legacy-encryption-key-value';

function setAllGoodKeys() {
  process.env.FIELD_ENCRYPTION_KEY = GOOD_KEY_A;
  process.env.ENCRYPTION_KEY_V1 = GOOD_KEY_A;
  process.env.ENCRYPTION_KEY = LEGACY_KEY;
}

describe('encryption key validation (P1 silent-drop enforcement)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clone env so we can mutate freely without leaking between tests
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // -------------------------------------------------------------------------
  // Correct keys → all green
  // -------------------------------------------------------------------------
  describe('correct keys', () => {
    it('passes presence + format + round-trip for all three keys', () => {
      setAllGoodKeys();
      const report = validateEncryptionKeys();

      expect(report.ok).toBe(true);
      expect(report.failedRequired).toHaveLength(0);
      for (const check of report.checks) {
        expect(check.present).toBe(true);
        expect(check.wellFormed).toBe(true);
        expect(check.selfTestPassed).toBe(true);
        expect(check.ok).toBe(true);
      }
    });

    it('assertEncryptionKeysValid does not throw when keys are valid', () => {
      setAllGoodKeys();
      expect(() => assertEncryptionKeysValid()).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Missing key → clear, loud failure
  // -------------------------------------------------------------------------
  describe('missing key', () => {
    it('flags a missing FIELD_ENCRYPTION_KEY as a required failure', () => {
      setAllGoodKeys();
      delete process.env.FIELD_ENCRYPTION_KEY;

      const report = validateEncryptionKeys();
      expect(report.ok).toBe(false);
      expect(report.failedRequired).toContain('FIELD_ENCRYPTION_KEY');

      const check = report.checks.find(c => c.key === 'FIELD_ENCRYPTION_KEY')!;
      expect(check.present).toBe(false);
      expect(check.ok).toBe(false);
      expect(check.reason).toMatch(/missing/i);
    });

    it('flags a missing ENCRYPTION_KEY_V1 as a required failure', () => {
      setAllGoodKeys();
      delete process.env.ENCRYPTION_KEY_V1;

      const report = validateEncryptionKeys();
      expect(report.ok).toBe(false);
      expect(report.failedRequired).toContain('ENCRYPTION_KEY_V1');
    });

    it('assertEncryptionKeysValid throws a clear error naming the missing key', () => {
      setAllGoodKeys();
      delete process.env.FIELD_ENCRYPTION_KEY;

      expect(() => assertEncryptionKeysValid()).toThrow(/FIELD_ENCRYPTION_KEY/);
      // Error must explain the silent-drop risk, not just say "invalid"
      expect(() => assertEncryptionKeysValid()).toThrow(
        /silently drops|connected account/i
      );
    });
  });

  // -------------------------------------------------------------------------
  // Wrong-length / malformed key → clear failure
  // -------------------------------------------------------------------------
  describe('malformed key', () => {
    it('flags a wrong-length FIELD_ENCRYPTION_KEY', () => {
      setAllGoodKeys();
      process.env.FIELD_ENCRYPTION_KEY = 'tooshort';

      const report = validateEncryptionKeys();
      const check = report.checks.find(c => c.key === 'FIELD_ENCRYPTION_KEY')!;
      expect(check.wellFormed).toBe(false);
      expect(check.ok).toBe(false);
      expect(check.reason).toMatch(/64 hex|malformed/i);
    });

    it('flags an all-zeros FIELD_ENCRYPTION_KEY', () => {
      setAllGoodKeys();
      process.env.FIELD_ENCRYPTION_KEY = '0'.repeat(64);

      const report = validateEncryptionKeys();
      const check = report.checks.find(c => c.key === 'FIELD_ENCRYPTION_KEY')!;
      expect(check.ok).toBe(false);
    });

    it('never includes raw key material in the failure reason', () => {
      setAllGoodKeys();
      const secret = 'b'.repeat(64);
      process.env.FIELD_ENCRYPTION_KEY = secret.slice(0, 10); // malformed but recognisable

      const report = validateEncryptionKeys();
      const check = report.checks.find(c => c.key === 'FIELD_ENCRYPTION_KEY')!;
      // Reason reports the length, never the value itself
      expect(check.reason).not.toContain(secret.slice(0, 10));
    });
  });

  // -------------------------------------------------------------------------
  // WRONG-value key on a STORED ciphertext → surfaced, not silent
  // -------------------------------------------------------------------------
  describe('wrong key on stored ciphertext (the silent-drop scenario)', () => {
    it('a token encrypted with key A cannot be decrypted with key B, and is flagged keyMismatch (not silent null)', () => {
      // 1. Encrypt a token with key A (simulates what is stored in the DB)
      process.env.FIELD_ENCRYPTION_KEY = GOOD_KEY_A;
      const storedCiphertext = encryptField('real-oauth-access-token')!;
      expect(storedCiphertext).toMatch(/^enc:v1:/);

      // 2. Key gets rotated/swapped to a DIFFERENT valid key (key B)
      process.env.FIELD_ENCRYPTION_KEY = GOOD_KEY_B;

      // 3. Reading the stored token must NOT silently look like "no connection".
      const readiness = resolvePlatformAccessToken(storedCiphertext);

      expect(readiness.ok).toBe(false);
      expect(readiness.keyMismatch).toBe(true); // distinct from missing token
      expect(readiness.accessToken).toBeUndefined();
      expect(readiness.reason).toMatch(/decrypt|key mismatch/i);
    });

    it('a genuinely missing token is NOT flagged as keyMismatch', () => {
      const readiness = resolvePlatformAccessToken(null);
      expect(readiness.ok).toBe(false);
      expect(readiness.keyMismatch).toBeUndefined();
      expect(readiness.reason).toMatch(/missing/i);
    });

    it('a pending-OAuth placeholder is NOT flagged as keyMismatch', () => {
      const readiness = resolvePlatformAccessToken('PENDING_OAUTH');
      expect(readiness.ok).toBe(false);
      expect(readiness.keyMismatch).toBeUndefined();
    });

    it('the correct key decrypts the stored token cleanly', () => {
      process.env.FIELD_ENCRYPTION_KEY = GOOD_KEY_A;
      const storedCiphertext = encryptField('real-oauth-access-token')!;

      const readiness = resolvePlatformAccessToken(storedCiphertext);
      expect(readiness.ok).toBe(true);
      expect(readiness.keyMismatch).toBeUndefined();
      expect(readiness.accessToken).toBe('real-oauth-access-token');
    });
  });
});
