-- Migration: Create Competitor Analysis Tables
-- Description: Tables for competitor tracking, market intelligence, and competitive analysis

-- Competitors Table
CREATE TABLE IF NOT EXISTS competitors (
    id SERIAL PRIMARY KEY,
    competitor_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    industry VARCHAR(100),
    config JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    added_by UUID NOT NULL,
    added_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_tracked TIMESTAMPTZ,
    
    CONSTRAINT fk_competitor_added_by
        FOREIGN KEY(added_by) 
        REFERENCES profiles(id)
        ON DELETE CASCADE,
        
    CONSTRAINT check_competitor_status 
        CHECK (status IN ('active', 'inactive', 'archived'))
);

CREATE INDEX idx_competitors_status ON competitors(status);
CREATE INDEX idx_competitors_industry ON competitors(industry);
CREATE INDEX idx_competitors_added_by ON competitors(added_by);

-- Competitor Metrics Table
CREATE TABLE IF NOT EXISTS competitor_metrics (
    id SERIAL PRIMARY KEY,
    competitor_id VARCHAR(255) NOT NULL,
    platform VARCHAR(50) NOT NULL,
    metrics JSONB NOT NULL,
    tracked_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_metrics_competitor
        FOREIGN KEY(competitor_id) 
        REFERENCES competitors(competitor_id)
        ON DELETE CASCADE
);

CREATE INDEX idx_competitor_metrics_id ON competitor_metrics(competitor_id);
CREATE INDEX idx_competitor_metrics_platform ON competitor_metrics(platform);
CREATE INDEX idx_competitor_metrics_tracked ON competitor_metrics(tracked_at);

-- Market Intelligence Table
CREATE TABLE IF NOT EXISTS market_intelligence (
    id SERIAL PRIMARY KEY,
    intelligence_id VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(100) NOT NULL,
    category VARCHAR(100),
    data JSONB NOT NULL,
    source VARCHAR(255),
    confidence_score DECIMAL(3,2),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ
);

CREATE INDEX idx_intelligence_type ON market_intelligence(type);
CREATE INDEX idx_intelligence_category ON market_intelligence(category);
CREATE INDEX idx_intelligence_created ON market_intelligence(created_at);

-- Competitive Insights Table
CREATE TABLE IF NOT EXISTS competitive_insights (
    id SERIAL PRIMARY KEY,
    insight_id VARCHAR(255) UNIQUE NOT NULL,
    competitor_id VARCHAR(255),
    insight_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    data JSONB,
    impact_score INTEGER CHECK (impact_score BETWEEN 1 AND 10),
    actionable BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_insight_competitor
        FOREIGN KEY(competitor_id) 
        REFERENCES competitors(competitor_id)
        ON DELETE CASCADE
);

CREATE INDEX idx_insights_competitor ON competitive_insights(competitor_id);
CREATE INDEX idx_insights_type ON competitive_insights(insight_type);
CREATE INDEX idx_insights_impact ON competitive_insights(impact_score);
CREATE INDEX idx_insights_actionable ON competitive_insights(actionable);