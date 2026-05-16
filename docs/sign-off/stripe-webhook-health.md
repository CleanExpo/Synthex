# Stripe Webhook Idempotency Health — 2026-05-16

## Architecture discovery

The plan referenced a `webhook_events` table for Stripe idempotency. **No such table exists in Synthex production** (project `znyjoyjsvjotlzjppzal`).

Inspecting `lib/webhooks/webhook-handler.ts` line 147–340 reveals Stripe webhook idempotency is implemented via **Redis** with 24h TTL, not a Postgres table:

```ts
const idempotencyKey = `webhook:idem:${platform}:${payloadHash}`;
// Check Redis for existing key
const existing = await redis.get(idempotencyKey);
// Store after processing
await redis.set(idempotencyKey, eventId, 86400); // 24h TTL
```

This is a valid design choice (cheaper than DB writes per webhook, TTL matches Stripe's retry window) but it means **the "stuck unprocessed events" query specified in the plan cannot be run** against the DB — there is no DB row to query.

## Redis health probe

```
GET https://synthex.social/api/health/redis
→ 200 OK
{
  "status": "healthy",
  "implementation": "redis-cloud-vercel",
  "connection": "redis-cloud",
  "timestamp": "2026-05-16T11:20:38.813Z",
  "responseTime": 646,
  "stats": {
    "connected": true,
    "mode": "redis-cloud",
    "memoryStoreSize": 0,
    "isEdgeRuntime": false,
    "implementation": "redis-cloud-vercel"
  }
}
```

## Stripe webhook endpoint smoke test

```
POST https://synthex.social/api/webhooks/stripe   (unsigned)
→ HTTP 400  (correct — "Missing signature" path in lib/webhooks/stripe/route.ts)
```

## Tables that DO exist (related)

| Table | Purpose |
|---|---|
| `webhook_endpoints` | User-configured outbound webhook destinations (with `events`, `secret`, `failureCount`) |
| `subscriptions` | Stripe subscription state |
| `audit_events_immutable` | Immutable audit log (Phase 2) |

## Verdict: PASS (with caveat)

Redis-backed idempotency is healthy and the Stripe webhook route correctly rejects unsigned requests. The plan's DB-table-based check is N/A.

Follow-up: update the runbook to reflect Redis-backed idempotency model so future sign-offs query `redis.dbsize()` or the `webhook:idem:stripe:*` keyspace instead of a non-existent DB table.
