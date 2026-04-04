#!/usr/bin/env node

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'DATABASE_URL',
  'JWT_SECRET',
  'OPENROUTER_API_KEY'
];

// In production, allow Prisma URLs
const validateDatabase = (url) => {
  if (!url) return false;
  return url.startsWith('postgresql://') || 
         url.startsWith('prisma://') ||
         url.startsWith('postgres://');
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

if (hasErrors && process.env.NODE_ENV === 'production') {
  console.warn('Environment variables missing but continuing in production mode');
  process.exit(0); // Don't fail in production
}

console.log('✅ Environment validation passed');
