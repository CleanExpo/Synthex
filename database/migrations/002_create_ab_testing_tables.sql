-- Migration: Create A/B Testing Tables
-- Description: Tables for A/B testing experiments, assignments, and conversions

-- A/B Testing Experiments Table
CREATE TABLE IF NOT EXISTS ab_experiments (
    id SERIAL PRIMARY KEY,
    experiment_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    hypothesis TEXT,
    status VARCHAR(50) DEFAULT 'draft',
    config JSONB NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    final_results JSONB,
    
    CONSTRAINT fk_experiment_creator
        FOREIGN KEY(created_by) 
        REFERENCES profiles(id)
        ON DELETE CASCADE,
        
    CONSTRAINT check_status 
        CHECK (status IN ('draft', 'running', 'paused', 'completed', 'cancelled'))
);

CREATE INDEX idx_experiments_status ON ab_experiments(status);
CREATE INDEX idx_experiments_creator ON ab_experiments(created_by);
CREATE INDEX idx_experiments_dates ON ab_experiments(started_at, completed_at);

-- A/B Testing Assignments Table
CREATE TABLE IF NOT EXISTS ab_assignments (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    experiment_id VARCHAR(255) NOT NULL,
    variant VARCHAR(100) NOT NULL,
    assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    context JSONB DEFAULT '{}',
    
    CONSTRAINT fk_assignment_user
        FOREIGN KEY(user_id) 
        REFERENCES profiles(id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_assignment_experiment
        FOREIGN KEY(experiment_id) 
        REFERENCES ab_experiments(experiment_id)
        ON DELETE CASCADE,
        
    UNIQUE(user_id, experiment_id)
);

CREATE INDEX idx_assignments_user ON ab_assignments(user_id);
CREATE INDEX idx_assignments_experiment ON ab_assignments(experiment_id);
CREATE INDEX idx_assignments_variant ON ab_assignments(variant);

-- A/B Testing Conversions Table
CREATE TABLE IF NOT EXISTS ab_conversions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    experiment_id VARCHAR(255) NOT NULL,
    variant VARCHAR(100) NOT NULL,
    conversion_type VARCHAR(100) DEFAULT 'default',
    value DECIMAL(10,2) DEFAULT 1,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_conversion_user
        FOREIGN KEY(user_id) 
        REFERENCES profiles(id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_conversion_experiment
        FOREIGN KEY(experiment_id) 
        REFERENCES ab_experiments(experiment_id)
        ON DELETE CASCADE
);

CREATE INDEX idx_conversions_user ON ab_conversions(user_id);
CREATE INDEX idx_conversions_experiment ON ab_conversions(experiment_id);
CREATE INDEX idx_conversions_variant ON ab_conversions(variant);
CREATE INDEX idx_conversions_type ON ab_conversions(conversion_type);
CREATE INDEX idx_conversions_created ON ab_conversions(created_at);