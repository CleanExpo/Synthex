const crypto = require('crypto');

/**
 * Encrypts sensitive data using AES-256-GCM
 * @param {string} text - The plaintext to encrypt
 * @param {string} encryptionKey - 32-character encryption key
 * @returns {string} Encrypted data with IV and auth tag
 */
function encrypt(text, encryptionKey) {
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
 * @param {string} encryptedData - The encrypted data string
 * @param {string} encryptionKey - 32-character encryption key
 * @returns {string} Decrypted plaintext
 */
function decrypt(encryptedData, encryptionKey) {
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
 * Encrypts user credentials for storage
 * @param {Object} credentials - Object containing platform credentials
 * @param {string} encryptionKey - Encryption key from environment
 * @returns {string} Encrypted credentials string
 */
function encryptCredentials(credentials, encryptionKey) {
  const jsonString = JSON.stringify(credentials);
  return encrypt(jsonString, encryptionKey);
}

/**
 * Decrypts stored user credentials
 * @param {string} encryptedCredentials - Encrypted credentials string
 * @param {string} encryptionKey - Encryption key from environment
 * @returns {Object} Decrypted credentials object
 */
function decryptCredentials(encryptedCredentials, encryptionKey) {
  const jsonString = decrypt(encryptedCredentials, encryptionKey);
  return JSON.parse(jsonString);
}

module.exports = {
  encrypt,
  decrypt,
  encryptCredentials,
  decryptCredentials
};