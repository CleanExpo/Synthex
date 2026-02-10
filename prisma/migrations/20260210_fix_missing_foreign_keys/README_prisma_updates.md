# Prisma Schema Updates Guide

**DO NOT RUN THIS FILE AS SQL** - This is documentation for updating `prisma/schema.prisma`

## Instructions

After running `migration.sql`, update your Prisma schema to match:

```bash
# After schema updates:
npx prisma generate
npx prisma db push  # for dev
# OR
npx prisma migrate deploy  # for prod
```

---

## Model Updates Needed

### AnalyticsEvent - Add relations

```prisma
model AnalyticsEvent {
  // ... existing fields ...

  // ADD THESE:
  user        User?     @relation(fields: [userId], references: [id], onDelete: Cascade)
  campaign    Campaign? @relation("CampaignAnalytics", fields: [campaignId], references: [id], onDelete: SetNull)

  @@index([userId, createdAt(sort: Desc)])
  @@index([campaignId])
}
```

### SentimentAnalysis - Add relation

```prisma
model SentimentAnalysis {
  // ... existing fields ...

  // ADD:
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, analyzedAt(sort: Desc)])
}
```

### SentimentTrend - Add relations

```prisma
model SentimentTrend {
  // ... existing fields ...

  // ADD:
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([userId, date(sort: Desc)])
  @@index([organizationId, date(sort: Desc)])
}
```

### ABTest - Add relations

```prisma
model ABTest {
  // ... existing fields ...

  // ADD:
  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  campaign Campaign? @relation(fields: [campaignId], references: [id], onDelete: SetNull)

  @@index([userId, status])
}
```

### Task - Add relations

```prisma
model Task {
  // ... existing fields ...

  // ADD:
  user     User      @relation("TaskCreator", fields: [userId], references: [id], onDelete: Cascade)
  assignee User?     @relation("TaskAssignee", fields: [assigneeId], references: [id], onDelete: SetNull)
  campaign Campaign? @relation(fields: [campaignId], references: [id], onDelete: SetNull)

  @@index([userId, status])
  @@index([assigneeId])
  @@index([campaignId])
}
```

### ContentShare - Add relation

```prisma
model ContentShare {
  // ... existing fields ...

  // ADD:
  sharedBy   User              @relation(fields: [sharedById], references: [id], onDelete: Cascade)
  accessLogs ContentAccessLog[]

  @@index([sharedById])
}
```

### Quote - Add relations

```prisma
model Quote {
  // ... existing fields ...

  // ADD:
  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  campaign Campaign? @relation(fields: [campaignId], references: [id], onDelete: SetNull)
}
```

### TeamNotification - Add relations

```prisma
model TeamNotification {
  // ... existing fields ...

  // ADD:
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

---

## User Model - Add reverse relations

```prisma
model User {
  // ... existing fields and relations ...

  // ADD THESE REVERSE RELATIONS:
  analyticsEvents       AnalyticsEvent[]
  sentimentAnalyses     SentimentAnalysis[]
  sentimentTrends       SentimentTrend[]
  engagementPredictions EngagementPrediction[]
  abTests               ABTest[]
  trackedCompetitors    TrackedCompetitor[]
  competitorComparisons CompetitorComparison[]
  tasksCreated          Task[] @relation("TaskCreator")
  tasksAssigned         Task[] @relation("TaskAssignee")
  contentShares         ContentShare[]
  contentAccessLogs     ContentAccessLog[]
  quotes                Quote[]
  quoteCollections      QuoteCollection[]
  reportTemplates       ReportTemplate[]
  scheduledReports      ScheduledReport[]
  teamNotifications     TeamNotification[]
}
```

## Campaign Model - Add reverse relations

```prisma
model Campaign {
  // ... existing fields and relations ...

  // ADD:
  analyticsEvents AnalyticsEvent[] @relation("CampaignAnalytics")
  abTests         ABTest[]
  tasks           Task[]
  quotes          Quote[]
}
```

## Organization Model - Add reverse relations

```prisma
model Organization {
  // ... existing fields and relations ...

  // ADD:
  sentimentTrends     SentimentTrend[]
  reportTemplates     ReportTemplate[]
  teamNotifications   TeamNotification[]
}
```
