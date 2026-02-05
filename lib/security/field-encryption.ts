/**
 * Field-Level Encryption for Sensitive Database Fields
 *
 * Uses AES-256-GCM for authenticated encryption of sensitive data
 * like OAuth tokens and API keys stored in the database.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - FIELD_ENCRYPTION_KEY: 32-byte hex-encoded key (64 chars) (CRITICAL)
 *   Generate with: openssl rand -hex 32
 *
 * FAILURE MODE: Operations will throw if key is missing/invalid
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// Constants
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

// Prefix to identify encrypted values
const ENCRYPTED_PREFIX = 'enc:v1:';

/**
 * Get the encryption key from environment
 * @throws Error if key is missing or invalid
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.FIELD_ENCRYPTION_KEY;

  if (!keyHex) {
    throw new Error(
      'FIELD_ENCRYPTION_KEY environment variable is required for field encryption. ' +
      'Generate with: openssl rand -hex 32'
    );
  }

  if (keyHex.length !== 64) {
    throw new Error(
      `FIELD_ENCRYPTION_KEY must be 64 hex characters (32 bytes). Got ${keyHex.length} characters.`
    );
  }

  const key = Buffer.from(keyHex, 'hex');

  if (key.length !== KEY_LENGTH) {
    throw new Error('FIELD_ENCRYPTION_KEY is not valid hex encoding.');
  }

  return key;
}

/**
 * Encrypt a plaintext value using AES-256-GCM
 *
 * @param plaintext - The value to encrypt
 * @returns Encrypted value with format: enc:v1:<iv>:<authTag>:<ciphertext>
 * @throws Error if encryption fails or key is invalid
 *
 * @example
 * const encrypted = encryptField('my-secret-token');
 * // Returns: "enc:v1:abc123...:def456...:xyz789..."
 */
export function encryptField(plaintext: string | null | undefined): string | null {
  if (plaintext === null || plaintext === undefined || plaintext === '') {
    return null;
  }

  // Don't re-encrypt already encrypted values
  if (plaintext.startsWith(ENCRYPTED_PREFIX)) {
    return plaintext;
  }

  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Format: enc:v1:<iv>:<authTag>:<ciphertext>
  return `${ENCRYPTED_PREFIX}${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
}

/**
 * Decrypt an encrypted value using AES-256-GCM
 *
 * @param encrypted - The encrypted value to decrypt
 * @returns Decrypted plaintext value
 * @throws Error if decryption fails, value is tampered, or key is invalid
 *
 * @example
 * const plaintext = decryptField(encryptedValue);
 * // Returns: "my-secret-token"
 */
export function decryptField(encrypted: string | null | undefined): string | null {
  if (encrypted === null || encrypted === undefined || encrypted === '') {
    return null;
  }

  // Return unencrypted values as-is (for backwards compatibility during migration)
  if (!encrypted.startsWith(ENCRYPTED_PREFIX)) {
    console.warn('[FieldEncryption] Detected unencrypted value, returning as-is. Run migration to encrypt.');
    return encrypted;
  }

  const key = getEncryptionKey();

  // Parse the encrypted format
  const withoutPrefix = encrypted.slice(ENCRYPTED_PREFIX.length);
  const parts = withoutPrefix.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format. Expected enc:v1:<iv>:<authTag>:<ciphertext>');
  }

  const [ivBase64, authTagBase64, ciphertextBase64] = parts;

  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  const ciphertext = Buffer.from(ciphertextBase64, 'base64');

  // Validate lengths
  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: ${iv.length}, expected ${IV_LENGTH}`);
  }

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`Invalid auth tag length: ${authTag.length}, expected ${AUTH_TAG_LENGTH}`);
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  decipher.setAuthTag(authTag);

  try {
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return plaintext.toString('utf8');
  } catch (error) {
    if (error instanceof Error && error instanceof Error ? error.message : String(error).includes('Unsupported state')) {
      throw new Error('Decryption failed: Invalid authentication tag. Data may be corrupted or tampered.');
    }
    throw error;
  }
}

/**
 * Check if a value is encrypted
 */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
}

/**
 * Safely encrypt a field, handling errors gracefully
 * Returns null on error instead of throwing
 */
export function encryptFieldSafe(plaintext: string | null | undefined): string | null {
  try {
    return encryptField(plaintext);
  } catch (error) {
    console.error('[FieldEncryption] Encryption failed:', error);
    return null;
  }
}

/**
 * Safely decrypt a field, handling errors gracefully
 * Returns the original value on error instead of throwing
 */
export function decryptFieldSafe(encrypted: string | null | undefined): string | null {
  try {
    return decryptField(encrypted);
  } catch (error) {
    console.error('[FieldEncryption] Decryption failed:', error);
    // Return original value if decryption fails (may be unencrypted legacy data)
    return encrypted ?? null;
  }
}

/**
 * Validate that field encryption is properly configured
 * Call this at application startup
 */
export function validateEncryptionConfig(): { valid: boolean; error?: string } {
  try {
    getEncryptionKey();

    // Test encryption/decryption round-trip
    const testValue = 'encryption-test-' + Date.now();
    const encrypted = encryptField(testValue);
    const decrypted = decryptField(encrypted);

    if (decrypted !== testValue) {
      return { valid: false, error: 'Encryption round-trip test failed' };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Unknown encryption config error'
    };
  }
}
