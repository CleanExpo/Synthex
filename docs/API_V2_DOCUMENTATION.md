# Synthex API v2 Documentation

## Overview

The Synthex API v2 provides comprehensive endpoints for social media automation, content generation, analytics, and team collaboration. All endpoints use JSON for request and response bodies.

## Base URL

```
Production: https://api.synthex.app/api/v2
Staging: https://staging-api.synthex.app/api/v2
Development: http://localhost:3000/api/v2
```

## Authentication

Most endpoints require authentication using Bearer tokens in the Authorization header:

```
Authorization: Bearer <your-token>
```

## Rate Limiting

Different endpoints have different rate limits:

| Endpoint Type | Rate Limit | Window |
|--------------|------------|---------|
| Authentication | 5 requests | 15 minutes |
| AI Generation | 30 requests | 1 hour |
| Standard API | 100 requests | 15 minutes |
| Analytics | 60 requests | 1 minute |

## Endpoints

### Authentication

#### POST /auth/register
Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe",
  "company": "Acme Inc"
}
```

**Response:**
```json
{
  "token": "jwt-token",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

#### POST /auth/login
Authenticate a user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

#### POST /auth/logout
Logout the current user.

#### POST /auth/reset-password
Request a password reset.

### Analytics

#### GET /analytics
Get analytics data for platforms.

**Query Parameters:**
- `platform` (string): Platform name (twitter, instagram, linkedin, etc.)
- `startDate` (ISO 8601): Start date for analytics
- `endDate` (ISO 8601): End date for analytics
- `metrics` (array): Specific metrics to retrieve

**Response:**
```json
{
  "data": {
    "impressions": 45678,
    "engagements": 2345,
    "clicks": 1234,
    "conversions": 89,
    "reach": 34567
  },
  "period": {
    "start": "2025-01-01T00:00:00Z",
    "end": "2025-01-31T23:59:59Z"
  }
}
```

#### GET /analytics/realtime
Get real-time analytics metrics.

#### GET /analytics/insights
Get AI-generated insights from analytics data.

#### GET /analytics/performance
Get platform performance metrics.

### AI Content Generation

#### POST /ai-content/generate
Generate content using AI.

**Request Body:**
```json
{
  "prompt": "Create a post about productivity tips",
  "platform": "twitter",
  "tone": "professional",
  "length": "medium",
  "includeHashtags": true,
  "includeEmojis": true
}
```

**Response:**
```json
{
  "content": "🚀 5 Productivity Tips That Actually Work:\n\n1. Time-block your calendar\n2. Use the 2-minute rule\n3. Batch similar tasks\n4. Take regular breaks\n5. Review daily priorities\n\n#ProductivityTips #TimeManagement #Success",
  "metadata": {
    "platform": "twitter",
    "characterCount": 195,
    "hashtagCount": 3,
    "estimatedEngagement": 0.045
  }
}
```

#### POST /ai-content/optimize
Optimize existing content for a platform.

#### POST /ai-content/hashtags
Generate relevant hashtags for content.

#### POST /ai-content/translate
Translate content to another language.

### A/B Testing

#### POST /ab-testing/tests
Create a new A/B test.

**Request Body:**
```json
{
  "name": "Holiday Campaign Test",
  "platform": "instagram",
  "variations": [
    {
      "name": "Version A",
      "content": "Holiday sale! 50% off everything",
      "image": "image-url-a"
    },
    {
      "name": "Version B", 
      "content": "Limited time: Half price on all items",
      "image": "image-url-b"
    }
  ],
  "duration": 7,
  "targetAudience": "all"
}
```

#### GET /ab-testing/tests
List all A/B tests.

#### GET /ab-testing/tests/:id
Get specific A/B test details.

#### GET /ab-testing/tests/:id/results
Get A/B test results.

### Team Collaboration

#### GET /teams/members
List team members.

#### POST /teams/invite
Invite a team member.

**Request Body:**
```json
{
  "email": "teammate@example.com",
  "role": "editor",
  "permissions": ["create_content", "view_analytics"]
}
```

#### PATCH /teams/members/:id
Update team member details.

#### DELETE /teams/members/:id
Remove a team member.

### Content Scheduler

#### POST /scheduler/posts
Schedule a new post.

**Request Body:**
```json
{
  "content": "Check out our latest blog post!",
  "platform": "linkedin",
  "scheduledFor": "2025-02-01T10:00:00Z",
  "media": ["image-url"],
  "targeting": {
    "locations": ["US", "UK"],
    "interests": ["technology", "business"]
  }
}
```

#### GET /scheduler/posts
List scheduled posts.

#### PATCH /scheduler/posts/:id
Update a scheduled post.

#### DELETE /scheduler/posts/:id
Cancel a scheduled post.

### Content Library

#### GET /library/content
List saved content.

**Query Parameters:**
- `type` (string): Content type filter
- `platform` (string): Platform filter
- `tags` (array): Tag filters
- `search` (string): Search query

#### POST /library/content
Save content to library.

#### GET /library/content/:id
Get specific content item.

#### DELETE /library/content/:id
Delete content from library.

### Competitor Analysis

#### GET /competitors
List tracked competitors.

#### POST /competitors
Add a competitor to track.

**Request Body:**
```json
{
  "name": "Competitor Corp",
  "website": "https://competitor.com",
  "platforms": {
    "twitter": "@competitor",
    "instagram": "@competitor",
    "linkedin": "competitor-corp"
  }
}
```

#### POST /competitors/:id/analyze
Run analysis on a competitor.

#### GET /competitors/:id/insights
Get competitor insights.

### Reporting

#### POST /reporting/generate
Generate a custom report.

**Request Body:**
```json
{
  "type": "monthly",
  "dateRange": {
    "start": "2025-01-01",
    "end": "2025-01-31"
  },
  "metrics": ["engagement", "reach", "conversions"],
  "platforms": ["all"],
  "format": "pdf"
}
```

#### GET /reporting/reports
List generated reports.

#### GET /reporting/reports/:id/download
Download a report.

### White Label

#### GET /white-label/config
Get white label configuration.

#### PUT /white-label/config
Update white label settings.

**Request Body:**
```json
{
  "branding": {
    "logo": "logo-url",
    "primaryColor": "#007bff",
    "secondaryColor": "#6c757d",
    "companyName": "Your Brand"
  },
  "customDomain": "app.yourbrand.com",
  "emailSettings": {
    "fromName": "Your Brand",
    "fromEmail": "noreply@yourbrand.com"
  }
}
```

### Mobile API

#### GET /mobile/config
Get mobile app configuration.

#### POST /mobile/sync
Sync mobile data.

### System

#### GET /health
Check API health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:00:00Z",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "queue": "healthy"
  }
}
```

#### GET /features
Get enabled feature flags.

#### GET /docs
Get API documentation.

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional context"
  }
}
```

### Common Error Codes

| Code | Description |
|------|------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

## Webhooks

Configure webhooks to receive real-time notifications:

```json
{
  "url": "https://your-app.com/webhooks/synthex",
  "events": ["post.published", "test.completed", "report.generated"],
  "secret": "webhook-secret"
}
```

## SDKs

Official SDKs are available for:
- JavaScript/TypeScript
- Python
- PHP
- Ruby
- Go

## Support

- Documentation: https://docs.synthex.app
- API Status: https://status.synthex.app
- Support: support@synthex.app
