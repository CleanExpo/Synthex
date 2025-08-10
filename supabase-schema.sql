-- ============================================
-- SYNTHEX PLATFORM - COMPLETE DATABASE SCHEMA
-- ============================================
-- Run this entire script in Supabase SQL Editor
-- Dashboard URL: https://supabase.com/dashboard/project/znyjoyjsvjotlzjppzal/sql
-- ============================================

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS public.campaigns CASCADE;
DROP TABLE IF EXISTS public.content CASCADE;
DROP TABLE IF EXISTS public.patterns CASCADE;
DROP TABLE IF EXISTS public.personas CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- ============================================
-- USERS TABLE (extends Supabase auth.users)
-- ============================================
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  company TEXT,
  role TEXT DEFAULT 'user',
  subscription_tier TEXT DEFAULT 'free',
  onboarding_completed BOOLEAN DEFAULT false,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create index for faster queries
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_subscription ON public.users(subscription_tier);

-- ============================================
-- PERSONAS TABLE
-- ============================================
CREATE TABLE public.personas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  attributes JSONB DEFAULT '{}',
  training_data JSONB DEFAULT '{}',
  voice_samples JSONB DEFAULT '[]',
  accuracy FLOAT DEFAULT 0 CHECK (accuracy >= 0 AND accuracy <= 100),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'training', 'active', 'archived')),
  last_trained TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create indexes
CREATE INDEX idx_personas_user ON public.personas(user_id);
CREATE INDEX idx_personas_status ON public.personas(status);

-- ============================================
-- CONTENT TABLE
-- ============================================
CREATE TABLE public.content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  persona_id UUID REFERENCES public.personas(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  platform TEXT NOT NULL CHECK (platform IN ('twitter', 'linkedin', 'instagram', 'facebook', 'tiktok')),
  content TEXT NOT NULL,
  media_urls JSONB DEFAULT '[]',
  hashtags JSONB DEFAULT '[]',
  mentions JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'failed', 'archived')),
  scheduled_for TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE,
  engagement_metrics JSONB DEFAULT '{}',
  ai_generated BOOLEAN DEFAULT false,
  virality_score FLOAT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create indexes
CREATE INDEX idx_content_user ON public.content(user_id);
CREATE INDEX idx_content_platform ON public.content(platform);
CREATE INDEX idx_content_status ON public.content(status);
CREATE INDEX idx_content_scheduled ON public.content(scheduled_for);
CREATE INDEX idx_content_campaign ON public.content(campaign_id);

-- ============================================
-- PATTERNS TABLE
-- ============================================
CREATE TABLE public.patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('twitter', 'linkedin', 'instagram', 'facebook', 'tiktok', 'all')),
  pattern_type TEXT CHECK (pattern_type IN ('hook', 'hashtag', 'timing', 'format', 'trend', 'viral')),
  pattern_data JSONB NOT NULL DEFAULT '{}',
  engagement_score FLOAT DEFAULT 0 CHECK (engagement_score >= 0 AND engagement_score <= 100),
  confidence_level FLOAT DEFAULT 0 CHECK (confidence_level >= 0 AND confidence_level <= 100),
  sample_size INTEGER DEFAULT 0,
  trending BOOLEAN DEFAULT false,
  valid_until TIMESTAMP WITH TIME ZONE,
  discovered_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create indexes
CREATE INDEX idx_patterns_platform ON public.patterns(platform);
CREATE INDEX idx_patterns_type ON public.patterns(pattern_type);
CREATE INDEX idx_patterns_trending ON public.patterns(trending);
CREATE INDEX idx_patterns_engagement ON public.patterns(engagement_score DESC);

-- ============================================
-- CAMPAIGNS TABLE
-- ============================================
CREATE TABLE public.campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  goals JSONB DEFAULT '{}',
  target_audience JSONB DEFAULT '{}',
  platforms JSONB DEFAULT '[]',
  budget DECIMAL(10, 2),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
  metrics JSONB DEFAULT '{}',
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create indexes
CREATE INDEX idx_campaigns_user ON public.campaigns(user_id);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);
CREATE INDEX idx_campaigns_dates ON public.campaigns(start_date, end_date);

-- ============================================
-- ANALYTICS TABLE
-- ============================================
CREATE TABLE public.analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  content_id UUID REFERENCES public.content(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('view', 'like', 'comment', 'share', 'click', 'save', 'follow')),
  value INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}',
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create indexes
CREATE INDEX idx_analytics_user ON public.analytics(user_id);
CREATE INDEX idx_analytics_content ON public.analytics(content_id);
CREATE INDEX idx_analytics_platform ON public.analytics(platform);
CREATE INDEX idx_analytics_date ON public.analytics(recorded_at);

