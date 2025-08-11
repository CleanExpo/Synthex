-- SYNTHEX Database Schema - Step 5: Sample Data & Testing
-- Run this AFTER running steps 1-4 to populate with sample data

-- ============================================
-- SAMPLE USER PROFILES (for testing)
-- ============================================

-- Create test users (passwords are hashed versions of 'testpass123')
-- Note: In production, users are created through Supabase Auth
DO $$
DECLARE
  v_user1_id UUID := gen_random_uuid();
  v_user2_id UUID := gen_random_uuid();
  v_user3_id UUID := gen_random_uuid();
BEGIN
  -- Only insert if no profiles exist
  IF NOT EXISTS (SELECT 1 FROM profiles LIMIT 1) THEN
    -- Insert sample profiles
    INSERT INTO profiles (id, email, name, role, subscription_tier, company, bio) VALUES
    (v_user1_id, 'demo@synthex.app', 'Demo User', 'user', 'pro', 'Synthex Demo', 'AI Marketing Enthusiast'),
    (v_user2_id, 'sarah@example.com', 'Sarah Johnson', 'user', 'enterprise', 'TechCorp', 'Digital Marketing Manager'),
    (v_user3_id, 'mike@example.com', 'Mike Chen', 'user', 'basic', 'StartupXYZ', 'Growth Hacker & Content Creator');

    -- Insert user preferences
    INSERT INTO user_preferences (user_id, preferred_platforms, posting_times, content_themes, ai_creativity_level, timezone) VALUES
    (v_user1_id, ARRAY['twitter', 'linkedin', 'instagram'], 
     '{"monday": ["09:00", "17:00"], "tuesday": ["10:00", "15:00"], "wednesday": ["09:00", "17:00"], "thursday": ["10:00", "15:00"], "friday": ["09:00", "14:00"]}'::JSONB,
     ARRAY['technology', 'AI', 'marketing'], 0.7, 'America/New_York'),
    (v_user2_id, ARRAY['linkedin', 'twitter'], 
     '{"tuesday": ["10:00"], "thursday": ["10:00"]}'::JSONB,
     ARRAY['B2B', 'enterprise', 'thought leadership'], 0.5, 'America/Los_Angeles'),
    (v_user3_id, ARRAY['instagram', 'tiktok', 'twitter'], 
     '{"daily": ["18:00", "20:00"]}'::JSONB,
     ARRAY['startups', 'growth', 'viral'], 0.9, 'Europe/London');

    -- Insert sample personas
    INSERT INTO personas (user_id, name, description, attributes, is_active) VALUES
    (v_user1_id, 'Professional Voice', 'Formal and authoritative tone for LinkedIn', 
     '{"tone": "Professional", "style": "Formal", "vocabulary": "Technical", "emotion": "Confident", "humor_level": 0.2}'::JSONB, true),
    (v_user1_id, 'Casual Creator', 'Fun and engaging for Instagram/TikTok', 
     '{"tone": "Casual", "style": "Conversational", "vocabulary": "Simple", "emotion": "Enthusiastic", "humor_level": 0.8}'::JSONB, true),
    (v_user2_id, 'Thought Leader', 'Industry insights and expertise', 
     '{"tone": "Authoritative", "style": "Educational", "vocabulary": "Industry-specific", "emotion": "Thoughtful", "humor_level": 0.3}'::JSONB, true),
    (v_user3_id, 'Viral Maverick', 'Edgy and attention-grabbing', 
     '{"tone": "Bold", "style": "Provocative", "vocabulary": "Trendy", "emotion": "Energetic", "humor_level": 0.9}'::JSONB, true);

    -- Insert sample campaigns
    INSERT INTO campaigns (user_id, name, description, platforms, status, start_date, end_date, budget) VALUES
    (v_user1_id, 'Q1 Product Launch', 'Launch campaign for new AI feature', 
     ARRAY['twitter', 'linkedin', 'instagram'], 'active', NOW(), NOW() + INTERVAL '30 days', 5000),
    (v_user1_id, 'Brand Awareness', 'Ongoing brand building campaign', 
     ARRAY['twitter', 'linkedin'], 'active', NOW() - INTERVAL '15 days', NOW() + INTERVAL '75 days', 10000),
    (v_user2_id, 'Enterprise Solutions', 'B2B lead generation campaign', 
     ARRAY['linkedin'], 'active', NOW() - INTERVAL '7 days', NOW() + INTERVAL '23 days', 15000),
    (v_user3_id, 'Viral Challenge', 'Create viral TikTok challenge', 
     ARRAY['tiktok', 'instagram'], 'planning', NOW() + INTERVAL '7 days', NOW() + INTERVAL '37 days', 2000);
  END IF;
