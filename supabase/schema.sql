-- SYNTHEX Marketing Automation Database Schema
-- Supabase PostgreSQL Database

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    company TEXT,
    role TEXT CHECK (role IN ('admin', 'manager', 'user')) DEFAULT 'user',
    subscription_tier TEXT CHECK (subscription_tier IN ('free', 'starter', 'professional', 'enterprise')) DEFAULT 'free',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Campaigns table
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    platforms TEXT[] NOT NULL,
    status TEXT CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')) DEFAULT 'draft',
    objectives TEXT[],
    budget_total DECIMAL(10, 2) DEFAULT 0,
    budget_spent DECIMAL(10, 2) DEFAULT 0,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    target_audience JSONB DEFAULT '{}',
    content_strategy JSONB DEFAULT '{}',
    performance_metrics JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Posts table
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    content_type TEXT CHECK (content_type IN ('text', 'image', 'video', 'carousel', 'story')) NOT NULL,
    content JSONB NOT NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    platform_post_id TEXT,
    status TEXT CHECK (status IN ('draft', 'scheduled', 'published', 'failed')) DEFAULT 'draft',
    metrics JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Analytics table
CREATE TABLE IF NOT EXISTS public.analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    metric_type TEXT NOT NULL,
    value DECIMAL(20, 4) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    metadata JSONB DEFAULT '{}'
);

-- Agent tasks table
CREATE TABLE IF NOT EXISTS public.agent_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_type TEXT NOT NULL,
    task_type TEXT NOT NULL,
    priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
    status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
    payload JSONB DEFAULT '{}',
    result JSONB,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Content templates table
CREATE TABLE IF NOT EXISTS public.content_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    platform TEXT NOT NULL,
    category TEXT,
    template_content JSONB NOT NULL,
    performance_score DECIMAL(5, 2),
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Audience segments table
CREATE TABLE IF NOT EXISTS public.audience_segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    demographics JSONB DEFAULT '{}',
    psychographics JSONB DEFAULT '{}',
    behaviors JSONB DEFAULT '{}',
    size_estimate INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Competitive intelligence table
CREATE TABLE IF NOT EXISTS public.competitive_intelligence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competitor_name TEXT NOT NULL UNIQUE,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Platform credentials table (encrypted)
CREATE TABLE IF NOT EXISTS public.platform_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    credentials JSONB NOT NULL, -- Should be encrypted
    is_active BOOLEAN DEFAULT true,
    last_verified TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(user_id, platform)
);

-- AI generation history table
CREATE TABLE IF NOT EXISTS public.ai_generations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    platform TEXT,
    generated_content JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    tokens_used INTEGER,
    cost DECIMAL(10, 4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Webhooks table
CREATE TABLE IF NOT EXISTS public.webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    events TEXT[] NOT NULL,
    is_active BOOLEAN DEFAULT true,
    secret TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Notification table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_posts_campaign_id ON public.posts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_posts_platform ON public.posts(platform);
CREATE INDEX IF NOT EXISTS idx_posts_status ON public.posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_at ON public.posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_analytics_campaign_id ON public.analytics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_analytics_post_id ON public.analytics(post_id);
CREATE INDEX IF NOT EXISTS idx_analytics_recorded_at ON public.analytics(recorded_at);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON public.agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_priority ON public.agent_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON public.posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_templates_updated_at BEFORE UPDATE ON public.content_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audience_segments_updated_at BEFORE UPDATE ON public.audience_segments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_competitive_intelligence_updated_at BEFORE UPDATE ON public.competitive_intelligence
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_platform_credentials_updated_at BEFORE UPDATE ON public.platform_credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON public.webhooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audience_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Campaign policies
CREATE POLICY "Users can view own campaigns" ON public.campaigns
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create campaigns" ON public.campaigns
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own campaigns" ON public.campaigns
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own campaigns" ON public.campaigns
    FOR DELETE USING (auth.uid() = user_id);

-- Post policies
CREATE POLICY "Users can view posts from own campaigns" ON public.posts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.campaigns
            WHERE campaigns.id = posts.campaign_id
            AND campaigns.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create posts for own campaigns" ON public.posts
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.campaigns
            WHERE campaigns.id = posts.campaign_id
            AND campaigns.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update posts from own campaigns" ON public.posts
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.campaigns
            WHERE campaigns.id = posts.campaign_id
            AND campaigns.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete posts from own campaigns" ON public.posts
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.campaigns
            WHERE campaigns.id = posts.campaign_id
            AND campaigns.user_id = auth.uid()
        )
    );

-- Analytics policies (read-only for users)
CREATE POLICY "Users can view analytics for own campaigns" ON public.analytics
    FOR SELECT USING (
        campaign_id IS NULL OR
        EXISTS (
            SELECT 1 FROM public.campaigns
            WHERE campaigns.id = analytics.campaign_id
            AND campaigns.user_id = auth.uid()
        )
    );

-- Platform credentials policies
CREATE POLICY "Users can view own credentials" ON public.platform_credentials
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own credentials" ON public.platform_credentials
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own credentials" ON public.platform_credentials
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own credentials" ON public.platform_credentials
    FOR DELETE USING (auth.uid() = user_id);

-- AI generations policies
CREATE POLICY "Users can view own AI generations" ON public.ai_generations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create AI generations" ON public.ai_generations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Functions for aggregated analytics
CREATE OR REPLACE FUNCTION get_campaign_analytics(campaign_id UUID)
RETURNS TABLE (
    total_impressions BIGINT,
    total_reach BIGINT,
    total_engagement BIGINT,
    total_clicks BIGINT,
    total_conversions BIGINT,
    average_engagement_rate DECIMAL,
    roi DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(CASE WHEN metric_type = 'impressions' THEN value::BIGINT END), 0) AS total_impressions,
        COALESCE(SUM(CASE WHEN metric_type = 'reach' THEN value::BIGINT END), 0) AS total_reach,
        COALESCE(SUM(CASE WHEN metric_type = 'engagement' THEN value::BIGINT END), 0) AS total_engagement,
        COALESCE(SUM(CASE WHEN metric_type = 'clicks' THEN value::BIGINT END), 0) AS total_clicks,
        COALESCE(SUM(CASE WHEN metric_type = 'conversions' THEN value::BIGINT END), 0) AS total_conversions,
        COALESCE(AVG(CASE WHEN metric_type = 'engagement_rate' THEN value END), 0) AS average_engagement_rate,
        COALESCE(MAX(CASE WHEN metric_type = 'roi' THEN value END), 0) AS roi
    FROM public.analytics
    WHERE analytics.campaign_id = get_campaign_analytics.campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get platform performance
CREATE OR REPLACE FUNCTION get_platform_performance(user_id UUID, days INTEGER DEFAULT 30)
RETURNS TABLE (
    platform TEXT,
    total_posts BIGINT,
    avg_engagement DECIMAL,
    total_reach BIGINT,
    best_performing_hour INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.platform,
        COUNT(DISTINCT p.id) AS total_posts,
        COALESCE(AVG((p.metrics->>'engagement')::DECIMAL), 0) AS avg_engagement,
        COALESCE(SUM((p.metrics->>'reach')::BIGINT), 0) AS total_reach,
        EXTRACT(HOUR FROM p.published_at)::INTEGER AS best_performing_hour
    FROM public.posts p
    JOIN public.campaigns c ON p.campaign_id = c.id
    WHERE c.user_id = get_platform_performance.user_id
        AND p.published_at >= NOW() - INTERVAL '1 day' * days
    GROUP BY p.platform, EXTRACT(HOUR FROM p.published_at)
    ORDER BY avg_engagement DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;