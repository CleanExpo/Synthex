/**
 * SWR hook for trend predictions and viral potential scoring.
 *
 * Fetches trending topics via GET /api/predict/trends?action=trending
 * and provides a manual trigger for viral potential checks.
 *
 * UNI-1611
 */

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { fetchJson } from '@/lib/fetcher';
import type { ViralPotentialScore } from '@/lib/analytics/trend-predictor';

export interface TrendingTopic {
  topic: string;
  volume: number;
  change: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  relatedHashtags: string[];
}

interface TrendingResponse {
  trending: TrendingTopic[];
  platform: string;
  retrievedAt: string;
}

export function useTrendPredictions(platform: string = 'twitter') {
  const { data, error, isLoading, mutate } = useSWR<TrendingResponse>(
    `/api/predict/trends?action=trending&platform=${platform}`,
    fetchJson
  );

  const [viralResult, setViralResult] = useState<ViralPotentialScore | null>(
    null
  );
  const [isCheckingViral, setIsCheckingViral] = useState(false);

  const checkViralPotential = useCallback(
    async (content: string, targetPlatform: string) => {
      setIsCheckingViral(true);
      try {
        const res = await fetch('/api/predict/trends', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            action: 'viral-potential',
            content: {
              text: content,
              contentLength: content.length,
              hasEmoji: /[\u{1F300}-\u{1F9FF}]/u.test(content),
              hasCTA: /comment|share|follow|like|save|click/i.test(content),
              hashtags: content.match(/#\w+/g) ?? [],
            },
            platform: targetPlatform,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.viralPotential) {
            setViralResult(data.viralPotential);
          }
        }
      } catch {
        // Viral check is optional
      } finally {
        setIsCheckingViral(false);
      }
    },
    []
  );

  return {
    topics: data?.trending ?? [],
    isLoading,
    error: error?.message ?? null,
    refresh: mutate,
    viralResult,
    isCheckingViral,
    checkViralPotential,
  };
}
