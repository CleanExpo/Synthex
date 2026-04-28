/**
 * Default {@link CoverageRepository} backed by Supabase service-role.
 *
 * Lazy-imports `@supabase/supabase-js`. Throws when creds missing —
 * tests inject a fake.
 *
 * Phase 3.4: hard-filters `brand='DR'` at the query level so a
 * misconfigured row in the table can't accidentally appear in the
 * dashboard. Defence in depth on top of the DB CHECK constraint.
 *
 * @see SYN-843 (parent: SYN-834 epic)
 */

import type { CoverageRepository, ServiceAreaCoverage } from './types';

interface SupabaseRow {
  id: string;
  brand: 'DR';
  postcode: string;
  suburb: string;
  state: string;
  opened_by_contractor_id: string;
  opened_at: string;
  closed_at: string | null;
  status: 'active' | 'paused' | 'retreated' | 'closed';
  gbp_updated_at: string | null;
  bing_updated_at: string | null;
  source_of_truth_job_id: string;
  created_at: string;
}

function rowToCoverage(row: SupabaseRow): ServiceAreaCoverage {
  return {
    id: row.id,
    brand: row.brand,
    postcode: row.postcode,
    suburb: row.suburb,
    state: row.state,
    openedByContractorId: row.opened_by_contractor_id,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    status: row.status,
    gbpUpdatedAt: row.gbp_updated_at,
    bingUpdatedAt: row.bing_updated_at,
    sourceOfTruthJobId: row.source_of_truth_job_id,
    createdAt: row.created_at,
  };
}

async function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      '[dashboard.coverage] Supabase service-role creds missing — pass an explicit coverageRepo in tests or set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY'
    );
  }
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export const supabaseCoverageRepository: CoverageRepository = {
  async findAllForDr() {
    const client = await getClient();
    const { data, error } = await client
      .from('service_area_coverage')
      .select()
      .eq('brand', 'DR') // Phase 3.4 hard filter
      .order('opened_at', { ascending: false });
    if (error) {
      throw new Error(
        `[dashboard.coverage] findAllForDr failed: ${error.code ?? '?'} ${error.message}`
      );
    }
    return (data ?? []).map((r: unknown) => rowToCoverage(r as SupabaseRow));
  },
};
