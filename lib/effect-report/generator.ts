/**
 * Effect Report Generator — SYN-674
 *
 * Orchestrates all five section builders into a complete EffectReportData object
 * and persists the result to the effect_reports Supabase table.
 *
 * Cold-start guard: clients created within 45 days of period_start are skipped.
 * Non-fatal: individual section failures return null (section omitted, not thrown).
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';
import {
  buildAchievementSummary,
  buildProprietaryMetrics,
  buildBiggestWin,
  buildHonestGap,
  buildWhatsNext,
} from './sections';
import type {
  EffectReportData,
  EffectReportRow,
  GenerateEffectReportInput,
  GenerateEffectReportOutput,
} from './types';

/** Clients active for fewer than this many days are skipped */
const COLD_START_DAYS = 45;

function getQuarterLabel(date: Date): string {
  const q = Math.floor(date.getUTCMonth() / 3) + 1;
  return `Q${q} ${date.getUTCFullYear()}`;
}

function getNextQuarterLabel(date: Date): string {
  const month = date.getUTCMonth();
  const year = date.getUTCFullYear();
  const nextQ = Math.floor(month / 3) + 2;
  if (nextQ > 4) return `Q1 ${year + 1}`;
  return `Q${nextQ} ${year}`;
}

/**
 * Generate an Effect Report for one organisation.
 *
 * @returns null when cold-start guard fires or no meaningful data.
 */
export async function generateEffectReport(
  input: GenerateEffectReportInput,
  admin: SupabaseClient,
  appUrl: string
): Promise<GenerateEffectReportOutput | null> {
  const { organizationId, periodStart, periodEnd } = input;

  // Resolve org metadata
  const org = await prisma.organization
    .findUnique({
      where: { id: organizationId },
      select: { name: true, createdAt: true },
    })
    .catch(() => null);

  if (!org) return null;

  // Cold-start guard: skip if client created within COLD_START_DAYS of period_start
  const clientCreatedAt = new Date(org.createdAt);
  const daysSinceCreation =
    (periodStart.getTime() - clientCreatedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceCreation < COLD_START_DAYS) return null;

  const quarterLabel = getQuarterLabel(periodEnd);
  const nextQuarterLabel = getNextQuarterLabel(periodEnd);

  // Build all sections concurrently (failures return null)
  const [achievementSummary, proprietaryMetrics, biggestWin, honestGap] =
    await Promise.all([
      buildAchievementSummary(organizationId, periodStart, periodEnd),
      buildProprietaryMetrics(organizationId, admin, periodStart, periodEnd),
      buildBiggestWin(organizationId, periodStart, periodEnd),
      buildHonestGap(organizationId),
    ]);

  // Determine posts per week for whatsNext
  const periodWeeks =
    (periodEnd.getTime() - periodStart.getTime()) / (7 * 24 * 60 * 60 * 1000);
  const postsPerWeek =
    periodWeeks > 0 ? achievementSummary.postsPublished / periodWeeks : 0;

  const whatsNext = await buildWhatsNext(
    organizationId,
    org.name,
    nextQuarterLabel,
    {
      postsPerWeek,
      healthScore: proprietaryMetrics.healthScore,
      geoScore: proprietaryMetrics.geoScore,
    }
  );

  // Track which sections have data
  const sectionsIncluded: string[] = ['achievement_summary'];
  if (
    proprietaryMetrics.healthScore !== null ||
    proprietaryMetrics.geoScore !== null
  ) {
    sectionsIncluded.push('proprietary_metrics');
  }
  if (biggestWin) sectionsIncluded.push('biggest_win');
  if (honestGap) sectionsIncluded.push('honest_gap');
  if (whatsNext) sectionsIncluded.push('whats_next');

  const reportData: EffectReportData = {
    generatedAt: new Date().toISOString(),
    quarterLabel,
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd: periodEnd.toISOString().slice(0, 10),
    businessName: org.name,
    industry: 'local business',
    achievementSummary,
    proprietaryMetrics,
    biggestWin: biggestWin ?? null,
    honestGap: honestGap ?? null,
    whatsNext: whatsNext ?? null,
    sectionsIncluded,
  };

  // SECURITY (2026-05-16): the `/api/og/effect-report` route now derives
  // clientId from the authenticated session and ignores `?client_id=`. We no
  // longer include the org id in the URL — viewing the card requires being
  // signed in as a member of the owning org.
  const pngUrl = `${appUrl}/api/og/effect-report?period=${encodeURIComponent(quarterLabel)}`;

  // Persist to Supabase
  const { data, error } = await (
    admin as ReturnType<
      typeof import('@supabase/supabase-js').createClient<any>
    >
  )
    .from('effect_reports')
    .insert({
      client_id: organizationId,
      period_start: reportData.periodStart,
      period_end: reportData.periodEnd,
      report_data: reportData,
      png_url: pngUrl,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[effect-report/generator] Insert failed:', error);
    return null;
  }

  const reportId = (data as { id: string }).id;

  return { reportId, pngUrl, reportData };
}

/**
 * Fetch a persisted Effect Report by ID (for viewer + download routes).
 * Returns null if not found.
 */
export async function getEffectReport(
  admin: SupabaseClient,
  reportId: string
): Promise<EffectReportRow | null> {
  const { data, error } = await (
    admin as ReturnType<
      typeof import('@supabase/supabase-js').createClient<any>
    >
  )
    .from('effect_reports')
    .select('*')
    .eq('id', reportId)
    .single();

  if (error || !data) return null;
  return data as EffectReportRow;
}

/**
 * Fetch the most recent Effect Report for a client in a given period.
 * Used by the dashboard viewer to resolve /dashboard/effect-report/[period].
 */
export async function getEffectReportByPeriod(
  admin: SupabaseClient,
  organizationId: string,
  quarterLabel: string
): Promise<EffectReportRow | null> {
  const { data } = await (
    admin as ReturnType<
      typeof import('@supabase/supabase-js').createClient<any>
    >
  )
    .from('effect_reports')
    .select('*')
    .eq('client_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!data) return null;

  const match = (data as EffectReportRow[]).find(
    r => r.report_data?.quarterLabel === quarterLabel
  );

  return match ?? null;
}
