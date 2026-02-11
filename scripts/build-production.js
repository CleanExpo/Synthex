#!/usr/bin/env node

/**
 * Production Build Script for SYNTHEX
 * This script prepares the application for production deployment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting SYNTHEX Production Build...\n');

// Check Node version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
if (majorVersion < 16) {
  console.error('❌ Node.js 16 or higher is required for production build');
  process.exit(1);
}
console.log(`✅ Node.js version: ${nodeVersion}`);

// Step 1: Clean previous build
console.log('\n📦 Cleaning previous build...');
try {
  execSync('npm run clean', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Failed to clean build directory');
  process.exit(1);
}

// Step 2: Run tests
console.log('\n🧪 Running tests...');
try {
  execSync('npm test', { stdio: 'inherit' });
  console.log('✅ All tests passed');
} catch (error) {
  console.error('❌ Tests failed - build aborted');
  process.exit(1);
}

// Step 3: Type checking
console.log('\n📝 Running TypeScript type check...');
try {
  execSync('npm run typecheck', { stdio: 'inherit' });
  console.log('✅ TypeScript validation passed');
} catch (error) {
  console.error('❌ TypeScript errors found');
  process.exit(1);
}

// Step 4: Build production bundle
console.log('\n🔨 Building production bundle...');
try {
  execSync('tsc --sourceMap false', { stdio: 'inherit' });
  console.log('✅ Production build completed');
} catch (error) {
  console.error('❌ Build failed');
  process.exit(1);
}

// Step 5: Verify build output
console.log('\n🔍 Verifying build output...');
const distPath = path.join(process.cwd(), 'dist');
const indexPath = path.join(distPath, 'index.js');

if (!fs.existsSync(distPath)) {
  console.error('❌ Build directory not found');
  process.exit(1);
}

if (!fs.existsSync(indexPath)) {
  console.error('❌ Main entry point not found in build');
  process.exit(1);
}

const buildStats = fs.statSync(indexPath);
const buildSizeMB = (buildStats.size / 1024 / 1024).toFixed(2);
console.log(`✅ Build size: ${buildSizeMB} MB`);

if (buildStats.size > 50 * 1024 * 1024) {
  console.warn('⚠️  Warning: Build size exceeds 50MB. Consider optimization.');
}

// Step 6: Create production info file
console.log('\n📄 Creating production metadata...');
const buildInfo = {
  version: require('../package.json').version,
  buildTime: new Date().toISOString(),
  nodeVersion: process.version,
  environment: 'production',
  commit: getGitCommit()
};

fs.writeFileSync(
  path.join(distPath, 'build-info.json'),
  JSON.stringify(buildInfo, null, 2)
);

// Step 7: Verify environment variables
console.log('\n🔐 Checking environment configuration...');
const requiredEnvVars = [
  'ANTHROPIC_API_KEY',
  'OPENROUTER_API_KEY'
];

const envExample = fs.readFileSync('.env.production', 'utf-8');
console.log('✅ Production environment template found');
console.log('⚠️  Remember to set these in Vercel Dashboard:');
requiredEnvVars.forEach(varName => {
  console.log(`   - ${varName}`);
});

// Step 8: Final summary
console.log('\n' + '='.repeat(50));
console.log('✅ PRODUCTION BUILD SUCCESSFUL!');
console.log('='.repeat(50));
console.log('\nBuild Information:');
console.log(`  Version: ${buildInfo.version}`);
console.log(`  Build Time: ${buildInfo.buildTime}`);
console.log(`  Build Size: ${buildSizeMB} MB`);
console.log(`  Node Version: ${nodeVersion}`);
if (buildInfo.commit) {
  console.log(`  Git Commit: ${buildInfo.commit}`);
}

console.log('\n📦 Build artifacts ready in: ./dist');
console.log('🚀 Ready for deployment to Vercel!\n');

console.log('Next steps:');
console.log('1. Deploy: npx vercel --prod');
console.log('2. Or push to GitHub for automatic deployment');
console.log('3. Set environment variables in Vercel Dashboard\n');

function getGitCommit() {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return null;
  }
}

process.exit(0);