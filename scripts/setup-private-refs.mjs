#!/usr/bin/env node
/**
 * setup-private-refs.mjs — one-off: loaded owned but PRIVATE reference images
 * into a private Supabase Storage bucket (reference-library-private) and wrote
 * a private manifest. These images (real customer job-site photos) must NEVER
 * live in the public repo/site.
 *
 * The Supabase client it used has been removed (lib/platform/noop-client
 * retired) and there is no replacement private store (/api/admin/private-refs
 * answers FEATURE_NOT_PROVISIONED), so this script exits 1 and uploads nothing.
 */
console.error(
  'setup-private-refs: requires the removed Supabase client (Storage bucket reference-library-private). Nothing was uploaded.'
);
process.exit(1);
