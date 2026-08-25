-- SYNTHEX Database Schema - Step 1: Tables Only
-- Run this FIRST in your Supabase SQL editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  bio TEXT,
  company TEXT,
  role TEXT DEFAULT 'user',
  subscription_tier TEXT DEFAULT 'free',
  api_keys JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create personas table
CREATE TABLE IF NOT EXISTS personas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  attributes JSONB NOT NULL,
  voice_samples TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create content table
CREATE TABLE IF NOT EXISTS content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  persona_id UUID REFERENCES personas(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  content TEXT NOT NULL,
  variations JSONB,
  metadata JSONB,
  status TEXT DEFAULT 'draft',
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  engagement_metrics JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create viral_patterns table
CREATE TABLE IF NOT EXISTS viral_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform TEXT NOT NULL,
  pattern_type TEXT NOT NULL,
  pattern_data JSONB NOT NULL,
  engagement_score NUMERIC DEFAULT 0,
  sample_content TEXT[],
  tags TEXT[],
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, pattern_type)
);

-- Create campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  platforms TEXT[],
  target_audience JSONB,
  goals JSONB,
  status TEXT DEFAULT 'draft',
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  budget NUMERIC,
  metrics JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create scheduled_posts table
CREATE TABLE IF NOT EXISTS scheduled_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content_id UUID REFERENCES content(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending',
  published_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create analytics table
CREATE TABLE IF NOT EXISTS analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content_id UUID REFERENCES content(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  impressions INTEGER DEFAULT 0,
  engagements INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create platform_connections table
CREATE TABLE IF NOT EXISTS platform_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  account_name TEXT,
  account_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform, account_id)
);

