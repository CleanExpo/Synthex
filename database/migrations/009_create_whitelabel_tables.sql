-- Migration: Create White-label Tables
-- Description: Tables for white-label tenants and enterprise customization

-- White-label Tenants Table
CREATE TABLE IF NOT EXISTS whitelabel_tenants (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL UNIQUE,
    company_name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    custom_domain VARCHAR(255),
    config JSONB NOT NULL,
    branding JSONB DEFAULT '{}',
    features JSONB DEFAULT '{}',
    limits JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'provisioning',
    tier VARCHAR(50) DEFAULT 'enterprise',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    activated_at TIMESTAMPTZ,
    suspended_at TIMESTAMPTZ,
    terminated_at TIMESTAMPTZ,
    
    CONSTRAINT check_tenant_status 
        CHECK (status IN ('provisioning', 'active', 'suspended', 'terminated'))
);

CREATE INDEX idx_tenants_subdomain ON whitelabel_tenants(subdomain);
CREATE INDEX idx_tenants_domain ON whitelabel_tenants(custom_domain);
CREATE INDEX idx_tenants_status ON whitelabel_tenants(status);
CREATE INDEX idx_tenants_tier ON whitelabel_tenants(tier);

-- Tenant Branding Table
CREATE TABLE IF NOT EXISTS tenant_branding (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) UNIQUE NOT NULL,
    logo_url TEXT,
    favicon_url TEXT,
    primary_color VARCHAR(7),
    secondary_color VARCHAR(7),
    accent_color VARCHAR(7),
    font_heading VARCHAR(100),
    font_body VARCHAR(100),
    custom_css TEXT,
    email_header TEXT,
    email_footer TEXT,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_branding_tenant
        FOREIGN KEY(tenant_id) 
        REFERENCES whitelabel_tenants(tenant_id)
        ON DELETE CASCADE
);

-- Tenant Features Table
CREATE TABLE IF NOT EXISTS tenant_features (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    feature_key VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    
    CONSTRAINT fk_features_tenant
        FOREIGN KEY(tenant_id) 
        REFERENCES whitelabel_tenants(tenant_id)
        ON DELETE CASCADE,
        
    UNIQUE(tenant_id, feature_key)
);

CREATE INDEX idx_features_tenant ON tenant_features(tenant_id);
CREATE INDEX idx_features_key ON tenant_features(feature_key);

-- Tenant API Keys Table
CREATE TABLE IF NOT EXISTS tenant_api_keys (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    key_id VARCHAR(255) UNIQUE NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    key_type VARCHAR(50) NOT NULL,
    name VARCHAR(255),
    permissions JSONB DEFAULT '[]',
    rate_limit INTEGER DEFAULT 1000,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMPTZ,
    
    CONSTRAINT fk_apikey_tenant
        FOREIGN KEY(tenant_id) 
        REFERENCES whitelabel_tenants(tenant_id)
        ON DELETE CASCADE,
        
    CONSTRAINT check_key_type 
        CHECK (key_type IN ('master', 'read', 'write', 'custom'))
);

CREATE INDEX idx_apikeys_tenant ON tenant_api_keys(tenant_id);
CREATE INDEX idx_apikeys_key ON tenant_api_keys(key_id);
CREATE INDEX idx_apikeys_type ON tenant_api_keys(key_type);

-- Tenant SSO Configuration Table
CREATE TABLE IF NOT EXISTS tenant_sso_config (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) UNIQUE NOT NULL,
    provider VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT false,
    config JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_sso_tenant
        FOREIGN KEY(tenant_id) 
        REFERENCES whitelabel_tenants(tenant_id)
        ON DELETE CASCADE,
        
    CONSTRAINT check_sso_provider 
        CHECK (provider IN ('saml', 'oauth', 'ldap', 'custom'))
);

-- Tenant Usage Table
CREATE TABLE IF NOT EXISTS tenant_usage (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    metrics JSONB NOT NULL,
    api_calls INTEGER DEFAULT 0,
    storage_bytes BIGINT DEFAULT 0,
    bandwidth_bytes BIGINT DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_usage_tenant
        FOREIGN KEY(tenant_id) 
        REFERENCES whitelabel_tenants(tenant_id)
        ON DELETE CASCADE,
        
    UNIQUE(tenant_id, date)
);

CREATE INDEX idx_usage_tenant ON tenant_usage(tenant_id);
CREATE INDEX idx_usage_date ON tenant_usage(date);

-- Tenant Custom Modules Table
CREATE TABLE IF NOT EXISTS tenant_custom_modules (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    module_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50),
    type VARCHAR(50),
    config JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'inactive',
    deployed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_module_tenant
        FOREIGN KEY(tenant_id) 
        REFERENCES whitelabel_tenants(tenant_id)
        ON DELETE CASCADE,
        
    CONSTRAINT check_module_status 
        CHECK (status IN ('inactive', 'deploying', 'active', 'failed', 'deprecated'))
);

CREATE INDEX idx_modules_tenant ON tenant_custom_modules(tenant_id);
CREATE INDEX idx_modules_status ON tenant_custom_modules(status);

-- Update triggers
CREATE OR REPLACE FUNCTION update_whitelabel_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tenant_branding_timestamp
BEFORE UPDATE ON tenant_branding
FOR EACH ROW
EXECUTE FUNCTION update_whitelabel_timestamp();

CREATE TRIGGER update_tenant_sso_timestamp
BEFORE UPDATE ON tenant_sso_config
FOR EACH ROW
EXECUTE FUNCTION update_whitelabel_timestamp();

CREATE TRIGGER update_tenant_modules_timestamp
BEFORE UPDATE ON tenant_custom_modules
FOR EACH ROW
EXECUTE FUNCTION update_whitelabel_timestamp();