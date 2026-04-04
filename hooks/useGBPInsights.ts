'use client';

import useSWR from 'swr';

interface GBPInsightsTotals {
  searchViews: number;
  mapsViews: number;
  websiteClicks: number;
  phoneClicks: number;
  directionClicks: number;
}

interface GBPInsightsTrend {
  date: string;
  searchViews: number | null;
  mapsViews: number | null;
  websiteClicks: number | null;
  phoneClicks: number | null;
  directionClicks: number | null;
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
    success: boolean;
    totals: GBPInsightsTotals;
    totalReviews: number | null;
    averageRating: number | null;
    trend: GBPInsightsTrend[];
  }>(url, fetchJson);

  return {
    totals: data?.totals ?? {
      searchViews: 0,
      mapsViews: 0,
      websiteClicks: 0,
      phoneClicks: 0,
      directionClicks: 0,
    },
    totalReviews: data?.totalReviews ?? 0,
    averageRating: data?.averageRating ?? 0,
    trend: data?.trend ?? [],
    isLoading,
    error: error?.message,
    refresh: mutate,
  };
}
