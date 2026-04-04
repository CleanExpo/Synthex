/**
 * API Key Encryption Service
 *
 * Handles AES-256-GCM encryption of sensitive API keys at rest.
 * Uses rotating encryption keys for key versioning support.
 *
 * Security features:
 * - AES-256-GCM authenticated encryption
 * - Random IV per encryption operation
 * - Key versioning for rotation support
 * - Constant-time comparison for validation
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;  // 128 bits
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Encryption keys indexed by version
 * In production, these should be stored in a secure key management service (e.g., AWS KMS)
 * For now, they're read from environment variables
 */
function getEncryptionKey(version: number = 1): Buffer {
  const keyEnv = process.env[`ENCRYPTION_KEY_V${version}`]?.trim();
  if (!keyEnv) {
    throw new Error(`Encryption key version ${version} not found in environment`);
  }

  // Key should be 64 hex characters (256 bits = 32 bytes)
  if (keyEnv.length !== 64) {
    throw new Error(
      `Invalid encryption key length for version ${version}. Expected 64 hex characters, got ${keyEnv.length}`
    );
  }

  return Buffer.from(keyEnv, 'hex');
}

interface EncryptedPayload {
  iv: string;        // Base64
  ciphertext: string; // Base64
  authTag: string;    // Base64
  salt: string;       // Base64 (used for key derivation if needed)
  version: number;    // Key version
}

/**
 * Encrypt an API key
 * Returns a JSON object with encrypted data + metadata
 */
export function encryptApiKey(plaintext: string, keyVersion: number = 1): string {
  try {
    const key = getEncryptionKey(keyVersion);
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    const payload: EncryptedPayload = {
      iv: iv.toString('base64'),
      ciphertext: encrypted,
      authTag: authTag.toString('base64'),
      salt: salt.toString('base64'),
      version: keyVersion,
    };

    return JSON.stringify(payload);
  } catch (error) {
    throw new Error(`Failed to encrypt API key: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Decrypt an API key
 * Expects encrypted data in the format returned by encryptApiKey
 */
export function decryptApiKey(encrypted: string): string {
  try {
    const payload: EncryptedPayload = JSON.parse(encrypted);

    const key = getEncryptionKey(payload.version);
    const iv = Buffer.from(payload.iv, 'base64');
    const ciphertext = Buffer.from(payload.ciphertext, 'hex');
    const authTag = Buffer.from(payload.authTag, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext).toString('utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    throw new Error(`Failed to decrypt API key: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Hash an API key for storage/comparison
 * Uses SHA-256 with salt for one-way hashing
 */
export function hashApiKey(plaintext: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(SALT_LENGTH).toString('base64');
  const hash = crypto
    .pbkdf2Sync(plaintext, salt, 100000, 32, 'sha256')
    .toString('base64');

  return { hash, salt };
}

/**
 * Verify an API key against a stored hash
 * Constant-time comparison to prevent timing attacks
 */
export function verifyApiKey(plaintext: string, storedHash: string, salt: string): boolean {
  try {
    const hash = crypto.pbkdf2Sync(plaintext, salt, 100000, 32, 'sha256').toString('base64');

    // Constant-time comparison
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash));
  } catch {
    return false;
  }
}

/**
 * Mask an API key for display
 * Shows only the last N characters
 */
export function maskApiKey(plaintext: string, visibleChars: number = 4): string {
  if (plaintext.length <= visibleChars) {
    return '*'.repeat(Math.max(3, plaintext.length - 1)) + plaintext[plaintext.length - 1];
  }

  const hidden = plaintext.length - visibleChars;
  return '*'.repeat(hidden) + plaintext.slice(-visibleChars);
}

/**
 * Generate encryption key for documentation/setup
 * Should be run once and stored securely (e.g., in AWS Secrets Manager)
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}
