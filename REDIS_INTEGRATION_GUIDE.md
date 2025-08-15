# 🚀 Redis Integration Guide for SYNTHEX

## Overview
This guide explains how to use the new unified Redis service throughout your SYNTHEX application. The system automatically selects the best Redis implementation based on your deployment environment.

## 📦 Quick Start

### Basic Import
```javascript
// Import the unified Redis service
import redisService from '@/lib/redis-unified';

// Or import specific functions
import { 
  set, 
  get, 
  del, 
  createSession, 
  checkRateLimit 
} from '@/lib/redis-unified';
```

## 🔧 Core Features

### 1. Basic Cache Operations

```javascript
// Set a value with TTL (in seconds)
await set('key', 'value', 3600); // Expires in 1 hour

// Get a value
const value = await get('key');

// Delete a key
await del('key');

// Check if key exists
const exists = await exists('key');

// Set expiration
await expire('key', 3600);

// Get TTL
const ttl = await ttl('key');
```

### 2. Session Management

```javascript
import { createSession, getSession, updateSession, deleteSession } from '@/lib/redis-unified';

// Create a new session
const sessionId = await createSession('user123', {
  email: 'user@example.com',
  role: 'user',
  loginTime: new Date().toISOString()
}, 86400); // 24 hour TTL

// Get session
const session = await getSession(sessionId);

// Update session
await updateSession(sessionId, {
  lastActivity: new Date().toISOString()
});

// Delete session
await deleteSession(sessionId);
```

### 3. Rate Limiting

```javascript
import { checkRateLimit } from '@/lib/redis-unified';

// Check rate limit
const result = await checkRateLimit(
  'api:endpoint:user123',  // Unique key
  100,                      // Max requests
  60000                     // Window in milliseconds
);

if (!result.allowed) {
  // Rate limit exceeded
  return new Response('Too many requests', { 
    status: 429,
    headers: {
      'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000)
    }
  });
}
```

## 🛡️ Middleware Integration

### Session Middleware

```javascript
import { withSession, withOptionalSession } from '@/middleware/session';

// Protected route (requires authentication)
export async function GET(request: NextRequest) {
  return withSession(request, async (req, session) => {
    // session.user contains user data
    // session.sessionId contains the session ID
    return NextResponse.json({
      user: session.user,
      message: 'Authenticated route'
    });
  });
}

// Optional authentication
export async function GET(request: NextRequest) {
  return withOptionalSession(request, async (req, session) => {
    if (session) {
      // User is authenticated
      return NextResponse.json({ authenticated: true });
    }
    // User is not authenticated
    return NextResponse.json({ authenticated: false });
  });
}
```

### Rate Limiting Middleware

```javascript
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/middleware/rate-limit';

// Using presets
export async function POST(request: NextRequest) {
  return withRateLimit(request, RATE_LIMIT_PRESETS.api, async (req) => {
    // Your API logic here
    return NextResponse.json({ success: true });
  });
}

// Custom configuration
export async function POST(request: NextRequest) {
  return withRateLimit(request, {
    limit: 5,
    windowMs: 60000, // 1 minute
    message: 'Too many requests'
  }, async (req) => {
    // Your API logic here
    return NextResponse.json({ success: true });
  });
}
```

## 📝 Example API Routes

### Login with Redis Integration
```javascript
// app/api/auth/login-redis/route.ts
import { checkRateLimit, createSession } from '@/lib/redis-unified';

export async function POST(request: NextRequest) {
  // Rate limiting
  const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
  const rateLimit = await checkRateLimit(`login:${clientIp}`, 5, 900000);
  
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many login attempts' },
      { status: 429 }
    );
  }
  
  // ... authentication logic ...
  
  // Create Redis session
  const sessionId = await createSession(userId, {
    email: user.email,
    loginTime: new Date().toISOString()
  });
  
  // Return response with session
  const response = NextResponse.json({ success: true });
  response.cookies.set('redis-session-id', sessionId);
  return response;
}
```

### Cached API Response
```javascript
// app/api/data/route.ts
import { get, set } from '@/lib/redis-unified';

export async function GET(request: NextRequest) {
  const cacheKey = 'api:data:all';
  
  // Check cache first
  const cached = await get(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }
  
  // Fetch fresh data
  const data = await fetchDataFromDatabase();
  
  // Cache for 5 minutes
  await set(cacheKey, data, 300);
  
  return NextResponse.json(data);
}
```

