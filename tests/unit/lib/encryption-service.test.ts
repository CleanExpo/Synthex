/**
 * Unit Tests for API Key Encryption Service — additional coverage
 *
 * lib/encryption/api-key-encryption.ts
 *
 * Focused on the specific scenarios requested:
 * - encrypt/decrypt round-trip produces the original plaintext
 * - encrypted values are not stored as plaintext
 * - different encryption keys produce different ciphertext
 * - hashApiKey / verifyApiKey constant-time comparison behaviour
 * - maskApiKey display utility
 * - generateEncryptionKey format
 *
 * Note: tests/unit/lib/encryption.test.ts covers the same module with slightly
 * different scenarios. This file extends that coverage with key-differential
 * tests and explicit plaintext-leakage assertions.
 */

import {
  encryptApiKey,
  decryptApiKey,
  hashApiKey,
  verifyApiKey,
  maskApiKey,
  generateEncryptionKey,
} from '@/lib/encryption/api-key-encryption';

// Two distinct 64-hex-char (256-bit) keys
const KEY_V1 =
  'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
const KEY_V2 =
  'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

describe('API Key Encryption Service — encryption-service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.ENCRYPTION_KEY_V1 = KEY_V1;
    process.env.ENCRYPTION_KEY_V2 = KEY_V2;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // -------------------------------------------------------------------------
  // Round-trip correctness
  // -------------------------------------------------------------------------

  describe('encrypt / decrypt round-trip', () => {
    it('produces the original plaintext after decrypt', () => {
      const plaintext = 'sk-live-abc123xyz789';
      expect(decryptApiKey(encryptApiKey(plaintext))).toBe(plaintext);
    });

    it('handles an empty string round-trip', () => {
      expect(decryptApiKey(encryptApiKey(''))).toBe('');
    });

    it('handles unicode characters round-trip', () => {
      const unicode = 'API-key-with-émojis-😀🔑';
      expect(decryptApiKey(encryptApiKey(unicode))).toBe(unicode);
    });

    it('handles a 1000-character key round-trip', () => {
      const long = 'x'.repeat(1000);
      expect(decryptApiKey(encryptApiKey(long))).toBe(long);
    });

    it('handles newlines and tabs in the plaintext', () => {
      const withWhitespace = 'key\nwith\ttabs\n';
      expect(decryptApiKey(encryptApiKey(withWhitespace))).toBe(withWhitespace);
    });
  });

  // -------------------------------------------------------------------------
  // Encrypted values must not contain the plaintext
  // -------------------------------------------------------------------------

  describe('encrypted output does not expose plaintext', () => {
    it('the encrypted string does not contain the plaintext verbatim', () => {
      const plaintext = 'super-secret-api-key-12345';
      const encrypted = encryptApiKey(plaintext);

      expect(encrypted).not.toContain(plaintext);
    });

    it('ciphertext field is not the original value', () => {
      const plaintext = 'my-plain-key';
      const payload = JSON.parse(encryptApiKey(plaintext));

      expect(payload.ciphertext).not.toBe(plaintext);
      // ciphertext is hex-encoded so it must not equal the UTF-8 bytes
      expect(payload.ciphertext).not.toContain(plaintext);
    });

    it('iv field is not the original value', () => {
      const plaintext = 'another-key';
      const payload = JSON.parse(encryptApiKey(plaintext));

      expect(payload.iv).not.toBe(plaintext);
    });
  });

  // -------------------------------------------------------------------------
  // Different keys produce different ciphertext
  // -------------------------------------------------------------------------

  describe('different keys produce different ciphertext', () => {
    it('same plaintext encrypted under V1 and V2 keys has different ciphertexts', () => {
      const plaintext = 'shared-plaintext-for-both-keys';

      const encV1 = encryptApiKey(plaintext, 1);
      const encV2 = encryptApiKey(plaintext, 2);

      const payloadV1 = JSON.parse(encV1);
      const payloadV2 = JSON.parse(encV2);

      expect(payloadV1.ciphertext).not.toBe(payloadV2.ciphertext);
    });

    it('V1 ciphertext cannot be decrypted with V2 key (tampered version tag)', () => {
      const plaintext = 'test-value';
      const encrypted = encryptApiKey(plaintext, 1);
      const payload = JSON.parse(encrypted);

      // Override the version tag to point to a different key
      payload.version = 2;
      const tampered = JSON.stringify(payload);

      // GCM auth tag will fail because the key is wrong
      expect(() => decryptApiKey(tampered)).toThrow(
        'Failed to decrypt API key'
      );
    });

    it('each fresh encryption of the same plaintext produces a unique ciphertext (random IV)', () => {
      const plaintext = 'repeated-value';

      const enc1 = JSON.parse(encryptApiKey(plaintext, 1));
      const enc2 = JSON.parse(encryptApiKey(plaintext, 1));

      // IV should be different each time
      expect(enc1.iv).not.toBe(enc2.iv);
      // Ciphertext should therefore differ
      expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
    });

    it('both V1 and V2 encryptions decrypt to the correct plaintext', () => {
      const plaintext = 'verify-both-keys';

      expect(decryptApiKey(encryptApiKey(plaintext, 1))).toBe(plaintext);
      expect(decryptApiKey(encryptApiKey(plaintext, 2))).toBe(plaintext);
    });
  });

  // -------------------------------------------------------------------------
  // hashApiKey / verifyApiKey — constant-time comparison
  // -------------------------------------------------------------------------

  describe('hash and verify', () => {
    it('verifies the correct key against its own hash', () => {
      const key = 'sk-secret-1234';
      const { hash, salt } = hashApiKey(key);
      expect(verifyApiKey(key, hash, salt)).toBe(true);
    });

    it('rejects a different key', () => {
      const { hash, salt } = hashApiKey('correct');
      expect(verifyApiKey('wrong', hash, salt)).toBe(false);
    });

    it('rejects the same key with a different salt', () => {
      const key = 'my-key';
      const { hash } = hashApiKey(key);
      const { salt: differentSalt } = hashApiKey(key);
      expect(verifyApiKey(key, hash, differentSalt)).toBe(false);
    });

    it('hash output is not the plaintext', () => {
      const key = 'plain-key-value';
      const { hash } = hashApiKey(key);
      expect(hash).not.toBe(key);
      expect(hash).not.toContain(key);
    });

    it('produces a different hash for each call (random salt)', () => {
      const key = 'same-key';
      const r1 = hashApiKey(key);
      const r2 = hashApiKey(key);
      expect(r1.salt).not.toBe(r2.salt);
      expect(r1.hash).not.toBe(r2.hash);
    });
  });

  // -------------------------------------------------------------------------
  // maskApiKey display utility
  // -------------------------------------------------------------------------

  describe('maskApiKey', () => {
    it('masks all but the last 4 characters', () => {
      const plaintext = 'sk-0123456789abcdef'; // 19 chars
      const masked = maskApiKey(plaintext);
      // 19 - 4 = 15 asterisks, then last 4 visible chars
      expect(masked).toBe('***************cdef');
      expect(masked.length).toBe(plaintext.length);
    });

    it('custom visible-char count is respected', () => {
      const masked = maskApiKey('abcdefgh', 3);
      expect(masked.endsWith('fgh')).toBe(true);
    });

    it('never returns the full plaintext', () => {
      const key = 'visible-secret-key';
      const masked = maskApiKey(key);
      expect(masked).not.toBe(key);
    });
  });

  // -------------------------------------------------------------------------
  // generateEncryptionKey utility
  // -------------------------------------------------------------------------

  describe('generateEncryptionKey', () => {
    it('produces a 64-character lowercase hex string', () => {
      const key = generateEncryptionKey();
      expect(key).toHaveLength(64);
      expect(key).toMatch(/^[0-9a-f]{64}$/);
    });

    it('each call returns a unique key', () => {
      const k1 = generateEncryptionKey();
      const k2 = generateEncryptionKey();
      expect(k1).not.toBe(k2);
    });

    it('the generated key can be used to encrypt and decrypt', () => {
      const rawKey = generateEncryptionKey();
      process.env.ENCRYPTION_KEY_V9 = rawKey;

      const plaintext = 'test-with-generated-key';
      const encrypted = encryptApiKey(plaintext, 9);
      const decrypted = decryptApiKey(encrypted);

      expect(decrypted).toBe(plaintext);

      delete process.env.ENCRYPTION_KEY_V9;
    });
  });
});
