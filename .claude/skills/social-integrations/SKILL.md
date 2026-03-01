---
name: social-integrations
description: >-
  Social media platform integration guide for SYNTHEX. Documents the 9-platform
  architecture, OAuth connection flow, webhook signature verification, token
  encryption, and the base service contract. Use when adding platform support,
  debugging OAuth issues, or working on webhook handlers.
metadata:
  author: synthex
  version: "1.0"
  engine: synthex-ai-agency
  type: reference-skill
  triggers:
    - social platform
    - platform integration
    - oauth connection
    - webhook handler
    - webhook signature
    - platform service
    - twitter api
    - instagram api
    - linkedin api
    - youtube api
    - tiktok api
---

# Social Integrations — Platform Connection Guide

## Purpose

SYNTHEX integrates with 9 social media platforms. Each platform has its own
OAuth flow, API quirks, rate limits, and webhook formats. This skill documents
the shared architecture, per-platform differences, and the common patterns
for adding or debugging platform support.

## Platform Matrix

| Platform | Service File | OAuth | Webhooks | Direct API |
|----------|-------------|-------|----------|------------|
| YouTube | `youtube-service.ts` | Google OAuth 2.0 | Yes (PubSubHubbub) | YouTube Data API v3 |
| Instagram | `instagram-service.ts` | Meta OAuth 2.0 | Yes (Meta webhooks) | Instagram Graph API |
| TikTok | `tiktok-service.ts` | TikTok OAuth 2.0 | Yes | TikTok API v2 |
| X (Twitter) | `twitter-service.ts` | OAuth 2.0 + OAuth 1.0a | Yes | Twitter API v2 |
| Facebook | (via Meta) | Meta OAuth 2.0 | Yes (shared with IG) | Facebook Graph API |
| LinkedIn | `linkedin-service.ts` | LinkedIn OAuth 2.0 | Yes | LinkedIn API |
| Pinterest | `pinterest-service.ts` | Pinterest OAuth 2.0 | Yes | Pinterest API v5 |
| Reddit | `reddit-service.ts` | Reddit OAuth 2.0 | Yes | Reddit API |
| Threads | `threads-service.ts` | Meta OAuth 2.0 | Yes (shared with IG) | Threads API |

**Supporting files:**
- `twitter-sync-service.ts` — Twitter-specific analytics sync
- `competitor-fetcher.ts` — Cross-platform competitor data
- `mention-fetcher.ts` — Cross-platform mention tracking
- `sentiment-analyzer.ts` — NLP sentiment analysis for social content

## Base Service Contract

**File:** `lib/social/base-platform-service.ts`
**Purpose:** Defines the interface all platform services must implement

**PlatformCredentials:**
```typescript
interface PlatformCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  platformUserId?: string;
  platformUsername?: string;
  scopes?: string[];
}
```

**TokenRefreshCallback:** Callback for persisting refreshed credentials to DB.
Platform services call this when they automatically refresh an expired token.

**SyncAnalyticsResult:** Standardised analytics response with metrics
(impressions, engagements, followers, following, posts, likes, comments,
shares, reach, profileViews) and optional daily/per-post breakdowns.

**Key design pattern:** Every platform service extends the base contract. This
ensures the dashboard can display analytics from any platform using the same
component structure.

## OAuth Connection Flow

```
User clicks "Connect [Platform]"
  │
  ▼
Client: oauth-handler.ts → POST /api/auth/oauth/{provider}
  │
  ▼
Server: Generate PKCE challenge (lib/auth/pkce.ts)
  │  - generateCodeVerifier() → 32 bytes crypto-random
  │  - generateCodeChallenge() → SHA-256 hash
  │  - Store state in Redis/DB/memory (fallback chain)
  │
  ▼
Redirect to platform's OAuth consent screen
  │
  ▼
User grants permissions → Platform redirects to callback URL
  │
  ▼
Server: /api/auth/oauth/{provider}/callback
  │  - Verify PKCE state
  │  - Exchange code for tokens
  │  - Encrypt tokens (AES-256-GCM)
  │  - Store in PlatformConnection table
  │
  ▼
Redirect to /dashboard/settings with success toast
```

**PKCE storage fallback:** Redis → Database (OAuthPKCEState) → In-memory

**Token storage:** Access and refresh tokens are encrypted at rest using
`lib/encryption/api-key-encryption.ts` before writing to the database.

## Webhook Architecture

### Signature Verification

**File:** `lib/webhooks/signature-verifier.ts`
**Class:** `SignatureVerifier`

**Platform-specific secrets:**
```
twitter   → TWITTER_WEBHOOK_SECRET
facebook  → META_WEBHOOK_SECRET
instagram → META_WEBHOOK_SECRET (shared with Facebook)
tiktok    → TIKTOK_WEBHOOK_SECRET
linkedin  → LINKEDIN_WEBHOOK_SECRET
pinterest → PINTEREST_WEBHOOK_SECRET
youtube   → GOOGLE_WEBHOOK_SECRET
threads   → META_WEBHOOK_SECRET (shared with Facebook/Instagram)
reddit    → REDDIT_WEBHOOK_SECRET
stripe    → STRIPE_WEBHOOK_SECRET
internal  → INTERNAL_WEBHOOK_SECRET
```

**Security:** Uses `crypto.createHmac()` with `timingSafeEqual()` to prevent
timing attacks. All signatures are verified before any processing occurs.

### Webhook Handler

**File:** `lib/webhooks/webhook-handler.ts`
**Class:** `WebhookHandler`

**Two processing modes:**

1. **Synchronous (serverless):** `receiveAndProcess()` — Verifies signature,
   parses event, runs all registered handlers inline within the HTTP request.
   **Required for Vercel** because there is no long-lived process to poll a queue.

