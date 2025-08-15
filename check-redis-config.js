/**
 * Quick Redis Configuration Check
 * Checks if Redis environment variables are configured
 */

require('dotenv').config({ path: '.env.local' });

console.log('========================================');
console.log('🔍 Redis Configuration Check');
console.log('========================================\n');

const redisVars = {
  'REDIS_URL': process.env.REDIS_URL,
  'REDIS_HOST': process.env.REDIS_HOST,
  'REDIS_PORT': process.env.REDIS_PORT,
  'REDIS_PASSWORD': process.env.REDIS_PASSWORD,
  'REDIS_USERNAME': process.env.REDIS_USERNAME,
  'UPSTASH_REDIS_REST_URL': process.env.UPSTASH_REDIS_REST_URL,
  'UPSTASH_REDIS_REST_TOKEN': process.env.UPSTASH_REDIS_REST_TOKEN
};

let hasRedisCloud = false;
let hasUpstash = false;
let canConnect = false;

console.log('📋 Environment Variables:\n');

Object.entries(redisVars).forEach(([key, value]) => {
  if (value) {
    if (key.includes('PASSWORD') || key.includes('TOKEN')) {
      console.log(`✅ ${key}: ***${value.slice(-4)}`);
    } else {
      console.log(`✅ ${key}: ${value}`);
    }
    
    if (key.startsWith('REDIS_')) hasRedisCloud = true;
    if (key.startsWith('UPSTASH_')) hasUpstash = true;
  } else {
    console.log(`❌ ${key}: Not set`);
  }
});

console.log('\n----------------------------------------\n');

// Check which Redis service is configured
if (hasRedisCloud && (redisVars.REDIS_URL || (redisVars.REDIS_HOST && redisVars.REDIS_PORT && redisVars.REDIS_PASSWORD))) {
  console.log('✅ Redis Cloud is configured');
  canConnect = true;
  
  if (redisVars.REDIS_PORT === '10795') {
    console.log('✅ Port matches your Redis Cloud instance (10795)');
  } else if (redisVars.REDIS_PORT) {
    console.log(`⚠️  Port is ${redisVars.REDIS_PORT}, but your screenshot shows 10795`);
  }
}

if (hasUpstash && redisVars.UPSTASH_REDIS_REST_URL && redisVars.UPSTASH_REDIS_REST_TOKEN) {
  console.log('✅ Upstash Redis is configured');
  canConnect = true;
}

if (!canConnect) {
  console.log('❌ No Redis service is properly configured\n');
  console.log('📝 To configure Redis Cloud:');
  console.log('1. Run: node setup-redis-env.js');
  console.log('2. OR manually add to .env.local:');
  console.log('   REDIS_URL=redis://default:YOUR_PASSWORD@YOUR_ENDPOINT:10795');
  console.log('   REDIS_HOST=YOUR_ENDPOINT');
  console.log('   REDIS_PORT=10795');
  console.log('   REDIS_PASSWORD=YOUR_PASSWORD\n');
  console.log('Get these values from your Redis Cloud dashboard by clicking "Connect"');
} else {
  console.log('\n🎯 Next Steps:');
  console.log('1. Test connection: node test-redis-cloud.js');
  console.log('2. Add these variables to Vercel dashboard');
  console.log('3. Deploy: vercel --prod');
}

console.log('\n========================================\n');