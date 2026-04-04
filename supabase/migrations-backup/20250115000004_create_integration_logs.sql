-- Migration: Create Integration Logs Table
-- Description: Tracks all integration activities for audit and debugging
-- Date: 2025-01-14

-- Create enum for log event types
DO $$ BEGIN
  CREATE TYPE integration_event_type AS ENUM (
    'connect',
    'disconnect',
    'refresh',
    'post_created',
    'post_scheduled',
    'post_published',
    'post_failed',
    'auth_expired',
    'auth_refreshed',
    'rate_limit',
    'error'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create integration_logs table
CREATE TABLE IF NOT EXISTS integration_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES user_integrations(id) ON DELETE CASCADE,
  platform integration_platform NOT NULL,
  event_type integration_event_type NOT NULL,
  event_data JSONB DEFAULT '{}',
  error_message TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_integration_logs_user_id ON integration_logs(user_id);
CREATE INDEX idx_integration_logs_integration_id ON integration_logs(integration_id);
CREATE INDEX idx_integration_logs_platform ON integration_logs(platform);
CREATE INDEX idx_integration_logs_event_type ON integration_logs(event_type);
CREATE INDEX idx_integration_logs_created_at ON integration_logs(created_at DESC);

-- Row Level Security (RLS)
ALTER TABLE integration_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own logs
CREATE POLICY "Users can view own integration logs" ON integration_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: System can insert logs (using service role)
CREATE POLICY "System can insert integration logs" ON integration_logs
  FOR INSERT WITH CHECK (true);

-- Create function to log integration events
CREATE OR REPLACE FUNCTION log_integration_event(
  p_user_id UUID,
  p_integration_id UUID,
  p_platform integration_platform,
  p_event_type integration_event_type,
  p_event_data JSONB DEFAULT '{}',
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO integration_logs (
    user_id,
    integration_id,
    platform,
    event_type,
    event_data,
    error_message,
    ip_address,
    user_agent
  ) VALUES (
    p_user_id,
    p_integration_id,
    p_platform,
    p_event_type,
    p_event_data,
    p_error_message,
    inet_client_addr(),
    current_setting('request.headers', true)::json->>'user-agent'
  ) RETURNING id INTO v_log_id;
  
  -- Update last_used timestamp on integration
  IF p_event_type IN ('post_created', 'post_scheduled', 'post_published') THEN
    UPDATE user_integrations 
    SET last_used = NOW() 
    WHERE id = p_integration_id;
  END IF;
  
  RETURN v_log_id;
END;
$$;

-- Grant execute permission on function
GRANT EXECUTE ON FUNCTION log_integration_event TO authenticated;

-- Create view for integration statistics
CREATE OR REPLACE VIEW integration_statistics AS
SELECT 
  ui.user_id,
  ui.platform,
  ui.status,
  ui.connected_at,
  ui.last_used,
  COUNT(DISTINCT il.id) FILTER (WHERE il.event_type = 'post_published') as total_posts,
  COUNT(DISTINCT il.id) FILTER (WHERE il.event_type = 'post_failed') as failed_posts,
  COUNT(DISTINCT il.id) FILTER (WHERE il.event_type = 'error') as total_errors,
  MAX(il.created_at) FILTER (WHERE il.event_type = 'post_published') as last_post_at
FROM user_integrations ui
LEFT JOIN integration_logs il ON ui.id = il.integration_id
GROUP BY ui.user_id, ui.platform, ui.status, ui.connected_at, ui.last_used;

-- Grant select on view to authenticated users
GRANT SELECT ON integration_statistics TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE integration_logs IS 'Audit log of all integration activities and events';
COMMENT ON VIEW integration_statistics IS 'Aggregated statistics for user integrations';