END $$;

-- ============================================
-- SAMPLE CONTENT WITH VARIATIONS
-- ============================================

-- Insert sample content for different platforms
INSERT INTO content (user_id, platform, content, status, metadata, variations)
SELECT 
  p.id,
  platforms.platform,
  CASE platforms.platform
    WHEN 'twitter' THEN 'Just discovered that AI can predict viral content patterns with 85% accuracy! 🚀 Here''s what I learned... #AIMarketing #ContentStrategy #ViralContent'
    WHEN 'linkedin' THEN 'The Future of Content Marketing: How AI is Revolutionizing Social Media Strategy

After analyzing 10,000+ viral posts, here are 5 key insights that will transform your approach:

1. Timing matters more than you think
2. Emotional triggers drive 73% more engagement
3. Visual content performs 2.3x better
4. Questions increase comments by 150%
5. Authenticity beats perfection every time

What''s your biggest challenge in content creation? Let''s discuss in the comments.

#DigitalMarketing #AIinBusiness #ContentMarketing #ThoughtLeadership'
    WHEN 'instagram' THEN '✨ Transform your content game with AI! 

Swipe to see how we increased engagement by 300% in just 30 days 👉

💡 Smart scheduling
📊 Data-driven insights
🎯 Targeted content
🚀 Viral potential analysis

Save this for later! What''s your content secret? Drop it below 👇

#ContentCreator #SocialMediaTips #MarketingHacks #AItools #DigitalMarketing #ContentStrategy'
    WHEN 'tiktok' THEN '🎬 POV: You discover an AI that writes viral content for you

*Shows screen with AI generating content*
*Engagement stats going up*
*Happy dance*

This is not a drill! Link in bio for the full tutorial 🔥

#AI #ContentCreation #SocialMediaHack #TikTokTips #ViralContent'
  END as content,
  CASE 
    WHEN RANDOM() < 0.3 THEN 'published'
    WHEN RANDOM() < 0.6 THEN 'scheduled'
    ELSE 'draft'
  END as status,
  jsonb_build_object(
    'ai_generated', true,
    'persona_used', 'Professional Voice',
    'hook_type', CASE WHEN platforms.platform = 'twitter' THEN 'question' ELSE 'story' END,
    'hashtag_count', CASE platforms.platform WHEN 'instagram' THEN 10 WHEN 'twitter' THEN 3 ELSE 5 END
  ),
  jsonb_build_object(
    'variation_1', 'Alternative version with different hook',
    'variation_2', 'Shorter version for A/B testing',
    'variation_3', 'Version with different CTA'
  )
FROM profiles p
CROSS JOIN (
  SELECT unnest(ARRAY['twitter', 'linkedin', 'instagram', 'tiktok']) as platform
) platforms
WHERE p.email = 'demo@synthex.app'
LIMIT 20;

-- ============================================
-- SAMPLE ANALYTICS DATA
-- ============================================

-- Generate sample analytics for published content
INSERT INTO analytics (user_id, content_id, platform, impressions, engagements, clicks, shares, comments, saves, reach)
SELECT 
  c.user_id,
  c.id,
  c.platform,
  FLOOR(RANDOM() * 10000 + 1000)::INTEGER as impressions,
  FLOOR(RANDOM() * 1000 + 50)::INTEGER as engagements,
  FLOOR(RANDOM() * 500 + 10)::INTEGER as clicks,
  FLOOR(RANDOM() * 200 + 5)::INTEGER as shares,
  FLOOR(RANDOM() * 100 + 2)::INTEGER as comments,
  FLOOR(RANDOM() * 150 + 3)::INTEGER as saves,
  FLOOR(RANDOM() * 8000 + 500)::INTEGER as reach
FROM content c
WHERE c.status = 'published'
  AND NOT EXISTS (
    SELECT 1 FROM analytics a 
    WHERE a.content_id = c.id
  )
LIMIT 50;

-- ============================================
-- SAMPLE VIRAL PATTERNS (Extended)
-- ============================================

