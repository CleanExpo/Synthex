#!/usr/bin/env node
/**
 * Generates cryptographically secure secrets for .env.local
 * Usage: node scripts/generate-secrets.js
 */
import { randomBytes } from 'crypto';

const secrets = {
  FIELD_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
  NEXTAUTH_SECRET: randomBytes(32).toString('hex'),
  SESSION_SECRET: randomBytes(32).toString('hex'),
  OAUTH_STATE_SECRET: randomBytes(32).toString('hex'),
};

console.log('\n# Generated secrets — paste into .env.local\n');
for (const [key, value] of Object.entries(secrets)) {
  console.log(`${key}=${value}`);
}
console.log('\n# Keep these values secret. Never commit them.\n');
