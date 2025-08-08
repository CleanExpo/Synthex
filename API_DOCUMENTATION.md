# SYNTHEX 2.0 API Documentation

## Overview
SYNTHEX 2.0 provides a comprehensive REST API for marketing automation, content generation, and platform optimization. All API endpoints are available under `/api/v2/`.

## Base URL
```
Production: https://api.synthex.app/api/v2
Staging: https://staging-api.synthex.app/api/v2
Development: http://localhost:3000/api/v2
```

## Authentication
All API requests require authentication using JWT tokens.

### Headers
```http
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

## Rate Limiting
Different rate limits apply based on endpoint type:
- Standard: 100 requests per 15 minutes
- AI Generation: 30 requests per hour
- Upload: 10 requests per hour
- High Traffic: 1000 requests per 15 minutes

## API Endpoints

### Analytics API

#### Get Real-time Metrics
```http
GET /analytics/metrics/realtime
```

#### Get Historical Metrics
```http
GET /analytics/metrics/historical?startDate=2024-01-01&endDate=2024-01-31
```

#### Track Event
```http
POST /analytics/events/track
{
  "eventType": "content_view",
  "eventData": {...},
  "platform": "tiktok"
}
```

### A/B Testing API

#### Create Experiment
```http
POST /ab-testing/experiments
{
  "name": "Homepage Test",
  "type": "simple",
  "variants": [...],
  "successMetrics": ["conversion_rate"]
}
```

#### Get Experiment Results
```http
GET /ab-testing/experiments/{experimentId}/results
```

#### Calculate Sample Size
```http
POST /ab-testing/calculate/sample-size
{
  "baselineConversion": 0.1,
  "minimumDetectableEffect": 0.02
}
```

### AI Content Generation API

#### Generate Content
```http
POST /ai-content/generate
{
  "prompt": "Create viral TikTok content",
  "type": "post",
  "platform": "tiktok",
  "tone": "friendly"
}
```

#### Generate Variations
```http
POST /ai-content/variations
{
  "originalContent": "...",
  "count": 5,
  "variationType": "tone"
}
```

#### Generate Hashtags
```http
POST /ai-content/hashtags
{
  "content": "...",
  "platform": "instagram",
  "count": 30
}
```

### Team Collaboration API

#### Create Team
```http
POST /teams
{
  "name": "Marketing Team",
  "description": "...",
  "type": "marketing"
}
```

#### Add Team Member
```http
POST /teams/{teamId}/members
{
  "email": "user@example.com",
  "role": "editor",
  "permissions": ["read", "write"]
}
```

#### Get Team Activity
```http
GET /teams/{teamId}/activity?startDate=2024-01-01
```

### Scheduler API

#### Schedule Content
```http
POST /scheduler/schedule
{
  "contentId": "content_123",
  "publishAt": "2024-02-01T10:00:00Z",
  "platform": "tiktok"
}
```

#### Get Optimal Times
```http
GET /scheduler/optimal-times?platform=instagram&timezone=America/New_York
```

#### Create Recurring Schedule
```http
POST /scheduler/recurring
{
  "pattern": "weekly",
  "daysOfWeek": [1, 3, 5],
  "timeOfDay": "14:00"
}
```

### Content Library API

#### Create Library Item
```http
POST /library/items
{
  "title": "Campaign Assets",
  "content": {...},
  "type": "post",
  "tags": ["campaign", "q1"]
}
```

#### Create Collection
```http
POST /library/collections
{
  "name": "Q1 Campaign",
  "type": "smart",
  "config": {...}
}
```

#### Search Library
```http
GET /library/search?q=campaign&type=post
```

### Mobile API

#### Register Device
```http
POST /mobile/devices/register
{
  "platform": "ios",
  "deviceName": "iPhone 14",
  "appVersion": "2.0.0",
  "pushToken": "..."
}
```

#### Send Push Notification
```http
POST /mobile/notifications/send
{
  "userId": "user_123",
  "title": "New Feature!",
  "body": "Check out our latest update"
}
```

#### Sync Data
```http
POST /mobile/sync
{
  "deviceId": "device_123",
  "changes": [...],
  "lastSyncAt": "2024-01-01T00:00:00Z"
}
```

### White-label API

#### Create Tenant
```http
POST /white-label/tenants
{
  "name": "acme-corp",
  "companyName": "ACME Corporation",
  "subdomain": "acme",
  "tier": "enterprise"
}
```

#### Update Branding
```http
PUT /white-label/tenants/{tenantId}/branding
{
  "logoUrl": "...",
  "primaryColor": "#3b82f6",
  "customCss": "..."
}
```

#### Configure SSO
```http
POST /white-label/tenants/{tenantId}/sso
{
  "provider": "saml",
  "config": {...},
  "enabled": true
}
```

### Competitor Analysis API

#### Add Competitor
```http
POST /competitors
{
  "name": "Competitor X",
  "domain": "competitor.com",
  "platforms": [...]
}
```

#### Get Trending Content
```http
GET /competitors/trending?platform=tiktok&timeframe=week
```

#### Get SWOT Analysis
```http
GET /competitors/swot/{competitorId}
```

### Reporting API

#### Create Report
```http
POST /reporting/reports
{
  "name": "Monthly Report",
  "type": "monthly",
  "metrics": ["views", "engagement"],
  "formats": ["pdf", "excel"]
}
```

#### Get Insights
```http
GET /reporting/insights?type=performance&actionable=true
```

#### Create Export Job
```http
POST /reporting/export
{
  "exportType": "analytics",
  "format": "csv",
  "dateRange": {...}
}
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Bad Request",
  "message": "Invalid request parameters",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "No valid authentication token provided"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "You do not have permission to access this resource"
}
```

### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "The requested resource does not exist"
}
```

### 429 Too Many Requests
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded",
  "retryAfter": 900
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
```

## Webhooks
SYNTHEX supports webhooks for real-time notifications:

### Webhook Events
- `content.published` - Content successfully published
- `experiment.completed` - A/B test reached significance
- `team.member.added` - New team member added
- `report.generated` - Report generation completed
- `competitor.alert` - Competitor activity detected

### Webhook Payload
```json
{
  "event": "content.published",
  "timestamp": "2024-01-01T12:00:00Z",
  "data": {
    "contentId": "content_123",
    "platform": "tiktok",
    "url": "https://..."
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
  apiKey: 'YOUR_API_KEY',
  environment: 'production'
});

const metrics = await client.analytics.getRealTimeMetrics();
```

### Python
```bash
pip install synthex-sdk
```

```python
from synthex import SynthexClient

client = SynthexClient(
    api_key='YOUR_API_KEY',
    environment='production'
)

metrics = client.analytics.get_realtime_metrics()
```

## Best Practices

1. **Caching**: Cache frequently accessed data to reduce API calls
2. **Pagination**: Use pagination for large datasets
3. **Error Handling**: Implement exponential backoff for retries
4. **Rate Limiting**: Monitor rate limit headers in responses
5. **Webhooks**: Use webhooks instead of polling when possible

## Support
- Documentation: https://docs.synthex.app
- API Status: https://status.synthex.app
- Support: support@synthex.app
- GitHub: https://github.com/synthex/api-sdk