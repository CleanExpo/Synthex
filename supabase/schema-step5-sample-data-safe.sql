-- SYNTHEX Database Schema - Step 5: Sample Data & Testing (Safe Version)
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
  v_campaign_id UUID;
BEGIN
  -- Get the first existing user (if any)
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  
  IF v_user_id IS NOT NULL THEN
    RAISE NOTICE 'Found user: %', v_user_id;
    
    -- Check if profile exists, if not create it
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id) THEN
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
      WHERE u.id = v_user_id;
      RAISE NOTICE 'Created profile for user';
    END IF;

    -- Check and insert user preferences
    IF NOT EXISTS (SELECT 1 FROM user_preferences WHERE user_id = v_user_id) THEN
      INSERT INTO user_preferences (user_id, preferred_platforms, posting_times, content_themes, ai_creativity_level, timezone)
      VALUES (
        v_user_id, 
        ARRAY['twitter', 'linkedin', 'instagram'], 
        '{"monday": ["09:00", "17:00"], "tuesday": ["10:00", "15:00"], "wednesday": ["09:00", "17:00"]}'::JSONB,
        ARRAY['technology', 'AI', 'marketing'], 
        0.7, 
        'America/New_York'
      );
      RAISE NOTICE 'Created user preferences';
    END IF;

    -- Insert sample personas (checking for duplicates)
    IF NOT EXISTS (SELECT 1 FROM personas WHERE user_id = v_user_id AND name = 'Professional Voice') THEN
      INSERT INTO personas (user_id, name, description, attributes, is_active)
      VALUES (v_user_id, 'Professional Voice', 'Formal and authoritative tone for LinkedIn', 
       '{"tone": "Professional", "style": "Formal", "vocabulary": "Technical", "emotion": "Confident", "humor_level": 0.2}'::JSONB, true)
      RETURNING id INTO v_persona_id;
    ELSE
      SELECT id INTO v_persona_id FROM personas WHERE user_id = v_user_id AND name = 'Professional Voice';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM personas WHERE user_id = v_user_id AND name = 'Casual Creator') THEN
      INSERT INTO personas (user_id, name, description, attributes, is_active)
      VALUES (v_user_id, 'Casual Creator', 'Fun and engaging for Instagram/TikTok', 
       '{"tone": "Casual", "style": "Conversational", "vocabulary": "Simple", "emotion": "Enthusiastic", "humor_level": 0.8}'::JSONB, true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM personas WHERE user_id = v_user_id AND name = 'Thought Leader') THEN
      INSERT INTO personas (user_id, name, description, attributes, is_active)
      VALUES (v_user_id, 'Thought Leader', 'Industry insights and expertise', 
       '{"tone": "Authoritative", "style": "Educational", "vocabulary": "Industry-specific", "emotion": "Thoughtful", "humor_level": 0.3}'::JSONB, true);
    END IF;
    
    RAISE NOTICE 'Created personas';

    -- Insert sample campaigns (checking for duplicates)
    IF NOT EXISTS (SELECT 1 FROM campaigns WHERE user_id = v_user_id AND name = 'Q1 Product Launch') THEN
      INSERT INTO campaigns (user_id, name, description, platforms, status, start_date, end_date, budget)
      VALUES (v_user_id, 'Q1 Product Launch', 'Launch campaign for new AI feature', 
       ARRAY['twitter', 'linkedin', 'instagram'], 'active', NOW(), NOW() + INTERVAL '30 days', 5000)
      RETURNING id INTO v_campaign_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM campaigns WHERE user_id = v_user_id AND name = 'Brand Awareness') THEN
      INSERT INTO campaigns (user_id, name, description, platforms, status, start_date, end_date, budget)
      VALUES (v_user_id, 'Brand Awareness', 'Ongoing brand building campaign', 
       ARRAY['twitter', 'linkedin'], 'active', NOW() - INTERVAL '15 days', NOW() + INTERVAL '75 days', 10000);
    END IF;
    
    RAISE NOTICE 'Created campaigns';

    -- Insert sample content (always create new)
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
    RETURNING id INTO v_content_id;
    
    RAISE NOTICE 'Created sample content';

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
      )
    LIMIT 5;
    
    RAISE NOTICE 'Created analytics data';

    -- Insert automation rules (check for duplicates)
    IF NOT EXISTS (SELECT 1 FROM automation_rules WHERE user_id = v_user_id AND name = 'Morning Post Schedule') THEN
      INSERT INTO automation_rules (user_id, name, trigger_type, trigger_config, action_type, action_config, is_active)
      VALUES (v_user_id, 'Morning Post Schedule', 'time_based',
       '{"schedule": "0 9 * * *", "timezone": "America/New_York"}'::JSONB,
       'post_content', '{"platform": "twitter", "content_type": "queue"}'::JSONB, true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM automation_rules WHERE user_id = v_user_id AND name = 'High Engagement Alert') THEN
      INSERT INTO automation_rules (user_id, name, trigger_type, trigger_config, action_type, action_config, is_active)
      VALUES (v_user_id, 'High Engagement Alert', 'engagement_based',
       '{"threshold": 1000, "metric": "engagements"}'::JSONB,
       'send_notification', '{"notification_type": "email", "template": "viral_alert"}'::JSONB, true);
    END IF;
    
    RAISE NOTICE 'Created automation rules';

    -- Insert achievements (check for duplicates by type)
    IF NOT EXISTS (SELECT 1 FROM user_achievements WHERE user_id = v_user_id AND achievement_type = 'first_post') THEN
      INSERT INTO user_achievements (user_id, achievement_type, achievement_name, description, completed, progress)
      VALUES (v_user_id, 'first_post', 'First Steps', 'Published your first post', true, 100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM user_achievements WHERE user_id = v_user_id AND achievement_type = 'viral_post') THEN
      INSERT INTO user_achievements (user_id, achievement_type, achievement_name, description, completed, progress)
      VALUES (v_user_id, 'viral_post', 'Going Viral', 'Got 10,000+ engagements on a single post', false, 45);
    END IF;
    
    RAISE NOTICE 'Created achievements';

    RAISE NOTICE '✅ Sample data successfully added for user %', v_user_id;
  ELSE
    RAISE NOTICE '⚠️ No users found. Please create a user account first through Supabase Auth.';
    RAISE NOTICE 'To create a user:';
    RAISE NOTICE '1. Go to your app and sign up';
    RAISE NOTICE '2. Or use Supabase Dashboard > Authentication > Users > Add User';
  END IF;
