-- Create system backups table for tracking backup history
CREATE TABLE IF NOT EXISTS public.system_backups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  type TEXT CHECK (type IN ('scheduled', 'manual')) NOT NULL,
  status TEXT CHECK (status IN ('completed', 'failed', 'in_progress')) NOT NULL,
  statistics JSONB DEFAULT '{}',
  size_bytes BIGINT,
  storage_location TEXT,
  retention_days INTEGER DEFAULT 30,
  restored_at TIMESTAMP WITH TIME ZONE,
  restored_by UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}'
);

-- Create indexes
CREATE INDEX IF NOT EXISTS system_backups_created_at_idx ON public.system_backups(created_at DESC);
CREATE INDEX IF NOT EXISTS system_backups_status_idx ON public.system_backups(status);
CREATE INDEX IF NOT EXISTS system_backups_type_idx ON public.system_backups(type);

-- Enable Row Level Security
ALTER TABLE public.system_backups ENABLE ROW LEVEL SECURITY;

-- Only admins can view backups
DROP POLICY IF EXISTS "Admins can view backups" ON public.system_backups;
CREATE POLICY "Admins can view backups" ON public.system_backups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Only system can create backups (via service role)
DROP POLICY IF EXISTS "System can create backups" ON public.system_backups;
CREATE POLICY "System can create backups" ON public.system_backups
  FOR INSERT WITH CHECK (false);

-- Only admins can update backup metadata
DROP POLICY IF EXISTS "Admins can update backups" ON public.system_backups;
CREATE POLICY "Admins can update backups" ON public.system_backups
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create function to clean old backups
CREATE OR REPLACE FUNCTION public.clean_old_backups()
RETURNS void AS $$
BEGIN
  DELETE FROM public.system_backups
  WHERE created_at < NOW() - INTERVAL '1 day' * retention_days;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create scheduled job to clean old backups (requires pg_cron extension)
-- Note: This needs to be set up in Supabase dashboard under Database > Extensions
-- SELECT cron.schedule('clean-old-backups', '0 3 * * *', 'SELECT public.clean_old_backups();');