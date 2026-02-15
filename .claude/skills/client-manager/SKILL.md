---
name: client-manager
description: >
  Campaign and client data management via Prisma ORM. Handles CRUD operations
  on campaigns, posts, projects, and user preferences. Tracks analytics and
  API usage. Use when user says "create campaign", "list campaigns", "update
  post", "delete project", "client data", or "manage analytics".
---

# Client & Campaign Data Manager

## Process

1. **Identify operation** -- determine the CRUD action and target model from user intent
2. **Validate inputs** -- check required fields, enum values, and foreign key references
3. **Execute via Prisma** -- run the appropriate Prisma Client query against PostgreSQL
4. **Return structured result** -- format the response with relevant fields and relations
5. **Log API usage** -- record the operation in ApiUsage for audit trail

## Prisma Models

### User
- `id` (cuid), `email` (unique), `name`, `password`
- OAuth: `googleId`, `avatar`, `authProvider` (local | google)
- API keys: `openrouterApiKey`, `anthropicApiKey` (encrypted)
- Settings: `preferences` (JSON)
- Relations: `campaigns[]`, `projects[]`, `apiUsage[]`
- Table: `users`

### Campaign
- `id` (cuid), `name`, `description`, `platform`, `status`
- Platform values: youtube, instagram, tiktok, twitter, facebook, linkedin, pinterest, reddit
- Status values: draft, active, paused, completed
- Data fields: `content` (JSON), `analytics` (JSON), `settings` (JSON)
- Relations: belongs to `User`, has many `Post[]`
- Table: `campaigns`

### Post
- `id` (cuid), `content`, `platform`, `status`
- Status values: draft, scheduled, published, failed
- Scheduling: `scheduledAt`, `publishedAt`
- Data fields: `metadata` (JSON -- images, hashtags, mentions), `analytics` (JSON)
- Relations: belongs to `Campaign`
- Table: `posts`

### Project
- `id` (cuid), `name`, `description`, `type`, `data` (JSON)
- Type values: marketing, content, analytics
- Relations: belongs to `User`
- Table: `projects`

### ApiUsage
- `id` (cuid), `endpoint`, `model`, `tokens`, `cost`, `status`
- Status values: success, error, rate_limited
- Data fields: `requestData` (JSON), `responseData` (JSON), `errorMessage`
- Relations: belongs to `User`
- Table: `api_usage`

### Session
- `id` (cuid), `token` (unique), `userId`, `expiresAt`
- Table: `sessions`

## Operations

### Campaign CRUD

| Operation | Prisma Method | Required Fields |
|-----------|---------------|-----------------|
| CREATE | `prisma.campaign.create()` | name, platform, userId |
| READ | `prisma.campaign.findUnique()` / `findMany()` | id or filter |
| UPDATE | `prisma.campaign.update()` | id, fields to update |
| DELETE | `prisma.campaign.delete()` | id |
| LIST | `prisma.campaign.findMany()` | userId, optional status/platform filter |

### Post Management

| Operation | Prisma Method | Required Fields |
|-----------|---------------|-----------------|
| CREATE | `prisma.post.create()` | content, platform, campaignId |
| SCHEDULE | `prisma.post.update()` | id, scheduledAt, status = "scheduled" |
| PUBLISH | `prisma.post.update()` | id, publishedAt, status = "published" |
| BULK CREATE | `prisma.post.createMany()` | array of post data |

### Analytics Tracking

- Store per-post engagement in `Post.analytics` JSON field
- Store campaign-level rollups in `Campaign.analytics` JSON field
- Track API costs via `ApiUsage` model per request
- Aggregate by: platform, date range, campaign, user

### User Preferences

- Stored in `User.preferences` JSON field
- Includes: default platform, timezone, notification settings, brand voice
- Update via `prisma.user.update({ data: { preferences: {...} } })`

## Query Patterns

### Filtering campaigns by status and platform
```
prisma.campaign.findMany({
  where: { userId, status, platform },
  include: { posts: true },
  orderBy: { updatedAt: 'desc' }
})
```

### Aggregating post analytics across a campaign
```
prisma.post.findMany({
  where: { campaignId },
  select: { analytics: true, platform: true, status: true }
})
```

### Tracking API costs for a user over a date range
```
prisma.apiUsage.aggregate({
  where: { userId, createdAt: { gte: startDate, lte: endDate } },
  _sum: { cost: true, tokens: true }
})
```

## Output

- **Single record**: full model object with included relations
- **List**: array of records with pagination metadata (total, page, pageSize)
- **Mutation**: updated record confirming the change
- **Analytics**: aggregated metrics with breakdowns by platform and date range
- **Errors**: structured error with code, message, and affected field

## Validation Rules

- Campaign `name` must be non-empty and under 255 characters
- Campaign `platform` must be one of the 8 supported platforms
- Post `content` must be non-empty
- Post `scheduledAt` must be in the future for scheduling operations
- User `email` must be unique and valid format
- All delete operations cascade to child records (posts under campaigns, etc.)