END $$;

-- ============================================
-- PLATFORM-WIDE SAMPLE DATA (No User Required)
-- ============================================

-- Viral Patterns (safe insert with explicit conflict handling)
DO $$
BEGIN
  -- Twitter patterns
  IF NOT EXISTS (SELECT 1 FROM viral_patterns WHERE platform = 'twitter' AND pattern_type = 'thread') THEN
    INSERT INTO viral_patterns (platform, pattern_type, pattern_data, engagement_score, tags)
    VALUES ('twitter', 'thread', 
     '{"structure": "hook-story-lesson", "optimal_length": 7, "best_time": "9am EST"}'::JSONB, 
     85, ARRAY['educational', 'storytelling']);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM viral_patterns WHERE platform = 'twitter' AND pattern_type = 'controversial_take') THEN
    INSERT INTO viral_patterns (platform, pattern_type, pattern_data, engagement_score, tags)
    VALUES ('twitter', 'controversial_take', 
     '{"structure": "unpopular_opinion-explanation-question", "optimal_length": 200}'::JSONB, 
     88, ARRAY['debate', 'discussion']);
  END IF;

  -- LinkedIn patterns
  IF NOT EXISTS (SELECT 1 FROM viral_patterns WHERE platform = 'linkedin' AND pattern_type = 'post') THEN
    INSERT INTO viral_patterns (platform, pattern_type, pattern_data, engagement_score, tags)
    VALUES ('linkedin', 'post', 
     '{"structure": "insight-data-question", "optimal_length": 150, "best_time": "Tuesday 10am"}'::JSONB, 
     90, ARRAY['professional', 'thought-leadership']);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM viral_patterns WHERE platform = 'linkedin' AND pattern_type = 'success_story') THEN
    INSERT INTO viral_patterns (platform, pattern_type, pattern_data, engagement_score, tags)
    VALUES ('linkedin', 'success_story', 
     '{"structure": "challenge-process-outcome-lesson", "optimal_length": 500}'::JSONB, 
     85, ARRAY['inspiration', 'business']);
  END IF;

  -- Instagram patterns
  IF NOT EXISTS (SELECT 1 FROM viral_patterns WHERE platform = 'instagram' AND pattern_type = 'carousel') THEN
    INSERT INTO viral_patterns (platform, pattern_type, pattern_data, engagement_score, tags)
    VALUES ('instagram', 'carousel', 
     '{"slides": 10, "structure": "problem-solution-tips", "best_time": "6pm"}'::JSONB, 
     88, ARRAY['educational', 'visual']);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM viral_patterns WHERE platform = 'instagram' AND pattern_type = 'reels') THEN
    INSERT INTO viral_patterns (platform, pattern_type, pattern_data, engagement_score, tags)
    VALUES ('instagram', 'reels', 
     '{"duration": "30-60s", "structure": "hook-content-cta"}'::JSONB, 
     91, ARRAY['video', 'trending']);
  END IF;

  -- TikTok patterns
  IF NOT EXISTS (SELECT 1 FROM viral_patterns WHERE platform = 'tiktok' AND pattern_type = 'video') THEN
    INSERT INTO viral_patterns (platform, pattern_type, pattern_data, engagement_score, tags)
    VALUES ('tiktok', 'video', 
     '{"duration": 30, "structure": "hook-demo-cta", "trending_sounds": true}'::JSONB, 
     92, ARRAY['tutorial', 'quick-tips']);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM viral_patterns WHERE platform = 'tiktok' AND pattern_type = 'challenge') THEN
    INSERT INTO viral_patterns (platform, pattern_type, pattern_data, engagement_score, tags)
    VALUES ('tiktok', 'challenge', 
     '{"structure": "demo-challenge-invite", "duration": "15-30s"}'::JSONB, 
     94, ARRAY['viral', 'engagement']);
  END IF;

  -- Facebook patterns
  IF NOT EXISTS (SELECT 1 FROM viral_patterns WHERE platform = 'facebook' AND pattern_type = 'post') THEN
    INSERT INTO viral_patterns (platform, pattern_type, pattern_data, engagement_score, tags)
    VALUES ('facebook', 'post', 
     '{"structure": "story-emotion-cta", "optimal_length": 300}'::JSONB, 
     75, ARRAY['engagement', 'community']);
  END IF;

  -- YouTube patterns
  IF NOT EXISTS (SELECT 1 FROM viral_patterns WHERE platform = 'youtube' AND pattern_type = 'shorts') THEN
    INSERT INTO viral_patterns (platform, pattern_type, pattern_data, engagement_score, tags)
    VALUES ('youtube', 'shorts', 
     '{"duration": 60, "structure": "problem-solution", "use_captions": true}'::JSONB, 
     89, ARRAY['educational', 'entertainment']);
  END IF;
  
  RAISE NOTICE 'Viral patterns added/updated';
