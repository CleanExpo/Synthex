# 🚀 Redis Cloud Configuration for SYNTHEX

## Your Current Redis Cloud Setup

Based on your screenshot, you have:
- **Database Name**: database-MCAJ6POB
- **Database ID**: #13336170
- **Region**: AWS / Asia Pacific (Sydney) - ap-southeast-2
- **Type**: Redis Stack
- **Redis Version**: 7.4
- **Creation Time**: 24-Jun-2025 22:58:29
- **Subscription**: database-MCAJ6POB
- **High Availability**: None
- **Memory**: 3 MB used / 100 GB available
- **Monthly Network Cap**: 100 GB
- **Monthly Network Used**: 1.2 KB / 100 GB (0%)

## 📋 Steps to Complete Setup

### 1. Get Your Connection Details

From your Redis Cloud dashboard:

1. **Click on "Connect"** button (shown in your screenshot)
2. You'll see connection options. Look for:
   - **Public endpoint** (something like: `redis-xxxxx.c1.ap-southeast-2-1.ec2.cloud.redislabs.com:10796`)
   - **Password** (click the eye icon to reveal)
   - **Username** (usually "default")

### 2. Configure Environment Variables

You need to add these to your environment:

#### Option A: Standard Redis URL Format
```bash
# Format: redis://username:password@host:port
REDIS_URL=redis://default:YOUR_PASSWORD@YOUR_ENDPOINT.com:10795

# Also add for compatibility:
REDIS_HOST=YOUR_ENDPOINT.com
REDIS_PORT=10795
REDIS_PASSWORD=YOUR_PASSWORD
REDIS_USERNAME=default
```

#### Option B: Using Redis Cloud REST API (if available)
```bash
# If Redis Cloud provides REST API access:
REDIS_CLOUD_URL=YOUR_ENDPOINT
REDIS_CLOUD_PASSWORD=YOUR_PASSWORD
```

### 3. Add to Vercel Dashboard

1. **Go to**: https://vercel.com/unite-group/synthex/settings/environment-variables
2. **Add these variables**:

```bash
# Primary Redis URL
Key: REDIS_URL
Value: redis://default:YOUR_PASSWORD@redis-xxxxx.c1.ap-southeast-2-1.ec2.cloud.redislabs.com:10795
Environment: ✅ Production ✅ Preview ✅ Development

# Individual components (for compatibility)
Key: REDIS_HOST
Value: redis-xxxxx.c1.ap-southeast-2-1.ec2.cloud.redislabs.com
Environment: ✅ Production ✅ Preview ✅ Development

Key: REDIS_PORT
Value: 10795
Environment: ✅ Production ✅ Preview ✅ Development

Key: REDIS_PASSWORD
Value: YOUR_PASSWORD
Environment: ✅ Production ✅ Preview ✅ Development
```

### 4. Update Your Local .env.local

Add to `.env.local`:
```bash
# Redis Cloud Configuration
REDIS_URL=redis://default:YOUR_PASSWORD@YOUR_ENDPOINT:10795
REDIS_HOST=YOUR_ENDPOINT
REDIS_PORT=10795
REDIS_PASSWORD=YOUR_PASSWORD
REDIS_USERNAME=default

# Optional: If you want to use both Redis Cloud and Upstash as fallback
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

### 5. Update Application Code

Since Redis Cloud uses standard Redis protocol, your existing `src/lib/redis.js` should work. However, let's create an optimized version:

Create `src/lib/redis-cloud.js`:
```javascript
import { createClient } from 'redis';

const REDIS_CONFIG = {
  url: process.env.REDIS_URL,
  socket: {
    connectTimeout: 10000,
    reconnectStrategy: (retries) => {
      if (retries > 5) return null;
      return Math.min(retries * 100, 3000);
    },
    tls: {
      rejectUnauthorized: false // Required for Redis Cloud
    }
  }
};

class RedisCloudService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.init();
  }

  async init() {
    if (!process.env.REDIS_URL) {
      console.warn('Redis Cloud not configured');
      return;
    }

    try {
      this.client = createClient(REDIS_CONFIG);
      
      this.client.on('error', (err) => {
        console.error('Redis Cloud Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('✅ Connected to Redis Cloud');
        this.isConnected = true;
      });

      await this.client.connect();
    } catch (error) {
      console.error('Failed to connect to Redis Cloud:', error);
    }
  }

  // Your methods here...
}

export default new RedisCloudService();
```

### 6. Test Your Connection

Create `test-redis-cloud.js`:
```javascript
const { createClient } = require('redis');
require('dotenv').config({ path: '.env.local' });

async function testRedisCloud() {
  console.log('🔄 Testing Redis Cloud connection...');
  
  const client = createClient({
    url: process.env.REDIS_URL,
    socket: {
      tls: {
        rejectUnauthorized: false
      }
    }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Redis Cloud!');
    
    // Test SET
    await client.set('test:key', 'Hello from SYNTHEX!');
    console.log('✅ SET operation successful');
    
    // Test GET
    const value = await client.get('test:key');
    console.log('✅ GET operation successful:', value);
    
    // Test DELETE
    await client.del('test:key');
    console.log('✅ DELETE operation successful');
    
    // Get server info
    const info = await client.info('server');
    console.log('✅ Redis version:', info.match(/redis_version:([^\r\n]+)/)[1]);
    
    await client.quit();
    console.log('✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testRedisCloud();
```

Run: `node test-redis-cloud.js`

### 7. Deploy to Vercel

```bash
# Commit changes
git add .
git commit -m "Configure Redis Cloud for production"
git push origin main

# Deploy
vercel --prod
```

## 📊 Monitoring Your Redis Cloud

### From Your Dashboard:
1. **Metrics Tab**: Shows operations, bandwidth, connections
2. **Slowlog Tab**: Identifies slow queries
3. **Configuration Tab**: Adjust settings
4. **Data Browser**: View and manage keys

### Redis Insight Tool:
1. Download Redis Insight: https://redis.com/redis-enterprise/redis-insight/
2. Connect using your credentials
3. Visual interface for managing data

## 🔧 Troubleshooting

### Connection Issues:
```bash
# Test from command line
redis-cli -h YOUR_ENDPOINT -p 10795 -a YOUR_PASSWORD ping
# Should return: PONG
```

### TLS/SSL Issues:
Make sure to include in your connection:
```javascript
socket: {
  tls: {
    rejectUnauthorized: false
  }
}
```

### Timeout Issues:
Increase timeout in connection config:
```javascript
socket: {
  connectTimeout: 10000, // 10 seconds
  commandTimeout: 5000   // 5 seconds
}
```

## ✅ Advantages of Redis Cloud

With your Redis Cloud setup, you get:
- ✅ **100 GB Memory** - Massive capacity
- ✅ **Redis Stack** - Includes JSON, Search, TimeSeries modules
- ✅ **Sydney Region** - Low latency for APAC users
- ✅ **Redis 7.4** - Latest features
- ✅ **Persistence** - Data survives restarts
- ✅ **Professional Support** - From Redis Labs

## 🎯 Next Steps

1. **Get your connection details** from the Connect button
2. **Add environment variables** to Vercel
3. **Test the connection** locally
4. **Deploy** to production
5. **Monitor** usage in Redis Cloud dashboard

Your Redis Cloud instance is already set up and ready - you just need to connect it to your application!

---

*Note: Your Redis Cloud instance shows very low usage (3MB / 1.2KB network), so it's ready for production traffic.*