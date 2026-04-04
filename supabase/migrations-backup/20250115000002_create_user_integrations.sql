-- Migration: Create User Integrations Table
-- Description: Stores encrypted social media credentials for each user
-- Date: 2025-01-14

-- Create enum for integration platforms
DO $$ BEGIN
  CREATE TYPE integration_platform AS ENUM (
    'twitter',
    'linkedin',
    'instagram',
    'facebook',
    'tiktok',
    'youtube',
    'pinterest',
    'threads'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create enum for integration status
DO $$ BEGIN
  CREATE TYPE integration_status AS ENUM (
    'active',
    'expired',
    'error',
    'disconnected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create user_integrations table
CREATE TABLE IF NOT EXISTS user_integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform integration_platform NOT NULL,
  credentials TEXT NOT NULL, -- Encrypted JSON containing API keys
  account_name VARCHAR(255), -- Display name for the connected account
  account_id VARCHAR(255), -- Platform-specific account ID
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used TIMESTAMP WITH TIME ZONE,
  last_sync TIMESTAMP WITH TIME ZONE,
  status integration_status DEFAULT 'active',
  error_message TEXT,
  metadata JSONB DEFAULT '{}', -- Additional platform-specific data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one integration per platform per user
  UNIQUE(user_id, platform)
);

-- Create indexes for performance
CREATE INDEX idx_user_integrations_user_id ON user_integrations(user_id);
CREATE INDEX idx_user_integrations_platform ON user_integrations(platform);
CREATE INDEX idx_user_integrations_status ON user_integrations(status);
CREATE INDEX idx_user_integrations_user_platform ON user_integrations(user_id, platform);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_user_integrations_updated_at 
  BEFORE UPDATE ON user_integrations 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own integrations
CREATE POLICY "Users can view own integrations" ON user_integrations
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own integrations
CREATE POLICY "Users can insert own integrations" ON user_integrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own integrations
CREATE POLICY "Users can update own integrations" ON user_integrations
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own integrations
CREATE POLICY "Users can delete own integrations" ON user_integrations
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to safely get decrypted credentials (server-side only)
CREATE OR REPLACE FUNCTION get_user_integration_credentials(
  p_user_id UUID,
  p_platform integration_platform
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_credentials TEXT;
BEGIN
  -- Only allow authenticated users to get their own credentials
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized access to credentials';
  END IF;
  
  SELECT credentials INTO v_credentials
  FROM user_integrations
  WHERE user_id = p_user_id AND platform = p_platform AND status = 'active';
  
  RETURN v_credentials;
END;
$$;

-- Grant execute permission on function
GRANT EXECUTE ON FUNCTION get_user_integration_credentials TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE user_integrations IS 'Stores encrypted social media platform credentials for each user';
COMMENT ON COLUMN user_integrations.credentials IS 'AES-256-GCM encrypted JSON containing platform API keys';
COMMENT ON COLUMN user_integrations.metadata IS 'Additional platform-specific data like rate limits, permissions, etc';