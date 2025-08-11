-- SYNTHEX Database Schema - Step 5: Sample Data & Testing (Fixed)
-- Run this AFTER running steps 1-4 to populate with sample data

-- ============================================
-- IMPORTANT: Sample data uses existing users
-- ============================================
-- Since profiles table references auth.users, we can only insert data for existing users
-- Create users through Supabase Auth first, then this script will add sample data

-- ============================================
-- SAMPLE DATA FOR EXISTING USERS
-- ============================================

DO $$
DECLARE
  v_user_id UUID;
  v_persona_id UUID;
  v_content_id UUID;
BEGIN
  -- Get the first existing user (if any)
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  
  IF v_user_id IS NOT NULL THEN
    -- Update or insert profile for existing user
    INSERT INTO profiles (id, email, name, role, subscription_tier, company, bio)
    SELECT 
      u.id,
      u.email,
      COALESCE(u.raw_user_meta_data->>'name', 'Demo User'),
      'user',
      'pro',
      'Synthex Demo',
      'AI Marketing Enthusiast'
    FROM auth.users u
    WHERE u.id = v_user_id
    ON CONFLICT (id) DO UPDATE
    SET 
      subscription_tier = COALESCE(profiles.subscription_tier, 'pro'),
      company = COALESCE(profiles.company, 'Synthex Demo'),
      bio = COALESCE(profiles.bio, 'AI Marketing Enthusiast');

    -- Insert user preferences if not exists
    INSERT INTO user_preferences (user_id, preferred_platforms, posting_times, content_themes, ai_creativity_level, timezone)
    VALUES (
      v_user_id, 
      ARRAY['twitter', 'linkedin', 'instagram'], 
      '{"monday": ["09:00", "17:00"], "tuesday": ["10:00", "15:00"], "wednesday": ["09:00", "17:00"]}'::JSONB,
      ARRAY['technology', 'AI', 'marketing'], 
      0.7, 
      'America/New_York'
    )
    ON CONFLICT (user_id) DO NOTHING;

    -- Insert sample personas
    INSERT INTO personas (user_id, name, description, attributes, is_active)
    VALUES 
      (v_user_id, 'Professional Voice', 'Formal and authoritative tone for LinkedIn', 
       '{"tone": "Professional", "style": "Formal", "vocabulary": "Technical", "emotion": "Confident", "humor_level": 0.2}'::JSONB, true),
      (v_user_id, 'Casual Creator', 'Fun and engaging for Instagram/TikTok', 
       '{"tone": "Casual", "style": "Conversational", "vocabulary": "Simple", "emotion": "Enthusiastic", "humor_level": 0.8}'::JSONB, true),
      (v_user_id, 'Thought Leader', 'Industry insights and expertise', 
       '{"tone": "Authoritative", "style": "Educational", "vocabulary": "Industry-specific", "emotion": "Thoughtful", "humor_level": 0.3}'::JSONB, true)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_persona_id;

    -- Insert sample campaigns
    INSERT INTO campaigns (user_id, name, description, platforms, status, start_date, end_date, budget)
    VALUES 
      (v_user_id, 'Q1 Product Launch', 'Launch campaign for new AI feature', 
       ARRAY['twitter', 'linkedin', 'instagram'], 'active', NOW(), NOW() + INTERVAL '30 days', 5000),
      (v_user_id, 'Brand Awareness', 'Ongoing brand building campaign', 
       ARRAY['twitter', 'linkedin'], 'active', NOW() - INTERVAL '15 days', NOW() + INTERVAL '75 days', 10000)
    ON CONFLICT DO NOTHING;

    -- Insert sample content
    INSERT INTO content (user_id, persona_id, platform, content, status, metadata)
    VALUES 
      (v_user_id, v_persona_id, 'twitter', 
       'Just discovered that AI can predict viral content patterns with 85% accuracy! 🚀 Here''s what I learned... #AIMarketing #ContentStrategy',
       'published',
       '{"ai_generated": true, "hook_type": "discovery", "hashtag_count": 2}'::JSONB),
      
      (v_user_id, v_persona_id, 'linkedin',
       'The Future of Content Marketing: How AI is Revolutionizing Social Media Strategy\n\nAfter analyzing 10,000+ viral posts, here are 5 key insights:\n\n1. Timing matters more than you think\n2. Emotional triggers drive 73% more engagement\n3. Visual content performs 2.3x better\n\n#DigitalMarketing #AIinBusiness',
       'published',
       '{"ai_generated": true, "hook_type": "insights", "format": "article"}'::JSONB),
      
      (v_user_id, v_persona_id, 'instagram',
       '✨ Transform your content game with AI!\n\n💡 Smart scheduling\n📊 Data-driven insights\n🎯 Targeted content\n\nSave this for later! #ContentCreator #SocialMediaTips',
       'scheduled',
       '{"ai_generated": true, "hook_type": "tips", "visual_required": true}'::JSONB)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_content_id;

    -- Insert sample analytics for published content
    INSERT INTO analytics (user_id, content_id, platform, impressions, engagements, clicks, shares, comments, saves, reach)
    SELECT 
      c.user_id,
      c.id,
      c.platform,
      FLOOR(RANDOM() * 10000 + 1000)::INTEGER,
      FLOOR(RANDOM() * 1000 + 50)::INTEGER,
      FLOOR(RANDOM() * 500 + 10)::INTEGER,
      FLOOR(RANDOM() * 200 + 5)::INTEGER,
      FLOOR(RANDOM() * 100 + 2)::INTEGER,
      FLOOR(RANDOM() * 150 + 3)::INTEGER,
      FLOOR(RANDOM() * 8000 + 500)::INTEGER
    FROM content c
    WHERE c.user_id = v_user_id 
      AND c.status = 'published'
      AND NOT EXISTS (
        SELECT 1 FROM analytics a WHERE a.content_id = c.id
      );

    -- Insert automation rules
    INSERT INTO automation_rules (user_id, name, trigger_type, trigger_config, action_type, action_config, is_active)
    VALUES 
      (v_user_id, 'Morning Post Schedule', 'time_based',
       '{"schedule": "0 9 * * *", "timezone": "America/New_York"}'::JSONB,
       'post_content', '{"platform": "twitter", "content_type": "queue"}'::JSONB, true),
      (v_user_id, 'High Engagement Alert', 'engagement_based',
       '{"threshold": 1000, "metric": "engagements"}'::JSONB,
       'send_notification', '{"notification_type": "email", "template": "viral_alert"}'::JSONB, true)
    ON CONFLICT DO NOTHING;

    -- Insert achievements
    INSERT INTO user_achievements (user_id, achievement_type, achievement_name, description, completed, progress)
    VALUES 
      (v_user_id, 'first_post', 'First Steps', 'Published your first post', true, 100),
      (v_user_id, 'viral_post', 'Going Viral', 'Got 10,000+ engagements on a single post', false, 45)
    ON CONFLICT (user_id, achievement_type) DO NOTHING;

    RAISE NOTICE 'Sample data added for user %', v_user_id;
  ELSE
    RAISE NOTICE 'No users found. Please create a user account first through Supabase Auth.';
  END IF;