-- Create api_usage table
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  cost NUMERIC DEFAULT 0,
  response_time_ms INTEGER,
  status_code INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create team_members table
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  permissions JSONB DEFAULT '{}',
  invited_by UUID REFERENCES profiles(id),
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Verify tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'personas', 'content', 'campaigns', 'viral_patterns');-- SYNTHEX Database Schema - Step 2: Indexes, RLS, and Sample Data
-- Run this AFTER running schema-step1-tables.sql

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_content_user_id ON content(user_id);
CREATE INDEX IF NOT EXISTS idx_content_status ON content(status);
CREATE INDEX IF NOT EXISTS idx_content_platform ON content(platform);
CREATE INDEX IF NOT EXISTS idx_personas_user_id ON personas(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user_id ON scheduled_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled_time ON scheduled_posts(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_content_id ON analytics(content_id);
CREATE INDEX IF NOT EXISTS idx_viral_patterns_platform ON viral_patterns(platform);
CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for personas
DROP POLICY IF EXISTS "Users can view own personas" ON personas;
CREATE POLICY "Users can view own personas" ON personas
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own personas" ON personas;
CREATE POLICY "Users can insert own personas" ON personas
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own personas" ON personas;
CREATE POLICY "Users can update own personas" ON personas
  FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own personas" ON personas;
CREATE POLICY "Users can delete own personas" ON personas
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for content
DROP POLICY IF EXISTS "Users can view own content" ON content;
CREATE POLICY "Users can view own content" ON content
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own content" ON content;
CREATE POLICY "Users can insert own content" ON content
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own content" ON content;
CREATE POLICY "Users can update own content" ON content
  FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own content" ON content;
CREATE POLICY "Users can delete own content" ON content
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for campaigns
DROP POLICY IF EXISTS "Users can view own campaigns" ON campaigns;
CREATE POLICY "Users can view own campaigns" ON campaigns
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own campaigns" ON campaigns;
CREATE POLICY "Users can insert own campaigns" ON campaigns
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own campaigns" ON campaigns;
CREATE POLICY "Users can update own campaigns" ON campaigns
  FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own campaigns" ON campaigns;
CREATE POLICY "Users can delete own campaigns" ON campaigns
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for scheduled_posts
DROP POLICY IF EXISTS "Users can view own scheduled posts" ON scheduled_posts;
CREATE POLICY "Users can view own scheduled posts" ON scheduled_posts
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own scheduled posts" ON scheduled_posts;
CREATE POLICY "Users can insert own scheduled posts" ON scheduled_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own scheduled posts" ON scheduled_posts;
CREATE POLICY "Users can update own scheduled posts" ON scheduled_posts
  FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own scheduled posts" ON scheduled_posts;
CREATE POLICY "Users can delete own scheduled posts" ON scheduled_posts
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for analytics
DROP POLICY IF EXISTS "Users can view own analytics" ON analytics;
CREATE POLICY "Users can view own analytics" ON analytics
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own analytics" ON analytics;
CREATE POLICY "Users can insert own analytics" ON analytics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for platform_connections
DROP POLICY IF EXISTS "Users can view own connections" ON platform_connections;
CREATE POLICY "Users can view own connections" ON platform_connections
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own connections" ON platform_connections;
CREATE POLICY "Users can insert own connections" ON platform_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own connections" ON platform_connections;
CREATE POLICY "Users can update own connections" ON platform_connections
  FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own connections" ON platform_connections;
CREATE POLICY "Users can delete own connections" ON platform_connections
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for api_usage
DROP POLICY IF EXISTS "Users can view own API usage" ON api_usage;
CREATE POLICY "Users can view own API usage" ON api_usage
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "System can insert API usage" ON api_usage;
CREATE POLICY "System can insert API usage" ON api_usage
  FOR INSERT WITH CHECK (true);

-- RLS Policies for notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for team_members
DROP POLICY IF EXISTS "Users can view teams they belong to" ON team_members;
CREATE POLICY "Users can view teams they belong to" ON team_members
  FOR SELECT USING (auth.uid() = user_id);

-- Viral patterns are public read, authenticated users can write
DROP POLICY IF EXISTS "Anyone can view viral patterns" ON viral_patterns;
CREATE POLICY "Anyone can view viral patterns" ON viral_patterns
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "System can manage viral patterns" ON viral_patterns;
DROP POLICY IF EXISTS "Authenticated users can insert viral patterns" ON viral_patterns;
CREATE POLICY "Authenticated users can insert viral patterns" ON viral_patterns
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated users can update viral patterns" ON viral_patterns;
CREATE POLICY "Authenticated users can update viral patterns" ON viral_patterns
  FOR UPDATE USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated users can delete viral patterns" ON viral_patterns;
CREATE POLICY "Authenticated users can delete viral patterns" ON viral_patterns
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_personas_updated_at ON personas;
CREATE TRIGGER update_personas_updated_at BEFORE UPDATE ON personas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_content_updated_at ON content;
CREATE TRIGGER update_content_updated_at BEFORE UPDATE ON content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample viral patterns
INSERT INTO viral_patterns (platform, pattern_type, pattern_data, engagement_score, tags)
VALUES 
  ('twitter', 'thread', '{"structure": "hook-story-lesson", "optimal_length": 7, "best_time": "9am EST"}', 85, ARRAY['educational', 'storytelling']),
  ('linkedin', 'post', '{"structure": "insight-data-question", "optimal_length": 150, "best_time": "Tuesday 10am"}', 90, ARRAY['professional', 'thought-leadership']),
  ('instagram', 'carousel', '{"slides": 10, "structure": "problem-solution-tips", "best_time": "6pm"}', 88, ARRAY['educational', 'visual']),
  ('tiktok', 'video', '{"duration": 30, "structure": "hook-demo-cta", "trending_sounds": true}', 92, ARRAY['tutorial', 'quick-tips']),
  ('facebook', 'post', '{"structure": "story-emotion-cta", "optimal_length": 300, "use_video": true}', 75, ARRAY['engagement', 'community']),
  ('youtube', 'short', '{"duration": 60, "structure": "problem-solution", "use_captions": true}', 89, ARRAY['educational', 'entertainment'])
ON CONFLICT (platform, pattern_type) DO NOTHING;

-- Create helper function to get user statistics
CREATE OR REPLACE FUNCTION get_user_stats(user_uuid UUID)
RETURNS TABLE (
  total_content INTEGER,
  total_campaigns INTEGER,
  total_personas INTEGER,
  scheduled_posts INTEGER,
  total_engagement INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*)::INTEGER FROM content WHERE user_id = user_uuid),
    (SELECT COUNT(*)::INTEGER FROM campaigns WHERE user_id = user_uuid),
    (SELECT COUNT(*)::INTEGER FROM personas WHERE user_id = user_uuid),
    (SELECT COUNT(*)::INTEGER FROM scheduled_posts WHERE user_id = user_uuid AND status = 'pending'),
    (SELECT COALESCE(SUM(engagements), 0)::INTEGER FROM analytics WHERE user_id = user_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Success message
SELECT 'Schema setup complete! Tables, indexes, RLS policies, and sample data have been created.' as message;-- SYNTHEX Database Schema - Step 3: Advanced Features & Analytics
-- Run this AFTER running schema-step1 and schema-step2

-- ============================================
-- ADVANCED ANALYTICS & REPORTING
-- ============================================

-- Create performance_metrics table for detailed analytics
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  platform TEXT NOT NULL,
  total_posts INTEGER DEFAULT 0,
  total_impressions INTEGER DEFAULT 0,
  total_engagements INTEGER DEFAULT 0,
  engagement_rate NUMERIC(5,2) DEFAULT 0,
  top_performing_content UUID REFERENCES content(id),
  worst_performing_content UUID REFERENCES content(id),
  average_reach INTEGER DEFAULT 0,
  follower_growth INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date, platform)
);

