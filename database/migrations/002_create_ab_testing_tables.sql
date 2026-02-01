-- Migration: Create A/B Testing Tables
-- Description: Sets up A/B testing infrastructure for experiments

-- Create ab_experiments table
CREATE TABLE IF NOT EXISTS ab_experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed')),
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    target_audience JSONB DEFAULT '{}',
    success_metrics JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ab_variants table
CREATE TABLE IF NOT EXISTS ab_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID REFERENCES ab_experiments(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    content JSONB NOT NULL,
    traffic_percentage INTEGER CHECK (traffic_percentage >= 0 AND traffic_percentage <= 100),
    is_control BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ab_participants table
CREATE TABLE IF NOT EXISTS ab_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID REFERENCES ab_experiments(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES ab_variants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id VARCHAR(255),
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    converted_at TIMESTAMP WITH TIME ZONE,
    conversion_value DECIMAL(10,2) DEFAULT 0,
    UNIQUE(experiment_id, user_id)
);

-- Create ab_events table
CREATE TABLE IF NOT EXISTS ab_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID REFERENCES ab_experiments(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES ab_variants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_ab_experiments_user_id ON ab_experiments(user_id);
CREATE INDEX idx_ab_experiments_status ON ab_experiments(status);
CREATE INDEX idx_ab_variants_experiment_id ON ab_variants(experiment_id);
CREATE INDEX idx_ab_participants_experiment_id ON ab_participants(experiment_id);
CREATE INDEX idx_ab_participants_variant_id ON ab_participants(variant_id);
CREATE INDEX idx_ab_events_experiment_id ON ab_events(experiment_id);
CREATE INDEX idx_ab_events_created_at ON ab_events(created_at);

-- Enable RLS
ALTER TABLE ab_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY ab_experiments_user_isolation ON ab_experiments
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY ab_variants_user_isolation ON ab_variants
    FOR ALL USING (experiment_id IN (
        SELECT id FROM ab_experiments WHERE user_id = auth.uid()
    ));

-- Migration record
INSERT INTO schema_migrations (version, name, applied_at)
VALUES ('002', 'create_ab_testing_tables', NOW())
ON CONFLICT (version) DO NOTHING;
