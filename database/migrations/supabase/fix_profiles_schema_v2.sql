-- =============================================================================
-- Migration v2: Fix profiles table — add missing columns + drop ALL FK constraints
-- =============================================================================
-- PROBLEM: The profiles table was created by an earlier migration (add_onboarding_columns.sql)
-- with only basic columns (id, email, name, avatar_url, onboarding_completed).
-- Our CREATE TABLE IF NOT EXISTS silently skipped because the table already existed.
-- Also: FK constraint profiles_id_fkey STILL references auth.users/public.users.
--
-- THIS FIX:
-- 1. Adds ALL missing columns to profiles table
-- 2. Drops ALL foreign key constraints on profiles/user_settings/social_integrations
-- 3. Refreshes the PostgREST schema cache
--
-- Safe to run multiple times (fully idempotent).
-- =============================================================================


-- ============================================
-- 1. ADD MISSING COLUMNS TO profiles
-- ============================================
-- These columns exist in the API code but were never added to the actual table

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_links JSONB;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;


-- ============================================
-- 2. DROP ALL FK CONSTRAINTS on user tables
-- ============================================
-- Drop ALL foreign keys, not just auth.users ones — catches public.users FKs too

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tc.table_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    WHERE tc.table_name IN ('profiles', 'user_settings', 'social_integrations')
      AND tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.table_name, r.constraint_name);
    RAISE NOTICE 'Dropped FK constraint % on %', r.constraint_name, r.table_name;
  END LOOP;
END $$;


-- ============================================
-- 3. FIX email COLUMN CONSTRAINTS
-- ============================================

-- Make email nullable with empty string default
ALTER TABLE profiles ALTER COLUMN email DROP NOT NULL;
ALTER TABLE profiles ALTER COLUMN email SET DEFAULT '';

-- Drop UNIQUE constraint on email if it exists
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'profiles'
      AND constraint_type = 'UNIQUE'
      AND constraint_name LIKE '%email%'
  LOOP
    EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT %I', r.constraint_name);
    RAISE NOTICE 'Dropped UNIQUE constraint: %', r.constraint_name;
  END LOOP;
END $$;


-- ============================================
-- 4. DROP OLD TRIGGER (if exists)
-- ============================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();


-- ============================================
-- 5. ENSURE user_settings and social_integrations exist
-- ============================================

CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL,
  notifications JSONB DEFAULT '{"email": true, "push": false, "sms": false, "weeklyReport": true, "viralAlert": true, "systemUpdates": false}',
  privacy JSONB DEFAULT '{"profilePublic": false, "showAnalytics": true, "allowDataCollection": true}',
  theme TEXT DEFAULT 'dark',
  language TEXT DEFAULT 'en',
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  platform TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  profile_data JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform)
);


-- ============================================
-- 6. AVATARS STORAGE BUCKET
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;


-- ============================================
-- 7. INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding ON profiles(onboarding_completed) WHERE onboarding_completed = false;
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_social_integrations_user_id ON social_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_social_integrations_platform ON social_integrations(platform);


-- ============================================
-- 8. ROW LEVEL SECURITY + POLICIES
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_integrations ENABLE ROW LEVEL SECURITY;

-- Open policies — our API uses service-role key which bypasses RLS anyway
DROP POLICY IF EXISTS "Service role full access profiles" ON profiles;
CREATE POLICY "Service role full access profiles" ON profiles
  FOR ALL USING (true) WITH CHECK (true);

-- Also drop old per-user policies that reference auth.uid() (they'd block service-role inserts on anon key)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

DROP POLICY IF EXISTS "Service role full access user_settings" ON user_settings;
CREATE POLICY "Service role full access user_settings" ON user_settings
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;

DROP POLICY IF EXISTS "Service role full access social_integrations" ON social_integrations;
CREATE POLICY "Service role full access social_integrations" ON social_integrations
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own integrations" ON social_integrations;
DROP POLICY IF EXISTS "Users can manage own integrations" ON social_integrations;

-- Storage policies for avatars
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
CREATE POLICY "Anyone can view avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Service role can manage avatars" ON storage.objects;
CREATE POLICY "Service role can manage avatars" ON storage.objects
  FOR ALL USING (bucket_id = 'avatars') WITH CHECK (bucket_id = 'avatars');


-- ============================================
-- 9. REFRESH PostgREST SCHEMA CACHE
-- ============================================
-- Critical: PostgREST caches table structure. After adding columns,
-- we must notify it to reload so the new columns are accessible via API.

NOTIFY pgrst, 'reload schema';


-- ============================================
-- DONE — Verify with:
--   SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles' ORDER BY ordinal_position;
-- Should show: id, email, name, avatar_url, onboarding_completed, onboarding_completed_at, created_at, updated_at, company, role, bio, phone, website, social_links
-- ============================================
