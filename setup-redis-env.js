/**
 * Redis Environment Setup Helper
 * This script helps you add Redis Cloud credentials to your .env.local
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

async function setupRedisEnv() {
  console.log('========================================');
  console.log('🚀 Redis Cloud Environment Setup');
  console.log('========================================\n');
  
  console.log('📝 Instructions:');
  console.log('1. Go to your Redis Cloud dashboard');
  console.log('2. Click the "Connect" button');
  console.log('3. Copy the connection details\n');
  
  console.log('Please enter your Redis Cloud connection details:\n');
  
  // Get endpoint
  const endpoint = await question('Redis Endpoint (e.g., redis-12345.c1.ap-southeast-2-1.ec2.cloud.redislabs.com): ');
  if (!endpoint) {
    console.log('❌ Endpoint is required!');
    rl.close();
    return;
  }
  
  // Get port
  const port = await question('Redis Port (from your screenshot it should be 10795): ') || '10795';
  
  // Get password
  const password = await question('Redis Password (will be hidden in .env.local): ');
  if (!password) {
    console.log('❌ Password is required!');
    rl.close();
    return;
  }
  
  // Get username (optional)
  const username = await question('Redis Username (press Enter for "default"): ') || 'default';
  
  // Construct Redis URL
  const redisUrl = `redis://${username}:${password}@${endpoint}:${port}`;
  
  // Prepare environment variables
  const envVars = `
# Redis Cloud Configuration
REDIS_URL=${redisUrl}
REDIS_HOST=${endpoint}
REDIS_PORT=${port}
REDIS_PASSWORD=${password}
REDIS_USERNAME=${username}
`;
  
  console.log('\n✅ Configuration ready!\n');
  console.log('The following will be added to .env.local:');
  console.log('----------------------------------------');
  console.log(`REDIS_URL=redis://${username}:***@${endpoint}:${port}`);
  console.log(`REDIS_HOST=${endpoint}`);
  console.log(`REDIS_PORT=${port}`);
  console.log(`REDIS_PASSWORD=***`);
  console.log(`REDIS_USERNAME=${username}`);
  console.log('----------------------------------------\n');
  
  const confirm = await question('Add these to .env.local? (yes/no): ');
  
  if (confirm.toLowerCase() === 'yes' || confirm.toLowerCase() === 'y') {
    const envPath = path.join(process.cwd(), '.env.local');
    
    // Check if file exists and has content
    let existingContent = '';
    if (fs.existsSync(envPath)) {
      existingContent = fs.readFileSync(envPath, 'utf8');
      
      // Check if Redis vars already exist
      if (existingContent.includes('REDIS_')) {
        console.log('\n⚠️  Warning: Redis variables already exist in .env.local');
        const overwrite = await question('Overwrite existing Redis configuration? (yes/no): ');
        
        if (overwrite.toLowerCase() !== 'yes' && overwrite.toLowerCase() !== 'y') {
          console.log('❌ Setup cancelled');
          rl.close();
          return;
        }
        
        // Remove existing Redis configuration
        existingContent = existingContent.split('\n')
          .filter(line => !line.trim().startsWith('REDIS_') && !line.includes('Redis Cloud Configuration'))
          .join('\n');
      }
    }
    
    // Add new configuration
    const newContent = existingContent + (existingContent.endsWith('\n') ? '' : '\n') + envVars;
    fs.writeFileSync(envPath, newContent);
    
    console.log('\n✅ Environment variables added to .env.local!');
    
    console.log('\n🧪 Would you like to test the connection now? (yes/no): ');
    const testNow = await question('');
    
    if (testNow.toLowerCase() === 'yes' || testNow.toLowerCase() === 'y') {
      console.log('\n🔄 Testing connection...\n');
      rl.close();
      
      // Run the test
      require('./test-redis-cloud.js');
    } else {
      console.log('\n📝 Next steps:');
      console.log('1. Run: node test-redis-cloud.js');
      console.log('2. Add these same variables to Vercel dashboard');
      console.log('3. Deploy with: vercel --prod\n');
      rl.close();
    }
  } else {
    console.log('\n❌ Setup cancelled');
    console.log('\n📝 You can manually add the variables to .env.local:');
    console.log(envVars);
    rl.close();
  }
}

// Run setup
setupRedisEnv().catch(error => {
  console.error('❌ Setup error:', error);
  rl.close();
});