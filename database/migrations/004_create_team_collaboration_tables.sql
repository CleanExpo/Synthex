-- Migration: Create Team Collaboration Tables
-- Description: Tables for team management, roles, permissions, and collaboration features

-- Teams Table
CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    team_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    config JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_team_creator
        FOREIGN KEY(created_by) 
        REFERENCES profiles(id)
        ON DELETE CASCADE,
        
    CONSTRAINT check_team_status 
        CHECK (status IN ('active', 'inactive', 'suspended', 'archived'))
);

CREATE INDEX idx_teams_status ON teams(status);
CREATE INDEX idx_teams_creator ON teams(created_by);
CREATE INDEX idx_teams_name ON teams(name);

-- Team Members Table
CREATE TABLE IF NOT EXISTS team_members (
    id SERIAL PRIMARY KEY,
    team_id VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL,
    role VARCHAR(50) NOT NULL,
    permissions JSONB DEFAULT '[]',
    status VARCHAR(50) DEFAULT 'active',
    invited_by UUID,
    joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMPTZ,
    
    CONSTRAINT fk_member_team
        FOREIGN KEY(team_id) 
        REFERENCES teams(team_id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_member_user
        FOREIGN KEY(user_id) 
        REFERENCES profiles(id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_member_inviter
        FOREIGN KEY(invited_by) 
        REFERENCES profiles(id)
        ON DELETE SET NULL,
        
    CONSTRAINT check_member_role 
        CHECK (role IN ('owner', 'admin', 'manager', 'editor', 'viewer', 'guest')),
        
    UNIQUE(team_id, user_id)
);

CREATE INDEX idx_members_team ON team_members(team_id);
CREATE INDEX idx_members_user ON team_members(user_id);
CREATE INDEX idx_members_role ON team_members(role);
CREATE INDEX idx_members_status ON team_members(status);

-- Team Invitations Table
CREATE TABLE IF NOT EXISTS team_invitations (
    id SERIAL PRIMARY KEY,
    team_id VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    user_id UUID,
    token VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    invited_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    
    CONSTRAINT fk_invitation_team
        FOREIGN KEY(team_id) 
        REFERENCES teams(team_id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_invitation_inviter
        FOREIGN KEY(invited_by) 
        REFERENCES profiles(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_invitations_team ON team_invitations(team_id);
CREATE INDEX idx_invitations_token ON team_invitations(token);
CREATE INDEX idx_invitations_status ON team_invitations(status);
CREATE INDEX idx_invitations_expires ON team_invitations(expires_at);

-- Team Activity Log Table
CREATE TABLE IF NOT EXISTS team_activity (
    id SERIAL PRIMARY KEY,
    team_id VARCHAR(255) NOT NULL,
    user_id UUID,
    activity_type VARCHAR(100) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_activity_team
        FOREIGN KEY(team_id) 
        REFERENCES teams(team_id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_activity_user
        FOREIGN KEY(user_id) 
        REFERENCES profiles(id)
        ON DELETE SET NULL
);

CREATE INDEX idx_activity_team ON team_activity(team_id);
CREATE INDEX idx_activity_user ON team_activity(user_id);
CREATE INDEX idx_activity_type ON team_activity(activity_type);
CREATE INDEX idx_activity_created ON team_activity(created_at);

-- Shared Content Table
CREATE TABLE IF NOT EXISTS shared_content (
    id SERIAL PRIMARY KEY,
    content_id VARCHAR(255) NOT NULL,
    team_id VARCHAR(255) NOT NULL,
    shared_by UUID NOT NULL,
    config JSONB DEFAULT '{}',
    permissions JSONB DEFAULT '["view"]',
    shared_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ,
    
    CONSTRAINT fk_shared_team
        FOREIGN KEY(team_id) 
        REFERENCES teams(team_id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_shared_user
        FOREIGN KEY(shared_by) 
        REFERENCES profiles(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_shared_content ON shared_content(content_id);
CREATE INDEX idx_shared_team ON shared_content(team_id);
CREATE INDEX idx_shared_user ON shared_content(shared_by);

-- Team Channels Table (for communication)
CREATE TABLE IF NOT EXISTS team_channels (
    id SERIAL PRIMARY KEY,
    channel_id VARCHAR(255) UNIQUE NOT NULL,
    team_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'chat',
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_channel_team
        FOREIGN KEY(team_id) 
        REFERENCES teams(team_id)
        ON DELETE CASCADE
);

CREATE INDEX idx_channels_team ON team_channels(team_id);
CREATE INDEX idx_channels_type ON team_channels(type);

-- Team Workspaces Table
CREATE TABLE IF NOT EXISTS team_workspaces (
    id SERIAL PRIMARY KEY,
    team_id VARCHAR(255) UNIQUE NOT NULL,
    config JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_workspace_team
        FOREIGN KEY(team_id) 
        REFERENCES teams(team_id)
        ON DELETE CASCADE
);

-- Update trigger for teams
CREATE OR REPLACE FUNCTION update_teams_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_teams_timestamp
BEFORE UPDATE ON teams
FOR EACH ROW
EXECUTE FUNCTION update_teams_timestamp();