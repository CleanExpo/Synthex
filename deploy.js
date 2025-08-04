// Vercel Deployment Trigger for Synthex
// Generated on 2025-08-04

const https = require('https');

const DEPLOY_HOOK = 'https://api.vercel.com/v1/integrations/deploy/prj_QcJrayyUbPteT2ez5JKpImPLgCWZ/wyQpfX55Zx';

console.log('');
console.log('==========================================');
console.log('   Synthex - Triggering Vercel Deploy    ');
console.log('==========================================');
console.log('');

console.log('Sending deployment request...');

const url = new URL(DEPLOY_HOOK);

const options = {
  hostname: url.hostname,
  path: url.pathname,
  method: 'POST',
};

const req = https.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('');
      console.log('✓ Deployment triggered successfully!');
      console.log('');
      console.log('Check deployment status at:');
      console.log('https://vercel.com/dashboard/synthex');
      console.log('');
      console.log('Or visit your app at:');
      console.log('https://synthex-h4j7.vercel.app/');
      console.log('');
      if (data) {
        console.log('Response:', data);
      }
    } else {
      console.log('');
      console.log('⚠ Unexpected status code:', res.statusCode);
      console.log('Response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('');
  console.error('✗ Deployment request failed!');
  console.error('Error:', error.message);
  console.error('');
  console.error('Troubleshooting:');
  console.error('1. Check your internet connection');
  console.error('2. Verify the webhook URL is correct');
  console.error('3. Regenerate the hook in Vercel if needed');
});

req.end();