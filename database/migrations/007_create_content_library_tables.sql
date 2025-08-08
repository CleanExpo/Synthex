-- Migration: Create Content Library Tables
-- Description: Tables for content library, collections, and asset management

-- Content Library Table
CREATE TABLE IF NOT EXISTS content_library (
    id SERIAL PRIMARY KEY,
    library_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID NOT NULL,
    team_id VARCHAR(255),
    title VARCHAR(255) NOT NULL,
    content JSONB NOT NULL,
    organization JSONB DEFAULT '{}',
    permissions JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    version INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'active',
    featured BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_library_user
        FOREIGN KEY(user_id) 
        REFERENCES profiles(id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_library_team
        FOREIGN KEY(team_id) 
        REFERENCES teams(team_id)
        ON DELETE CASCADE,
        
    CONSTRAINT check_library_status 
        CHECK (status IN ('active', 'archived', 'deleted'))
);

CREATE INDEX idx_library_user ON content_library(user_id);
CREATE INDEX idx_library_team ON content_library(team_id);
CREATE INDEX idx_library_title ON content_library(title);
CREATE INDEX idx_library_status ON content_library(status);
CREATE INDEX idx_library_featured ON content_library(featured);
CREATE INDEX idx_library_content ON content_library USING GIN(content);
CREATE INDEX idx_library_organization ON content_library USING GIN(organization);

-- Content Collections Table
CREATE TABLE IF NOT EXISTS content_collections (
    id SERIAL PRIMARY KEY,
    collection_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID NOT NULL,
    team_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) DEFAULT 'manual',
    config JSONB NOT NULL,
    item_count INTEGER DEFAULT 0,
    visibility VARCHAR(50) DEFAULT 'private',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_collection_user
        FOREIGN KEY(user_id) 
        REFERENCES profiles(id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_collection_team
        FOREIGN KEY(team_id) 
        REFERENCES teams(team_id)
        ON DELETE CASCADE,
        
    CONSTRAINT check_collection_type 
        CHECK (type IN ('manual', 'smart', 'dynamic'))
);

CREATE INDEX idx_collections_user ON content_collections(user_id);
CREATE INDEX idx_collections_team ON content_collections(team_id);
CREATE INDEX idx_collections_type ON content_collections(type);
CREATE INDEX idx_collections_visibility ON content_collections(visibility);

-- Collection Items Table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS collection_items (
    id SERIAL PRIMARY KEY,
    collection_id VARCHAR(255) NOT NULL,
    library_id VARCHAR(255) NOT NULL,
    position INTEGER DEFAULT 0,
    added_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_item_collection
        FOREIGN KEY(collection_id) 
        REFERENCES content_collections(collection_id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_item_library
        FOREIGN KEY(library_id) 
        REFERENCES content_library(library_id)
        ON DELETE CASCADE,
        
    UNIQUE(collection_id, library_id)
);

CREATE INDEX idx_collection_items_collection ON collection_items(collection_id);
CREATE INDEX idx_collection_items_library ON collection_items(library_id);
CREATE INDEX idx_collection_items_position ON collection_items(position);

-- Media Assets Table
CREATE TABLE IF NOT EXISTS media_assets (
    id SERIAL PRIMARY KEY,
    asset_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID NOT NULL,
    library_id VARCHAR(255),
    type VARCHAR(50) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    cdn_url TEXT,
    thumbnail_url TEXT,
    size_bytes BIGINT,
    dimensions JSONB,
    duration INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_asset_user
        FOREIGN KEY(user_id) 
        REFERENCES profiles(id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_asset_library
        FOREIGN KEY(library_id) 
        REFERENCES content_library(library_id)
        ON DELETE CASCADE,
        
    CONSTRAINT check_asset_type 
        CHECK (type IN ('image', 'video', 'audio', 'document', 'other'))
);

CREATE INDEX idx_assets_user ON media_assets(user_id);
CREATE INDEX idx_assets_library ON media_assets(library_id);
CREATE INDEX idx_assets_type ON media_assets(type);
CREATE INDEX idx_assets_created ON media_assets(created_at);

-- Content Tags Table
CREATE TABLE IF NOT EXISTS content_tags (
    id SERIAL PRIMARY KEY,
    tag_name VARCHAR(100) NOT NULL,
    library_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_tag_library
        FOREIGN KEY(library_id) 
        REFERENCES content_library(library_id)
        ON DELETE CASCADE,
        
    UNIQUE(tag_name, library_id)
);

CREATE INDEX idx_tags_name ON content_tags(tag_name);
CREATE INDEX idx_tags_library ON content_tags(library_id);

-- Content Versions Table
CREATE TABLE IF NOT EXISTS content_versions (
    id SERIAL PRIMARY KEY,
    library_id VARCHAR(255) NOT NULL,
    version_number INTEGER NOT NULL,
    content JSONB NOT NULL,
    changed_by UUID NOT NULL,
    change_description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_version_library
        FOREIGN KEY(library_id) 
        REFERENCES content_library(library_id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_version_user
        FOREIGN KEY(changed_by) 
        REFERENCES profiles(id)
        ON DELETE CASCADE,
        
    UNIQUE(library_id, version_number)
);

CREATE INDEX idx_versions_library ON content_versions(library_id);
CREATE INDEX idx_versions_number ON content_versions(version_number);

-- Update triggers
CREATE OR REPLACE FUNCTION update_library_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_library_timestamp
BEFORE UPDATE ON content_library
FOR EACH ROW
EXECUTE FUNCTION update_library_timestamp();

CREATE TRIGGER update_collections_timestamp
BEFORE UPDATE ON content_collections
FOR EACH ROW
EXECUTE FUNCTION update_library_timestamp();