#!/usr/bin/env node
/**
 * Sentry Setup Helper for SYNTHEX
 * This script helps configure Sentry for your application
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setupSentry() {
  console.log('\n🚨 SYNTHEX Sentry Configuration Helper\n');
  console.log('This will help you set up error tracking with Sentry.\n');
  
  // Check if .env.local exists
  const envPath = path.join(__dirname, '.env.local');
  const envExists = fs.existsSync(envPath);
  
  console.log('Please have ready:');
  console.log('1. Your Sentry DSN from https://sentry.io');
  console.log('2. Your Sentry auth token (optional, for source maps)');
  console.log('3. Your organization slug and project name\n');
  
  const dsn = await question('Enter your Sentry DSN: ');
  
  if (!dsn || !dsn.startsWith('https://')) {
    console.log('❌ Invalid DSN. Please get it from your Sentry project settings.');
    rl.close();
    return;
  }
  
  const useSourceMaps = await question('Do you want to upload source maps? (y/n): ');
  
  let authToken = '';
  let org = '';
  let project = '';
  
  if (useSourceMaps.toLowerCase() === 'y') {
    authToken = await question('Enter your Sentry auth token: ');
    org = await question('Enter your organization slug: ');
    project = await question('Enter your project name (default: synthex): ') || 'synthex';
  }
  
  // Create or update .env.local
  let envContent = envExists ? fs.readFileSync(envPath, 'utf-8') : '';
  
  // Remove old Sentry config if exists
  envContent = envContent.replace(/^.*SENTRY.*$/gm, '');
  
  // Add new Sentry config
  const sentryConfig = `
# Sentry Error Tracking
NEXT_PUBLIC_SENTRY_DSN=${dsn}
SENTRY_DSN=${dsn}
${authToken ? `SENTRY_AUTH_TOKEN=${authToken}` : '# SENTRY_AUTH_TOKEN=your_token_here'}
${org ? `SENTRY_ORG=${org}` : '# SENTRY_ORG=your_org'}
${project ? `SENTRY_PROJECT=${project}` : '# SENTRY_PROJECT=synthex'}
SENTRY_ENVIRONMENT=${process.env.NODE_ENV || 'development'}
`;
  
  envContent += sentryConfig;
  
  fs.writeFileSync(envPath, envContent.trim());
  console.log('✅ Updated .env.local with Sentry configuration');
  
  // Update sentry.properties if source maps enabled
  if (useSourceMaps.toLowerCase() === 'y' && authToken) {
    const sentryProps = `defaults.url=https://sentry.io/
defaults.org=${org}
defaults.project=${project}
auth.token=${authToken}
`;
    
    fs.writeFileSync(path.join(__dirname, 'sentry.properties'), sentryProps);
    console.log('✅ Updated sentry.properties for source map uploads');
  }
  
  // Check if we should use Sentry-wrapped config
  const useWrappedConfig = await question('Enable Sentry in next.config? (y/n): ');
  
  if (useWrappedConfig.toLowerCase() === 'y') {
    // Backup current config
    const configPath = path.join(__dirname, 'next.config.mjs');
    const backupPath = path.join(__dirname, 'next.config.backup.mjs');
    
    if (fs.existsSync(configPath)) {
      fs.copyFileSync(configPath, backupPath);
      console.log('✅ Backed up next.config.mjs to next.config.backup.mjs');
    }
    
    // Copy Sentry config
    const sentryConfigPath = path.join(__dirname, 'next.config.sentry.mjs');
    if (fs.existsSync(sentryConfigPath)) {
      fs.copyFileSync(sentryConfigPath, configPath);
      console.log('✅ Applied Sentry configuration to next.config.mjs');
    }
  }
  
  console.log('\n🎉 Sentry configuration complete!\n');
  console.log('Next steps:');
  console.log('1. Add these same environment variables to Vercel dashboard');
  console.log('2. Deploy your application');
  console.log('3. Test by visiting /api/sentry-test (creates test error)');
  console.log('\nFor Vercel, add these environment variables:');
  console.log(`  NEXT_PUBLIC_SENTRY_DSN=${dsn}`);
  console.log(`  SENTRY_DSN=${dsn}`);
  if (authToken) {
    console.log(`  SENTRY_AUTH_TOKEN=${authToken}`);
    console.log(`  SENTRY_ORG=${org}`);
    console.log(`  SENTRY_PROJECT=${project}`);
  }
  
  rl.close();
}

setupSentry().catch(err => {
  console.error('Error:', err);
  rl.close();
});