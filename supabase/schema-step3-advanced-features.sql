-- SYNTHEX Database Schema - Step 3: Advanced Features & Analytics
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
SELECT 'Advanced features installed successfully!' as message;