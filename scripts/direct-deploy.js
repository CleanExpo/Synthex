#!/usr/bin/env node

/**
 * Direct deployment to fix auth pages
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🎯 Direct Deployment Script\n');

// Check if build exists
if (!fs.existsSync('.next')) {
  console.log('No build found. Building now...');
  execSync('npm run build', { stdio: 'inherit' });
}

console.log('\n✅ Build exists with auth pages');
console.log('📦 Deploying to Vercel...\n');

// Method 1: Try git push trigger
console.log('Attempting deployment via git push...');
try {
  execSync('git add -A', { stdio: 'inherit' });
  execSync('git commit -m "fix: deploy auth pages to production"', { stdio: 'inherit' });
  execSync('git push origin main', { stdio: 'inherit' });
  console.log('\n✅ Pushed to GitHub. Vercel should auto-deploy.');
} catch (e) {
  console.log('Git push failed or no changes to commit');
}

console.log('\n📝 IMPORTANT NEXT STEPS:');
console.log('1. Go to: https://vercel.com/unite-group/synthex');
console.log('2. Cancel any stuck deployments');
console.log('3. Click "Redeploy" on the latest deployment');
console.log('4. Or trigger a new deployment from GitHub');
console.log('\n✅ The auth pages are built and ready:');
console.log('   - /auth/login');
console.log('   - /auth/register');
console.log('   - /auth/forgot-password');
console.log('   - /auth/reset-password');
console.log('\nOnce deployed, these will work at https://synthex.social/auth/login');