-- Add more diverse viral patterns
INSERT INTO viral_patterns (platform, pattern_type, pattern_data, engagement_score, tags, sample_content)
VALUES 
  -- Twitter patterns
  ('twitter', 'controversial_take', 
   '{"structure": "unpopular_opinion-explanation-question", "optimal_length": 200, "best_time": "12pm EST", "emotion": "provocative"}'::JSONB, 
   88, ARRAY['debate', 'discussion', 'viral'], 
   ARRAY['Unpopular opinion: [controversial statement]. Here''s why I think this... What''s your take?']),
  
  ('twitter', 'breaking_news', 
   '{"structure": "breaking-details-source", "optimal_length": 150, "best_time": "anytime", "urgency": "high"}'::JSONB, 
   92, ARRAY['news', 'trending', 'timely'], 
   ARRAY['BREAKING: [news]. According to [source], this means... Thread 🧵']),
  
  -- LinkedIn patterns
  ('linkedin', 'success_story', 
   '{"structure": "challenge-process-outcome-lesson", "optimal_length": 500, "best_time": "Tuesday 8am", "format": "narrative"}'::JSONB, 
   85, ARRAY['inspiration', 'business', 'leadership'], 
   ARRAY['3 years ago, I was [situation]. Today, I [achievement]. Here''s exactly how I did it...']),
  
  ('linkedin', 'industry_prediction', 
   '{"structure": "prediction-evidence-implications", "optimal_length": 400, "best_time": "Wednesday 10am", "credibility": "high"}'::JSONB, 
   87, ARRAY['thought-leadership', 'trends', 'insights'], 
   ARRAY['By 2025, [prediction] will transform [industry]. Here''s the data backing this up...']),
  
  -- Instagram patterns
  ('instagram', 'before_after', 
   '{"structure": "before_image-after_image-story", "slides": 2, "best_time": "6pm", "visual_impact": "high"}'::JSONB, 
   91, ARRAY['transformation', 'visual', 'inspiring'], 
   ARRAY['Swipe to see the incredible transformation → [emoji]']),
  
  ('instagram', 'tutorial_reel', 
   '{"structure": "hook-steps-result", "duration": "30-60s", "best_time": "1pm", "music": "trending"}'::JSONB, 
   89, ARRAY['educational', 'howto', 'reels'], 
   ARRAY['Save this! 5 [topic] hacks you didn''t know existed']),
  
  -- TikTok patterns
  ('tiktok', 'day_in_life', 
   '{"structure": "morning-afternoon-evening", "duration": "45s", "pov": "first_person", "authenticity": "high"}'::JSONB, 
   86, ARRAY['lifestyle', 'relatable', 'authentic'], 
   ARRAY['Day in the life of a [profession] - the reality might surprise you']),
  
  ('tiktok', 'reaction_video', 
   '{"structure": "setup-reaction-explanation", "duration": "30s", "emotion": "shocked", "trending_sound": true}'::JSONB, 
   90, ARRAY['reaction', 'commentary', 'viral'], 
   ARRAY['Wait for it... 😱 [shocking revelation]'])
ON CONFLICT (platform, pattern_type) DO NOTHING;

-- ============================================
-- SAMPLE HASHTAG PERFORMANCE DATA
-- ============================================

INSERT INTO hashtag_performance (hashtag, platform, usage_count, avg_engagement, trending_score)
VALUES 
  ('#AIMarketing', 'twitter', 15234, 856.5, 92.3),
  ('#ContentStrategy', 'twitter', 12456, 723.2, 88.7),
  ('#ThoughtLeadership', 'linkedin', 8934, 1243.8, 94.5),
  ('#B2BMarketing', 'linkedin', 7823, 987.3, 86.2),
  ('#Entrepreneurship', 'linkedin', 18234, 1456.7, 95.8),
  ('#InstaMarketing', 'instagram', 24567, 2341.5, 89.4),
  ('#ContentCreator', 'instagram', 34521, 3456.2, 93.7),
  ('#FYP', 'tiktok', 892341, 5634.2, 98.9),
  ('#LearnOnTikTok', 'tiktok', 234567, 4321.8, 91.2),
  ('#MarketingTips', 'all', 45678, 2345.6, 90.5)
ON CONFLICT (hashtag, platform) DO UPDATE
SET 
  usage_count = EXCLUDED.usage_count,
  avg_engagement = EXCLUDED.avg_engagement,
  trending_score = EXCLUDED.trending_score;

-- ============================================
-- SAMPLE TRENDING TOPICS
-- ============================================

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
   NOW() + INTERVAL '7 days')
ON CONFLICT (topic, platform) DO UPDATE
SET 
  trending_score = EXCLUDED.trending_score,
  expires_at = EXCLUDED.expires_at;

-- ============================================
-- SAMPLE AUTOMATION RULES
-- ============================================

INSERT INTO automation_rules (user_id, name, trigger_type, trigger_config, action_type, action_config, is_active)
SELECT 
  p.id,
  'Morning Post Schedule',
  'time_based',
  '{"schedule": "0 9 * * *", "timezone": "America/New_York"}'::JSONB,
  'post_content',
  '{"platform": "twitter", "content_type": "queue"}'::JSONB,
  true