-- Create content_performance_history for tracking trends
CREATE TABLE IF NOT EXISTS content_performance_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID REFERENCES content(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  impressions INTEGER DEFAULT 0,
  engagements INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  sentiment_score NUMERIC(3,2) DEFAULT 0, -- -1 to 1
  virality_score NUMERIC(5,2) DEFAULT 0
);

-- Create competitor_analysis table
CREATE TABLE IF NOT EXISTS competitor_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  competitor_name TEXT NOT NULL,
  platform TEXT NOT NULL,
  competitor_handle TEXT,
  follower_count INTEGER,
  engagement_rate NUMERIC(5,2),
  posting_frequency TEXT,
  top_content_themes TEXT[],
  analyzed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create ai_training_data table for persona improvement
CREATE TABLE IF NOT EXISTS ai_training_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  persona_id UUID REFERENCES personas(id) ON DELETE CASCADE,
  input_text TEXT NOT NULL,
  output_text TEXT NOT NULL,
  performance_score NUMERIC(3,2), -- 0 to 1
  user_feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create hashtag_performance table
CREATE TABLE IF NOT EXISTS hashtag_performance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hashtag TEXT NOT NULL,
  platform TEXT NOT NULL,
  usage_count INTEGER DEFAULT 0,
  avg_engagement NUMERIC DEFAULT 0,
  trending_score NUMERIC(5,2) DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(hashtag, platform)
);

-- Create user_preferences table for personalization
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  preferred_platforms TEXT[],
  posting_times JSONB, -- {"monday": ["09:00", "17:00"], ...}
  content_themes TEXT[],
  excluded_hashtags TEXT[],
  auto_post BOOLEAN DEFAULT false,
  ai_creativity_level NUMERIC(3,2) DEFAULT 0.7, -- 0 to 1
  language_preferences TEXT[] DEFAULT ARRAY['en'],
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create content_templates table
CREATE TABLE IF NOT EXISTS content_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  template_structure JSONB NOT NULL,
  variables JSONB, -- {"product_name": "string", "price": "number"}
  performance_data JSONB,
  is_public BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create ab_tests table for content optimization
CREATE TABLE IF NOT EXISTS ab_tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  variant_a UUID REFERENCES content(id),
  variant_b UUID REFERENCES content(id),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  winner UUID REFERENCES content(id),
  confidence_level NUMERIC(3,2),
  results JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create collaboration_invites table
CREATE TABLE IF NOT EXISTS collaboration_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL,
  inviter_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  invitee_email TEXT NOT NULL,
  role TEXT DEFAULT 'viewer',
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create billing_history table
CREATE TABLE IF NOT EXISTS billing_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  description TEXT,
  stripe_invoice_id TEXT,
  stripe_payment_intent TEXT,
  status TEXT DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- ============================================

