-- Migration: Create Advanced Scheduler Tables
-- Description: Tables for content scheduling, optimal timing, and recurring schedules

-- Scheduled Content Table
CREATE TABLE IF NOT EXISTS scheduled_content (
    id SERIAL PRIMARY KEY,
    schedule_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID NOT NULL,
    content_id VARCHAR(255),
    config JSONB NOT NULL,
    publish_at TIMESTAMPTZ NOT NULL,
    timezone VARCHAR(100) DEFAULT 'UTC',
    platform VARCHAR(50),
    status VARCHAR(50) DEFAULT 'scheduled',
    attempts INTEGER DEFAULT 0,
    published_at TIMESTAMPTZ,
    publish_result JSONB,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_schedule_user
        FOREIGN KEY(user_id) 
        REFERENCES profiles(id)
        ON DELETE CASCADE,
        
    CONSTRAINT check_schedule_status 
        CHECK (status IN ('scheduled', 'publishing', 'published', 'failed', 'cancelled'))
);

CREATE INDEX idx_schedule_user ON scheduled_content(user_id);
CREATE INDEX idx_schedule_content ON scheduled_content(content_id);
CREATE INDEX idx_schedule_publish ON scheduled_content(publish_at);
CREATE INDEX idx_schedule_status ON scheduled_content(status);
CREATE INDEX idx_schedule_platform ON scheduled_content(platform);

-- Recurring Schedules Table
CREATE TABLE IF NOT EXISTS recurring_schedules (
    id SERIAL PRIMARY KEY,
    schedule_id VARCHAR(255) NOT NULL,
    pattern VARCHAR(50) NOT NULL,
    interval_value INTEGER,
    days_of_week INTEGER[],
    time_of_day TIME,
    end_type VARCHAR(50) DEFAULT 'never',
    end_date TIMESTAMPTZ,
    max_occurrences INTEGER,
    current_occurrences INTEGER DEFAULT 0,
    next_run TIMESTAMPTZ,
    active BOOLEAN DEFAULT true,
    
    CONSTRAINT fk_recurring_schedule
        FOREIGN KEY(schedule_id) 
        REFERENCES scheduled_content(schedule_id)
        ON DELETE CASCADE,
        
    CONSTRAINT check_pattern 
        CHECK (pattern IN ('daily', 'weekly', 'biweekly', 'monthly', 'custom')),
        
    CONSTRAINT check_end_type 
        CHECK (end_type IN ('never', 'date', 'occurrences'))
);

CREATE INDEX idx_recurring_schedule ON recurring_schedules(schedule_id);
CREATE INDEX idx_recurring_next ON recurring_schedules(next_run);
CREATE INDEX idx_recurring_active ON recurring_schedules(active);

-- Optimal Timings Table
CREATE TABLE IF NOT EXISTS optimal_timings (
    id SERIAL PRIMARY KEY,
    user_id UUID,
    platform VARCHAR(50) NOT NULL,
    timezone VARCHAR(100) NOT NULL,
    day_of_week INTEGER,
    hour INTEGER,
    engagement_score DECIMAL(5,2),
    sample_size INTEGER,
    confidence_level DECIMAL(3,2),
    calculated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_timing_user
        FOREIGN KEY(user_id) 
        REFERENCES profiles(id)
        ON DELETE CASCADE,
        
    UNIQUE(user_id, platform, timezone, day_of_week, hour)
);

CREATE INDEX idx_timing_user ON optimal_timings(user_id);
CREATE INDEX idx_timing_platform ON optimal_timings(platform);
CREATE INDEX idx_timing_timezone ON optimal_timings(timezone);
CREATE INDEX idx_timing_score ON optimal_timings(engagement_score DESC);

-- Schedule Conflicts Table
CREATE TABLE IF NOT EXISTS schedule_conflicts (
    id SERIAL PRIMARY KEY,
    schedule_id VARCHAR(255) NOT NULL,
    conflicting_schedule_id VARCHAR(255) NOT NULL,
    conflict_type VARCHAR(50),
    resolution VARCHAR(50),
    resolved_at TIMESTAMPTZ,
    
    CONSTRAINT fk_conflict_schedule
        FOREIGN KEY(schedule_id) 
        REFERENCES scheduled_content(schedule_id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_conflict_conflicting
        FOREIGN KEY(conflicting_schedule_id) 
        REFERENCES scheduled_content(schedule_id)
        ON DELETE CASCADE
);

CREATE INDEX idx_conflicts_schedule ON schedule_conflicts(schedule_id);
CREATE INDEX idx_conflicts_conflicting ON schedule_conflicts(conflicting_schedule_id);

-- Timezone Preferences Table
CREATE TABLE IF NOT EXISTS timezone_preferences (
    id SERIAL PRIMARY KEY,
    user_id UUID UNIQUE NOT NULL,
    primary_timezone VARCHAR(100) NOT NULL,
    auto_detect BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_timezone_user
        FOREIGN KEY(user_id) 
        REFERENCES profiles(id)
        ON DELETE CASCADE
);

-- Update trigger for scheduled content
CREATE OR REPLACE FUNCTION update_scheduled_content_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_scheduled_content_timestamp
BEFORE UPDATE ON scheduled_content
FOR EACH ROW
EXECUTE FUNCTION update_scheduled_content_timestamp();