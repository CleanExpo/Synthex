#!/usr/bin/env node

import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: '.env.local', quiet: true });

const required = ['DATABASE_URL', 'JWT_SECRET', 'OPENROUTER_API_KEY'];

// In production, allow Prisma URLs
const validateDatabase = url => {
  if (!url) return false;
  return (
    url.startsWith('postgresql://') ||
    url.startsWith('prisma://') ||
    url.startsWith('postgres://')
  );
};

let hasErrors = false;

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    hasErrors = true;
  }
}

// Special validation for DATABASE_URL
if (process.env.DATABASE_URL && !validateDatabase(process.env.DATABASE_URL)) {
  console.warn('DATABASE_URL format may need adjustment for production');
}

if (hasErrors) {
  console.error('Environment validation failed');
  process.exit(1);
}

console.log('✅ Environment validation passed');
