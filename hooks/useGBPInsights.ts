'use client';

import useSWR from 'swr';
import {
  type EvidenceState,
  EVIDENCE_STATE_LABELS,
} from '@/lib/ree/evidence-state';

interface GBPInsightsTotals {
  searchViews: number | null;
  mapsViews: number | null;
  websiteClicks: number | null;
  phoneClicks: number | null;
  directionClicks: number | null;
}

interface GBPInsightsTrend {
  date: string;
  searchViews: number | null;
  mapsViews: number | null;
  websiteClicks: number | null;
  phoneClicks: number | null;
  directionClicks: number | null;
}

function safeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function normalizeGBPInsightsTotals(
  totals: Partial<GBPInsightsTotals> | null | undefined
): GBPInsightsTotals {
  return {
    searchViews: safeNumber(totals?.searchViews),
    mapsViews: safeNumber(totals?.mapsViews),
    websiteClicks: safeNumber(totals?.websiteClicks),
    phoneClicks: safeNumber(totals?.phoneClicks),
    directionClicks: safeNumber(totals?.directionClicks),
  };
}

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function useGBPInsights(locationId?: string, days: number = 30) {
  const url = locationId
    ? `/api/google-business/insights?locationId=${locationId}&days=${days}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<{
    state: EvidenceState;
    reason?: string;
    totals: GBPInsightsTotals;
    totalReviews: number | null;
    averageRating: number | null;
    trend: GBPInsightsTrend[];
  }>(url, fetchJson);

  const totals = normalizeGBPInsightsTotals(data?.totals);
  const complete = (values: GBPInsightsTotals) =>
    Object.values(normalizeGBPInsightsTotals(values)).every(
      value => value !== null
    );
  const available =
    !error &&
    data?.state === 'OBSERVED' &&
    complete(totals) &&
    Array.isArray(data.trend) &&
    data.trend.every(complete);
  return {
    message: available
      ? null
      : `${error ? EVIDENCE_STATE_LABELS.UNAVAILABLE : EVIDENCE_STATE_LABELS.PARTIAL}: historical performance withheld pending snapshot grain and provenance review`,
    totals:
      available && data?.totals
        ? normalizeGBPInsightsTotals(data.totals)
        : normalizeGBPInsightsTotals(null),
    totalReviews: available ? (data?.totalReviews ?? null) : null,
    averageRating: available ? (data?.averageRating ?? null) : null,
    trend: available ? (data?.trend ?? []) : [],
    isLoading,
    error: error?.message,
    refresh: mutate,
  };
}