END $$;

-- Hashtag Performance (safe insert)
DO $$
BEGIN
  -- Only insert if table is empty or update existing
  IF NOT EXISTS (SELECT 1 FROM hashtag_performance WHERE hashtag = '#AIMarketing') THEN
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
      ('#DigitalMarketing', 'all', 89012, 4567.8, 94.1);
    RAISE NOTICE 'Hashtag performance data added';
  ELSE
    RAISE NOTICE 'Hashtag performance data already exists';
  END IF;
END $$;

-- Trending Topics (safe insert)
DO $$
BEGIN
  -- Check and insert trending topics
  IF NOT EXISTS (SELECT 1 FROM trending_topics WHERE topic = 'AI Tools for Creators' AND platform = 'twitter') THEN
    INSERT INTO trending_topics (topic, platform, trending_score, related_hashtags, expires_at)
    VALUES ('AI Tools for Creators', 'twitter', 94.5, 
     ARRAY['#AITools', '#ContentCreation', '#CreatorEconomy'], 
     NOW() + INTERVAL '48 hours');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM trending_topics WHERE topic = 'Remote Work Culture' AND platform = 'linkedin') THEN
    INSERT INTO trending_topics (topic, platform, trending_score, related_hashtags, expires_at)
    VALUES ('Remote Work Culture', 'linkedin', 91.2, 
     ARRAY['#RemoteWork', '#FutureOfWork', '#WorkLifeBalance'], 
     NOW() + INTERVAL '72 hours');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM trending_topics WHERE topic = 'Sustainable Fashion' AND platform = 'instagram') THEN
    INSERT INTO trending_topics (topic, platform, trending_score, related_hashtags, expires_at)
    VALUES ('Sustainable Fashion', 'instagram', 88.7, 
     ARRAY['#SustainableFashion', '#EcoFriendly', '#SlowFashion'], 
     NOW() + INTERVAL '24 hours');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM trending_topics WHERE topic = '30-Day Challenge' AND platform = 'tiktok') THEN
    INSERT INTO trending_topics (topic, platform, trending_score, related_hashtags, expires_at)
    VALUES ('30-Day Challenge', 'tiktok', 96.3, 
     ARRAY['#30DayChallenge', '#TransformationTuesday', '#GlowUp'], 
     NOW() + INTERVAL '7 days');
  END IF;
  
  RAISE NOTICE 'Trending topics added/updated';