-- ============================================
-- TEMPLATES TABLE
-- ============================================
CREATE TABLE public.templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  platform TEXT,
  category TEXT,
  content_structure JSONB NOT NULL DEFAULT '{}',
  variables JSONB DEFAULT '[]',
  is_public BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  rating FLOAT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create indexes
CREATE INDEX idx_templates_user ON public.templates(user_id);
CREATE INDEX idx_templates_public ON public.templates(is_public);
CREATE INDEX idx_templates_platform ON public.templates(platform);

-- ============================================
-- API_KEYS TABLE
-- ============================================
CREATE TABLE public.api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  last_four TEXT NOT NULL,
  permissions JSONB DEFAULT '[]',
  rate_limit INTEGER DEFAULT 1000,
  expires_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  revoked_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes
CREATE INDEX idx_api_keys_user ON public.api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON public.api_keys(key_hash);

-- ============================================
-- AUDIT_LOGS TABLE
-- ============================================
CREATE TABLE public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  changes JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create indexes
CREATE INDEX idx_audit_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_date ON public.audit_logs(created_at);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Users policies
CREATE POLICY "Users can view own profile" 
  ON public.users FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
  ON public.users FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
  ON public.users FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Personas policies
CREATE POLICY "Users can manage own personas" 
  ON public.personas FOR ALL 
  USING (auth.uid() = user_id);

-- Content policies
CREATE POLICY "Users can manage own content" 
  ON public.content FOR ALL 
  USING (auth.uid() = user_id);

-- Patterns policies (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view patterns" 
  ON public.patterns FOR SELECT 
  USING (auth.uid() IS NOT NULL);

-- Campaigns policies
CREATE POLICY "Users can manage own campaigns" 
  ON public.campaigns FOR ALL 
  USING (auth.uid() = user_id);

-- Analytics policies
CREATE POLICY "Users can view own analytics" 
  ON public.analytics FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analytics" 
  ON public.analytics FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Templates policies
CREATE POLICY "Users can manage own templates" 
  ON public.templates FOR ALL 
  USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Public templates are viewable by all" 
  ON public.templates FOR SELECT 
  USING (is_public = true OR auth.uid() = user_id);

-- API Keys policies
CREATE POLICY "Users can manage own API keys" 
  ON public.api_keys FOR ALL 
  USING (auth.uid() = user_id);

-- Audit logs policies
CREATE POLICY "Users can view own audit logs" 
  ON public.audit_logs FOR SELECT 
  USING (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_personas_updated_at BEFORE UPDATE ON public.personas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_updated_at BEFORE UPDATE ON public.content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patterns_updated_at BEFORE UPDATE ON public.patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically create user profile after signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user creation
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- VIEWS (Optional - for easier querying)
-- ============================================

-- Content with engagement metrics view
CREATE OR REPLACE VIEW public.content_performance AS
SELECT 
  c.*,
  COALESCE(
    (c.engagement_metrics->>'likes')::INTEGER + 
    (c.engagement_metrics->>'comments')::INTEGER + 
    (c.engagement_metrics->>'shares')::INTEGER, 
    0
  ) as total_engagement,
  u.name as user_name,
  p.name as persona_name
FROM public.content c
LEFT JOIN public.users u ON c.user_id = u.id
LEFT JOIN public.personas p ON c.persona_id = p.id;

-- Campaign performance view
CREATE OR REPLACE VIEW public.campaign_performance AS
SELECT 
  camp.*,
  COUNT(DISTINCT c.id) as content_count,
  AVG(c.virality_score) as avg_virality_score
FROM public.campaigns camp
LEFT JOIN public.content c ON camp.id = c.campaign_id
GROUP BY camp.id;

-- ============================================
-- SEED DATA (Optional - for testing)
-- ============================================

-- Insert sample patterns (viral hooks)
INSERT INTO public.patterns (platform, pattern_type, pattern_data, engagement_score, trending) VALUES
('twitter', 'hook', '{"type": "question", "template": "What''s your unpopular opinion about {topic}?"}', 85, true),
('linkedin', 'hook', '{"type": "story", "template": "After 10 years in {industry}, here''s what I learned..."}', 92, true),
('instagram', 'hashtag', '{"tags": ["#motivation", "#entrepreneur", "#mindset"], "avg_reach": 50000}', 78, true),
('tiktok', 'timing', '{"best_times": ["6:00", "12:00", "19:00", "22:00"], "timezone": "UTC"}', 88, true),
('all', 'viral', '{"elements": ["personal story", "unexpected twist", "call to action"], "success_rate": 0.73}', 95, true);

-- ============================================
-- GRANT PERMISSIONS (Already handled by RLS)
-- ============================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant permissions on tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
-- Schema created successfully!
-- Your Synthex platform database is ready.
-- 
-- Next steps:
-- 1. Test authentication by signing up a user
-- 2. Check that the user profile is created automatically
-- 3. Start using the platform!
-- ============================================