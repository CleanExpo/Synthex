import crypto from 'crypto';

/**
 * Encrypts sensitive data using AES-256-GCM
 * @param text - The plaintext to encrypt
 * @param encryptionKey - 32-character encryption key
 * @returns Encrypted data with IV and auth tag
 */
export function encrypt(text: string, encryptionKey: string): string {
  // Ensure key is 32 bytes
  const key = Buffer.from(encryptionKey.padEnd(32, '0').slice(0, 32));
  
  // Generate random IV
  const iv = crypto.randomBytes(16);
  
  // Create cipher
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  // Encrypt the text
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Get auth tag
  const authTag = cipher.getAuthTag();
  
  // Combine IV, auth tag, and encrypted data
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

/**
 * Decrypts data encrypted with encrypt()
 * @param encryptedData - The encrypted data string
 * @param encryptionKey - 32-character encryption key
 * @returns Decrypted plaintext
 */
export function decrypt(encryptedData: string, encryptionKey: string): string {
  // Parse the encrypted data
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  
  const [ivHex, authTagHex, encrypted] = parts;
  
  // Ensure key is 32 bytes
  const key = Buffer.from(encryptionKey.padEnd(32, '0').slice(0, 32));
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  // Create decipher
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  // Decrypt
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Hashes a password using bcrypt-like algorithm
 * @param password - The password to hash
 * @returns Hashed password
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verifies a password against a hash
 * @param password - The password to verify
 * @param hashedPassword - The hashed password to compare against
 * @returns True if password matches
 */
export function verifyPassword(password: string, hashedPassword: string): boolean {
  const [salt, hash] = hashedPassword.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

/**
 * Generates a secure random token
 * @param length - Length of the token in bytes (default 32)
 * @returns Hex-encoded random token
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Encrypts user credentials for storage
 * @param credentials - Object containing platform credentials
 * @param encryptionKey - Encryption key from environment
 * @returns Encrypted credentials string
 */
export function encryptCredentials(credentials: Record<string, unknown>, encryptionKey: string): string {
  const jsonString = JSON.stringify(credentials);
  return encrypt(jsonString, encryptionKey);
}

/**
 * Decrypts stored user credentials
 * @param encryptedCredentials - Encrypted credentials string
 * @param encryptionKey - Encryption key from environment
 * @returns Decrypted credentials object
 */
export function decryptCredentials(encryptedCredentials: string, encryptionKey: string): Record<string, unknown> {
  const jsonString = decrypt(encryptedCredentials, encryptionKey);
  return JSON.parse(jsonString);
}