END $$;

-- ============================================
-- PLATFORM-WIDE SAMPLE DATA (No User Required)
-- ============================================

-- Enhanced Viral Patterns
INSERT INTO viral_patterns (platform, pattern_type, pattern_data, engagement_score, tags, sample_content)
VALUES 
  -- Twitter patterns
  ('twitter', 'thread', 
   '{"structure": "hook-story-lesson", "optimal_length": 7, "best_time": "9am EST"}'::JSONB, 
   85, ARRAY['educational', 'storytelling'], 
   ARRAY['Thread: Here''s what nobody tells you about [topic]... 🧵']),
  
  ('twitter', 'controversial_take', 
   '{"structure": "unpopular_opinion-explanation-question", "optimal_length": 200, "best_time": "12pm EST"}'::JSONB, 
   88, ARRAY['debate', 'discussion'], 
   ARRAY['Unpopular opinion: [statement]. Here''s why I think this...']),
  
  ('twitter', 'breaking_news', 
   '{"structure": "breaking-details-source", "optimal_length": 150, "urgency": "high"}'::JSONB, 
   92, ARRAY['news', 'trending'], 
   ARRAY['BREAKING: [news]. According to [source]...']),
  
  -- LinkedIn patterns
  ('linkedin', 'post', 
   '{"structure": "insight-data-question", "optimal_length": 150, "best_time": "Tuesday 10am"}'::JSONB, 
   90, ARRAY['professional', 'thought-leadership'], 
   ARRAY['After 10 years in [industry], here''s the truth...']),
  
  ('linkedin', 'success_story', 
   '{"structure": "challenge-process-outcome-lesson", "optimal_length": 500, "format": "narrative"}'::JSONB, 
   85, ARRAY['inspiration', 'business'], 
   ARRAY['3 years ago, I was [situation]. Today, I [achievement]...']),
  
  ('linkedin', 'industry_prediction', 
   '{"structure": "prediction-evidence-implications", "optimal_length": 400}'::JSONB, 
   87, ARRAY['trends', 'insights'], 
   ARRAY['By 2025, [prediction] will transform [industry]...']),
  
  -- Instagram patterns
  ('instagram', 'carousel', 
   '{"slides": 10, "structure": "problem-solution-tips", "best_time": "6pm"}'::JSONB, 
   88, ARRAY['educational', 'visual'], 
   ARRAY['Swipe for the complete guide → ']),
  
  ('instagram', 'before_after', 
   '{"structure": "before_image-after_image-story", "slides": 2}'::JSONB, 
   91, ARRAY['transformation', 'visual'], 
   ARRAY['The transformation is incredible! Swipe →']),
  
  ('instagram', 'tutorial_reel', 
   '{"structure": "hook-steps-result", "duration": "30-60s"}'::JSONB, 
   89, ARRAY['educational', 'reels'], 
   ARRAY['Save this! 5 hacks you didn''t know']),
  
  -- TikTok patterns
  ('tiktok', 'video', 
   '{"duration": 30, "structure": "hook-demo-cta", "trending_sounds": true}'::JSONB, 
   92, ARRAY['tutorial', 'quick-tips'], 
   ARRAY['Wait for it... 😱']),
  
  ('tiktok', 'day_in_life', 
   '{"structure": "morning-afternoon-evening", "duration": "45s"}'::JSONB, 
   86, ARRAY['lifestyle', 'authentic'], 
   ARRAY['Day in the life of a [profession]']),
  
  ('tiktok', 'reaction_video', 
   '{"structure": "setup-reaction-explanation", "duration": "30s"}'::JSONB, 
   90, ARRAY['reaction', 'commentary'], 
   ARRAY['My reaction to [trending topic]']),
  
  -- Facebook patterns
  ('facebook', 'post', 
   '{"structure": "story-emotion-cta", "optimal_length": 300}'::JSONB, 
   75, ARRAY['engagement', 'community'], 
   ARRAY['I never thought this would happen, but...']),
  
  -- YouTube patterns
  ('youtube', 'short', 
   '{"duration": 60, "structure": "problem-solution", "use_captions": true}'::JSONB, 
   89, ARRAY['educational', 'entertainment'], 
   ARRAY['You''ve been doing [task] wrong this whole time'])
