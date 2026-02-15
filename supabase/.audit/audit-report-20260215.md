# SQL Hardener Audit Report
**Generated**: 2026-02-15
**Codebase**: Synthex

---

## Executive Summary

| Metric | Count | Status |
|--------|-------|--------|
| Prisma Models | 67 | Source of truth |
| Supabase Tables (complete-schema.sql) | 11 | ⚠️ Outdated |
| Tables with RLS | 9 | Missing 2 |
| Existing Indexes | 24 | Need ~15 more |
| JSONB Columns | 9 | Need GIN indexes |

**Critical Finding**: The `complete-schema.sql` is severely outdated. Prisma has 67 models but Supabase schema only defines 11 tables.

---

## Issue 1: Schema Sync Gap (CRITICAL)

### Tables in Prisma but Missing from Supabase Schema

The following 56 tables exist in Prisma but are NOT in `complete-schema.sql`:

**Core**:
- `User` (maps to `users`)
- `Account`
- `Session`
- `OAuthPKCEState`

**Content & Campaigns**:
- `Post`
- `CalendarPost`
- `ContentShare`, `ContentComment`, `ContentAccessLog`
- `Persona`, `PersonaTrainingData`

**Analytics**:
- `AnalyticsEvent`
- `SentimentAnalysis`, `SentimentTrend`
- `EngagementPrediction`

**Teams & Organizations**:
- `Organization`
- `TeamInvitation`
- `TeamNotification`
- `Role`, `UserRole`, `PermissionAudit`

**A/B Testing**:
- `ABTest`, `ABTestVariant`, `ABTestResult`

**Competitors**:
- `TrackedCompetitor`, `CompetitorSnapshot`
- `CompetitorPost`, `CompetitorAlert`, `CompetitorComparison`

**Retention System**:
- `AIConversation`, `AIMessage`, `AIWeeklyDigest`
- `UserHealthScore`, `UserStreak`, `UserAchievement`
- `Referral`, `UserLoyaltyTier`, `FeedbackSurvey`

**GEO/E-E-A-T**:
- `AuthorProfile`, `SEOAudit`, `GEOAnalysis`
- `GEOResearchReport`, `VisualAsset`, `LocalCaseStudy`
- `ArticleAuthor`

**Multi-Business**:
- `BusinessOwnership`

**Other**:
- `Project`, `AuditLog`, `Report`, `ScheduledReport`
- `ReportTemplate`, `ReportDelivery`, `Quote`, `QuoteCollection`
- `Task`, `Subscription`, `BrandGeneration`
- `PsychologyPrinciple`, `PsychologyMetric`, `UserPsychologyPreference`
- `CompetitiveAnalysis`, `PlatformPost`, `PlatformMetrics`

### Recommendation

**Option A**: Generate Supabase schema from Prisma (recommended)
```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > supabase/prisma-schema-full.sql
```

**Option B**: Use Prisma migrations exclusively and sync via:
```bash
npx prisma db push
```

---

## Issue 2: Missing RLS (HIGH)

### Tables Without RLS

| Table | Risk | Fix |
|-------|------|-----|
| `viral_patterns` | LOW (shared data) | Optional - public read patterns |
| `team_members` | **HIGH** | Must add RLS |

### Fix for team_members

```sql
-- Enable RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Team members can view their own team
CREATE POLICY "team_members_select_own_team"
  ON team_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  );

-- Only team admins can insert
CREATE POLICY "team_members_insert_admin"
  ON team_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = NEW.team_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
    OR auth.uid() = invited_by
  );

-- Members can update own record, admins can update team
CREATE POLICY "team_members_update"
  ON team_members FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = team_members.team_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

-- Only admins can delete
CREATE POLICY "team_members_delete_admin"
  ON team_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = team_members.team_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );
```

---

## Issue 3: Missing Indexes (MEDIUM)

### Foreign Key Columns Without Indexes

| Table | Column | Fix |
|-------|--------|-----|
| `team_members` | `team_id` | `CREATE INDEX idx_team_members_team_id ON team_members(team_id);` |
| `scheduled_posts` | `content_id` | `CREATE INDEX idx_scheduled_posts_content_id ON scheduled_posts(content_id);` |
| `scheduled_posts` | `campaign_id` | `CREATE INDEX idx_scheduled_posts_campaign_id ON scheduled_posts(campaign_id);` |
| `content` | `persona_id` | `CREATE INDEX idx_content_persona_id ON content(persona_id);` |
| `analytics` | `platform` | `CREATE INDEX idx_analytics_platform ON analytics(platform);` |

### Timestamp Columns for Sorting

| Table | Column | Fix |
|-------|--------|-----|
| `content` | `published_at` | `CREATE INDEX idx_content_published_at ON content(published_at DESC);` |
| `content` | `scheduled_for` | `CREATE INDEX idx_content_scheduled_for ON content(scheduled_for);` |
| `api_usage` | `created_at` | `CREATE INDEX idx_api_usage_created_at ON api_usage(created_at DESC);` |

### Status/Type Columns for Filtering

| Table | Column | Fix |
|-------|--------|-----|
| `campaigns` | `status` | `CREATE INDEX idx_campaigns_status ON campaigns(status);` |
| `scheduled_posts` | `status` | `CREATE INDEX idx_scheduled_posts_status ON scheduled_posts(status);` |
| `notifications` | `is_read` | `CREATE INDEX idx_notifications_is_read ON notifications(is_read) WHERE is_read = false;` |

---

## Issue 4: JSONB Columns Without GIN Indexes (LOW)

For frequently queried JSONB columns, add GIN indexes:

```sql
-- High-value JSONB indexes (query patterns)
CREATE INDEX IF NOT EXISTS idx_content_metadata_gin ON content USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_campaigns_target_audience_gin ON campaigns USING gin(target_audience);
CREATE INDEX IF NOT EXISTS idx_viral_patterns_data_gin ON viral_patterns USING gin(pattern_data);

-- Skip for rarely queried columns:
-- content.variations, content.engagement_metrics
-- campaigns.goals, campaigns.metrics
-- notifications.data
```

---

## Issue 5: Missing Constraints (LOW)

### NOT NULL Recommendations

| Table | Column | Current | Recommendation |
|-------|--------|---------|----------------|
| `personas` | `user_id` | NULLABLE | Should be NOT NULL |
| `content` | `user_id` | NULLABLE | Should be NOT NULL |
| `campaigns` | `user_id` | NULLABLE | Should be NOT NULL |

### Missing updated_at Triggers

Tables missing automatic `updated_at` updates:
- All tables need `handle_updated_at()` trigger

```sql
-- Create trigger function (if not exists)
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at column
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Repeat for: personas, content, viral_patterns, campaigns
```

---

## Recommended Actions

### Priority 1: Sync Schema (Do First)
```bash
# Generate fresh Supabase schema from Prisma
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > supabase/prisma-generated-schema.sql

# Review and clean up the generated SQL
# Then apply to Supabase
```

### Priority 2: Apply Security Fixes
Run the migration in `supabase/migrations/20260215_security_hardening.sql`

### Priority 3: Add Missing Indexes
Run the migration in `supabase/migrations/20260215_performance_indexes.sql`

---

## Files Generated

1. `supabase/.audit/audit-report-20260215.md` (this file)
2. `supabase/migrations/20260215_security_hardening.sql` (to be generated)
3. `supabase/migrations/20260215_performance_indexes.sql` (to be generated)
