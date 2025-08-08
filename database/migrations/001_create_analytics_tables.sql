-- Migration: Create Analytics Tables
-- Description: Tables for advanced analytics and real-time metrics tracking

-- Analytics Events Table
CREATE TABLE IF NOT EXISTS analytics_events (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    platform VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_analytics_user
        FOREIGN KEY(user_id) 
        REFERENCES profiles(id)
        ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_analytics_user ON analytics_events(user_id);
CREATE INDEX idx_analytics_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_timestamp ON analytics_events(timestamp);
CREATE INDEX idx_analytics_platform ON analytics_events(platform);
CREATE INDEX idx_analytics_metadata ON analytics_events USING GIN(metadata);

-- Aggregated Analytics Table (for faster queries)
CREATE TABLE IF NOT EXISTS analytics_aggregates (
    id SERIAL PRIMARY KEY,
    user_id UUID,
    date DATE NOT NULL,
    platform VARCHAR(50),
    metrics JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, date, platform)
);

CREATE INDEX idx_aggregates_user_date ON analytics_aggregates(user_id, date);
CREATE INDEX idx_aggregates_platform ON analytics_aggregates(platform);

-- Predictions Table
CREATE TABLE IF NOT EXISTS analytics_predictions (
    id SERIAL PRIMARY KEY,
    user_id UUID,
    model_type VARCHAR(50) NOT NULL,
    prediction JSONB NOT NULL,
    confidence DECIMAL(3,2),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ
);

CREATE INDEX idx_predictions_user ON analytics_predictions(user_id);
CREATE INDEX idx_predictions_type ON analytics_predictions(model_type);

-- Real-time Metrics Table
CREATE TABLE IF NOT EXISTS realtime_metrics (
    id SERIAL PRIMARY KEY,
    metric_key VARCHAR(255) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_realtime_key ON realtime_metrics(metric_key);

-- Create update trigger for aggregates
CREATE OR REPLACE FUNCTION update_analytics_aggregates_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_analytics_aggregates_timestamp
BEFORE UPDATE ON analytics_aggregates
FOR EACH ROW
EXECUTE FUNCTION update_analytics_aggregates_timestamp();