ON CONFLICT (platform, pattern_type) DO UPDATE
SET 
  pattern_data = EXCLUDED.pattern_data,
  engagement_score = EXCLUDED.engagement_score,
  tags = EXCLUDED.tags;

-- Sample Hashtag Performance
INSERT INTO hashtag_performance (hashtag, platform, usage_count, avg_engagement, trending_score)
VALUES 
  ('#AIMarketing', 'twitter', 15234, 856.5, 92.3),
  ('#ContentStrategy', 'twitter', 12456, 723.2, 88.7),
  ('#ThoughtLeadership', 'linkedin', 8934, 1243.8, 94.5),
  ('#B2BMarketing', 'linkedin', 7823, 987.3, 86.2),
  ('#Entrepreneurship', 'linkedin', 18234, 1456.7, 95.8),
  ('#InstaMarketing', 'instagram', 24567, 2341.5, 89.4),
  ('#ContentCreator', 'instagram', 34521, 3456.2, 93.7),
  ('#Reels', 'instagram', 56789, 4567.8, 95.2),
  ('#FYP', 'tiktok', 892341, 5634.2, 98.9),
  ('#ForYou', 'tiktok', 765432, 4987.6, 97.5),
  ('#LearnOnTikTok', 'tiktok', 234567, 4321.8, 91.2),
  ('#MarketingTips', 'all', 45678, 2345.6, 90.5),
  ('#SocialMediaMarketing', 'all', 67890, 3456.7, 92.8),
  ('#DigitalMarketing', 'all', 89012, 4567.8, 94.1)
ON CONFLICT (hashtag, platform) DO UPDATE
SET 
  usage_count = EXCLUDED.usage_count,
  avg_engagement = EXCLUDED.avg_engagement,
  trending_score = EXCLUDED.trending_score,
  last_updated = NOW();

-- Sample Trending Topics
INSERT INTO trending_topics (topic, platform, trending_score, related_hashtags, expires_at)
VALUES 
  ('AI Tools for Creators', 'twitter', 94.5, 
   ARRAY['#AITools', '#ContentCreation', '#CreatorEconomy'], 
   NOW() + INTERVAL '48 hours'),
  
  ('Remote Work Culture', 'linkedin', 91.2, 
   ARRAY['#RemoteWork', '#FutureOfWork', '#WorkLifeBalance'], 
   NOW() + INTERVAL '72 hours'),
  
  ('Sustainable Fashion', 'instagram', 88.7, 
   ARRAY['#SustainableFashion', '#EcoFriendly', '#SlowFashion'], 
   NOW() + INTERVAL '24 hours'),
  
  ('30-Day Challenge', 'tiktok', 96.3, 
   ARRAY['#30DayChallenge', '#TransformationTuesday', '#GlowUp'], 
   NOW() + INTERVAL '7 days'),
  
  ('Crypto & Web3', 'twitter', 89.4,
   ARRAY['#Crypto', '#Web3', '#Blockchain'],
   NOW() + INTERVAL '36 hours'),
  
  ('Mental Health Awareness', 'all', 93.8,
   ARRAY['#MentalHealth', '#SelfCare', '#Wellness'],
   NOW() + INTERVAL '5 days')
