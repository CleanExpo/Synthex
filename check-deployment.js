#!/usr/bin/env node

/**
 * Check Deployment Status
 * Verifies that SYNTHEX is deployed and working
 */

const https = require('https');

const deploymentUrls = [
  'https://synthex.vercel.app',
  'https://synthex-unite-group.vercel.app',
  'https://synthex-c4uqxzmt8-unite-group.vercel.app'
];

console.log('🔍 Checking SYNTHEX deployment status...\n');

function checkUrl(url) {
  return new Promise((resolve) => {
    const apiUrl = `${url}/api/health`;
    
    https.get(apiUrl, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.success && json.status === 'healthy') {
            console.log(`✅ ${url}`);
            console.log(`   API Status: ${json.status}`);
            console.log(`   Database: ${json.database || 'connected'}`);
            console.log(`   Version: ${json.version || '2.0.0'}`);
            resolve({ url, status: 'online', data: json });
          } else {
            console.log(`⚠️  ${url} - API responding but unhealthy`);
            resolve({ url, status: 'unhealthy' });
          }
        } catch (e) {
          console.log(`❌ ${url} - Invalid response`);
          resolve({ url, status: 'error' });
        }
      });
    }).on('error', (err) => {
      console.log(`❌ ${url} - Not accessible`);
      resolve({ url, status: 'offline' });
    });
  });
}

async function checkAll() {
  console.log('Testing deployment URLs...\n');
  
  const results = [];
  for (const url of deploymentUrls) {
    const result = await checkUrl(url);
    results.push(result);
  }
  
  console.log('\n' + '='.repeat(50));
  
  const online = results.find(r => r.status === 'online');
  
  if (online) {
    console.log('\n🎉 DEPLOYMENT SUCCESSFUL!\n');
    console.log(`Your app is live at: ${online.url}`);
    console.log(`API endpoint: ${online.url}/api`);
    console.log(`Health check: ${online.url}/api/health`);
    console.log('\nDefault login credentials:');
    console.log('Email: admin@synthex.io');
    console.log('Password: admin123');
    console.log('\n⚠️  Remember to change the password immediately!');
  } else {
    console.log('\n⏳ Deployment may still be in progress...');
    console.log('Wait a few minutes and try again.');
    console.log('\nOr check Vercel dashboard:');
    console.log('https://vercel.com/unite-group/synthex');
  }
}

checkAll().catch(console.error);