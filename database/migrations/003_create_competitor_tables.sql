-- Migration: Create Competitor Analysis Tables
-- Description: Stores competitor data and analysis results

-- Create competitors table
CREATE TABLE IF NOT EXISTS competitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    website VARCHAR(500),
    social_handles JSONB DEFAULT '{}',
    industry VARCHAR(100),
    description TEXT,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create competitor_social_posts table
CREATE TABLE IF NOT EXISTS competitor_social_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competitor_id UUID REFERENCES competitors(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    external_id VARCHAR(255),
    content TEXT,
    media_urls JSONB DEFAULT '[]',
    engagement_metrics JSONB DEFAULT '{}',
    posted_at TIMESTAMP WITH TIME ZONE,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create competitor_analytics table
CREATE TABLE IF NOT EXISTS competitor_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competitor_id UUID REFERENCES competitors(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    followers_count INTEGER DEFAULT 0,
    engagement_rate DECIMAL(5,2),
    post_frequency DECIMAL(5,2),
    top_performing_content JSONB DEFAULT '[]',
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_competitors_user_id ON competitors(user_id);
CREATE INDEX idx_competitor_posts_competitor_id ON competitor_social_posts(competitor_id);
CREATE INDEX idx_competitor_posts_platform ON competitor_social_posts(platform);
CREATE INDEX idx_competitor_analytics_competitor_id ON competitor_analytics(competitor_id);

-- Enable RLS
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY competitors_user_isolation ON competitors
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY competitor_posts_user_isolation ON competitor_social_posts
    FOR ALL USING (competitor_id IN (
        SELECT id FROM competitors WHERE user_id = auth.uid()
    ));

-- Migration record
INSERT INTO schema_migrations (version, name, applied_at)
VALUES ('003', 'create_competitor_tables', NOW())
ON CONFLICT (version) DO NOTHING;
