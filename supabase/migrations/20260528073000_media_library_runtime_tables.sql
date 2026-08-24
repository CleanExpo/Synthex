-- =============================================================================
-- Synthex media library runtime tables
--
-- The active API surface uses `media_assets` and `media_folders` through
-- lib/services/media-library.ts. These tables are intentionally shaped to match
-- that runtime contract instead of replaying the older custom content-library
-- migration, whose UUID profile FKs and columns no longer match production.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.media_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.media_folders(id) ON DELETE SET NULL,
  color TEXT,
  icon TEXT,
  asset_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  url TEXT,
  video_url TEXT,
  base64_data TEXT,
  external_id TEXT,
  prompt TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  folder_id UUID REFERENCES public.media_folders(id) ON DELETE SET NULL,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT media_assets_type_check CHECK (type IN ('image', 'video', 'audio')),
  CONSTRAINT media_assets_status_check CHECK (
    status IN ('pending', 'processing', 'completed', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS media_folders_user_id_idx
  ON public.media_folders(user_id);
CREATE INDEX IF NOT EXISTS media_folders_parent_id_idx
  ON public.media_folders(parent_id);

CREATE INDEX IF NOT EXISTS media_assets_user_id_idx
  ON public.media_assets(user_id);
CREATE INDEX IF NOT EXISTS media_assets_type_idx
  ON public.media_assets(type);
CREATE INDEX IF NOT EXISTS media_assets_provider_idx
  ON public.media_assets(provider);
CREATE INDEX IF NOT EXISTS media_assets_status_idx
  ON public.media_assets(status);
CREATE INDEX IF NOT EXISTS media_assets_folder_id_idx
  ON public.media_assets(folder_id);
CREATE INDEX IF NOT EXISTS media_assets_is_archived_idx
  ON public.media_assets(is_archived);
CREATE INDEX IF NOT EXISTS media_assets_created_at_idx
  ON public.media_assets(created_at DESC);
CREATE INDEX IF NOT EXISTS media_assets_prompt_trgm_idx
  ON public.media_assets USING GIN (prompt gin_trgm_ops);
CREATE INDEX IF NOT EXISTS media_assets_tags_idx
  ON public.media_assets USING GIN(tags);
CREATE INDEX IF NOT EXISTS media_assets_metadata_idx
  ON public.media_assets USING GIN(metadata);
CREATE INDEX IF NOT EXISTS media_assets_metadata_name_trgm_idx
  ON public.media_assets USING GIN ((COALESCE(metadata->>'name', '')) gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.synthex_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS media_folders_touch_updated_at ON public.media_folders;
CREATE TRIGGER media_folders_touch_updated_at
BEFORE UPDATE ON public.media_folders
FOR EACH ROW
EXECUTE FUNCTION public.synthex_touch_updated_at();

DROP TRIGGER IF EXISTS media_assets_touch_updated_at ON public.media_assets;
CREATE TRIGGER media_assets_touch_updated_at
BEFORE UPDATE ON public.media_assets
FOR EACH ROW
EXECUTE FUNCTION public.synthex_touch_updated_at();

CREATE OR REPLACE FUNCTION public.check_media_library_folder_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  folder_owner TEXT;
  target_folder_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'media_folders' THEN
    target_folder_id := NEW.parent_id;
  ELSE
    target_folder_id := NEW.folder_id;
  END IF;

  IF target_folder_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO folder_owner
  FROM public.media_folders
  WHERE id = target_folder_id;

  IF folder_owner IS NOT NULL AND folder_owner <> NEW.user_id THEN
    RAISE EXCEPTION 'media folder ownership mismatch';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS media_folders_owner_guard ON public.media_folders;
CREATE TRIGGER media_folders_owner_guard
BEFORE INSERT OR UPDATE ON public.media_folders
FOR EACH ROW
EXECUTE FUNCTION public.check_media_library_folder_owner();

DROP TRIGGER IF EXISTS media_assets_owner_guard ON public.media_assets;
CREATE TRIGGER media_assets_owner_guard
BEFORE INSERT OR UPDATE ON public.media_assets
FOR EACH ROW
EXECUTE FUNCTION public.check_media_library_folder_owner();

DROP FUNCTION IF EXISTS public.increment_media_usage(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.increment_media_usage(
  asset_id UUID,
  user_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.media_assets
  SET usage_count = usage_count + 1,
      updated_at = NOW()
  WHERE id = increment_media_usage.asset_id
    AND media_assets.user_id = increment_media_usage.user_id;
END;
$$;

ALTER TABLE public.media_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS media_folders_user_select ON public.media_folders;
CREATE POLICY media_folders_user_select
  ON public.media_folders FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS media_folders_user_insert ON public.media_folders;
CREATE POLICY media_folders_user_insert
  ON public.media_folders FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS media_folders_user_update ON public.media_folders;
CREATE POLICY media_folders_user_update
  ON public.media_folders FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS media_folders_user_delete ON public.media_folders;
CREATE POLICY media_folders_user_delete
  ON public.media_folders FOR DELETE TO authenticated
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS media_assets_user_select ON public.media_assets;
CREATE POLICY media_assets_user_select
  ON public.media_assets FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS media_assets_user_insert ON public.media_assets;
CREATE POLICY media_assets_user_insert
  ON public.media_assets FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS media_assets_user_update ON public.media_assets;
CREATE POLICY media_assets_user_update
  ON public.media_assets FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS media_assets_user_delete ON public.media_assets;
CREATE POLICY media_assets_user_delete
  ON public.media_assets FOR DELETE TO authenticated
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS media_folders_service_role_all ON public.media_folders;
CREATE POLICY media_folders_service_role_all
  ON public.media_folders FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS media_assets_service_role_all ON public.media_assets;
CREATE POLICY media_assets_service_role_all
  ON public.media_assets FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_folders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_assets TO authenticated;
GRANT ALL ON public.media_folders TO service_role;
GRANT ALL ON public.media_assets TO service_role;
REVOKE ALL ON FUNCTION public.increment_media_usage(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_media_usage(UUID, TEXT) TO authenticated, service_role;
