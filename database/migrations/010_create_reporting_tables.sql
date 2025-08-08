-- Migration: Create Reporting Tables
-- Description: Tables for automated reporting, insights, and data exports

-- Reports Table
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    report_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID,
    team_id VARCHAR(255),
    tenant_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    schedule VARCHAR(50),
    config JSONB NOT NULL,
    data JSONB,
    formats JSONB DEFAULT '["pdf", "html"]',
    status VARCHAR(50) DEFAULT 'pending',
    generated_at TIMESTAMPTZ,
    requested_by UUID,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_report_user
        FOREIGN KEY(user_id) 
        REFERENCES profiles(id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_report_team
        FOREIGN KEY(team_id) 
        REFERENCES teams(team_id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_report_tenant
        FOREIGN KEY(tenant_id) 
        REFERENCES whitelabel_tenants(tenant_id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_report_requester
        FOREIGN KEY(requested_by) 
        REFERENCES profiles(id)
        ON DELETE SET NULL,
        
    CONSTRAINT check_report_type 
        CHECK (type IN ('daily', 'weekly', 'monthly', 'quarterly', 'annual', 'custom')),
        
    CONSTRAINT check_report_status 
        CHECK (status IN ('pending', 'generating', 'completed', 'failed', 'cancelled'))
);

CREATE INDEX idx_reports_user ON reports(user_id);
CREATE INDEX idx_reports_team ON reports(team_id);
CREATE INDEX idx_reports_tenant ON reports(tenant_id);
CREATE INDEX idx_reports_type ON reports(type);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_generated ON reports(generated_at);

-- Report Schedules Table
CREATE TABLE IF NOT EXISTS report_schedules (
    id SERIAL PRIMARY KEY,
    schedule_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID,
    team_id VARCHAR(255),
    report_type VARCHAR(50) NOT NULL,
    config JSONB NOT NULL,
    cron_expression VARCHAR(100),
    timezone VARCHAR(100) DEFAULT 'UTC',
    recipients JSONB DEFAULT '[]',
    enabled BOOLEAN DEFAULT true,
    last_run TIMESTAMPTZ,
    next_run TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_schedule_user
        FOREIGN KEY(user_id) 
        REFERENCES profiles(id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_schedule_team
        FOREIGN KEY(team_id) 
        REFERENCES teams(team_id)
        ON DELETE CASCADE
);

CREATE INDEX idx_schedules_user ON report_schedules(user_id);
CREATE INDEX idx_schedules_team ON report_schedules(team_id);
CREATE INDEX idx_schedules_enabled ON report_schedules(enabled);
CREATE INDEX idx_schedules_next_run ON report_schedules(next_run);

-- Report Recipients Table
CREATE TABLE IF NOT EXISTS report_recipients (
    id SERIAL PRIMARY KEY,
    report_id VARCHAR(255),
    schedule_id VARCHAR(255),
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    delivery_method VARCHAR(50) DEFAULT 'email',
    delivered BOOLEAN DEFAULT false,
    delivered_at TIMESTAMPTZ,
    error_message TEXT,
    
    CONSTRAINT fk_recipient_report
        FOREIGN KEY(report_id) 
        REFERENCES reports(report_id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_recipient_schedule
        FOREIGN KEY(schedule_id) 
        REFERENCES report_schedules(schedule_id)
        ON DELETE CASCADE,
        
    CONSTRAINT check_delivery_method 
        CHECK (delivery_method IN ('email', 'webhook', 'slack', 'teams', 'api'))
);

CREATE INDEX idx_recipients_report ON report_recipients(report_id);
CREATE INDEX idx_recipients_schedule ON report_recipients(schedule_id);
CREATE INDEX idx_recipients_delivered ON report_recipients(delivered);

-- Insights Table
CREATE TABLE IF NOT EXISTS insights (
    id SERIAL PRIMARY KEY,
    insight_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID,
    type VARCHAR(50) NOT NULL,
    category VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    data JSONB,
    impact_score INTEGER CHECK (impact_score BETWEEN 1 AND 10),
    confidence_score DECIMAL(3,2),
    actionable BOOLEAN DEFAULT true,
    actions JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ,
    
    CONSTRAINT fk_insight_user
        FOREIGN KEY(user_id) 
        REFERENCES profiles(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_insights_user ON insights(user_id);
CREATE INDEX idx_insights_type ON insights(type);
CREATE INDEX idx_insights_category ON insights(category);
CREATE INDEX idx_insights_impact ON insights(impact_score);
CREATE INDEX idx_insights_actionable ON insights(actionable);
CREATE INDEX idx_insights_created ON insights(created_at);

-- Report Templates Table
CREATE TABLE IF NOT EXISTS report_templates (
    id SERIAL PRIMARY KEY,
    template_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    sections JSONB NOT NULL,
    filters JSONB DEFAULT '{}',
    visualizations JSONB DEFAULT '{}',
    is_public BOOLEAN DEFAULT false,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_template_creator
        FOREIGN KEY(created_by) 
        REFERENCES profiles(id)
        ON DELETE SET NULL
);

CREATE INDEX idx_report_templates_type ON report_templates(type);
CREATE INDEX idx_report_templates_public ON report_templates(is_public);
CREATE INDEX idx_report_templates_creator ON report_templates(created_by);

-- Export Jobs Table
CREATE TABLE IF NOT EXISTS export_jobs (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID NOT NULL,
    export_type VARCHAR(50) NOT NULL,
    format VARCHAR(50) NOT NULL,
    config JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    file_url TEXT,
    file_size BIGINT,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_export_user
        FOREIGN KEY(user_id) 
        REFERENCES profiles(id)
        ON DELETE CASCADE,
        
    CONSTRAINT check_export_type 
        CHECK (export_type IN ('data', 'report', 'analytics', 'library', 'all')),
        
    CONSTRAINT check_export_format 
        CHECK (format IN ('json', 'csv', 'excel', 'pdf', 'zip')),
        
    CONSTRAINT check_export_status 
        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'))
);

CREATE INDEX idx_exports_user ON export_jobs(user_id);
CREATE INDEX idx_exports_type ON export_jobs(export_type);
CREATE INDEX idx_exports_status ON export_jobs(status);
CREATE INDEX idx_exports_created ON export_jobs(created_at);