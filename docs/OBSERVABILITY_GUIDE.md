# SYNTHEX Observability Guide

> **Task:** UNI-423 - Monitoring & Observability Epic

This guide covers logging, error tracking, health monitoring, and observability best practices.

## Table of Contents

1. [Logging](#logging)
2. [Error Tracking](#error-tracking)
3. [Health Monitoring](#health-monitoring)
4. [Performance Monitoring](#performance-monitoring)
5. [Alerting](#alerting)
6. [Best Practices](#best-practices)

---

## Logging

### Structured Logger

SYNTHEX uses a JSON-structured logger for consistent, parseable logs.

```typescript
import { logger } from '@/lib/logger';

// Basic logging
logger.info('User signed in', { userId: '123' });
logger.warn('Rate limit approaching', { remaining: 10 });
logger.error('Payment failed', { orderId: '456', error: err });

// Create child logger with preset fields
const reqLogger = logger.child({ requestId: 'req_123' });
reqLogger.info('Processing request');
reqLogger.info('Request complete');
```

### Log Levels

| Level | Use Case | Production |
|-------|----------|------------|
| `debug` | Development details | Hidden |
| `info` | Normal operations | Visible |
| `warn` | Potential issues | Visible |
| `error` | Failures | Visible |

### Log Format

```json
{
  "level": "info",
  "message": "User signed in",
  "timestamp": "2026-02-02T10:30:00.000Z",
  "service": "synthex",
  "requestId": "req_123",
  "userId": "user_456"
}
```

### Configuration

```bash
# Set log level
LOG_LEVEL=debug  # debug, info, warn, error

# Defaults:
# - Development: debug
# - Production: info
```

---

## Error Tracking

### Tracking Errors

```typescript
import { trackError, ErrorSeverity, ErrorCategory } from '@/lib/observability';

// Basic tracking (auto-classifies severity and category)
trackError(error);

// With context
trackError(error, {
  severity: ErrorSeverity.HIGH,
  category: ErrorCategory.DATABASE,
  userId: 'user_123',
  requestId: 'req_456',
  operation: 'createUser',
  metadata: { email: 'user@example.com' }
});
```

### Error Severity

| Severity | Description | Example |
|----------|-------------|---------|
| `LOW` | Minor issues | Validation errors |
| `MEDIUM` | Notable problems | External API timeout |
| `HIGH` | Significant failures | Database connection failed |
| `CRITICAL` | System-wide impact | Auth system down |

### Error Categories

| Category | Description |
|----------|-------------|
| `VALIDATION` | Input validation failures |
| `AUTHENTICATION` | Login/token failures |
| `AUTHORIZATION` | Permission denied |
| `DATABASE` | Database errors |
| `EXTERNAL_SERVICE` | Third-party API failures |
| `NETWORK` | Connection issues |
| `RATE_LIMIT` | Rate limiting triggered |
| `INTERNAL` | Application bugs |

### Wrapped Functions

```typescript
import { withErrorTracking } from '@/lib/observability';

// Async function with automatic error tracking
const result = await withErrorTracking(
  () => processPayment(data),
  { operation: 'payment', userId }
);

// Sync function
const result = withErrorTrackingSync(
  () => parseConfig(data),
  { operation: 'parseConfig' }
);
```

### Query Errors

```typescript
import { getRecentErrors, getErrorStats } from '@/lib/observability';

// Get recent errors
const errors = getRecentErrors(50, {
  severity: ErrorSeverity.HIGH,
  category: ErrorCategory.DATABASE,
  since: new Date(Date.now() - 60 * 60 * 1000), // Last hour
});

// Get statistics
const stats = getErrorStats(60); // Last 60 minutes
console.log(stats.total);
console.log(stats.bySeverity);
console.log(stats.topErrors);
```

---

## Health Monitoring

### Health Dashboard API

```bash
# Full health report
GET /api/monitoring/health-dashboard

# Quick status check
GET /api/monitoring/health-dashboard?view=quick

# Recent errors
GET /api/monitoring/health-dashboard?view=errors&count=50&since=60
```

### Response Format

```json
{
  "success": true,
  "health": {
    "status": "healthy",
    "timestamp": "2026-02-02T10:30:00.000Z",
    "uptime": 86400,
    "version": "2.0.1",
    "environment": "production",
    "components": [
      {
        "name": "database",
        "status": "healthy",
        "latency": 12
      },
      {
        "name": "memory",
        "status": "healthy",
        "details": { "heapUsedMB": 150, "heapPercent": 45 }
      },
      {
        "name": "api",
        "status": "healthy",
        "details": { "requestsPerMinute": 120, "errorRate": 0.5 }
      }
    ],
    "metrics": {
      "memory": { "heapUsedMB": 150, "usagePercent": 45 },
      "errors": { "last5Minutes": 2, "last1Hour": 15 },
      "api": { "requestsPerMinute": 120, "errorRate": 0.5 }
    },
    "alerts": []
  }
}
```

### Health Statuses

| Status | Description | HTTP Code |
|--------|-------------|-----------|
| `healthy` | All systems operational | 200 |
| `degraded` | Minor issues, still functional | 200 |
| `unhealthy` | Critical failures | 503 |

### Programmatic Health Check

```typescript
import { getSystemHealth, getQuickHealth } from '@/lib/observability';

// Full health check
const health = await getSystemHealth();
console.log(health.status);
console.log(health.components);
console.log(health.alerts);

// Quick check (for probes)
const quick = await getQuickHealth();
if (quick.status === 'unhealthy') {
  // Handle degraded service
}
```

---

## Performance Monitoring

### Metrics API

```bash
# Performance metrics (JSON)
GET /api/performance/metrics

# Prometheus format
GET /api/performance/metrics?format=prometheus

# Performance report
GET /api/monitoring/performance?view=report&period=60
```

### Track Custom Metrics

```typescript
import { trackAPIResponse, trackDatabaseQuery } from '@/lib/monitoring/performance-monitor';

// Track API response
trackAPIResponse('/api/users', 'GET', 200, startTime, userId, requestId);

// Track database query
trackDatabaseQuery('User.findMany', startTime, true, rowCount);
```

### Performance Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| API p95 | > 1000ms | > 2000ms |
| Error rate | > 5% | > 10% |
| Memory usage | > 75% | > 90% |
| DB query time | > 500ms | > 1000ms |

---

## Alerting

### Alert Sources

1. **Performance Monitor** - Response time and error rate alerts
2. **Error Tracker** - High/critical error alerts
3. **Health Dashboard** - Component health alerts

### Alert API

```bash
# Get recent alerts
GET /api/monitoring/performance?view=alerts&count=20
```

### Alert Integration

```typescript
import performanceMonitor from '@/lib/monitoring/performance-monitor';

// Get recent alerts
const alerts = await performanceMonitor.getRecentAlerts(20);

// Configure thresholds
performanceMonitor.setThresholds({
  responseTime: { warning: 500, critical: 1000 },
  errorRate: { warning: 5, critical: 10 },
  memoryUsage: { warning: 75, critical: 90 },
});
```

---

## Best Practices

### 1. Structured Logging

```typescript
// ✅ DO: Include context
logger.info('User action', {
  userId: '123',
  action: 'purchase',
  productId: '456',
  amount: 99.99
});

// ❌ DON'T: Log unstructured strings
console.log('User 123 purchased product 456 for $99.99');
```

### 2. Error Context

```typescript
// ✅ DO: Include relevant context
trackError(error, {
  operation: 'createOrder',
  userId: user.id,
  metadata: { orderId, productIds }
});

// ❌ DON'T: Track bare errors
trackError(error);
```

### 3. Health Check Granularity

```typescript
// ✅ DO: Check specific components
const health = await getSystemHealth();
if (health.components.find(c => c.name === 'database')?.status === 'unhealthy') {
  // Handle database-specific issue
}

// ❌ DON'T: Only check overall status
if (health.status !== 'healthy') {
  // Can't tell what's wrong
}
```

### 4. Performance Tracking

```typescript
// ✅ DO: Track at boundaries
const startTime = Date.now();
try {
  const result = await externalAPI.call();
  trackAPIResponse('/external/api', 'POST', 200, startTime);
  return result;
} catch (error) {
  trackAPIResponse('/external/api', 'POST', 500, startTime);
  throw error;
}

// ❌ DON'T: Track internal operations
trackAPIResponse('helper.formatData', 'CALL', 200, startTime); // Not useful
```

### 5. Log Levels

```typescript
// ✅ DO: Use appropriate levels
logger.debug('Cache lookup', { key }); // Development only
logger.info('User logged in', { userId }); // Normal operation
logger.warn('Retry attempt', { attempt: 2 }); // Potential issue
logger.error('Payment failed', { error }); // Actual failure

// ❌ DON'T: Log everything at info
logger.info('Entering function'); // Too verbose
logger.info('Variable x is 5'); // Debug level
```

---

## Monitoring Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/health` | Basic health check |
| `/api/health/live` | Liveness probe |
| `/api/health/ready` | Readiness probe |
| `/api/monitoring/health-dashboard` | Full health dashboard |
| `/api/monitoring/performance` | Performance metrics |
| `/api/performance/metrics` | Prometheus metrics |

---

## Related Documentation

- [Scalability Guide](./SCALABILITY_GUIDE.md)
- [Testing Guide](./TESTING_GUIDE.md)
- [Troubleshooting](./TROUBLESHOOTING.md)

---

*Last updated: 2026-02-02*
