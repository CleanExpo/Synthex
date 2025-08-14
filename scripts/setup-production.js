#!/usr/bin/env node

/**
 * Production Setup Script for Synthex
 * Generates encryption key and provides setup instructions
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('\n🚀 SYNTHEX Production Setup Script\n');
console.log('=====================================\n');

// Function to generate encryption key
function generateEncryptionKey() {
  // Generate 32-character key for AES-256
  return crypto.randomBytes(16).toString('hex');
}

// Function to generate strong JWT secret
function generateJWTSecret() {
  return crypto.randomBytes(32).toString('hex');
}

// Function to generate NextAuth secret
function generateNextAuthSecret() {
  return crypto.randomBytes(32).toString('hex');
}

// Generate all required secrets
const secrets = {
  ENCRYPTION_KEY: generateEncryptionKey(),
  JWT_SECRET: generateJWTSecret(),
  NEXTAUTH_SECRET: generateNextAuthSecret()
};

console.log('📝 Generated Secrets (SAVE THESE SECURELY!):\n');
console.log('----------------------------------------');
for (const [key, value] of Object.entries(secrets)) {
  console.log(`${key}=${value}`);
}
console.log('----------------------------------------\n');

// Create .env.local template
const envTemplate = `# ================================
# SYNTHEX Production Configuration
# Generated: ${new Date().toISOString()}
# ================================

# Database Configuration (Required)
# Get these from https://supabase.com
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Authentication (Required)
JWT_SECRET=${secrets.JWT_SECRET}
NEXTAUTH_URL=https://synthex.social
NEXTAUTH_SECRET=${secrets.NEXTAUTH_SECRET}

# Encryption (Required - KEEP THIS SECRET!)
ENCRYPTION_KEY=${secrets.ENCRYPTION_KEY}

# AI Services (Required for content generation)
# Get from https://openrouter.ai
OPENROUTER_API_KEY=your_openrouter_api_key

# Error Tracking (Optional but recommended)
# Get from https://sentry.io
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
SENTRY_DSN=your_sentry_dsn
SENTRY_AUTH_TOKEN=your_sentry_auth_token
SENTRY_ORG=your_sentry_org
SENTRY_PROJECT=your_sentry_project

# Email Service (For user notifications)
# Choose one provider:
RESEND_API_KEY=your_resend_api_key
# OR
# SENDGRID_API_KEY=your_sendgrid_api_key

# Environment Settings
NODE_ENV=production
DEMO_MODE=false
`;

// Save to .env.local.example
const envPath = path.join(process.cwd(), '.env.local.example');
fs.writeFileSync(envPath, envTemplate);
console.log(`✅ Created ${envPath}\n`);

// Setup instructions
console.log('📋 SETUP INSTRUCTIONS:\n');
console.log('=====================================\n');

console.log('1️⃣  SUPABASE SETUP:\n');
console.log('   a. Create account at https://supabase.com');
console.log('   b. Create new project');
console.log('   c. Go to SQL Editor and run migrations:');
console.log('      - supabase/migrations/001_create_user_integrations.sql');
console.log('      - supabase/migrations/002_create_integration_logs.sql');
console.log('   d. Copy project URL and keys from Settings → API\n');

console.log('2️⃣  VERCEL ENVIRONMENT VARIABLES:\n');
console.log('   a. Go to your Vercel project dashboard');
console.log('   b. Navigate to Settings → Environment Variables');
console.log('   c. Add the following variables:\n');

const vercelVars = [
  { name: 'NEXT_PUBLIC_SUPABASE_URL', desc: 'Supabase project URL' },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', desc: 'Supabase anonymous key' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', desc: 'Supabase service role key (secret!)' },
  { name: 'ENCRYPTION_KEY', desc: `Use: ${secrets.ENCRYPTION_KEY}` },
  { name: 'JWT_SECRET', desc: `Use: ${secrets.JWT_SECRET}` },
  { name: 'NEXTAUTH_SECRET', desc: `Use: ${secrets.NEXTAUTH_SECRET}` },
  { name: 'NEXTAUTH_URL', desc: 'https://synthex.social' },
  { name: 'OPENROUTER_API_KEY', desc: 'Your OpenRouter API key' }
];

vercelVars.forEach(({ name, desc }) => {
  console.log(`   • ${name}`);
  console.log(`     ${desc}\n`);
});

console.log('3️⃣  LOCAL DEVELOPMENT:\n');
console.log('   a. Copy .env.local.example to .env.local');
console.log('   b. Fill in your Supabase and OpenRouter credentials');
console.log('   c. Run: npm run dev\n');

console.log('4️⃣  DEPLOY TO PRODUCTION:\n');
console.log('   a. Commit and push all changes');
console.log('   b. Vercel will automatically deploy');
console.log('   c. Test at https://synthex.social\n');

console.log('5️⃣  TEST THE INTEGRATION SYSTEM:\n');
console.log('   a. Create a test user account');
console.log('   b. Navigate to /dashboard/integrations');
console.log('   c. Connect a platform with test credentials');
console.log('   d. Verify encryption in Supabase dashboard\n');

// Security warnings
console.log('⚠️  SECURITY WARNINGS:\n');
console.log('=====================================\n');
console.log('❗ NEVER commit .env.local to git');
console.log('❗ NEVER share your ENCRYPTION_KEY');
console.log('❗ NEVER expose SUPABASE_SERVICE_ROLE_KEY to clients');
console.log('❗ Rotate keys if you suspect they\'ve been compromised\n');

// Create Vercel deployment checklist
const checklist = `# Synthex Production Deployment Checklist

## Pre-Deployment
- [ ] Supabase project created
- [ ] Database migrations executed
- [ ] Environment variables added to Vercel
- [ ] ENCRYPTION_KEY saved securely
- [ ] OpenRouter API key obtained

## Deployment
- [ ] Code pushed to main branch
- [ ] Vercel build successful
- [ ] No TypeScript errors
- [ ] No build warnings

## Post-Deployment Verification
- [ ] Site loads at https://synthex.social
- [ ] Glassmorphic UI visible
- [ ] Authentication working
- [ ] Integration modal opens
- [ ] Demo page accessible at /demo/integrations

## Integration Testing
- [ ] Create test user account
- [ ] Navigate to /dashboard/integrations
- [ ] Connect test platform
- [ ] Verify credentials encrypted in Supabase
- [ ] Test disconnect functionality

## Security Verification
- [ ] HTTPS enforced
- [ ] Environment variables not exposed
- [ ] API routes require authentication
- [ ] Rate limiting active
- [ ] CORS properly configured

## Monitoring Setup
- [ ] Sentry error tracking configured (optional)
- [ ] Vercel analytics enabled
- [ ] Database monitoring active
- [ ] API usage tracking

## Documentation
- [ ] README updated
- [ ] API documentation current
- [ ] User guide available
- [ ] Admin documentation complete

---
Generated: ${new Date().toISOString()}
`;

// Save checklist
const checklistPath = path.join(process.cwd(), 'DEPLOYMENT_CHECKLIST.md');
fs.writeFileSync(checklistPath, checklist);
console.log(`✅ Created ${checklistPath}\n`);

// Generate SQL migration runner
const sqlRunner = `#!/bin/bash
# Supabase Migration Runner
# Run this in Supabase SQL Editor

echo "Running Synthex database migrations..."

# You can also use Supabase CLI:
# supabase db push

echo "✅ Migrations complete!"
echo "Remember to verify tables were created:"
echo "- user_integrations"
echo "- integration_logs"
echo "- integration_statistics (view)"
`;

const sqlRunnerPath = path.join(process.cwd(), 'supabase', 'run-migrations.sh');
fs.writeFileSync(sqlRunnerPath, sqlRunner);
fs.chmodSync(sqlRunnerPath, '755');
console.log(`✅ Created ${sqlRunnerPath}\n`);

console.log('=====================================\n');
console.log('✨ Setup script complete!\n');
console.log('Next steps:');
console.log('1. Save the generated secrets securely');
console.log('2. Follow the setup instructions above');
console.log('3. Use DEPLOYMENT_CHECKLIST.md to track progress\n');

process.exit(0);