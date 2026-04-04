-- =============================================================================
-- Migration: Create user tables for OAuth-based auth (no auth.users FK)
-- =============================================================================
-- Our app uses custom JWT cookies for auth (Google OAuth + email/password).
-- Users are NOT stored in Supabase's auth.users table.
-- All tables use plain UUID primary/foreign keys with no FK to auth.users.
-- Safe to run multiple times (fully idempotent).
-- =============================================================================


-- ============================================
-- 1. CREATE TABLES (no FK to auth.users)
-- ============================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  email TEXT DEFAULT '',
  name TEXT,
  avatar_url TEXT,
  company TEXT,
  role TEXT,
  bio TEXT,
  phone TEXT,
  website TEXT,
  social_links JSONB,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
-- 2. DROP ANY EXISTING FK CONSTRAINTS TO auth.users
-- ============================================
-- In case the tables existed before with FK constraints, remove them.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tc.table_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name IN ('profiles', 'user_settings', 'social_integrations')
      AND tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_schema = 'auth'
      AND ccu.table_name = 'users'
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', r.table_name, r.constraint_name);
    RAISE NOTICE 'Dropped FK constraint % on %', r.constraint_name, r.table_name;
  END LOOP;
END $$;


-- ============================================
-- 3. DROP THE AUTO-PROFILE-CREATE TRIGGER
-- ============================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();


-- ============================================
-- 4. RELAX email CONSTRAINTS on profiles
-- ============================================

DO $$
BEGIN
  -- Drop UNIQUE constraint on email if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'profiles'
      AND constraint_type = 'UNIQUE'
      AND constraint_name LIKE '%email%'
  ) THEN
    EXECUTE (
      SELECT format('ALTER TABLE profiles DROP CONSTRAINT %I', constraint_name)
      FROM information_schema.table_constraints
      WHERE table_name = 'profiles'
        AND constraint_type = 'UNIQUE'
        AND constraint_name LIKE '%email%'
      LIMIT 1
    );
    RAISE NOTICE 'Dropped UNIQUE constraint on profiles.email';
  END IF;
END $$;

-- Allow NULL/empty email
ALTER TABLE profiles ALTER COLUMN email DROP NOT NULL;
ALTER TABLE profiles ALTER COLUMN email SET DEFAULT '';


-- ============================================
-- 5. ADD onboarding_completed COLUMN IF MISSING
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'onboarding_completed'
  ) THEN
    ALTER TABLE profiles ADD COLUMN onboarding_completed BOOLEAN DEFAULT false;
    RAISE NOTICE 'Added onboarding_completed column to profiles';
  END IF;
END $$;


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
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_social_integrations_user_id ON social_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_social_integrations_platform ON social_integrations(platform);


-- ============================================
-- 8. ROW LEVEL SECURITY + POLICIES
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_integrations ENABLE ROW LEVEL SECURITY;

-- Open policies — our API uses service-role key which bypasses RLS anyway.
-- These ensure nothing is accidentally blocked.
DROP POLICY IF EXISTS "Service role full access profiles" ON profiles;
CREATE POLICY "Service role full access profiles" ON profiles
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access user_settings" ON user_settings;
CREATE POLICY "Service role full access user_settings" ON user_settings
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access social_integrations" ON social_integrations;
CREATE POLICY "Service role full access social_integrations" ON social_integrations
  FOR ALL USING (true) WITH CHECK (true);

-- Storage policies for avatars
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
CREATE POLICY "Anyone can view avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Service role can manage avatars" ON storage.objects;
CREATE POLICY "Service role can manage avatars" ON storage.objects
  FOR ALL USING (bucket_id = 'avatars') WITH CHECK (bucket_id = 'avatars');


-- ============================================
-- DONE
-- ============================================