-- Create materialized view for trending content (wrapped in DO block for idempotency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_matviews WHERE matviewname = 'trending_content'
  ) THEN
    EXECUTE '
      CREATE MATERIALIZED VIEW trending_content AS
      SELECT
        c.id,
        c.platform,
        c.content,
        c.user_id,
        COUNT(DISTINCT a.id) as total_engagements,
        AVG(a.engagements) as avg_engagement,
        MAX(a.recorded_at) as last_updated
      FROM content c
      LEFT JOIN analytics a ON c.id = a.content_id
      WHERE c.created_at > NOW() - INTERVAL ''7 days''
      GROUP BY c.id, c.platform, c.content, c.user_id
      ORDER BY avg_engagement DESC
      LIMIT 100
    ';
  END IF;
END;
$$;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_trending_content_platform ON trending_content(platform);

-- ============================================
-- ADVANCED FUNCTIONS
-- ============================================

-- Function to calculate engagement rate
CREATE OR REPLACE FUNCTION calculate_engagement_rate(
  p_impressions INTEGER,
  p_engagements INTEGER
) RETURNS NUMERIC AS $$
BEGIN
  IF COALESCE(p_impressions, 0) = 0 THEN
    RETURN 0;
  END IF;
  RETURN ROUND((COALESCE(p_engagements, 0)::NUMERIC / p_impressions::NUMERIC) * 100, 2);
END;
$$ LANGUAGE plpgsql;

