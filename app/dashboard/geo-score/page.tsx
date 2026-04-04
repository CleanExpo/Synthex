'use client';

/**
 * /dashboard/geo-score — GEO Score Panel
 *
 * Client-facing GEO Score surface: ring, 90-day trend, and recommended actions.
 * Data source: client_geo_scores via /api/dashboard/geo-score
 *
 * Cold start: shows skeleton with "calculating" message when no row exists.
 * Revalidates every 24h (ISR equivalent via SWR refreshInterval).
 *
 * SYN-657
 */

import useSWR from 'swr';
import { GeoScorePanel, type GeoScoreData } from '@/components/geo/GeoScorePanel';
import { GeoScoreSkeleton } from '@/components/geo/GeoScoreSkeleton';

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => r.json());

type GeoScoreResponse =
  | ({ score: null })
  | GeoScoreData;

export default function GeoScorePage() {
  const { data, error, isLoading } = useSWR<GeoScoreResponse>(
    '/api/dashboard/geo-score',
    fetchJson,
    {
      revalidateOnFocus:    false,
      refreshInterval:      86_400_000, // 24h
      dedupingInterval:     60_000,
    }
  );

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8">
        <GeoScoreSkeleton coldStart={false} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8 text-center">
        <p className="text-sm text-white/40">
          Score temporarily unavailable — we&apos;re working on it
        </p>
      </div>
    );
  }

  // Cold start — no score yet
  if (!data || data.score === null) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8">
        <GeoScoreSkeleton coldStart />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <div className="mb-8">
        <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">
          AI Search Visibility
        </p>
        <h1 className="text-2xl font-light text-white">GEO Score</h1>
        <p className="mt-2 text-sm text-white/40">
          How visible your business is when AI tools like ChatGPT and Google AI
          recommend local businesses.
        </p>
      </div>

      <GeoScorePanel data={data as GeoScoreData} />
    </div>
  );
}
