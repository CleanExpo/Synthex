-- Migration: Create Mobile API Tables
-- Description: Tables for mobile devices, push notifications, and offline sync

-- Mobile Devices Table
CREATE TABLE IF NOT EXISTS mobile_devices (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID NOT NULL,
    platform VARCHAR(50) NOT NULL,
    device_name VARCHAR(255),
    device_model VARCHAR(255),
    os_version VARCHAR(50),
    app_version VARCHAR(50),
    push_token_fcm TEXT,
    push_token_apns TEXT,
    push_token_web TEXT,
    config JSONB DEFAULT '{}',
    capabilities JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'active',
    last_seen TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    logged_out_at TIMESTAMPTZ,
    wiped_at TIMESTAMPTZ,
    wiped_by UUID,
    
    CONSTRAINT fk_device_user
        FOREIGN KEY(user_id) 
        REFERENCES profiles(id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_device_wiped_by
        FOREIGN KEY(wiped_by) 
        REFERENCES profiles(id)
        ON DELETE SET NULL,
        
    CONSTRAINT check_device_platform 
        CHECK (platform IN ('ios', 'android', 'web')),
        
    CONSTRAINT check_device_status 
        CHECK (status IN ('active', 'inactive', 'logged_out', 'wiped'))
);

CREATE INDEX idx_devices_user ON mobile_devices(user_id);
CREATE INDEX idx_devices_platform ON mobile_devices(platform);
CREATE INDEX idx_devices_status ON mobile_devices(status);
CREATE INDEX idx_devices_last_seen ON mobile_devices(last_seen);
CREATE INDEX idx_devices_fcm_token ON mobile_devices(push_token_fcm);
CREATE INDEX idx_devices_apns_token ON mobile_devices(push_token_apns);

-- Push Notifications Table
CREATE TABLE IF NOT EXISTS push_notifications (
    id SERIAL PRIMARY KEY,
    notification_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID NOT NULL,
    device_id VARCHAR(255),
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    content JSONB DEFAULT '{}',
    data JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    category VARCHAR(100),
    priority VARCHAR(50) DEFAULT 'normal',
    read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    delivered BOOLEAN DEFAULT false,
    delivered_at TIMESTAMPTZ,
    clicked BOOLEAN DEFAULT false,
    clicked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_notification_user
        FOREIGN KEY(user_id) 
        REFERENCES profiles(id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_notification_device
        FOREIGN KEY(device_id) 
        REFERENCES mobile_devices(device_id)
        ON DELETE CASCADE,
        
    CONSTRAINT check_notification_priority 
        CHECK (priority IN ('urgent', 'high', 'normal', 'low'))
);

CREATE INDEX idx_notifications_user ON push_notifications(user_id);
CREATE INDEX idx_notifications_device ON push_notifications(device_id);
CREATE INDEX idx_notifications_category ON push_notifications(category);
CREATE INDEX idx_notifications_read ON push_notifications(read);
CREATE INDEX idx_notifications_created ON push_notifications(created_at);

-- Notification Queue Table
CREATE TABLE IF NOT EXISTS notification_queue (
    id SERIAL PRIMARY KEY,
    notification_id VARCHAR(255) NOT NULL,
    device_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    scheduled_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_queue_notification
        FOREIGN KEY(notification_id) 
        REFERENCES push_notifications(notification_id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_queue_device
        FOREIGN KEY(device_id) 
        REFERENCES mobile_devices(device_id)
        ON DELETE CASCADE,
        
    CONSTRAINT check_queue_status 
        CHECK (status IN ('pending', 'processing', 'delivered', 'failed', 'cancelled'))
);

CREATE INDEX idx_queue_notification ON notification_queue(notification_id);
CREATE INDEX idx_queue_device ON notification_queue(device_id);
CREATE INDEX idx_queue_status ON notification_queue(status);
CREATE INDEX idx_queue_scheduled ON notification_queue(scheduled_at);

-- Offline Sync Queue Table
CREATE TABLE IF NOT EXISTS offline_sync_queue (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL,
    sync_id VARCHAR(255) UNIQUE NOT NULL,
    change_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255),
    data JSONB NOT NULL,
    conflict_resolution VARCHAR(50) DEFAULT 'server-wins',
    status VARCHAR(50) DEFAULT 'pending',
    synced_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_sync_device
        FOREIGN KEY(device_id) 
        REFERENCES mobile_devices(device_id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_sync_user
        FOREIGN KEY(user_id) 
        REFERENCES profiles(id)
        ON DELETE CASCADE,
        
    CONSTRAINT check_change_type 
        CHECK (change_type IN ('create', 'update', 'delete')),
        
    CONSTRAINT check_sync_status 
        CHECK (status IN ('pending', 'syncing', 'synced', 'conflict', 'failed'))
);

CREATE INDEX idx_sync_device ON offline_sync_queue(device_id);
CREATE INDEX idx_sync_user ON offline_sync_queue(user_id);
CREATE INDEX idx_sync_status ON offline_sync_queue(status);
CREATE INDEX idx_sync_created ON offline_sync_queue(created_at);

-- Mobile Sessions Table
CREATE TABLE IF NOT EXISTS mobile_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    device_id VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    terminated_at TIMESTAMPTZ,
    
    CONSTRAINT fk_session_device
        FOREIGN KEY(device_id) 
        REFERENCES mobile_devices(device_id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_session_user
        FOREIGN KEY(user_id) 
        REFERENCES profiles(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_sessions_device ON mobile_sessions(device_id);
CREATE INDEX idx_sessions_user ON mobile_sessions(user_id);
CREATE INDEX idx_sessions_expires ON mobile_sessions(expires_at);
CREATE INDEX idx_sessions_activity ON mobile_sessions(last_activity);

-- Device Settings Table
CREATE TABLE IF NOT EXISTS device_settings (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(255) UNIQUE NOT NULL,
    notifications_enabled BOOLEAN DEFAULT true,
    offline_mode_enabled BOOLEAN DEFAULT true,
    biometric_enabled BOOLEAN DEFAULT false,
    theme VARCHAR(50) DEFAULT 'system',
    language VARCHAR(10) DEFAULT 'en',
    data_usage VARCHAR(50) DEFAULT 'wifi-only',
    auto_sync BOOLEAN DEFAULT true,
    sync_interval INTEGER DEFAULT 60,
    settings JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_settings_device
        FOREIGN KEY(device_id) 
        REFERENCES mobile_devices(device_id)
        ON DELETE CASCADE
);

-- Update trigger for device settings
CREATE OR REPLACE FUNCTION update_device_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_device_settings_timestamp
BEFORE UPDATE ON device_settings
FOR EACH ROW
EXECUTE FUNCTION update_device_settings_timestamp();