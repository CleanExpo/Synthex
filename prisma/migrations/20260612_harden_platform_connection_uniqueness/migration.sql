-- Prevent duplicate active platform connections from reappearing.
--
-- Business-scoped connections are canonical per organization + platform, even
-- when different owners complete OAuth. Personal connections remain canonical
-- per user + platform when organization_id is NULL.

WITH ranked_business_connections AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, platform
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS row_number
  FROM platform_connections
  WHERE organization_id IS NOT NULL
    AND is_active = true
    AND deleted_at IS NULL
),
ranked_personal_connections AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, platform
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS row_number
  FROM platform_connections
  WHERE organization_id IS NULL
    AND is_active = true
    AND deleted_at IS NULL
)
UPDATE platform_connections
SET
  is_active = false,
  access_token = '',
  refresh_token = NULL,
  deleted_at = NOW(),
  updated_at = NOW()
WHERE id IN (
  SELECT id FROM ranked_business_connections WHERE row_number > 1
  UNION ALL
  SELECT id FROM ranked_personal_connections WHERE row_number > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_connections_active_business_platform_key
  ON platform_connections (organization_id, platform)
  WHERE organization_id IS NOT NULL
    AND is_active = true
    AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS platform_connections_active_personal_platform_key
  ON platform_connections (user_id, platform)
  WHERE organization_id IS NULL
    AND is_active = true
    AND deleted_at IS NULL;
