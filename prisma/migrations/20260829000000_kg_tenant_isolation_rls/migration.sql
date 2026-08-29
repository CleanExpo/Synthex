-- Tenant isolation for the knowledge-graph tables (North Star Phase 0.1).
--
-- Context. Both tables already have RLS enabled, but the only policies present
-- are blanket service-role grants (`service_role_all_cke`, `service_role_all_cke_edge`,
-- cmd=ALL, qual=true). With RLS on and no policy matching `authenticated`,
-- Postgres denies every row to that role — so this migration does not close an
-- open door, it opens a correctly-scoped one. Nothing is exposed today.
--
-- The tenant key is `client_id`, NOT `organization_id`. It holds the
-- organization id (lib/knowledge-graph/builder.ts writes `client_id: orgId`),
-- but the column was named `client_id` when the tables were created and has no
-- foreign key. Policies must therefore read `client_id`.
--
-- Scope. SELECT only, for `authenticated`, matching the convention used by
-- ab_tests / api_credentials (`users_select_own_org_*`). Writes stay with
-- service_role. This does NOT affect the server read path: lib/knowledge-query.ts
-- uses prisma.$queryRaw, which connects as `postgres` — the table owner — and
-- table owners bypass RLS while relforcerowsecurity is false. The `WHERE
-- client_id = $1` in application code remains the isolation for that path.
--
-- Additive and reversible: creates two policies, drops nothing but its own
-- prior versions of them.

DROP POLICY IF EXISTS users_select_own_org_client_knowledge_entities
  ON public.client_knowledge_entities;

CREATE POLICY users_select_own_org_client_knowledge_entities
  ON public.client_knowledge_entities
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT users.organization_id
      FROM public.users
      WHERE users.id = (auth.uid())::text
    )
  );

DROP POLICY IF EXISTS users_select_own_org_client_knowledge_edges
  ON public.client_knowledge_edges;

CREATE POLICY users_select_own_org_client_knowledge_edges
  ON public.client_knowledge_edges
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT users.organization_id
      FROM public.users
      WHERE users.id = (auth.uid())::text
    )
  );
