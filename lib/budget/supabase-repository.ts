/**
 * Default {@link BudgetLedgerRepository} backed by Supabase service-role client.
 *
 * Lazy-imports `@supabase/supabase-js` so test contexts that inject their own
 * repository don't pay the bundle cost.
 *
 * If `SUPABASE_SERVICE_ROLE_KEY` is missing (local dev / CI), every method
 * throws — callers should always pass a mock repository in test environments
 * or rely on the env-presence check upstream.
 *
 * @see SYN-839 (parent: SYN-834 epic)
 */

import type {
  BudgetLedgerRepository,
  CommitLocationInput,
  LedgerEntry,
} from './types';

interface SupabaseRow {
  id: string;
  service_area_coverage_id: string;
  source_of_truth_job_id: string;
  contractor_id: string;
  postcode: string;
  suburb: string;
  monthly_amount_aud: string | number;
  opened_at: string;
  paused_at: string | null;
  paused_reason: string | null;
  closed_at: string | null;
  status: 'active' | 'paused' | 'closed';
  created_at: string;
}

function rowToEntry(row: SupabaseRow): LedgerEntry {
  return {
    id: row.id,
    serviceAreaCoverageId: row.service_area_coverage_id,
    sourceOfTruthJobId: row.source_of_truth_job_id,
    contractorId: row.contractor_id,
    postcode: row.postcode,
    suburb: row.suburb,
    monthlyAmountAud:
      typeof row.monthly_amount_aud === 'string'
        ? Number(row.monthly_amount_aud)
        : row.monthly_amount_aud,
    openedAt: row.opened_at,
    pausedAt: row.paused_at,
    pausedReason: row.paused_reason,
    closedAt: row.closed_at,
    status: row.status,
    createdAt: row.created_at,
  };
}

async function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      '[budget.repository] Supabase service-role creds missing — pass an explicit repository in tests or set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY'
    );
  }
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export const supabaseBudgetLedgerRepository: BudgetLedgerRepository = {
  async insert(input: CommitLocationInput & { monthlyAmountAud: number }) {
    const client = await getClient();
    const { data, error } = await client
      .from('location_budget_ledger')
      .insert({
        service_area_coverage_id: input.serviceAreaCoverageId,
        source_of_truth_job_id: input.sourceOfTruthJobId,
        contractor_id: input.contractorId,
        postcode: input.postcode,
        suburb: input.suburb,
        monthly_amount_aud: input.monthlyAmountAud,
      })
      .select()
      .single();
    if (error) {
      throw new Error(
        `[budget.repository] insert failed: ${error.code ?? '?'} ${error.message}`
      );
    }
    return rowToEntry(data as SupabaseRow);
  },

  async findActiveByCoverage(serviceAreaCoverageId: string) {
    const client = await getClient();
    const { data, error } = await client
      .from('location_budget_ledger')
      .select()
      .eq('service_area_coverage_id', serviceAreaCoverageId)
      .eq('status', 'active')
      .maybeSingle();
    if (error) {
      throw new Error(
        `[budget.repository] findActiveByCoverage failed: ${error.code ?? '?'} ${error.message}`
      );
    }
    return data ? rowToEntry(data as SupabaseRow) : null;
  },

  async sumActiveMonthlyAud() {
    const client = await getClient();
    const { data, error } = await client
      .from('location_budget_ledger')
      .select('monthly_amount_aud')
      .eq('status', 'active');
    if (error) {
      throw new Error(
        `[budget.repository] sumActiveMonthlyAud failed: ${error.code ?? '?'} ${error.message}`
      );
    }
    return (data ?? []).reduce(
      (sum: number, row: { monthly_amount_aud: string | number }) =>
        sum +
        (typeof row.monthly_amount_aud === 'string'
          ? Number(row.monthly_amount_aud)
          : row.monthly_amount_aud),
      0
    );
  },

  async countActive() {
    const client = await getClient();
    const { count, error } = await client
      .from('location_budget_ledger')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
    if (error) {
      throw new Error(
        `[budget.repository] countActive failed: ${error.code ?? '?'} ${error.message}`
      );
    }
    return count ?? 0;
  },

  async sumActiveMonthlyAudForContractor(contractorId: string) {
    const client = await getClient();
    const { data, error } = await client
      .from('location_budget_ledger')
      .select('monthly_amount_aud')
      .eq('status', 'active')
      .eq('contractor_id', contractorId);
    if (error) {
      throw new Error(
        `[budget.repository] sumActiveMonthlyAudForContractor failed: ${error.code ?? '?'} ${error.message}`
      );
    }
    return (data ?? []).reduce(
      (sum: number, row: { monthly_amount_aud: string | number }) =>
        sum +
        (typeof row.monthly_amount_aud === 'string'
          ? Number(row.monthly_amount_aud)
          : row.monthly_amount_aud),
      0
    );
  },

  async findByContractor(contractorId: string) {
    const client = await getClient();
    const { data, error } = await client
      .from('location_budget_ledger')
      .select()
      .eq('contractor_id', contractorId)
      .order('opened_at', { ascending: false });
    if (error) {
      throw new Error(
        `[budget.repository] findByContractor failed: ${error.code ?? '?'} ${error.message}`
      );
    }
    return (data ?? []).map((row: unknown) => rowToEntry(row as SupabaseRow));
  },

  async pause(serviceAreaCoverageId: string, reason: string) {
    const client = await getClient();
    const { data, error } = await client
      .from('location_budget_ledger')
      .update({
        status: 'paused',
        paused_at: new Date().toISOString(),
        paused_reason: reason,
      })
      .eq('service_area_coverage_id', serviceAreaCoverageId)
      .eq('status', 'active')
      .select()
      .maybeSingle();
    if (error) {
      throw new Error(
        `[budget.repository] pause failed: ${error.code ?? '?'} ${error.message}`
      );
    }
    return data ? rowToEntry(data as SupabaseRow) : null;
  },

  async resume(serviceAreaCoverageId: string) {
    const client = await getClient();
    const { data, error } = await client
      .from('location_budget_ledger')
      .update({
        status: 'active',
        paused_at: null,
        paused_reason: null,
      })
      .eq('service_area_coverage_id', serviceAreaCoverageId)
      .eq('status', 'paused')
      .select()
      .maybeSingle();
    if (error) {
      throw new Error(
        `[budget.repository] resume failed: ${error.code ?? '?'} ${error.message}`
      );
    }
    return data ? rowToEntry(data as SupabaseRow) : null;
  },
};