## 🔍 Health Monitoring

### Check Redis Health
```javascript
// GET /api/health/redis
const response = await fetch('/api/health/redis');
const health = await response.json();

console.log(health);
// {
//   status: 'healthy',
//   implementation: 'redis-cloud-vercel',
//   connection: 'redis-cloud',
//   stats: { ... }
// }
```

### Performance Testing (Admin Only)
```javascript
// POST /api/health/redis
const response = await fetch('/api/health/redis', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    iterations: 10,
    dataSize: 1024
  })
});
```

## 🌐 Environment Configuration

### Required Environment Variables
```env
# Redis Cloud Configuration
REDIS_URL=redis://default:password@host:port
REDIS_HOST=redis-xxxxx.ec2.redns.redis-cloud.com
REDIS_PORT=10795
REDIS_PASSWORD=your-password
REDIS_USERNAME=default

# Optional: Upstash for Edge Runtime
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

## 🚀 Deployment Considerations

### Vercel Deployment
- The unified service automatically uses `redis-cloud-vercel.js` for optimal performance
- Connection pooling is handled automatically
- Falls back to memory storage if Redis is unavailable

### Local Development
- Uses standard Redis client for better debugging
- Can connect to local Redis or Redis Cloud
- Memory fallback available for testing without Redis

### Edge Runtime
- Automatically switches to Upstash REST API
- Compatible with Vercel Edge Functions
- Lightweight and fast

## 📊 Implementation Priority

The unified Redis service selects implementations in this order:
1. **Redis Cloud** (Vercel production)
2. **Upstash** (Edge Runtime)
3. **Standard Redis** (Local development)
4. **Memory Fallback** (No Redis configured)

## 🛠️ Troubleshooting

### Common Issues

1. **"Redis not configured" warning**
   - Ensure environment variables are set
   - Check `.env.local` for local development
   - Verify Vercel dashboard for production

2. **Rate limit not working**
   - Verify Redis connection is active
   - Check implementation type: `await getImplementationType()`
   - Memory fallback has limited rate limiting

3. **Sessions not persisting**
   - Ensure cookies are being set correctly
   - Check Redis connection health
   - Verify session TTL settings

### Debug Commands
```javascript
import { healthCheck, getStats, getImplementationType } from '@/lib/redis-unified';

// Check health
const health = await healthCheck();
console.log('Redis health:', health);

// Get statistics
const stats = await getStats();
console.log('Redis stats:', stats);

// Check implementation
const impl = await getImplementationType();
console.log('Using implementation:', impl);
```

## 📚 API Reference

### Core Functions
- `set(key, value, ttl)` - Store a value
- `get(key)` - Retrieve a value
- `del(key)` - Delete a key
- `exists(key)` - Check if key exists
- `expire(key, seconds)` - Set expiration
- `ttl(key)` - Get time to live

### Session Functions
- `createSession(userId, data, ttl)` - Create session
- `getSession(sessionId)` - Get session
- `updateSession(sessionId, data)` - Update session
- `deleteSession(sessionId)` - Delete session
- `getUserSessions(userId)` - Get user's sessions

### Rate Limiting
- `checkRateLimit(key, limit, windowMs)` - Check rate limit

### Monitoring
- `healthCheck()` - Check Redis health
- `getStats()` - Get statistics
- `getImplementationType()` - Get current implementation

## 🎯 Best Practices

1. **Always handle fallbacks** - Redis might not always be available
2. **Use appropriate TTLs** - Don't cache forever
3. **Namespace your keys** - Prevent collisions: `app:feature:key`
4. **Monitor health regularly** - Set up health check alerts
5. **Test locally** - Use the test scripts provided
6. **Log errors** - But don't expose sensitive data

## 📞 Support

For issues or questions about Redis integration:
1. Check the health endpoint: `/api/health/redis`
2. Review logs in Vercel dashboard
3. Test connection with provided scripts
4. Check Redis Cloud dashboard for service status

---

*Last Updated: 2025-08-15*
*Redis Cloud Instance: database-MCAJ6POB (#13336170)*