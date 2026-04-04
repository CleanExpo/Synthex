-- Content generation history
CREATE TABLE IF NOT EXISTS content_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    platform VARCHAR(50),
    tone VARCHAR(50),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Content drafts
CREATE TABLE IF NOT EXISTS content_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    platform VARCHAR(50),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Published content
CREATE TABLE IF NOT EXISTS published_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    platform VARCHAR(50) NOT NULL,
    scheduled_time TIMESTAMP,
    published_time TIMESTAMP,
    status VARCHAR(50) DEFAULT 'draft',
    metrics JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_content_generations_user_id ON content_generations(user_id);
CREATE INDEX idx_content_drafts_user_id ON content_drafts(user_id);
CREATE INDEX idx_published_content_user_id ON published_content(user_id);
CREATE INDEX idx_published_content_campaign_id ON published_content(campaign_id);
CREATE INDEX idx_published_content_status ON published_content(status);
CREATE INDEX idx_published_content_scheduled_time ON published_content(scheduled_time);

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_content_drafts_updated_at BEFORE UPDATE ON content_drafts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_published_content_updated_at BEFORE UPDATE ON published_content
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();