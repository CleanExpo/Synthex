-- SYNTHEX Database Schema - Step 4: Real-time Features & Automation
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
ALTER PUBLICATION supabase_realtime ADD TABLE workspaces;
ALTER PUBLICATION supabase_realtime ADD TABLE workspace_members;
ALTER PUBLICATION supabase_realtime ADD TABLE live_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE content_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE trending_topics;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

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
CREATE POLICY "Users can view workspaces they belong to" ON workspaces
  FOR SELECT USING (
    owner_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_id = workspaces.id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can manage workspaces" ON workspaces
  FOR ALL USING (owner_id = auth.uid());

-- Queue policies
CREATE POLICY "Users manage own queue" ON content_queue
  FOR ALL USING (user_id = auth.uid());

-- Automation policies
CREATE POLICY "Users manage own automation" ON automation_rules
  FOR ALL USING (user_id = auth.uid());

-- Achievement policies
CREATE POLICY "Users view own achievements" ON user_achievements
  FOR SELECT USING (user_id = auth.uid());

-- Success message
SELECT 'Real-time features and automation installed successfully!' as message;