-- Migration: Create AI Content Generation Tables
-- Description: Tables for AI-generated content, templates, and generation history

-- AI Generations Table
CREATE TABLE IF NOT EXISTS ai_generations (
    id SERIAL PRIMARY KEY,
    generation_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID NOT NULL,
    prompt TEXT NOT NULL,
    config JSONB NOT NULL,
    content JSONB NOT NULL,
    variations JSONB DEFAULT '[]',
    provider VARCHAR(50),
    model VARCHAR(100),
    tokens_used INTEGER,
    quality_score DECIMAL(3,2),
    generated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_generation_user
        FOREIGN KEY(user_id) 
        REFERENCES profiles(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_generations_user ON ai_generations(user_id);
CREATE INDEX idx_generations_provider ON ai_generations(provider);
CREATE INDEX idx_generations_generated ON ai_generations(generated_at);
CREATE INDEX idx_generations_quality ON ai_generations(quality_score);

-- Content Templates Table
CREATE TABLE IF NOT EXISTS content_templates (
    id SERIAL PRIMARY KEY,
    template_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    type VARCHAR(50),
    user_id UUID,
    team_id VARCHAR(255),
    config JSONB NOT NULL,
    usage_count INTEGER DEFAULT 0,
    rating DECIMAL(2,1),
    is_public BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_template_user
        FOREIGN KEY(user_id) 
        REFERENCES profiles(id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_template_team
        FOREIGN KEY(team_id) 
        REFERENCES teams(team_id)
        ON DELETE CASCADE
);

CREATE INDEX idx_templates_user ON content_templates(user_id);
CREATE INDEX idx_templates_team ON content_templates(team_id);
CREATE INDEX idx_templates_category ON content_templates(category);
CREATE INDEX idx_templates_type ON content_templates(type);
CREATE INDEX idx_templates_public ON content_templates(is_public);
CREATE INDEX idx_templates_active ON content_templates(active);

-- Template Variables Table
CREATE TABLE IF NOT EXISTS template_variables (
    id SERIAL PRIMARY KEY,
    template_id VARCHAR(255) NOT NULL,
    variable_name VARCHAR(100) NOT NULL,
    variable_type VARCHAR(50),
    default_value TEXT,
    description TEXT,
    required BOOLEAN DEFAULT false,
    
    CONSTRAINT fk_variable_template
        FOREIGN KEY(template_id) 
        REFERENCES content_templates(template_id)
        ON DELETE CASCADE,
        
    UNIQUE(template_id, variable_name)
);

CREATE INDEX idx_variables_template ON template_variables(template_id);

-- AI Training Data Table (for improving generation)
CREATE TABLE IF NOT EXISTS ai_training_data (
    id SERIAL PRIMARY KEY,
    user_id UUID,
    content_type VARCHAR(50),
    input_data JSONB NOT NULL,
    output_data JSONB NOT NULL,
    feedback JSONB,
    quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_training_user
        FOREIGN KEY(user_id) 
        REFERENCES profiles(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_training_user ON ai_training_data(user_id);
CREATE INDEX idx_training_type ON ai_training_data(content_type);
CREATE INDEX idx_training_rating ON ai_training_data(quality_rating);

-- Update trigger for templates
CREATE OR REPLACE FUNCTION update_templates_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_templates_timestamp
BEFORE UPDATE ON content_templates
FOR EACH ROW
EXECUTE FUNCTION update_templates_timestamp();