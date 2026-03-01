/**
 * Unit Tests for API Key Encryption Service
 * Tests encrypt/decrypt roundtrip, hash/verify, mask, key generation, error cases
 *
 * Tests actual crypto operations — no mocking needed for the core crypto functions.
 * Only process.env is manipulated to control encryption key availability.
 */

import {
  encryptApiKey,
  decryptApiKey,
  hashApiKey,
  verifyApiKey,
  maskApiKey,
  generateEncryptionKey,
} from '@/lib/encryption/api-key-encryption';

// A valid 64-hex-char key (32 bytes = 256 bits)
const TEST_KEY = 'a'.repeat(64);

describe('API Key Encryption Service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clone env so we can safely mutate it
    process.env = { ...originalEnv };
    process.env.ENCRYPTION_KEY_V1 = TEST_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // =========================================================================
  // encryptApiKey / decryptApiKey roundtrip
  // =========================================================================
  describe('encryptApiKey + decryptApiKey roundtrip', () => {
    it('should encrypt and decrypt a simple API key', () => {
      const plaintext = 'sk-abc123xyz';
      const encrypted = encryptApiKey(plaintext);
      const decrypted = decryptApiKey(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt an empty string', () => {
      const encrypted = encryptApiKey('');
      const decrypted = decryptApiKey(encrypted);

      expect(decrypted).toBe('');
    });

    it('should encrypt and decrypt a long API key', () => {
      const longKey = 'sk-' + 'x'.repeat(500);
      const encrypted = encryptApiKey(longKey);
      const decrypted = decryptApiKey(encrypted);

      expect(decrypted).toBe(longKey);
    });

    it('should encrypt and decrypt special characters', () => {
      const specialKey = 'key_with+special/chars=and&symbols!@#$%';
      const encrypted = encryptApiKey(specialKey);
      const decrypted = decryptApiKey(encrypted);

      expect(decrypted).toBe(specialKey);
    });

    it('should produce different ciphertexts for same plaintext (random IV)', () => {
      const plaintext = 'sk-same-key';
      const encrypted1 = encryptApiKey(plaintext);
      const encrypted2 = encryptApiKey(plaintext);

      // Different encryptions of the same plaintext should differ (random IV + salt)
      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to the same value
      expect(decryptApiKey(encrypted1)).toBe(plaintext);
      expect(decryptApiKey(encrypted2)).toBe(plaintext);
    });

    it('should produce valid JSON with expected fields', () => {
      const encrypted = encryptApiKey('test-key');
      const payload = JSON.parse(encrypted);

      expect(payload).toHaveProperty('iv');
      expect(payload).toHaveProperty('ciphertext');
      expect(payload).toHaveProperty('authTag');
      expect(payload).toHaveProperty('salt');
      expect(payload).toHaveProperty('version');
      expect(payload.version).toBe(1);
    });
  });

  // =========================================================================
  // Key versioning
  // =========================================================================
  describe('key versioning', () => {
    it('should encrypt with specified key version', () => {
      process.env.ENCRYPTION_KEY_V2 = 'b'.repeat(64);

      const encrypted = encryptApiKey('test-key', 2);
      const payload = JSON.parse(encrypted);

      expect(payload.version).toBe(2);

      // Should decrypt with the correct version key
      const decrypted = decryptApiKey(encrypted);
      expect(decrypted).toBe('test-key');
    });

    it('should throw when encryption key version is not set', () => {
      expect(() => encryptApiKey('test', 99)).toThrow(
        'Encryption key version 99 not found'
      );
    });

    it('should throw when encryption key has wrong length', () => {
      process.env.ENCRYPTION_KEY_V3 = 'short';

      expect(() => encryptApiKey('test', 3)).toThrow(
        'Invalid encryption key length'
      );
    });
  });

  // =========================================================================
  // decryptApiKey error cases
  // =========================================================================
  describe('decryptApiKey error cases', () => {
    it('should throw on invalid JSON input', () => {
      expect(() => decryptApiKey('not-json')).toThrow('Failed to decrypt API key');
    });

    it('should throw on tampered ciphertext', () => {
      const encrypted = encryptApiKey('original');
      const payload = JSON.parse(encrypted);
      payload.ciphertext = 'tampered' + payload.ciphertext;
      const tampered = JSON.stringify(payload);

      expect(() => decryptApiKey(tampered)).toThrow('Failed to decrypt API key');
    });

    it('should throw on tampered auth tag', () => {
      const encrypted = encryptApiKey('original');
      const payload = JSON.parse(encrypted);
      // Change the auth tag to invalidate GCM authentication
      payload.authTag = Buffer.from('x'.repeat(16)).toString('base64');
      const tampered = JSON.stringify(payload);

      expect(() => decryptApiKey(tampered)).toThrow('Failed to decrypt API key');
    });

    it('should throw when decryption key is missing', () => {
      const encrypted = encryptApiKey('test');
      const payload = JSON.parse(encrypted);
      payload.version = 42; // Reference a key version that doesn't exist
      const modified = JSON.stringify(payload);

      expect(() => decryptApiKey(modified)).toThrow('Failed to decrypt API key');
    });
  });

  // =========================================================================
  // hashApiKey / verifyApiKey
  // =========================================================================
  describe('hashApiKey + verifyApiKey', () => {
    it('should hash and verify an API key', () => {
      const plaintext = 'sk-secret-key-123';
      const { hash, salt } = hashApiKey(plaintext);

      expect(hash).toBeDefined();
      expect(salt).toBeDefined();
      expect(hash).not.toBe(plaintext);

      expect(verifyApiKey(plaintext, hash, salt)).toBe(true);
    });

    it('should reject incorrect plaintext', () => {
      const { hash, salt } = hashApiKey('correct-key');

      expect(verifyApiKey('wrong-key', hash, salt)).toBe(false);
    });

    it('should reject wrong salt', () => {
      const { hash } = hashApiKey('my-key');

      expect(verifyApiKey('my-key', hash, 'wrong-salt')).toBe(false);
    });

    it('should produce different hashes for same input (random salt)', () => {
      const result1 = hashApiKey('same-key');
      const result2 = hashApiKey('same-key');

      // Different salts mean different hashes
      expect(result1.salt).not.toBe(result2.salt);
      expect(result1.hash).not.toBe(result2.hash);

      // But both verify correctly against their own salt
      expect(verifyApiKey('same-key', result1.hash, result1.salt)).toBe(true);
      expect(verifyApiKey('same-key', result2.hash, result2.salt)).toBe(true);
    });
  });

  // =========================================================================
  // maskApiKey
  // =========================================================================
  describe('maskApiKey', () => {
    it('should mask all but last 4 characters by default', () => {
      const masked = maskApiKey('sk-1234567890abcdef');

      expect(masked).toBe('***************cdef');
      expect(masked.length).toBe('sk-1234567890abcdef'.length);
    });

    it('should respect custom visibleChars parameter', () => {
      const masked = maskApiKey('sk-1234567890', 6);

      expect(masked).toBe('*******567890');
    });

    it('should handle very short keys', () => {
      const masked = maskApiKey('ab', 4);

      // When plaintext.length <= visibleChars, uses fallback logic
      expect(masked).toContain('*');
      expect(masked[masked.length - 1]).toBe('b');
    });

    it('should handle single character key', () => {
      const masked = maskApiKey('x');

      expect(masked).toContain('*');
      expect(masked[masked.length - 1]).toBe('x');
    });
  });

  // =========================================================================
  // generateEncryptionKey
  // =========================================================================
  describe('generateEncryptionKey', () => {
    it('should generate a 64-character hex string', () => {
      const key = generateEncryptionKey();

      expect(key).toHaveLength(64);
      expect(key).toMatch(/^[0-9a-f]+$/);
    });

    it('should generate unique keys', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();

      expect(key1).not.toBe(key2);
    });
  });
});
