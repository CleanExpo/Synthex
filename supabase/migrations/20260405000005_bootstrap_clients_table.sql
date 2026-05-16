-- ============================================================================
-- Migration: 20260405000005_bootstrap_clients_table
-- Purpose:   Add `public.clients` placeholder for Preview branch resolution.
--
-- 20260405000006_syn681_client_conversations.sql FKs to public.clients(id)
-- (UUID). On Preview the table doesn't exist; on prod Prisma created it.
--
-- Sequenced between 20260405000004 and 20260405000006 so it lands just
-- before the migration that needs it. Same `IF NOT EXISTS` pattern as the
-- other prisma-bootstrap migrations — no-op in real envs.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);
