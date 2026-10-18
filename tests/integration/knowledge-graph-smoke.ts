/**
 * Knowledge Graph Integration Smoke Test — SYN-648 + SYN-654
 *
 * Verified the knowledge_entities / knowledge_edges schema, pgvector search and
 * the get_pipeline_memory / cleanup_pipeline_memory RPCs against the live
 * Supabase DB through the Supabase client.
 *
 * That client has been removed (lib/platform/noop-client retired) and the
 * knowledge-graph tables have no model in prisma/schema.prisma, so there is
 * nothing this smoke test can honestly exercise. It exits 1 rather than print
 * passes it did not observe.
 */

console.error(
  'knowledge-graph-smoke: requires the removed Supabase client ' +
    '(lib/platform/noop-client); the knowledge-graph tables have no Prisma model. Nothing was checked.'
);
process.exit(1);