END $$;

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

-- ============================================
-- REFRESH MATERIALIZED VIEWS
-- ============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_matviews 
    WHERE schemaname = 'public' 
    AND matviewname = 'trending_content'
  ) THEN
    REFRESH MATERIALIZED VIEW trending_content;
    RAISE NOTICE 'Materialized view refreshed';
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
  v_hashtag_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_user_count FROM profiles;
  SELECT COUNT(*) INTO v_content_count FROM content;
  SELECT COUNT(*) INTO v_pattern_count FROM viral_patterns;
  SELECT COUNT(*) INTO v_trending_count FROM trending_topics;
  SELECT COUNT(*) INTO v_hashtag_count FROM hashtag_performance;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Sample Data Loading Complete!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Users with profiles: %', v_user_count;
  RAISE NOTICE 'Content items: %', v_content_count;
  RAISE NOTICE 'Viral patterns: %', v_pattern_count;
  RAISE NOTICE 'Trending topics: %', v_trending_count;
  RAISE NOTICE 'Hashtag data: %', v_hashtag_count;
  RAISE NOTICE '========================================';
  
  IF v_user_count = 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  NO USERS FOUND!';
    RAISE NOTICE '';
    RAISE NOTICE 'To add sample data, first create a user:';
    RAISE NOTICE '1. Go to your app: https://synthex-z06c5t9bb-unite-group.vercel.app';
    RAISE NOTICE '2. Click "Sign Up" and create an account';
    RAISE NOTICE '3. Run this script again';
    RAISE NOTICE '';
    RAISE NOTICE 'Or in Supabase Dashboard:';
    RAISE NOTICE '1. Go to Authentication > Users';
    RAISE NOTICE '2. Click "Add User" > "Create new user"';
    RAISE NOTICE '3. Run this script again';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '🎉 Your SYNTHEX database is populated!';
    RAISE NOTICE 'You can now test all features.';
  END IF;
  
  RAISE NOTICE '========================================';
END $$;