/**
 * Default {@link KpiRepository} backed by Supabase service-role client.
 *
 * Lazy-imports `@supabase/supabase-js` so test contexts that inject their
 * own repository don't pay the bundle cost.
 *
 * If `SUPABASE_SERVICE_ROLE_KEY` is missing, every method throws —
 * callers should always pass a mock repository in test environments.
 *
 * @see SYN-842 (parent: SYN-834 epic)
 */

import type {
  KpiPeriodDays,
  KpiRepository,
  KpiSnapshot,
  KpiVerificationState,
  RecordKpiInput,
} from './types';

interface SupabaseRow {
  id: string;
  service_area_coverage_id: string;
  measured_at: string;
  period_days: number;
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
  revenue_aud: string | number | null;
  verification_state: KpiVerificationState;
  verified_at: string | null;
  created_at: string;
}

function rowToSnapshot(row: SupabaseRow): KpiSnapshot {
  return {
    id: row.id,
    serviceAreaCoverageId: row.service_area_coverage_id,
    measuredAt: row.measured_at,
    periodDays: row.period_days as KpiPeriodDays,
    impressions: row.impressions ?? 0,
    clicks: row.clicks ?? 0,
    conversions: row.conversions ?? 0,
    revenueAud:
      row.revenue_aud == null
        ? 0
        : typeof row.revenue_aud === 'string'
          ? Number(row.revenue_aud)
          : row.revenue_aud,
    verificationState: row.verification_state,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
  };
}

async function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      '[kpi.repository] Supabase service-role creds missing — pass an explicit repository in tests or set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY'
    );
  }
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export const supabaseKpiRepository: KpiRepository = {
  async insert(
    input: RecordKpiInput & {
      verificationState: KpiVerificationState;
      verifiedAt: string | null;
    }
  ) {
    const client = await getClient();
    const { data, error } = await client
      .from('location_kpi')
      .insert({
        service_area_coverage_id: input.serviceAreaCoverageId,
        period_days: input.periodDays,
        impressions: input.impressions ?? 0,
        clicks: input.clicks ?? 0,
        conversions: input.conversions ?? 0,
        revenue_aud: input.revenueAud ?? 0,
        verification_state: input.verificationState,
        verified_at: input.verifiedAt,
      })
      .select()
      .single();
    if (error) {
      throw new Error(
        `[kpi.repository] insert failed: ${error.code ?? '?'} ${error.message}`
      );
    }
    return rowToSnapshot(data as SupabaseRow);
  },

  async findLatestForCoverage(
    serviceAreaCoverageId: string,
    periodDays?: KpiPeriodDays
  ) {
    const client = await getClient();
    let query = client
      .from('location_kpi')
      .select()
      .eq('service_area_coverage_id', serviceAreaCoverageId)
      .order('measured_at', { ascending: false })
      .limit(1);
    if (typeof periodDays === 'number') {
      query = query.eq('period_days', periodDays);
    }
    const { data, error } = await query.maybeSingle();
    if (error) {
      throw new Error(
        `[kpi.repository] findLatestForCoverage failed: ${error.code ?? '?'} ${error.message}`
      );
    }
    return data ? rowToSnapshot(data as SupabaseRow) : null;
  },

  async findAllForCoverage(serviceAreaCoverageId: string) {
    const client = await getClient();
    const { data, error } = await client
      .from('location_kpi')
      .select()
      .eq('service_area_coverage_id', serviceAreaCoverageId)
      .order('measured_at', { ascending: false });
    if (error) {
      throw new Error(
        `[kpi.repository] findAllForCoverage failed: ${error.code ?? '?'} ${error.message}`
      );
    }
    return (data ?? []).map((row: unknown) =>
      rowToSnapshot(row as SupabaseRow)
    );
  },

  async listLatestNinetyDayPerCoverage() {
    const client = await getClient();
    // Pull all 90-day rows ordered newest-first, then dedupe by coverage in
    // application code. Cheap given expected scale (hundreds of coverages).
    const { data, error } = await client
      .from('location_kpi')
      .select()
      .eq('period_days', 90)
      .order('measured_at', { ascending: false });
    if (error) {
      throw new Error(
        `[kpi.repository] listLatestNinetyDayPerCoverage failed: ${error.code ?? '?'} ${error.message}`
      );
    }
    const seen = new Set<string>();
    const latest: KpiSnapshot[] = [];
    for (const row of (data ?? []) as SupabaseRow[]) {
      if (seen.has(row.service_area_coverage_id)) continue;
      seen.add(row.service_area_coverage_id);
      latest.push(rowToSnapshot(row));
    }
    return latest;
  },
};
