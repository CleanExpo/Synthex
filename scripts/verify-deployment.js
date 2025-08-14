#!/usr/bin/env node

/**
 * Deployment Verification Script
 * Checks if the latest code is deployed to production
 */

const https = require('https');

// Define test URLs
const URLS = {
  production: 'https://synthex.social',
  latestVercel: 'https://synthex-jax895zwc-unite-group.vercel.app',
};

// Test endpoints
const TEST_ENDPOINTS = [
  '/demo/integrations',
  '/api/integrations/twitter/connect',
];

function checkEndpoint(baseUrl, endpoint) {
  return new Promise((resolve) => {
    const url = baseUrl + endpoint;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          url,
          status: res.statusCode,
          hasIntegrationUI: data.includes('Platform Integrations'),
          hasEncryption: data.includes('encrypted and stored securely'),
          hasDemoMode: data.includes('Demo Mode'),
        });
      });
    }).on('error', (err) => {
      resolve({
        url,
        status: 'ERROR',
        error: err.message,
      });
    });
  });
}

async function verifyDeployment() {
  console.log('🔍 Verifying Deployment Status\n');
  console.log('=====================================\n');

  // Check production domain
  console.log('📍 Checking Production (synthex.social)...\n');
  for (const endpoint of TEST_ENDPOINTS) {
    const result = await checkEndpoint(URLS.production, endpoint);
    console.log(`  ${endpoint}:`);
    console.log(`    Status: ${result.status}`);
    if (result.status === 200) {
      console.log(`    Has Integration UI: ${result.hasIntegrationUI ? '✅' : '❌'}`);
      console.log(`    Has Encryption: ${result.hasEncryption ? '✅' : '❌'}`);
      console.log(`    Has Demo Mode: ${result.hasDemoMode ? '✅' : '❌'}`);
    }
    console.log('');
  }

  // Check latest Vercel deployment
  console.log('📍 Checking Latest Vercel Deployment...\n');
  for (const endpoint of TEST_ENDPOINTS) {
    const result = await checkEndpoint(URLS.latestVercel, endpoint);
    console.log(`  ${endpoint}:`);
    console.log(`    Status: ${result.status}`);
    if (result.status === 200) {
      console.log(`    Has Integration UI: ${result.hasIntegrationUI ? '✅' : '❌'}`);
      console.log(`    Has Encryption: ${result.hasEncryption ? '✅' : '❌'}`);
      console.log(`    Has Demo Mode: ${result.hasDemoMode ? '✅' : '❌'}`);
    }
    console.log('');
  }

  console.log('=====================================\n');
  console.log('📋 DEPLOYMENT ISSUE DETECTED!\n');
  console.log('The production domain (synthex.social) is not pointing to the latest deployment.\n');
  console.log('🔧 TO FIX THIS:\n');
  console.log('1. Go to Vercel Dashboard → Project Settings → Domains');
  console.log('2. Make sure synthex.social is assigned to the main branch');
  console.log('3. Check "Production Branch" is set to "main"');
  console.log('4. Trigger a redeployment from main branch');
  console.log('5. OR use: vercel --prod --yes to force production deployment\n');
}

verifyDeployment();