-- Function to get platform insights
CREATE OR REPLACE FUNCTION get_platform_insights(
  p_user_id UUID,
  p_platform TEXT,
  p_days INTEGER DEFAULT 30
) RETURNS TABLE (
  best_posting_time TEXT,
  avg_engagement_rate NUMERIC,
  top_hashtags TEXT[],
  content_count INTEGER,
  total_reach INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH platform_data AS (
    SELECT 
      c.id,
      c.created_at,
      EXTRACT(HOUR FROM c.created_at) as hour,
      a.engagements,
      a.impressions,
      a.reach
    FROM content c
    LEFT JOIN analytics a ON c.id = a.content_id
    WHERE c.user_id = p_user_id 
      AND c.platform = p_platform
      AND c.created_at > NOW() - INTERVAL '1 day' * p_days
  )
  SELECT 
    (SELECT hour::TEXT || ':00' FROM platform_data 
     WHERE engagements IS NOT NULL 
     GROUP BY hour 
     ORDER BY AVG(engagements) DESC 
     LIMIT 1) as best_posting_time,
    ROUND(AVG(calculate_engagement_rate(impressions, engagements)), 2) as avg_engagement_rate,
    (SELECT ARRAY_AGG(DISTINCT hashtag) 
     FROM (
       SELECT unnest(string_to_array(c.content, ' ')) as hashtag
       FROM content c
       WHERE c.user_id = p_user_id 
         AND c.platform = p_platform
         AND c.content LIKE '%#%'
       LIMIT 5
     ) t 
     WHERE hashtag LIKE '#%') as top_hashtags,
    COUNT(*)::INTEGER as content_count,
    COALESCE(SUM(reach), 0)::INTEGER as total_reach
  FROM platform_data;
END;
$$ LANGUAGE plpgsql;

-- Function to predict best posting time
CREATE OR REPLACE FUNCTION predict_best_posting_time(
  p_user_id UUID,
  p_platform TEXT
) RETURNS TEXT AS $$
DECLARE
  v_best_hour INTEGER;
  v_best_day TEXT;
BEGIN
  -- Analyze historical performance
  WITH performance_by_time AS (
    SELECT 
      EXTRACT(HOUR FROM c.created_at) as hour,
      EXTRACT(DOW FROM c.created_at) as day_of_week,
      AVG(COALESCE(a.engagements, 0)) as avg_engagement
    FROM content c
    LEFT JOIN analytics a ON c.id = a.content_id
    WHERE c.user_id = p_user_id 
      AND c.platform = p_platform
      AND c.created_at > NOW() - INTERVAL '90 days'
    GROUP BY hour, day_of_week
    ORDER BY avg_engagement DESC
    LIMIT 1
  )
  SELECT hour, 
    CASE day_of_week
      WHEN 0 THEN 'Sunday'
      WHEN 1 THEN 'Monday'
      WHEN 2 THEN 'Tuesday'
      WHEN 3 THEN 'Wednesday'
      WHEN 4 THEN 'Thursday'
      WHEN 5 THEN 'Friday'
      WHEN 6 THEN 'Saturday'
    END
  INTO v_best_hour, v_best_day
  FROM performance_by_time;
  
  IF v_best_hour IS NULL THEN
    -- Return platform defaults if no data
    RETURN CASE p_platform
      WHEN 'twitter' THEN 'Weekdays 9:00 AM'
      WHEN 'linkedin' THEN 'Tuesday 10:00 AM'
      WHEN 'instagram' THEN 'Weekdays 6:00 PM'
      WHEN 'tiktok' THEN 'Weekdays 6:00-8:00 PM'
      ELSE 'Weekdays 12:00 PM'
    END;
  END IF;
  
  RETURN v_best_day || ' ' || v_best_hour || ':00';
END;
$$ LANGUAGE plpgsql;

-- Function to generate content recommendations
CREATE OR REPLACE FUNCTION generate_content_recommendations(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 5
) RETURNS TABLE (
  recommendation_type TEXT,
  platform TEXT,
  suggestion TEXT,
  expected_engagement NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  -- Get recommendations based on viral patterns and user history
  WITH user_performance AS (
    SELECT 
      c.platform,
      AVG(a.engagements) as avg_engagement,
      COUNT(*) as post_count
    FROM content c
    LEFT JOIN analytics a ON c.id = a.content_id
    WHERE c.user_id = p_user_id
    GROUP BY c.platform
  ),
  viral_recommendations AS (
    SELECT 
      'Viral Pattern' as rec_type,
      vp.platform,
      'Try ' || vp.pattern_type || ' format: ' || vp.pattern_data->>'structure' as suggestion,
      vp.engagement_score
    FROM viral_patterns vp
    LEFT JOIN user_performance up ON vp.platform = up.platform
    WHERE up.post_count < 10 OR up.avg_engagement < vp.engagement_score
    ORDER BY vp.engagement_score DESC
    LIMIT p_limit
  )
  SELECT * FROM viral_recommendations;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS FOR AUTOMATION
-- ============================================

-- Trigger to update performance metrics daily
CREATE OR REPLACE FUNCTION update_daily_metrics() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO performance_metrics (
    user_id, date, platform, total_posts, total_impressions,
    total_engagements, engagement_rate
  )
  SELECT
    NEW.user_id,
    CURRENT_DATE,
    NEW.platform,
    COUNT(*),
    COALESCE(SUM(impressions), 0),
    COALESCE(SUM(engagements), 0),
    CASE
      WHEN COALESCE(SUM(impressions), 0) = 0 THEN 0
      ELSE ROUND((COALESCE(SUM(engagements), 0)::NUMERIC / SUM(impressions)::NUMERIC) * 100, 2)
    END
  FROM analytics
  WHERE user_id = NEW.user_id
    AND platform = NEW.platform
    AND DATE(recorded_at) = CURRENT_DATE
  GROUP BY user_id, platform
  ON CONFLICT (user_id, date, platform)
  DO UPDATE SET
    total_impressions = EXCLUDED.total_impressions,
    total_engagements = EXCLUDED.total_engagements,
    engagement_rate = EXCLUDED.engagement_rate;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_metrics ON analytics;
CREATE TRIGGER trigger_update_metrics
AFTER INSERT ON analytics
FOR EACH ROW EXECUTE FUNCTION update_daily_metrics();

-- ============================================
-- INDEXES FOR NEW TABLES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_performance_metrics_user_date ON performance_metrics(user_id, date);
CREATE INDEX IF NOT EXISTS idx_content_performance_history_content ON content_performance_history(content_id);
CREATE INDEX IF NOT EXISTS idx_hashtag_performance_platform ON hashtag_performance(platform);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_ab_tests_user ON ab_tests(user_id);

-- ============================================
-- RLS POLICIES FOR NEW TABLES
-- ============================================

ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_performance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_training_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_tests ENABLE ROW LEVEL SECURITY;

-- Performance metrics policies
DROP POLICY IF EXISTS "Users view own metrics" ON performance_metrics;
CREATE POLICY "Users view own metrics" ON performance_metrics
  FOR SELECT USING (auth.uid() = user_id);

-- User preferences policies
DROP POLICY IF EXISTS "Users manage own preferences" ON user_preferences;
CREATE POLICY "Users manage own preferences" ON user_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Content templates policies
DROP POLICY IF EXISTS "Users manage own templates" ON content_templates;
CREATE POLICY "Users manage own templates" ON content_templates
  FOR ALL USING (auth.uid() = user_id OR is_public = true);

-- AB tests policies
DROP POLICY IF EXISTS "Users manage own tests" ON ab_tests;
CREATE POLICY "Users manage own tests" ON ab_tests
  FOR ALL USING (auth.uid() = user_id);

-- Success message
SELECT 'Advanced features installed successfully!' as message;-- SYNTHEX Database Schema - Step 4: Real-time Features & Automation
-- Run this AFTER running schema-step1, step2, and step3

-- ============================================
-- REAL-TIME COLLABORATION FEATURES
-- ============================================

-- Create workspace table for team collaboration
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  description TEXT,
  settings JSONB DEFAULT '{}',
  max_members INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create workspace_members table
CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- owner, admin, editor, viewer
  permissions JSONB DEFAULT '{}',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- Create live_sessions table for real-time collaboration
CREATE TABLE IF NOT EXISTS live_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  content_id UUID REFERENCES content(id) ON DELETE CASCADE,
  active_users UUID[],
  session_data JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- Create content_versions table for version control
CREATE TABLE IF NOT EXISTS content_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID REFERENCES content(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content_data TEXT NOT NULL,
  changed_by UUID REFERENCES profiles(id),
  change_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(content_id, version_number)
);

-- Create automation_rules table
CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL, -- time_based, engagement_based, event_based
  trigger_config JSONB NOT NULL,
  action_type TEXT NOT NULL, -- post_content, send_notification, generate_content
  action_config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_triggered TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create automation_logs table
CREATE TABLE IF NOT EXISTS automation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id UUID REFERENCES automation_rules(id) ON DELETE CASCADE,
  status TEXT NOT NULL, -- success, failed, skipped
  trigger_data JSONB,
  result_data JSONB,
  error_message TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create content_queue table for automated posting
CREATE TABLE IF NOT EXISTS content_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content_id UUID REFERENCES content(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  priority INTEGER DEFAULT 5, -- 1-10, higher is more important
  scheduled_time TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  status TEXT DEFAULT 'pending', -- pending, processing, posted, failed
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create trending_topics table
CREATE TABLE IF NOT EXISTS trending_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic TEXT NOT NULL,
  platform TEXT NOT NULL,
  trending_score NUMERIC DEFAULT 0,
  related_hashtags TEXT[],
  sample_posts JSONB,
  expires_at TIMESTAMPTZ,
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(topic, platform)
);

-- Create user_achievements table for gamification
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_type TEXT NOT NULL,
  achievement_name TEXT NOT NULL,
  description TEXT,
  criteria JSONB,
  progress NUMERIC DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  reward_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_type)
);