2. **Async queue (long-lived process):** `receive()` + `start()` — Enqueues
   events and processes them via a polling interval. Only for traditional servers.

**Event types:** `WebhookEventType` covers platform-specific events like
`post.created`, `comment.received`, `analytics.updated`, `mention.detected`.

### Social Webhook Handlers

**File:** `lib/webhooks/social-webhook-handlers.ts`
**Purpose:** Platform-specific webhook event processing (analytics sync,
mention tracking, engagement updates)

## Per-Platform Notes

### X (Twitter)
- **Dual OAuth:** Supports both OAuth 2.0 (user context) and OAuth 1.0a (app context)
- **Direct API vars:** `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`,
  `TWITTER_ACCESS_TOKEN_SECRET`, `TWITTER_BEARER_TOKEN`
- **Sync service:** Dedicated `twitter-sync-service.ts` for analytics sync
- **Rate limits:** Strict per-endpoint limits, tracked per 15-minute window

### Meta (Facebook, Instagram, Threads)
- **Shared webhook secret:** All three platforms use `META_WEBHOOK_SECRET`
- **Graph API:** Shared base URL (`graph.facebook.com`) with platform-specific edges
- **Page tokens:** Facebook requires page-level tokens (not user tokens) for posting

### LinkedIn
- **Direct API vars:** `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`
- **Organisation posts:** Requires `w_organization_social` scope for company page posting
- **UGC API:** Uses User-Generated Content API for post creation

### YouTube
- **Data API vars:** `YOUTUBE_API_KEY`, `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`
- **Quota system:** YouTube Data API uses quota units (not simple rate limits)
- **PubSubHubbub:** Webhook notifications via Google's PubSubHubbub hub

## Common Mistakes

| Mistake | Why It's Wrong | Correct Pattern |
|---------|---------------|----------------|
| Storing tokens in plain text | Security vulnerability | Encrypt with `api-key-encryption.ts` |
| Skipping signature verification | Webhook forgery risk | Always verify with `SignatureVerifier` |
| Using `receiveAndProcess()` in long-lived server | Unnecessary blocking | Use async queue mode |
| Hardcoding callback URLs | Breaks across environments | Use `NEXT_PUBLIC_APP_URL` env var |
| Ignoring token refresh | Stale credentials cause failures | Implement `TokenRefreshCallback` |
| Not handling rate limits | API bans and service disruption | Check platform-specific limits |

## Environment Variables

| Variable | Platform | Required |
|----------|----------|----------|
| `TWITTER_API_KEY` | X (Twitter) | For direct API |
| `TWITTER_API_SECRET` | X (Twitter) | For direct API |
| `TWITTER_ACCESS_TOKEN` | X (Twitter) | For direct API |
| `TWITTER_ACCESS_TOKEN_SECRET` | X (Twitter) | For direct API |
| `TWITTER_BEARER_TOKEN` | X (Twitter) | For direct API |
| `TWITTER_WEBHOOK_SECRET` | X (Twitter) | For webhooks |
| `LINKEDIN_CLIENT_ID` | LinkedIn | For OAuth |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn | For OAuth |
| `LINKEDIN_WEBHOOK_SECRET` | LinkedIn | For webhooks |
| `YOUTUBE_API_KEY` | YouTube | For Data API |
| `YOUTUBE_CLIENT_ID` | YouTube | For OAuth |
| `YOUTUBE_CLIENT_SECRET` | YouTube | For OAuth |
| `META_WEBHOOK_SECRET` | FB/IG/Threads | For webhooks |
| `TIKTOK_WEBHOOK_SECRET` | TikTok | For webhooks |
| `PINTEREST_WEBHOOK_SECRET` | Pinterest | For webhooks |
| `REDDIT_WEBHOOK_SECRET` | Reddit | For webhooks |
| `GOOGLE_WEBHOOK_SECRET` | YouTube | For webhooks |
| `INTERNAL_WEBHOOK_SECRET` | System | For internal webhooks |
| `API_ENCRYPTION_KEY` | All | Token encryption |
| `NEXT_PUBLIC_APP_URL` | All | OAuth callback base URL |

## File Index

| File | Purpose |
|------|---------|
| `lib/social/base-platform-service.ts` | Base service contract and types |
| `lib/social/twitter-service.ts` | X (Twitter) API integration |
| `lib/social/twitter-sync-service.ts` | Twitter analytics sync |
| `lib/social/instagram-service.ts` | Instagram Graph API |
| `lib/social/linkedin-service.ts` | LinkedIn API |
| `lib/social/youtube-service.ts` | YouTube Data API v3 |
| `lib/social/tiktok-service.ts` | TikTok API v2 |
| `lib/social/pinterest-service.ts` | Pinterest API v5 |
| `lib/social/reddit-service.ts` | Reddit API |
| `lib/social/threads-service.ts` | Threads API |
| `lib/social/index.ts` | Platform service exports |
| `lib/social/competitor-fetcher.ts` | Cross-platform competitor data |
| `lib/social/mention-fetcher.ts` | Cross-platform mention tracking |
| `lib/social/sentiment-analyzer.ts` | NLP sentiment analysis |
| `lib/webhooks/signature-verifier.ts` | Webhook signature verification |
| `lib/webhooks/webhook-handler.ts` | Central webhook processing |
| `lib/webhooks/social-webhook-handlers.ts` | Platform-specific webhook handlers |
| `lib/webhooks/verifier.ts` | Additional verification utilities |
| `lib/webhooks/index.ts` | Webhook module exports |
| `lib/auth/pkce.ts` | PKCE challenge generation |
| `lib/auth/oauth-handler.ts` | Client-side OAuth initiation |
| `lib/encryption/api-key-encryption.ts` | Token encryption/decryption |
