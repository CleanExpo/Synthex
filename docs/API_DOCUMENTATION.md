# SYNTHEX API Documentation

**Version:** 2.0.1
**Base URL:** `https://synthex.social/api`
**Authentication:** Bearer Token (JWT) or API Key

---

## Table of Contents

1. [Authentication](#-authentication)
2. [Health Check APIs](#-health-check-apis)
3. [Analytics & Reporting](#-analytics--reporting)
4. [Content Generation](#-content-generation)
5. [Campaign Management](#-campaign-management)
6. [Post Scheduling](#-post-scheduling)
7. [Quotes API](#-quotes-api)
8. [Team Management](#-team-management)
9. [Notifications](#-notifications)
10. [Enterprise Security](#-enterprise-security-features)
11. [Performance Monitoring](#-performance-monitoring)
12. [Content Library](#-content-library)
13. [Workflows](#-workflows)
14. [Platform Integrations](#-platform-integrations)
15. [Error Responses](#-error-responses)
16. [Rate Limiting](#-rate-limiting)
17. [Webhooks](#-webhooks)
18. [SDK & Libraries](#-sdk--libraries)

---

## 🔐 Authentication

All API endpoints require authentication via Bearer token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Obtain Token
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user-123",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "admin"
    }
  },
  "message": "Login successful"
}
```

---

## 🏥 Health Check APIs

Health check endpoints for monitoring and load balancer integration.

### Comprehensive Health Check
```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-02T12:00:00Z",
  "version": "2.0.1",
  "buildId": "abc1234",
  "environment": "production",
  "region": "iad1",
  "uptime": 86400,
  "responseTime": 45,
  "checks": {
    "database": { "status": "healthy", "latency": 12, "message": "Connected" },
    "cache": { "status": "healthy", "latency": 3, "message": "Mode: upstash" },
    "environment": { "status": "healthy", "message": "All configured" },
    "resources": { "status": "healthy", "message": "Heap: 45%" }
  },
  "endpoints": {
    "live": "/api/health/live",
    "ready": "/api/health/ready",
    "database": "/api/health/db",
    "redis": "/api/health/redis"
  }
}
```

### Liveness Probe
```http
GET /api/health/live
```

Lightweight check for load balancer liveness probes. Returns 200 if process is alive.

**Response:**
```json
{
  "status": "alive",
  "timestamp": "2026-02-02T12:00:00Z",
  "uptime": 86400
}
```

### Readiness Probe
```http
GET /api/health/ready
```

Checks if service can accept traffic (database, cache connections).

**Response:**
```json
{
  "status": "ready",
  "timestamp": "2026-02-02T12:00:00Z",
  "responseTime": 25,
  "checks": {
    "database": { "status": "healthy", "latency": 10 },
    "cache": { "status": "healthy", "latency": 2 }
  },
  "summary": {
    "healthy": 2,
    "degraded": 0,
    "unhealthy": 0,
    "total": 2
  }
}
```

### Database Health
```http
GET /api/health/db
```

### Redis/Cache Health
```http
GET /api/health/redis
```

### Authentication Health
```http
GET /api/health/auth
```

---

## 📊 Analytics & Reporting

### Get Analytics Overview
```http
GET /api/v1/analytics/overview
```

**Query Parameters:**
- `startDate` (optional): Start date (ISO format)
- `endDate` (optional): End date (ISO format)
- `platform` (optional): Filter by platform

**Response:**
```json
{
  "success": true,
  "data": {
    "totalContent": 245,
    "totalEngagement": 12450,
    "averageEngagement": 50.8,
    "topPlatforms": ["twitter", "linkedin"],
    "contentTypes": {
      "posts": 180,
      "articles": 45,
      "campaigns": 20
    }
  },
  "message": "Analytics overview retrieved successfully"
}
```

### Get Content Performance
```http
GET /api/v1/analytics/content-performance
```

**Response:**
```json
{
  "success": true,
  "data": {
    "contentItems": [
      {
        "id": "content-123",
        "title": "AI Marketing Trends",
        "platform": "linkedin",
        "engagement": 245,
        "reach": 1200,
        "clicks": 45,
        "shares": 12
      }
    ],
    "totalItems": 245,
    "averageEngagement": 50.8
  }
}
```

---

## ✍️ Content Generation

### Generate Content
```http
POST /api/v1/content/generate
Content-Type: application/json

{
  "prompt": "Write a social media post about AI marketing",
  "platform": "linkedin",
  "tone": "professional",
  "length": "medium"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "content": "🚀 The future of marketing is here with AI...",
    "metadata": {
      "wordCount": 120,
      "estimatedReadTime": "30 seconds",
      "suggestedHashtags": ["#AI", "#Marketing", "#Innovation"]
    },
    "suggestions": [
      "Consider adding a call-to-action",
      "Include industry statistics"
    ]
  },
  "message": "Content generated successfully"
}
```

### Get Content Drafts
```http
GET /api/v1/content/drafts
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `platform` (optional): Filter by platform

---

## 📅 Campaign Management

### Create Campaign
```http
POST /api/v1/campaigns
Content-Type: application/json

{
  "name": "Q4 Marketing Push",
  "description": "End of year marketing campaign",
  "platforms": ["twitter", "linkedin", "facebook"],
  "startDate": "2024-10-01T00:00:00Z",
  "endDate": "2024-12-31T23:59:59Z",
  "budget": 5000,
  "targetAudience": "B2B professionals"
}
```

### Get Campaigns
```http
GET /api/v1/campaigns
```

**Query Parameters:**
- `status` (optional): `draft`, `active`, `paused`, `completed`
- `platform` (optional): Filter by platform
- `page`, `limit`: Pagination

---

## 📝 Post Scheduling

### Schedule Post
```http
POST /api/v1/posts
Content-Type: application/json

{
  "content": "Excited to share our latest AI insights! 🚀",
  "platforms": ["twitter", "linkedin"],
  "scheduledTime": "2024-01-15T10:00:00Z",
  "media": ["image-url-1.jpg"],
  "campaignId": "campaign-123"
}
```

### Get Scheduled Posts
```http
GET /api/v1/posts
```

**Query Parameters:**
- `status`: `scheduled`, `published`, `failed`
- `platform`: Filter by platform
- `startDate`, `endDate`: Date range filter

---

## 💬 Quotes API

Manage inspirational quotes for content generation.

### List Quotes
```http
GET /api/quotes
Authorization: Bearer <token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| category | string | Filter by category (inspirational, motivational, business, humor, etc.) |
| tags | string | Filter by tags (comma-separated) |
| aiGenerated | boolean | Filter AI-generated quotes |
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20, max: 100) |

**Response:**
```json
{
  "success": true,
  "quotes": [
    {
      "id": "quote_123",
      "text": "Innovation distinguishes between a leader and a follower.",
      "author": "Steve Jobs",
      "category": "business",
      "tags": ["leadership", "innovation"],
      "aiGenerated": false,
      "usageCount": 156,
      "likeCount": 45,
      "createdAt": "2026-01-15T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 250,
    "totalPages": 13
  }
}
```

### Get Quote
```http
GET /api/quotes/[id]
Authorization: Bearer <token>
```

### Create Quote
```http
POST /api/quotes
Authorization: Bearer <token>
Content-Type: application/json

{
  "text": "Your quote text here",
  "author": "Author Name",
  "source": "Source reference",
  "category": "motivational",
  "tags": ["success", "mindset"],
  "isPublic": true
}
```

**Response (201):**
```json
{
  "success": true,
  "quote": {
    "id": "quote_456",
    "text": "Your quote text here",
    "author": "Author Name",
    "category": "motivational",
    "tags": ["success", "mindset"],
    "isPublic": true,
    "aiGenerated": false,
    "createdAt": "2026-02-02T12:00:00Z"
  }
}
```

### Update Quote
```http
PUT /api/quotes/[id]
Authorization: Bearer <token>
Content-Type: application/json

{
  "text": "Updated quote text",
  "category": "inspirational"
}
```

### Delete Quote
```http
DELETE /api/quotes/[id]
Authorization: Bearer <token>
```

### Track Engagement
```http
PATCH /api/quotes/[id]
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "like"
}
```

**Actions:** `like`, `use`, `share`

**Response:**
```json
{
  "success": true,
  "quote": {
    "id": "quote_123",
    "likeCount": 46,
    "usageCount": 157,
    "shareCount": 23
  }
}
```

### Bulk Delete Quotes
```http
DELETE /api/quotes
Authorization: Bearer <token>
Content-Type: application/json

{
  "ids": ["quote_123", "quote_456", "quote_789"]
}
```

---

## 👥 Team Management

### Get Team Members
```http
GET /api/v1/team
```

### Add Team Member
```http
POST /api/v1/team
Content-Type: application/json

{
  "email": "member@example.com",
  "role": "editor",
  "permissions": ["content.create", "content.edit"]
}
```

**Roles:**
- `admin`: Full access
- `editor`: Content management
- `viewer`: Read-only access

---

## 🔔 Notifications

### Get Notifications
```http
GET /api/v1/notifications
```

**Query Parameters:**
- `status`: `unread`, `read`, `all`
- `type`: `system`, `campaign`, `publishing`
- `page`, `limit`: Pagination

### Mark as Read
```http
PUT /api/v1/notifications/:id/read
```

---

## 🔐 Enterprise Security Features

### Two-Factor Authentication

#### Get 2FA Status
```http
GET /api/v1/2fa/status
```

#### Setup 2FA
```http
POST /api/v1/2fa/setup
```

**Response:**
```json
{
  "success": true,
  "data": {
    "qrCode": "data:image/png;base64,...",
    "secret": "JBSWY3DPEHPK3PXP",
    "backupCodes": ["12345678", "87654321"]
  }
}
```

#### Verify 2FA Token
```http
POST /api/v1/2fa/verify
Content-Type: application/json

{
  "token": "123456"
}
```

### User Management

#### List Users
```http
GET /api/v1/users
```

**Query Parameters:**
- `role`: Filter by role
- `status`: `active`, `inactive`
- `search`: Search by name/email
- `page`, `limit`: Pagination

#### Create User
```http
POST /api/v1/users
Content-Type: application/json

{
  "email": "newuser@example.com",
  "name": "New User",
  "role": "editor",
  "organization": "company-123",
  "permissions": ["content.create", "content.edit"]
}
```

#### Update User
```http
PUT /api/v1/users/:id
Content-Type: application/json

{
  "role": "admin",
  "isActive": true,
  "permissions": ["*"]
}
```

### Audit Logging

#### Get Audit Logs
```http
GET /api/v1/audit/logs
```

**Query Parameters:**
- `userId`: Filter by user
- `action`: Filter by action type
- `resource`: Filter by resource
- `startDate`, `endDate`: Date range
- `severity`: `low`, `medium`, `high`, `critical`

**Response:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "audit-123",
        "userId": "user-123",
        "action": "user.login",
        "resource": "authentication",
        "timestamp": "2024-01-15T10:30:00Z",
        "ipAddress": "192.168.1.1",
        "userAgent": "Mozilla/5.0...",
        "details": {
          "loginMethod": "password",
          "success": true
        }
      }
    ],
    "totalCount": 1250,
    "page": 1,
    "limit": 50
  }
}
```

---

## ⚡ Performance Monitoring

### System Health
```http
GET /api/v1/performance/health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime": 86400,
    "metrics": {
      "responseTime": 150,
      "errorRate": 0.01,
      "requestsPerSecond": 25.5,
      "memoryUsagePercent": 45.2
    },
    "issues": [],
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Performance Statistics
```http
GET /api/v1/performance/stats
```

**Query Parameters:**
- `timeRange`: Time range in milliseconds (default: 3600000 = 1 hour)

**Response:**
```json
{
  "success": true,
  "data": {
    "averageResponseTime": 145.5,
    "p50": 120,
    "p90": 250,
    "p95": 380,
    "p99": 650,
    "requestsPerSecond": 28.3,
    "errorRate": 0.015,
    "totalRequests": 102045,
    "slowestEndpoints": [
      {
        "endpoint": "/api/v1/content/generate",
        "averageTime": 2450,
        "requests": 1250
      }
    ]
  }
}
```

### Cache Management
```http
POST /api/v1/performance/cache/clear
Content-Type: application/json

{
  "pattern": "user",  // Optional: clear specific pattern
  "userId": "user-123"  // Optional: clear user-specific cache
}
```

---

## 📁 Content Library

### Upload File
```http
POST /api/v1/library/upload
Content-Type: multipart/form-data

file: <binary-data>
type: "image"
tags: "marketing,social"
```

### Get Library Items
```http
GET /api/v1/library
```

**Query Parameters:**
- `type`: `image`, `video`, `document`, `template`
- `tags`: Filter by tags (comma-separated)
- `search`: Search by name/description

---

## 🔄 Workflows

### Create Workflow
```http
POST /api/v1/workflows
Content-Type: application/json

{
  "name": "Content Scheduler",
  "description": "Automatically schedule content across platforms",
  "triggers": [
    {
      "type": "schedule",
      "config": {
        "cron": "0 9 * * 1-5"
      }
    }
  ],
  "actions": [
    {
      "type": "generate_content",
      "config": {
        "prompt": "Daily motivation post",
        "platform": "linkedin"
      }
    },
    {
      "type": "schedule_post",
      "config": {
        "delay": 3600
      }
    }
  ]
}
```

### Get Workflows
```http
GET /api/v1/workflows
```

### Execute Workflow
```http
POST /api/v1/workflows/:id/execute
```

---

## 🚀 Platform Integrations

### Connect Platform
```http
POST /api/v1/platforms/connect
Content-Type: application/json

{
  "platform": "twitter",
  "credentials": {
    "apiKey": "your-api-key",
    "apiSecret": "your-api-secret",
    "accessToken": "your-access-token",
    "accessTokenSecret": "your-token-secret"
  }
}
```

### Publish to Platform
```http
POST /api/v1/platforms/publish
Content-Type: application/json

{
  "platform": "twitter",
  "content": "Hello from SYNTHEX! 🚀 #AI #Marketing",
  "media": ["image1.jpg"],
  "scheduling": {
    "publishAt": "2024-01-15T14:00:00Z"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "postId": "platform-post-123",
    "platformPostId": "1234567890",
    "publishedAt": "2024-01-15T14:00:00Z",
    "postUrl": "https://twitter.com/user/status/1234567890",
    "metrics": {
      "initialViews": 0,
      "initialEngagement": 0
    }
  },
  "message": "Post published successfully to Twitter"
}
```

---

## 📊 Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {
      "field": "Additional error context"
    }
  },
  "message": "Brief error description"
}
```

### Common HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Validation Error
- `429` - Rate Limited
- `500` - Internal Server Error
- `503` - Service Unavailable

---

## 🔄 Rate Limiting

API endpoints are rate limited to ensure fair usage:

- **General endpoints:** 100 requests/minute
- **Content generation:** 20 requests/minute
- **Platform publishing:** 10 requests/minute

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642678800
```

---

## 🌐 Webhooks

SYNTHEX supports webhooks for real-time notifications:

### Configure Webhook
```http
POST /api/v1/webhooks
Content-Type: application/json

{
  "url": "https://your-app.com/webhook",
  "events": ["post.published", "campaign.completed"],
  "secret": "your-webhook-secret"
}
```

### Webhook Events

- `post.published` - When a post is successfully published
- `post.failed` - When a post fails to publish
- `campaign.started` - When a campaign begins
- `campaign.completed` - When a campaign ends
- `user.created` - When a new user is added
- `audit.alert` - When a security alert occurs

### Webhook Payload Example
```json
{
  "event": "post.published",
  "timestamp": "2024-01-15T14:00:00Z",
  "data": {
    "postId": "post-123",
    "platform": "twitter",
    "content": "Hello world!",
    "publishedAt": "2024-01-15T14:00:00Z"
  }
}
```

---

## 🔧 SDK & Libraries

### JavaScript/TypeScript SDK

```bash
npm install @synthex/sdk
```

```javascript
import { SynthexAPI } from '@synthex/sdk';

const synthex = new SynthexAPI({
  apiKey: 'your-api-key',
  baseUrl: 'https://synthex-a3f0o7y9q-unite-group.vercel.app'
});

// Generate content
const content = await synthex.content.generate({
  prompt: 'Write a marketing post',
  platform: 'linkedin'
});

// Schedule post
const post = await synthex.posts.create({
  content: content.data.content,
  platforms: ['linkedin'],
  scheduledTime: new Date(Date.now() + 3600000)
});
```

### Python SDK

```bash
pip install synthex-python
```

```python
from synthex import SynthexAPI

client = SynthexAPI(api_key='your-api-key')

# Generate content
content = client.content.generate(
    prompt='Write a marketing post',
    platform='linkedin'
)

# Get analytics
analytics = client.analytics.overview(
    start_date='2024-01-01',
    end_date='2024-01-31'
)
```

---

## 📚 Additional Resources

- **Status Page:** https://status.synthex.ai
- **Developer Portal:** https://developers.synthex.ai
- **Community:** https://community.synthex.ai
- **Support:** support@synthex.ai

---

## 📞 Support

- **API Status:** https://status.synthex.social
- **Documentation:** https://docs.synthex.social
- **Support Email:** api-support@synthex.social
- **GitHub Issues:** https://github.com/CleanExpo/Synthex/issues

---

*Last updated: February 2026 | Version 2.0.1*
