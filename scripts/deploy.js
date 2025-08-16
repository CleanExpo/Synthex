#!/usr/bin/env node

/**
 * SYNTHEX Deployment Script
 * Handles production deployment to Vercel
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 SYNTHEX Production Deployment Script');
console.log('========================================\n');

// Check if Vercel CLI is installed
function checkVercelCLI() {
  try {
    execSync('vercel --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// Install Vercel CLI if not present
function installVercelCLI() {
  console.log('📦 Installing Vercel CLI...');
  try {
    execSync('npm install -g vercel', { stdio: 'inherit' });
    console.log('✅ Vercel CLI installed successfully\n');
  } catch (error) {
    console.error('❌ Failed to install Vercel CLI');
    console.error('Please install manually: npm install -g vercel');
    process.exit(1);
  }
}

// Check environment variables
function checkEnvironment() {
  console.log('🔍 Checking environment...\n');
  
  const envFile = path.join(__dirname, '..', '.env.local');
  const envExampleFile = path.join(__dirname, '..', '.env.production.example');
  
  if (!fs.existsSync(envFile)) {
    console.log('⚠️  No .env.local file found');
    console.log('   Environment variables should be configured in Vercel Dashboard\n');
  } else {
    console.log('✅ .env.local file found\n');
  }
  
  if (fs.existsSync(envExampleFile)) {
    console.log('📋 Required environment variables (configure in Vercel):');
    console.log('   - DATABASE_URL');
    console.log('   - DIRECT_URL');
    console.log('   - JWT_SECRET');
    console.log('   - NEXT_PUBLIC_APP_URL');
    console.log('   - EMAIL_PROVIDER (optional)');
    console.log('   - OPENROUTER_API_KEY (for AI features)\n');
  }
}

// Run deployment
function deploy() {
  console.log('🚀 Starting deployment to Vercel...\n');
  
  const args = process.argv.slice(2);
  const isProd = args.includes('--prod');
  const isForce = args.includes('--force');
  
  let command = 'vercel';
  
  if (isProd) {
    command += ' --prod';
  }
  
  if (isForce) {
    command += ' --force';
  }
  
  // Add yes flag to skip prompts
  if (args.includes('--yes')) {
    command += ' --yes';
  }
  
  console.log(`Running: ${command}\n`);
  
  try {
    execSync(command, { stdio: 'inherit' });
    console.log('\n✅ Deployment completed successfully!');
    console.log('\n📌 Next Steps:');
    console.log('   1. Check deployment URL in Vercel Dashboard');
    console.log('   2. Configure environment variables if needed');
    console.log('   3. Run database migrations: npx prisma migrate deploy');
    console.log('   4. Test the deployment');
    console.log('\n🎉 SYNTHEX is live!');
  } catch (error) {
    console.error('\n❌ Deployment failed');
    console.error('Please check the error messages above');
    process.exit(1);
  }
}

// Main execution
async function main() {
  // Check Vercel CLI
  if (!checkVercelCLI()) {
    installVercelCLI();
  }
  
  // Check environment
  checkEnvironment();
  
  // Confirm deployment
  if (!process.argv.includes('--yes')) {
    console.log('📝 Deployment Checklist:');
    console.log('   [ ] Database configured (Supabase/PostgreSQL)');
    console.log('   [ ] Environment variables ready');
    console.log('   [ ] Code committed to Git');
    console.log('   [ ] Tests passing\n');
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('Ready to deploy? (y/N): ', (answer) => {
      rl.close();
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        deploy();
      } else {
        console.log('\n⚠️  Deployment cancelled');
        process.exit(0);
      }
    });
  } else {
    deploy();
  }
}

// Run the script
main().catch(error => {
  console.error('Deployment script error:', error);
  process.exit(1);
});

// Usage instructions
if (process.argv.includes('--help')) {
  console.log('Usage: node scripts/deploy.js [options]');
  console.log('\nOptions:');
  console.log('  --prod    Deploy to production');
  console.log('  --force   Force deployment (clear cache)');
  console.log('  --yes     Skip confirmation prompt');
  console.log('  --help    Show this help message');
  console.log('\nExamples:');
  console.log('  node scripts/deploy.js              # Deploy to preview');
  console.log('  node scripts/deploy.js --prod       # Deploy to production');
  console.log('  node scripts/deploy.js --prod --yes # Deploy to production without prompt');
  process.exit(0);
}