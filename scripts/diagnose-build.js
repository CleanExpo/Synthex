#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('\n🔍 BUILD DIAGNOSTICS\n');

// Step 1: Check Next.js version compatibility
console.log('1. Checking Next.js and dependency compatibility...');
try {
  const pkg = require('../package.json');
  console.log(`   Next.js: ${pkg.dependencies.next}`);
  console.log(`   Next-Auth: ${pkg.dependencies['next-auth']}`);
  console.log(`   React: ${pkg.dependencies.react}`);
  
  // Check for beta versions
  if (pkg.dependencies['next-auth'].includes('beta')) {
    console.log('   ⚠️  WARNING: Using next-auth beta version');
    console.log('   Consider downgrading to stable: npm install next-auth@^4.24.11');
  }
} catch (e) {
  console.log('   ❌ ERROR reading package.json');
}

// Step 2: Check auth configuration
console.log('\n2. Checking authentication setup...');
const authPaths = [
  'src/lib/auth.ts',
  'src/lib/auth/index.ts',
  'src/app/api/auth/[...nextauth]/route.ts'
];

let authConfigFound = false;
authPaths.forEach(p => {
  if (fs.existsSync(p)) {
    console.log(`   ✓ Found: ${p}`);
    authConfigFound = true;
  }
});

if (!authConfigFound) {
  console.log('   ❌ No auth configuration found');
  console.log('   This may cause build failures');
}

// Step 3: Check for import errors
console.log('\n3. Scanning for common import issues...');
const checkImports = [
  { file: 'src/middleware.ts', issue: 'middleware configuration' },
  { file: 'next.config.js', issue: 'Next.js configuration' },
  { file: 'src/app/layout.tsx', issue: 'root layout' }
];

checkImports.forEach(({ file, issue }) => {
  if (fs.existsSync(file)) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('next-auth/next')) {
        console.log(`   ⚠️  ${file}: Uses old next-auth import`);
      }
      if (content.includes('@auth/') && !content.includes('@auth/prisma-adapter')) {
        console.log(`   ⚠️  ${file}: Uses @auth packages that may conflict`);
      }
    } catch (e) {
      console.log(`   ❌ Cannot read ${file}`);
    }
  }
});

// Step 4: Check environment setup
console.log('\n4. Checking .env configuration...');
const envFiles = ['.env', '.env.local', '.env.production'];
let envFound = false;

envFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`   ✓ Found: ${file}`);
    envFound = true;
    
    // Check for required vars
    const content = fs.readFileSync(file, 'utf8');
    const requiredVars = ['DATABASE_URL', 'NEXTAUTH_SECRET', 'JWT_SECRET'];
    requiredVars.forEach(v => {
      if (!content.includes(v)) {
        console.log(`   ⚠️  Missing ${v} in ${file}`);
      }
    });
  }
});

if (!envFound) {
  console.log('   ❌ No .env file found');
}

// Step 5: Try to identify the specific build error
console.log('\n5. Testing build with detailed output...\n');
console.log('   Running: next build (first 50 lines of output)\n');

try {
  // Capture build output
  const output = execSync('npx next build 2>&1', { 
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'production' },
    timeout: 30000
  });
  
  const lines = output.split('\n').slice(0, 50);
  lines.forEach(line => console.log('   ' + line));
  
  console.log('\n   ✅ Build completed successfully!');
} catch (error) {
  if (error.stdout) {
    const lines = error.stdout.toString().split('\n').slice(0, 50);
    lines.forEach(line => console.log('   ' + line));
  }
  if (error.stderr) {
    console.log('\n   Build errors:');
    const errorLines = error.stderr.toString().split('\n').slice(0, 30);
    errorLines.forEach(line => console.log('   ' + line));
  }
  
  // Parse specific error types
  const errorStr = (error.stdout || '') + (error.stderr || '');
  
  if (errorStr.includes('Module not found')) {
    console.log('\n   📌 Issue: Missing module dependencies');
    console.log('   Fix: Run "npm install --legacy-peer-deps"');
  }
  
  if (errorStr.includes('next-auth') || errorStr.includes('NextAuth')) {
    console.log('\n   📌 Issue: NextAuth configuration problem');
    console.log('   Fix: Check auth setup and imports');
  }
  
  if (errorStr.includes('prisma') || errorStr.includes('Prisma')) {
    console.log('\n   📌 Issue: Prisma client problem');
    console.log('   Fix: Run "npx prisma generate"');
  }
  
  if (errorStr.includes('ECONNREFUSED') || errorStr.includes('ETIMEDOUT')) {
    console.log('\n   📌 Issue: Database connection problem');
    console.log('   Fix: Check DATABASE_URL in .env');
  }
}

console.log('\n=====================================');
console.log('📋 RECOMMENDED FIXES:\n');
console.log('1. Downgrade next-auth to stable:');
console.log('   npm uninstall next-auth @auth/prisma-adapter');
console.log('   npm install next-auth@4.24.11 @auth/prisma-adapter@1.6.0 --legacy-peer-deps');
console.log('\n2. Regenerate dependencies:');
console.log('   rm -rf node_modules package-lock.json');
console.log('   npm install --legacy-peer-deps');
console.log('\n3. Ensure all environment variables are set');
console.log('\n4. Run "npx prisma generate" before building');
console.log('=====================================\n');