ON CONFLICT (topic, platform) DO UPDATE
SET 
  trending_score = EXCLUDED.trending_score,
  related_hashtags = EXCLUDED.related_hashtags,
  expires_at = EXCLUDED.expires_at;

-- ============================================
-- HELPER FUNCTIONS FOR TESTING
-- ============================================

-- Function to create sample content for any user
CREATE OR REPLACE FUNCTION create_sample_content_for_user(p_user_email TEXT)
RETURNS void AS $$
DECLARE
  v_user_id UUID;
  v_platforms TEXT[] := ARRAY['twitter', 'linkedin', 'instagram', 'tiktok'];
  v_platform TEXT;
BEGIN
  -- Get user ID from email
  SELECT id INTO v_user_id 
  FROM auth.users 
  WHERE email = p_user_email;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User with email % not found', p_user_email;
    RETURN;
  END IF;
  
  -- Create sample content for each platform
  FOREACH v_platform IN ARRAY v_platforms
  LOOP
    INSERT INTO content (user_id, platform, content, status, metadata)
    VALUES (
      v_user_id,
      v_platform,
      'Sample ' || v_platform || ' content: ' || NOW()::TEXT,
      'draft',
      jsonb_build_object('sample', true, 'created_by', 'create_sample_content_for_user')
    );
  END LOOP;
  
  RAISE NOTICE 'Sample content created for user %', p_user_email;
END;
$$ LANGUAGE plpgsql;

-- Function to generate test analytics
CREATE OR REPLACE FUNCTION generate_test_analytics(p_days INTEGER DEFAULT 7)
RETURNS void AS $$
DECLARE
  v_content RECORD;
  v_day INTEGER;
BEGIN
  FOR v_content IN 
    SELECT id, user_id, platform 
    FROM content 
    WHERE status = 'published'
    LIMIT 10
  LOOP
    FOR v_day IN 1..p_days LOOP
      INSERT INTO analytics (
        user_id, content_id, platform,
        impressions, engagements, clicks, shares, comments, saves, reach,
        recorded_at
      ) VALUES (
        v_content.user_id,
        v_content.id,
        v_content.platform,
        FLOOR(RANDOM() * 5000 + 100)::INTEGER,
        FLOOR(RANDOM() * 500 + 10)::INTEGER,
        FLOOR(RANDOM() * 250 + 5)::INTEGER,
        FLOOR(RANDOM() * 100 + 1)::INTEGER,
        FLOOR(RANDOM() * 50 + 1)::INTEGER,
        FLOOR(RANDOM() * 75 + 1)::INTEGER,
        FLOOR(RANDOM() * 4000 + 80)::INTEGER,
        NOW() - (p_days - v_day) * INTERVAL '1 day'
      );
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Test analytics generated for % days', p_days;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- REFRESH MATERIALIZED VIEWS
-- ============================================

-- Refresh materialized view if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_matviews 
    WHERE schemaname = 'public' 
    AND matviewname = 'trending_content'
  ) THEN
    REFRESH MATERIALIZED VIEW trending_content;
  END IF;
END $$;

-- ============================================
-- FINAL STATUS REPORT
-- ============================================

DO $$
DECLARE
  v_user_count INTEGER;
  v_content_count INTEGER;
  v_pattern_count INTEGER;
  v_trending_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_user_count FROM profiles;
  SELECT COUNT(*) INTO v_content_count FROM content;
  SELECT COUNT(*) INTO v_pattern_count FROM viral_patterns;
  SELECT COUNT(*) INTO v_trending_count FROM trending_topics;
  
  RAISE NOTICE '=======================================';
  RAISE NOTICE 'Sample Data Loading Complete!';
  RAISE NOTICE '=======================================';
  RAISE NOTICE 'Users with profiles: %', v_user_count;
  RAISE NOTICE 'Content items: %', v_content_count;
  RAISE NOTICE 'Viral patterns: %', v_pattern_count;
  RAISE NOTICE 'Trending topics: %', v_trending_count;
  RAISE NOTICE '=======================================';
  
  IF v_user_count = 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  No users found! To add sample data:';
    RAISE NOTICE '1. Create a user account through your app';
    RAISE NOTICE '2. Run this script again';
    RAISE NOTICE 'Or use: SELECT create_sample_content_for_user(''your-email@example.com'');';
  END IF;
END $$;