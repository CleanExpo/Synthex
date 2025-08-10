# 📚 SYNTHEX API Documentation

## Base URL
```
Production: https://synthex.vercel.app/api
Development: http://localhost:3000/api
```

## Authentication
All authenticated endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <your-token>
```

## Endpoints

### 🔐 Authentication

#### POST /api/auth/signup
Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe"
}
```

**Response:** `201 Created`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "jwt-token"
}
```

#### POST /api/auth/login
Authenticate user and receive token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response:** `200 OK`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "jwt-token"
}
```

### 🤖 Content Generation

#### POST /api/content/generate
Generate AI-powered content for social media.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "prompt": "Create a viral tweet about AI technology",
  "platform": "twitter",
  "tone": "professional",
  "length": "short",
  "hashtags": true,
  "emoji": true
}
```

**Response:** `200 OK`
```json
{
  "content": "🚀 AI is revolutionizing how we work, create, and innovate...",
  "hashtags": ["#AI", "#Technology", "#Innovation"],
  "platform": "twitter",
  "characterCount": 280,
  "metadata": {
    "tone": "professional",
    "readability": 8.5,
    "engagement_score": 0.85
  }
}
```

### 📊 Pattern Analysis

#### POST /api/patterns/analyze
Analyze content patterns for optimization.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "content": "Your content to analyze",
  "platform": "instagram",
  "targetAudience": "millennials"
}
```

**Response:** `200 OK`
```json
{
  "analysis": {
    "sentiment": "positive",
    "readability": 7.8,
    "keywords": ["technology", "innovation"],
    "suggestions": [
      "Add more emotional triggers",
      "Include a call-to-action"
    ],
    "predictedEngagement": 0.72,
    "bestPostingTime": "2024-01-15T14:00:00Z"
  }
}
```

### 📈 Analytics

#### GET /api/analytics/performance
Get performance metrics for your content.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `startDate` (ISO 8601): Start date for analytics
- `endDate` (ISO 8601): End date for analytics
- `platform` (string): Filter by platform
- `metric` (string): Specific metric to retrieve

**Response:** `200 OK`
```json
{
  "metrics": {
    "totalPosts": 150,
    "totalEngagement": 45000,
    "averageEngagementRate": 0.15,
    "topPerformingPost": {
      "id": "post-123",
      "platform": "instagram",
      "engagement": 5000
    },
    "growthRate": 0.23
  },
  "timeline": [
    {
      "date": "2024-01-01",
      "posts": 5,
      "engagement": 1500
    }
  ]
}
```

### 🔍 Monitoring

#### GET /api/monitoring/events
Get monitoring events (Development only).

**Response:** `200 OK`
```json
{
  "totalEvents": 100,
  "events": [
    {
      "sessionId": "session_123",
      "errors": [],
      "actions": [],
      "timestamp": "2024-01-15T10:00:00Z"
    }
  ]
}
```

#### POST /api/monitoring/events
Send monitoring events.

**Request Body:**
```json
{
  "sessionId": "session_123",
  "userId": "user_456",
  "errors": [
    {
      "message": "Error message",
      "stack": "Error stack trace",
      "timestamp": "2024-01-15T10:00:00Z"
    }
  ],
  "actions": [
    {
      "action": "button_click",
      "element": "submit_button",
      "timestamp": "2024-01-15T10:00:00Z"
    }
  ]
}
```

**Response:** `200 OK`
```json
{
  "success": true
}
```

### ❤️ Health Check

#### GET /api/health
Check API health status.

**Response:** `200 OK`
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:00:00Z",
  "environment": "production",
  "version": "2.0.1",
  "message": "SYNTHEX API is running"
}
```

### 🔄 Cron Jobs

#### GET /api/cron/analyze-patterns
Trigger pattern analysis cron job (Internal use).

**Headers:**
```
Authorization: Bearer <cron-secret>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "analyzed": 50,
  "timestamp": "2024-01-15T10:00:00Z"
}
```

## Error Responses

All endpoints follow a consistent error response format:

### 400 Bad Request
```json
{
  "error": "Bad Request",
  "message": "Invalid input data",
  "details": {
    "field": "email",
    "issue": "Invalid email format"
  }
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "You don't have permission to access this resource"
}
```

### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "Resource not found"
}
```

### 429 Too Many Requests
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded",
  "retryAfter": 60
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred",
  "requestId": "req_123456"
}
```

## Rate Limiting

API endpoints are rate limited to prevent abuse:

- **Anonymous:** 10 requests per minute
- **Authenticated:** 100 requests per minute
- **Premium:** 1000 requests per minute

Rate limit information is included in response headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642252800
```

## Webhooks

Configure webhooks to receive real-time updates:

### Webhook Events
- `content.generated` - New content generated
- `pattern.analyzed` - Pattern analysis complete
- `post.scheduled` - Post scheduled for publishing
- `post.published` - Post published successfully
- `engagement.threshold` - Engagement threshold reached

### Webhook Payload
```json
{
  "event": "content.generated",
  "timestamp": "2024-01-15T10:00:00Z",
  "data": {
    // Event-specific data
  }
}
```

## SDKs and Libraries

### JavaScript/TypeScript
```bash
npm install @synthex/sdk
```

```javascript
import { SynthexClient } from '@synthex/sdk';

const client = new SynthexClient({
  apiKey: 'your-api-key',
  environment: 'production'
});

// Generate content
const content = await client.content.generate({
  prompt: 'Create a viral tweet',
  platform: 'twitter'
});
```

### Python
```bash
pip install synthex-sdk
```

```python
from synthex import SynthexClient

client = SynthexClient(
    api_key='your-api-key',
    environment='production'
)

# Generate content
content = client.content.generate(
    prompt='Create a viral tweet',
    platform='twitter'
)
```

## Best Practices

1. **Always use HTTPS** in production
2. **Store API keys securely** - never commit them to version control
3. **Implement retry logic** with exponential backoff
4. **Cache responses** when appropriate
5. **Use webhooks** for real-time updates instead of polling
6. **Paginate large result sets** to improve performance
7. **Validate input** before sending requests
8. **Handle errors gracefully** in your application

## Support

- **Documentation:** https://docs.synthex.ai
- **Status Page:** https://status.synthex.ai
- **Support Email:** api-support@synthex.ai
- **GitHub Issues:** https://github.com/unite-group/synthex/issues

---

Last Updated: 2025-08-10