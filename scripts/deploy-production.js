#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🚀 Starting SYNTHEX deployment...');

try {
  // Step 1: Clean cache
  console.log('Cleaning build cache...');
  execSync('rm -rf .next .vercel/cache', { stdio: 'inherit' });
  
  // Step 2: Install dependencies
  console.log('Installing dependencies...');
  execSync('npm ci --legacy-peer-deps', { stdio: 'inherit' });
  
  // Step 3: Generate Prisma client
  console.log('Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });
  
  // Step 4: Build application
  console.log('Building application...');
  execSync('npm run build', { stdio: 'inherit' });
  
  // Step 5: Deploy to Vercel
  console.log('Deploying to Vercel...');
  execSync('vercel --prod --yes', { stdio: 'inherit' });
  
  console.log('✅ Deployment successful!');
} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  process.exit(1);
}