-- ============================================
-- EDGE FUNCTIONS FOR AUTOMATION
-- ============================================

-- Function to auto-generate content based on trending topics
CREATE OR REPLACE FUNCTION auto_generate_trending_content()
RETURNS void AS $$
DECLARE
  v_topic RECORD;
  v_user RECORD;
BEGIN
  -- Get top trending topics
  FOR v_topic IN 
    SELECT * FROM trending_topics 
    WHERE trending_score > 80 
    AND expires_at > NOW()
    ORDER BY trending_score DESC 
    LIMIT 5
  LOOP
    -- For each user with auto-generation enabled
    FOR v_user IN 
      SELECT p.id, up.ai_creativity_level 
      FROM profiles p
      JOIN user_preferences up ON p.id = up.user_id
      WHERE up.auto_post = true
    LOOP
      -- Create content for trending topic
      INSERT INTO content (
        user_id, platform, content, status, metadata
      ) VALUES (
        v_user.id,
        v_topic.platform,
        'AI Generated: ' || v_topic.topic, -- This would call AI service
        'draft',
        jsonb_build_object(
          'trending_topic', v_topic.topic,
          'auto_generated', true,
          'creativity_level', v_user.ai_creativity_level
        )
      );
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to process content queue
CREATE OR REPLACE FUNCTION process_content_queue()
RETURNS void AS $$
DECLARE
  v_item RECORD;