FROM profiles p
WHERE p.email = 'demo@synthex.app'
LIMIT 1;

INSERT INTO automation_rules (user_id, name, trigger_type, trigger_config, action_type, action_config, is_active)
SELECT 
  p.id,
  'High Engagement Alert',
  'engagement_based',
  '{"threshold": 1000, "metric": "engagements"}'::JSONB,
  'send_notification',
  '{"notification_type": "email", "template": "viral_alert"}'::JSONB,
  true
FROM profiles p
WHERE p.email = 'demo@synthex.app'
LIMIT 1;

-- ============================================
-- SAMPLE ACHIEVEMENTS
-- ============================================

INSERT INTO user_achievements (user_id, achievement_type, achievement_name, description, completed, completed_at, progress)
SELECT 
  p.id,
  'first_post',
  'First Steps',
  'Published your first post',
  true,
  NOW() - INTERVAL '30 days',
  100
FROM profiles p
WHERE p.email = 'demo@synthex.app'
UNION ALL
SELECT 
  p.id,
  'viral_post',
  'Going Viral',
  'Got 10,000+ engagements on a single post',
  false,
  NULL,
  75
FROM profiles p
WHERE p.email = 'demo@synthex.app';

-- ============================================
-- SAMPLE CONTENT TEMPLATES
-- ============================================

INSERT INTO content_templates (user_id, name, platform, template_structure, variables, is_public, usage_count)
SELECT 
  p.id,
  'Product Launch Tweet',
  'twitter',
  '{"sections": ["announcement", "features", "cta"], "format": "thread"}'::JSONB,
  '{"product_name": "string", "launch_date": "date", "key_features": "array"}'::JSONB,
  true,
  42
FROM profiles p
WHERE p.email = 'demo@synthex.app'
LIMIT 1;

-- ============================================
-- TESTING FUNCTIONS
-- ============================================

-- Create a function to generate test data
CREATE OR REPLACE FUNCTION generate_test_content(
  p_user_id UUID,
  p_count INTEGER DEFAULT 10
) RETURNS void AS $$
DECLARE
  v_platforms TEXT[] := ARRAY['twitter', 'linkedin', 'instagram', 'tiktok'];
  v_statuses TEXT[] := ARRAY['draft', 'scheduled', 'published'];
  i INTEGER;
BEGIN
  FOR i IN 1..p_count LOOP
    INSERT INTO content (
      user_id, 
      platform, 
      content, 
      status,
      created_at
    ) VALUES (
      p_user_id,
      v_platforms[1 + FLOOR(RANDOM() * 4)],
      'Test content #' || i || ' - ' || MD5(RANDOM()::TEXT),
      v_statuses[1 + FLOOR(RANDOM() * 3)],
      NOW() - (RANDOM() * INTERVAL '90 days')
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to simulate engagement growth
CREATE OR REPLACE FUNCTION simulate_engagement_growth(
  p_content_id UUID,
  p_days INTEGER DEFAULT 7
) RETURNS void AS $$
DECLARE
  v_day INTEGER;
  v_base_engagement INTEGER;
BEGIN
  v_base_engagement := FLOOR(RANDOM() * 100 + 50);
  
  FOR v_day IN 1..p_days LOOP
    INSERT INTO content_performance_history (
      content_id,
      recorded_at,
      impressions,
      engagements,
      clicks,
      shares,
      saves,
      comments
    ) VALUES (
      p_content_id,
      NOW() - (p_days - v_day) * INTERVAL '1 day',
      v_base_engagement * v_day * (1 + RANDOM()),
      v_base_engagement * v_day * 0.1 * (1 + RANDOM()),
      v_base_engagement * v_day * 0.05 * (1 + RANDOM()),
      v_base_engagement * v_day * 0.02 * (1 + RANDOM()),
      v_base_engagement * v_day * 0.03 * (1 + RANDOM()),
      v_base_engagement * v_day * 0.01 * (1 + RANDOM())
    );
  END LOOP;
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
-- FINAL STATISTICS
-- ============================================

SELECT 'Sample data loaded successfully!' as status,
  (SELECT COUNT(*) FROM profiles) as total_users,
  (SELECT COUNT(*) FROM content) as total_content,
  (SELECT COUNT(*) FROM viral_patterns) as viral_patterns,
  (SELECT COUNT(*) FROM trending_topics) as trending_topics,
  (SELECT COUNT(*) FROM campaigns) as active_campaigns;