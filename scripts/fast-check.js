#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

console.log('\n🚀 FAST DEPLOYMENT CHECK\n');

let issues = [];

// 1. Check critical dependencies
console.log('Checking dependencies...');
try {
  const pkg = require('../package.json');
  
  // Check for problematic versions
  if (pkg.dependencies['next-auth'] === '^5.0.0-beta.25') {
    console.log('⚠️  Using next-auth beta version - may cause issues');
  }
  
  if (!pkg.dependencies['@prisma/client']) {
    issues.push('Missing @prisma/client dependency');
  }
  
  console.log('✓ Dependencies look OK\n');
} catch (e) {
  issues.push('Cannot read package.json');
}

// 2. Quick Prisma check
console.log('Checking Prisma...');
try {
  execSync('npx prisma validate', { stdio: 'pipe' });
  console.log('✓ Prisma schema valid\n');
} catch (e) {
  issues.push('Prisma schema has errors');
}

// 3. Check for common build blockers
console.log('Checking for common issues...');

// Check if auth is properly configured
const authFiles = [
  'src/lib/auth/auth-adapter.ts',
  'src/lib/auth/auth-service.ts'
];

authFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    console.log(`⚠️  Missing: ${file}`);
  }
});

// 4. Environment check
console.log('\nChecking environment...');
const criticalEnvVars = [
  'DATABASE_URL',
  'DIRECT_URL',
  'JWT_SECRET',
  'NEXTAUTH_SECRET'
];

const missingEnv = criticalEnvVars.filter(v => !process.env[v]);
if (missingEnv.length > 0) {
  console.log(`⚠️  Missing env vars: ${missingEnv.join(', ')}`);
  console.log('   These are required for Vercel deployment');
}

// 5. Try a quick build
console.log('\nAttempting quick build test...');
console.log('Running: next build --experimental-build-mode=compile\n');

try {
  // Just compile, don't generate pages
  execSync('npx next build --experimental-build-mode=compile', { 
    stdio: 'inherit',
    timeout: 60000,
    env: { ...process.env, NODE_ENV: 'production' }
  });
  console.log('\n✅ Build compilation successful!');
} catch (e) {
  console.log('\n❌ Build failed - see errors above');
  issues.push('Build compilation failed');
}

// Report
console.log('\n=====================================');
if (issues.length === 0) {
  console.log('✅ READY FOR DEPLOYMENT');
  console.log('\nPush to GitHub to trigger Vercel build');
} else {
  console.log('❌ ISSUES FOUND:');
  issues.forEach(i => console.log(`  - ${i}`));
  console.log('\nFix these before deploying');
}