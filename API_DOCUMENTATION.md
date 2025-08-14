# 📚 SYNTHEX API Documentation

**Version:** 1.0.0  
**Base URL:** `https://synthex.ai/api`  
**Authentication:** Bearer Token (JWT)

## 🔐 Authentication

All API requests require authentication using a Bearer token:

```http
Authorization: Bearer YOUR_JWT_TOKEN
```

## 📋 API Endpoints

### Authentication

#### POST `/api/auth/register`
Create a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe"
}
```

**Response:** `201 Created`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "token": "jwt_token"
}
```

---

#### POST `/api/auth/login`
Authenticate user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password"
}
```

**Response:** `200 OK`

---

### Content Management

#### GET `/api/content/posts`
Get user's posts.

**Query Parameters:**
- `page` (integer): Page number
- `limit` (integer): Items per page
- `status` (string): Filter by status

**Response:** `200 OK`
```json
{
  "posts": [...],
  "pagination": {
    "page": 1,
    "total": 100
  }
}
```

---

#### POST `/api/content/posts`
Create a new post.

**Request:**
```json
{
  "title": "New Post",
  "content": "Content here...",
  "platforms": ["twitter", "linkedin"],
  "scheduled_at": "2025-01-15T14:00:00Z"
}
```

**Response:** `201 Created`

---

### Analytics

#### GET `/api/analytics/overview`
Get analytics overview.

**Query Parameters:**
- `period`: Time period (7d, 30d, 90d)

**Response:** `200 OK`
```json
{
  "overview": {
    "total_reach": 45234,
    "engagement_rate": 7.56
  }
}
```

---

### Monitoring

#### GET `/api/monitoring/metrics`
Get system metrics.

**Response:** `200 OK`
```json
{
  "system": {
    "status": "operational",
    "uptime": "99.9%"
  }
}
```

---

## 🔒 Rate Limiting

- Default: 60 requests/minute
- Authenticated: 120 requests/minute

## 📊 Response Codes

| Code | Description |
|------|-------------|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 404 | Not Found |
| 429 | Too Many Requests |
| 500 | Server Error |

## 🧪 Code Examples

### JavaScript
```javascript
const response = await fetch('https://synthex.ai/api/content/posts', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
});
const posts = await response.json();
```

### Python
```python
import requests

response = requests.get(
    'https://synthex.ai/api/content/posts',
    headers={'Authorization': 'Bearer YOUR_TOKEN'}
)
```

---

**Support:** api@synthex.ai