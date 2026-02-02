# SYNTHEX Scalability Guide

> **Task:** UNI-435 - Scalability & Performance Epic

This guide covers production-ready scalability patterns implemented in SYNTHEX.

## Table of Contents

1. [Database Optimization](#database-optimization)
2. [API Response Caching](#api-response-caching)
3. [Rate Limiting](#rate-limiting)
4. [Query Batching](#query-batching)
5. [Performance Monitoring](#performance-monitoring)
6. [Best Practices](#best-practices)

---

## Database Optimization

### Connection Pooling

SYNTHEX uses multi-level connection pooling:

```typescript
// lib/prisma.ts - Singleton with connection pooling
import { prisma } from '@/lib/prisma';

// Environment variables for pool configuration
// DATABASE_URL=postgresql://...?connection_limit=10&pool_timeout=10
// DATABASE_POOL_SIZE=10 (default)
// DATABASE_POOL_TIMEOUT=10 (seconds)
```

**Key Features:**
- Supabase PgBouncer (port 6543) for external pooling
- Prisma connection pool for application-level pooling
- Automatic health checks and reconnection
- Graceful shutdown handling

### Query Optimization

```typescript
// Use select to limit fields
const users = await prisma.user.findMany({
  select: { id: true, name: true, email: true }
});

// Use pagination for large datasets
const posts = await prisma.post.findMany({
  take: 20,
  skip: (page - 1) * 20,
  cursor: lastId ? { id: lastId } : undefined,
});

// Include relations sparingly
const user = await prisma.user.findUnique({
  where: { id },
  include: {
    campaigns: { take: 5 } // Limit related records
  }
});
```

### Transaction Helper

```typescript
import { withTransaction } from '@/lib/prisma';

// Automatic timeout and retry handling
const result = await withTransaction(async (tx) => {
  const user = await tx.user.update({ ... });
  const campaign = await tx.campaign.create({ ... });
  return { user, campaign };
}, 5000); // 5 second timeout
```

---

## API Response Caching

### Basic Usage

```typescript
import { withCache } from '@/lib/scalability';
import { NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return withCache('quotes:list', { ttl: 300 }, async () => {
    const quotes = await prisma.quote.findMany();
    return NextResponse.json({ quotes });
  });
}
```

### Cache with Tags

```typescript
// Cacheable with invalidation tags
export async function GET(request: NextRequest, { params }) {
  return withCache(
    `quote:${params.id}`,
    {
      ttl: 600,
      tags: ['quotes', `quote:${params.id}`]
    },
    async () => {
      const quote = await prisma.quote.findUnique({
        where: { id: params.id }
      });
      return NextResponse.json({ quote });
    }
  );
}
```

### Cache Invalidation

```typescript
import { invalidateCache, invalidateCacheKey } from '@/lib/scalability';

// After creating/updating a quote
await invalidateCache('quotes'); // Invalidates all quote caches

// Invalidate specific cache
await invalidateCacheKey(`quote:${id}`);
```

### Stale-While-Revalidate

```typescript
// Serve stale data while fetching fresh in background
return withCache(
  'dashboard:stats',
  {
    ttl: 60,               // Fresh for 1 minute
    staleWhileRevalidate: 300  // Stale OK for 5 more minutes
  },
  async () => {
    // Expensive computation
  }
);
```

---

## Rate Limiting

### Using Rate Limiters

```typescript
import { checkRateLimit, withRateLimit } from '@/lib/scalability';

// Check rate limit manually
export async function POST(request: NextRequest) {
  const result = await checkRateLimit(request, 'write');

  if (!result.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: result.headers }
    );
  }

  // Process request...
}

// Or use middleware wrapper
const rateLimitedHandler = withRateLimit('api');

export async function GET(request: NextRequest) {
  return rateLimitedHandler(request, async () => {
    return NextResponse.json({ data: '...' });
  });
}
```

### Pre-configured Limiters

| Limiter | Limit | Window | Use Case |
|---------|-------|--------|----------|
| `auth` | 5 | 15 min | Login, signup, password reset |
| `api` | 100 | 1 min | Standard API endpoints |
| `read` | 500 | 1 min | Read-heavy endpoints |
| `write` | 30 | 1 min | Create/update operations |
| `ai` | 20 | 1 min | AI/expensive operations |
| `webhook` | 1000 | 1 min | Incoming webhooks |

### Custom Rate Limiter

```typescript
import { getRateLimiter } from '@/lib/scalability';

const customLimiter = getRateLimiter('custom', {
  limit: 50,
  window: 3600, // 1 hour
  message: 'Custom limit reached',
  keyGenerator: (req) => {
    // Rate limit by user ID instead of IP
    const userId = req.headers.get('x-user-id');
    return userId || 'anonymous';
  }
});
```

---

## Query Batching

Prevent N+1 queries using the DataLoader pattern:

### Basic Usage

```typescript
import { createLoader } from '@/lib/scalability';

const userLoader = createLoader(async (ids: string[]) => {
  const users = await prisma.user.findMany({
    where: { id: { in: ids } }
  });
  const userMap = new Map(users.map(u => [u.id, u]));
  return ids.map(id => userMap.get(id) || null);
});

// These are batched into a single query!
const [user1, user2, user3] = await Promise.all([
  userLoader.load('id1'),
  userLoader.load('id2'),
  userLoader.load('id3'),
]);
```

### Request-Scoped Loaders

```typescript
import { LoaderContext, loaderFactories } from '@/lib/scalability';

export async function GET(request: NextRequest) {
  // Create context for this request
  const ctx = new LoaderContext();

  try {
    const userLoader = ctx.getLoader('users', async (ids) => {
      // Batch function
    });

    // Use loaders...

  } finally {
    // Clean up after request
    ctx.clearAll();
  }
}
```

### Pre-built Loaders

```typescript
import { loaderFactories } from '@/lib/scalability';
import { prisma } from '@/lib/prisma';

const userLoader = loaderFactories.users(prisma);
const campaignLoader = loaderFactories.campaigns(prisma);
const projectLoader = loaderFactories.projects(prisma);
```

---

## Performance Monitoring

### Using the Performance Monitor

```typescript
import { trackAPIResponse, trackDatabaseQuery } from '@/lib/monitoring/performance-monitor';

// Track API responses
trackAPIResponse('/api/users', 'GET', 200, startTime, userId, requestId);

// Track database queries
trackDatabaseQuery('User.findMany', startTime, true, 25);
```

### Metrics API

```bash
# Get performance report
GET /api/monitoring/performance?view=report&period=60

# Get real-time metrics
GET /api/monitoring/performance?view=realtime

# Prometheus format
GET /api/performance/metrics?format=prometheus
```

### Slow Query Detection

```typescript
// Automatic logging of slow queries (>1s)
// Configured in lib/prisma.ts

// Custom tracking
import performanceMonitor from '@/lib/monitoring/performance-monitor';

const report = await performanceMonitor.generateReport(60);
console.log('Slowest endpoints:', report.api.slowestEndpoints);
```

---

## Best Practices

### 1. Database Queries

```typescript
// ✅ DO: Use pagination
const items = await prisma.item.findMany({ take: 20, skip: offset });

// ✅ DO: Select only needed fields
const users = await prisma.user.findMany({
  select: { id: true, name: true }
});

// ❌ DON'T: Load all records
const allItems = await prisma.item.findMany();

// ❌ DON'T: N+1 queries
for (const post of posts) {
  const author = await prisma.user.findUnique({ where: { id: post.authorId } });
}
```

### 2. Caching Strategy

```typescript
// ✅ DO: Cache expensive computations
const stats = await withCache('dashboard:stats', { ttl: 300 }, computeStats);

// ✅ DO: Use cache tags for invalidation
await withCache(`user:${id}`, { ttl: 600, tags: ['users'] }, getUser);

// ❌ DON'T: Cache user-specific data without proper keys
await withCache('current-user', { ttl: 600 }, getCurrentUser); // Wrong!

// ✅ DO: Include user ID in cache key
await withCache(`user-dashboard:${userId}`, { ttl: 300 }, getDashboard);
```

### 3. Rate Limiting

```typescript
// ✅ DO: Apply appropriate limits per endpoint type
const authLimiter = getRateLimiter('auth');      // Strict
const readLimiter = getRateLimiter('read');      // Generous
const writeLimiter = getRateLimiter('write');    // Moderate

// ✅ DO: Include rate limit headers
return NextResponse.json(data, { headers: result.headers });

// ❌ DON'T: Use same limit for all endpoints
```

### 4. Connection Management

```typescript
// ✅ DO: Use the singleton Prisma client
import { prisma } from '@/lib/prisma';

// ❌ DON'T: Create new PrismaClient instances
const client = new PrismaClient(); // Wrong!

// ✅ DO: Use transactions for related operations
await withTransaction(async (tx) => {
  await tx.user.update({ ... });
  await tx.notification.create({ ... });
});

// ❌ DON'T: Multiple separate updates
await prisma.user.update({ ... });
await prisma.notification.create({ ... });
```

### 5. Error Handling

```typescript
// ✅ DO: Use retry logic for transient failures
import { executeWithRetry } from '@/lib/prisma';

const result = await executeWithRetry(
  () => prisma.user.findUnique({ where: { id } }),
  3,  // max retries
  1000 // initial delay
);
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Pooled connection string | Required |
| `DIRECT_URL` | Direct connection string | Required |
| `DATABASE_POOL_SIZE` | Max connections | 10 |
| `DATABASE_POOL_TIMEOUT` | Connection timeout (s) | 10 |
| `UPSTASH_REDIS_REST_URL` | Redis URL for caching | Optional |
| `UPSTASH_REDIS_REST_TOKEN` | Redis token | Optional |

---

## Monitoring Checklist

- [ ] Monitor p95/p99 response times via `/api/monitoring/performance`
- [ ] Set up alerts for error rates > 5%
- [ ] Track slow queries (>1s) in logs
- [ ] Monitor memory usage via metrics endpoint
- [ ] Review rate limit hit rates weekly

---

*Last updated: 2026-02-02*
