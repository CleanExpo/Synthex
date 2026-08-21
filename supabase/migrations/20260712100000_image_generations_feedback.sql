-- 20260712100000_image_generations_feedback.sql
-- Trial slice: per-variant image generation lineage + founder preference feedback.
-- Additive only. Applied out of band via Supabase apply_migration (SYN estate rule).

CREATE TABLE IF NOT EXISTS public.image_generations (
  "id" text NOT NULL DEFAULT (gen_random_uuid())::text,
  "organization_id" text,
  "user_id" text NOT NULL,
  "batch_group_id" text NOT NULL,
  "status" text NOT NULL,
  "provider" text NOT NULL,
  "model" text,
  "seed" integer,
  "input_prompt" text NOT NULL,
  "enhanced_prompt" text,
  "style" text,
  "aspect_ratio" text,
  "image_url" text,
  "media_asset_id" text,
  "grounded" boolean NOT NULL DEFAULT false,
  "reference_set" text,
  "ref_count" integer,
  "lora_id" text,
  "lora_applied" boolean NOT NULL DEFAULT false,
  "kept" boolean,
  "rank" integer,
  "feedback_at" timestamptz,
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT image_generations_pkey PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS image_generations_organization_id_created_at_idx
  ON public.image_generations ("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS image_generations_batch_group_id_idx
  ON public.image_generations ("batch_group_id");
CREATE INDEX IF NOT EXISTS image_generations_user_id_idx
  ON public.image_generations ("user_id");
-- Rank integrity across concurrent PATCHes (panel Major): one rank value per batch.
CREATE UNIQUE INDEX IF NOT EXISTS image_generations_batch_rank_key
  ON public.image_generations ("batch_group_id", "rank") WHERE "rank" IS NOT NULL;

ALTER TABLE public.image_generations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY image_generations_service_role_all ON public.image_generations
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY image_generations_org_select ON public.image_generations
    FOR SELECT TO authenticated USING (public.is_team_member(organization_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
