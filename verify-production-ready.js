#!/usr/bin/env node

/**
 * Production Readiness Checker
 * Verifies that all environment variables are properly configured
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 SYNTHEX Production Readiness Check\n');
console.log('='.repeat(50) + '\n');

// Required environment variables for production
const requiredVars = [
  { name: 'NEXT_PUBLIC_SUPABASE_URL', pattern: /^https:\/\/.+\.supabase\.co/ },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', pattern: /^eyJ/ },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', pattern: /^eyJ/ },
  { name: 'DATABASE_URL', pattern: /^(postgresql|prisma\+postgres):\/\// },
  { name: 'JWT_SECRET', minLength: 64 },
  { name: 'OPENROUTER_API_KEY', pattern: /^sk-or-/ },
];

// Optional but recommended
const optionalVars = [
  { name: 'GOOGLE_CLIENT_ID', pattern: /^\d+-.*\.apps\.googleusercontent\.com$/ },
  { name: 'GOOGLE_CLIENT_SECRET', pattern: /^GOCSPX-/ },
  { name: 'ANTHROPIC_API_KEY', pattern: /^sk-ant-/ },
  { name: 'OPENAI_API_KEY', pattern: /^sk-/ },
];

// Check if .env exists
const envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  console.log('❌ No .env file found!\n');
  console.log('Create a .env file with your environment variables.\n');
  process.exit(1);
}

// Load environment variables
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};

envContent.split('\n').forEach(line => {
  if (line && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').replace(/^["']|["']$/g, '');
      envVars[key.trim()] = value;
    }
  }
});

console.log('📋 Checking Required Variables:\n');

let allRequired = true;
let warnings = [];

// Check required variables
requiredVars.forEach(varDef => {
  const value = envVars[varDef.name];
  
  if (!value) {
    console.log(`❌ ${varDef.name}: MISSING`);
    allRequired = false;
  } else if (varDef.pattern && !varDef.pattern.test(value)) {
    console.log(`⚠️  ${varDef.name}: Invalid format`);
    warnings.push(`${varDef.name} doesn't match expected pattern`);
  } else if (varDef.minLength && value.length < varDef.minLength) {
    console.log(`⚠️  ${varDef.name}: Too short (min ${varDef.minLength} chars)`);
    warnings.push(`${varDef.name} should be at least ${varDef.minLength} characters`);
  } else {
    console.log(`✅ ${varDef.name}: OK`);
  }
});

console.log('\n📋 Checking Optional Variables:\n');

// Check optional variables
optionalVars.forEach(varDef => {
  const value = envVars[varDef.name];
  
  if (!value) {
    console.log(`⚪ ${varDef.name}: Not set (optional)`);
  } else if (varDef.pattern && !varDef.pattern.test(value)) {
    console.log(`⚠️  ${varDef.name}: Invalid format`);
    warnings.push(`${varDef.name} doesn't match expected pattern`);
  } else {
    console.log(`✅ ${varDef.name}: OK`);
  }
});

// Check for exposed secrets
console.log('\n🔒 Security Check:\n');

const exposedPatterns = [
  { pattern: /lX2WLK2mB8Ucrjdv/, name: 'Supabase password' },
  { pattern: /postgresql:\/\/postgres:[^@]+@/, name: 'Database credentials' },
];

let hasExposedSecrets = false;

exposedPatterns.forEach(check => {
  if (envContent.match(check.pattern)) {
    console.log(`❌ Exposed ${check.name} found in .env file!`);
    hasExposedSecrets = true;
  }
});

if (!hasExposedSecrets) {
  console.log('✅ No exposed secrets detected');
}

// Check .gitignore
console.log('\n📁 Git Configuration:\n');

const gitignorePath = path.join(process.cwd(), '.gitignore');
if (fs.existsSync(gitignorePath)) {
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
  if (gitignoreContent.includes('.env')) {
    console.log('✅ .env is in .gitignore');
  } else {
    console.log('❌ .env is NOT in .gitignore - FIX THIS!');
    hasExposedSecrets = true;
  }
} else {
  console.log('❌ No .gitignore file found!');
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('\n📊 Summary:\n');

if (allRequired && !hasExposedSecrets && warnings.length === 0) {
  console.log('✅ Production ready! You can deploy to Vercel.\n');
  console.log('Next steps:');
  console.log('  1. Run: vercel --prod');
  console.log('  2. Follow the prompts to deploy');
  console.log('  3. Verify at: https://synthex-cerq.vercel.app\n');
  process.exit(0);
} else {
  if (!allRequired) {
    console.log('❌ Missing required environment variables\n');
  }
  if (hasExposedSecrets) {
    console.log('❌ Security issues detected\n');
  }
  if (warnings.length > 0) {
    console.log('⚠️  Warnings:');
    warnings.forEach(w => console.log(`  - ${w}`));
  }
  
  console.log('\n🔧 Fix these issues before deploying to production.\n');
  process.exit(1);
}