BEGIN
  -- Get items ready to post
  FOR v_item IN 
    SELECT * FROM content_queue 
    WHERE status = 'pending' 
    AND (scheduled_time IS NULL OR scheduled_time <= NOW())
    ORDER BY priority DESC, created_at ASC
    LIMIT 10
  LOOP
    -- Update status to processing
    UPDATE content_queue 
    SET status = 'processing' 
    WHERE id = v_item.id;
    
    -- Here you would call the actual posting API
    -- For now, we'll simulate success
    UPDATE content_queue 
    SET 
      status = 'posted',
      posted_at = NOW()
    WHERE id = v_item.id;
    
    -- Update analytics
    INSERT INTO analytics (
      user_id, content_id, platform, impressions
    ) VALUES (
      v_item.user_id, v_item.content_id, v_item.platform, 0
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to check and award achievements
CREATE OR REPLACE FUNCTION check_user_achievements(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_content_count INTEGER;
  v_engagement_total INTEGER;
  v_platforms_used INTEGER;
BEGIN
  -- Get user statistics
  SELECT COUNT(*) INTO v_content_count 
  FROM content WHERE user_id = p_user_id;
  
  SELECT COALESCE(SUM(engagements), 0) INTO v_engagement_total
  FROM analytics WHERE user_id = p_user_id;
  
  SELECT COUNT(DISTINCT platform) INTO v_platforms_used
  FROM content WHERE user_id = p_user_id;
  
  -- Check "First Post" achievement
  IF v_content_count >= 1 THEN
    INSERT INTO user_achievements (
      user_id, achievement_type, achievement_name, completed, completed_at
    ) VALUES (
      p_user_id, 'first_post', 'First Steps', true, NOW()
    ) ON CONFLICT (user_id, achievement_type) 
    DO UPDATE SET completed = true, completed_at = NOW();
  END IF;
  
  -- Check "Prolific Creator" achievement (100 posts)
  IF v_content_count >= 100 THEN
    INSERT INTO user_achievements (
      user_id, achievement_type, achievement_name, completed, completed_at
    ) VALUES (
      p_user_id, 'prolific_creator', 'Prolific Creator', true, NOW()
    ) ON CONFLICT (user_id, achievement_type) 
    DO UPDATE SET completed = true, completed_at = NOW();
  END IF;
  
  -- Check "Engagement Master" achievement (10k total engagements)
  IF v_engagement_total >= 10000 THEN
    INSERT INTO user_achievements (
      user_id, achievement_type, achievement_name, completed, completed_at
    ) VALUES (
      p_user_id, 'engagement_master', 'Engagement Master', true, NOW()
    ) ON CONFLICT (user_id, achievement_type) 
    DO UPDATE SET completed = true, completed_at = NOW();
  END IF;
  
  -- Check "Platform Explorer" achievement (used 5+ platforms)
  IF v_platforms_used >= 5 THEN
    INSERT INTO user_achievements (
      user_id, achievement_type, achievement_name, completed, completed_at
    ) VALUES (
      p_user_id, 'platform_explorer', 'Platform Explorer', true, NOW()
    ) ON CONFLICT (user_id, achievement_type) 
    DO UPDATE SET completed = true, completed_at = NOW();
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SCHEDULED JOBS (Cron-like functions)
-- ============================================

-- Function to refresh trending topics (call via cron)
CREATE OR REPLACE FUNCTION refresh_trending_topics()
RETURNS void AS $$
BEGIN
  -- Remove expired topics
  DELETE FROM trending_topics WHERE expires_at < NOW();
  
  -- Update trending scores based on recent content performance
  INSERT INTO trending_topics (topic, platform, trending_score, expires_at)
  SELECT 
    SUBSTRING(content FROM '#(\w+)'),
    platform,
    AVG(engagements) * 10 as score,
    NOW() + INTERVAL '24 hours'
  FROM content c
  JOIN analytics a ON c.id = a.content_id
  WHERE c.created_at > NOW() - INTERVAL '24 hours'
    AND content LIKE '%#%'
  GROUP BY SUBSTRING(content FROM '#(\w+)'), platform
  HAVING AVG(engagements) > 100
  ON CONFLICT (topic, platform) 
  DO UPDATE SET 
    trending_score = EXCLUDED.trending_score,
    expires_at = EXCLUDED.expires_at;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old data
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
  -- Delete old automation logs (keep 30 days)
  DELETE FROM automation_logs 
  WHERE executed_at < NOW() - INTERVAL '30 days';
  
  -- Delete old API usage logs (keep 90 days)
  DELETE FROM api_usage 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  -- Archive old content (move to different status)
  UPDATE content 
  SET status = 'archived' 
  WHERE created_at < NOW() - INTERVAL '180 days'
    AND status != 'archived';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- REAL-TIME SUBSCRIPTIONS
-- ============================================

-- Enable real-time for collaboration tables
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE workspaces;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE workspace_members;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE live_sessions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE content_queue;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE trending_topics;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- WEBHOOK TRIGGERS
-- ============================================

-- Function to send webhook on content publication
CREATE OR REPLACE FUNCTION notify_content_published()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'published' AND OLD.status != 'published' THEN
    PERFORM pg_notify(
      'content_published',
      json_build_object(
        'content_id', NEW.id,
        'user_id', NEW.user_id,
        'platform', NEW.platform,
        'published_at', NEW.published_at
      )::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_content_published ON content;
CREATE TRIGGER trigger_content_published
AFTER UPDATE ON content
FOR EACH ROW EXECUTE FUNCTION notify_content_published();

-- Function to notify on high engagement
CREATE OR REPLACE FUNCTION notify_high_engagement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.engagements > 1000 THEN
    INSERT INTO notifications (
      user_id, type, title, message, data
    ) VALUES (
      NEW.user_id,
      'high_engagement',
      'Content Going Viral! 🚀',
      'Your content has received over 1000 engagements!',
      jsonb_build_object('content_id', NEW.content_id, 'engagements', NEW.engagements)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_high_engagement ON analytics;
CREATE TRIGGER trigger_high_engagement
AFTER INSERT OR UPDATE ON analytics
FOR EACH ROW EXECUTE FUNCTION notify_high_engagement();

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_content_queue_status ON content_queue(status, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_automation_rules_user ON automation_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_trending_topics_score ON trending_topics(trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);

-- ============================================
-- RLS POLICIES FOR NEW TABLES
-- ============================================

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- Workspace policies
DROP POLICY IF EXISTS "Users can view workspaces they belong to" ON workspaces;
CREATE POLICY "Users can view workspaces they belong to" ON workspaces
  FOR SELECT USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = workspaces.id
      AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can manage workspaces" ON workspaces;
CREATE POLICY "Owners can manage workspaces" ON workspaces
  FOR ALL USING (owner_id = auth.uid());

-- Queue policies
DROP POLICY IF EXISTS "Users manage own queue" ON content_queue;
CREATE POLICY "Users manage own queue" ON content_queue
  FOR ALL USING (user_id = auth.uid());

-- Automation policies
DROP POLICY IF EXISTS "Users manage own automation" ON automation_rules;
CREATE POLICY "Users manage own automation" ON automation_rules
  FOR ALL USING (user_id = auth.uid());

-- Achievement policies
DROP POLICY IF EXISTS "Users view own achievements" ON user_achievements;
CREATE POLICY "Users view own achievements" ON user_achievements
  FOR SELECT USING (user_id = auth.uid());

-- Success message
SELECT 'Real-time features and automation installed successfully!' as message;