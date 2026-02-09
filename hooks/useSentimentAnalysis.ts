/**
 * Sentiment Analysis Hook
 *
 * @description Hook for sentiment analysis and engagement prediction:
 * - Analyze text sentiment
 * - Predict engagement
 * - Get sentiment trends
 * - Batch analyze content
 *
 * Usage:
 * ```tsx
 * const { analyze, predictEngagement, trends, isLoading } = useSentimentAnalysis();
 *
 * const result = await analyze("Great product launch!");
 * console.log(result.sentiment, result.score);
 * ```
 */

'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================

export type Sentiment = 'positive' | 'neutral' | 'negative' | 'mixed';

export interface Emotion {
  emotion: string;
  intensity: number;
}

export interface SentimentResult {
  id?: string;
  sentiment: Sentiment;
  score: number;
  confidence: number;
  emotions: Emotion[];
  toneIndicators: string[];
  keyPhrases: string[];
}

export interface EngagementPrediction {
  id?: string;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  engagementRate: number;
  confidence: number;
  factors?: {
    factor: string;
    impact: 'positive' | 'neutral' | 'negative';
    weight: number;
  }[];
  recommendations?: string[];
}

export interface SentimentTrends {
  period: {
    start: string;
    end: string;
    days: number;
  };
  overall: {
    total: number;
    positive: number;
    neutral: number;
    negative: number;
    mixed: number;
    avgScore: number;
    avgConfidence: number;
  };
  trends: {
    date: string;
    count: number;
    positive: number;
    neutral: number;
    negative: number;
    mixed: number;
    avgScore: number;
  }[];
  topEmotions: {
    emotion: string;
    count: number;
    percentage: number;
  }[];
  platformBreakdown: Record<string, {
    count: number;
    avgScore: number;
    positive: number;
    negative: number;
  }>;
  insights: string[];
}

export interface BatchResult {
  id?: string;
  contentId?: string;
  sentiment: Sentiment;
  score: number;
  confidence: number;
  emotions: Emotion[];
}

export interface BatchSummary {
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  mixed: number;
  avgScore: number;
  avgConfidence: number;
}

export interface UseSentimentAnalysisReturn {
  isLoading: boolean;
  error: Error | null;
  analyze: (
    text: string,
    options?: {
      contentType?: 'post' | 'comment' | 'campaign' | 'text';
      contentId?: string;
      platform?: string;
      predictEngagement?: boolean;
    }
  ) => Promise<{ analysis: SentimentResult; engagementPrediction?: EngagementPrediction } | null>;
  analyzeBatch: (
    items: {
      id?: string;
      text: string;
      contentType?: 'post' | 'comment' | 'campaign' | 'text';
      contentId?: string;
      platform?: string;
    }[]
  ) => Promise<{ results: BatchResult[]; summary: BatchSummary } | null>;
  predictEngagement: (
    text: string,
    platform: string,
    options?: {
      contentType?: 'post' | 'campaign' | 'story' | 'reel' | 'thread';
      contentId?: string;
      hasMedia?: boolean;
      mediaType?: 'image' | 'video' | 'carousel' | 'gif';
      scheduledTime?: string;
      audienceSize?: number;
    }
  ) => Promise<EngagementPrediction | null>;
  getTrends: (options?: {
    platform?: string;
    days?: number;
    groupBy?: 'day' | 'week' | 'platform';
  }) => Promise<SentimentTrends | null>;
  updateActuals: (
    predictionId: string,
    actuals: {
      actualLikes: number;
      actualComments: number;
      actualShares: number;
      actualReach?: number;
    }
  ) => Promise<{ accuracy: number } | null>;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useSentimentAnalysis(): UseSentimentAnalysisReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Analyze single text sentiment
   */
  const analyze = useCallback(
    async (
      text: string,
      options?: {
        contentType?: 'post' | 'comment' | 'campaign' | 'text';
        contentId?: string;
        platform?: string;
        predictEngagement?: boolean;
      }
    ): Promise<{ analysis: SentimentResult; engagementPrediction?: EngagementPrediction } | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/ai-content/sentiment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            text,
            contentType: options?.contentType || 'text',
            contentId: options?.contentId,
            platform: options?.platform,
            predictEngagement: options?.predictEngagement || false,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to analyze sentiment');
        }

        const data = await response.json();
        return {
          analysis: data.analysis,
          engagementPrediction: data.engagementPrediction,
        };
      } catch (err) {
        setError(err as Error);
        toast.error((err as Error).message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Batch analyze multiple texts
   */
  const analyzeBatch = useCallback(
    async (
      items: {
        id?: string;
        text: string;
        contentType?: 'post' | 'comment' | 'campaign' | 'text';
        contentId?: string;
        platform?: string;
      }[]
    ): Promise<{ results: BatchResult[]; summary: BatchSummary } | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/ai-content/sentiment/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ items }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to analyze batch');
        }

        const data = await response.json();
        return {
          results: data.results,
          summary: data.summary,
        };
      } catch (err) {
        setError(err as Error);
        toast.error((err as Error).message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Predict engagement for content
   */
  const predictEngagement = useCallback(
    async (
      text: string,
      platform: string,
      options?: {
        contentType?: 'post' | 'campaign' | 'story' | 'reel' | 'thread';
        contentId?: string;
        hasMedia?: boolean;
        mediaType?: 'image' | 'video' | 'carousel' | 'gif';
        scheduledTime?: string;
        audienceSize?: number;
      }
    ): Promise<EngagementPrediction | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/analytics/predict-engagement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            text,
            platform,
            contentType: options?.contentType || 'post',
            contentId: options?.contentId,
            hasMedia: options?.hasMedia || false,
            mediaType: options?.mediaType,
            scheduledTime: options?.scheduledTime,
            audienceSize: options?.audienceSize,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to predict engagement');
        }

        const data = await response.json();
        return {
          id: data.prediction.id,
          likes: data.prediction.likes,
          comments: data.prediction.comments,
          shares: data.prediction.shares,
          reach: data.prediction.reach,
          engagementRate: data.prediction.engagementRate,
          confidence: data.prediction.confidence,
          factors: data.factors,
          recommendations: data.recommendations,
        };
      } catch (err) {
        setError(err as Error);
        toast.error((err as Error).message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Get sentiment trends
   */
  const getTrends = useCallback(
    async (options?: {
      platform?: string;
      days?: number;
      groupBy?: 'day' | 'week' | 'platform';
    }): Promise<SentimentTrends | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (options?.platform) params.set('platform', options.platform);
        if (options?.days) params.set('days', String(options.days));
        if (options?.groupBy) params.set('groupBy', options.groupBy);

        const response = await fetch(`/api/analytics/sentiment?${params}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch trends');
        }

        return await response.json();
      } catch (err) {
        setError(err as Error);
        toast.error((err as Error).message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Update actual engagement results
   */
  const updateActuals = useCallback(
    async (
      predictionId: string,
      actuals: {
        actualLikes: number;
        actualComments: number;
        actualShares: number;
        actualReach?: number;
      }
    ): Promise<{ accuracy: number } | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/analytics/predict-engagement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            predictionId,
            ...actuals,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update actuals');
        }

        const data = await response.json();
        toast.success(`Prediction accuracy: ${Math.round(data.accuracy * 100)}%`);
        return { accuracy: data.accuracy };
      } catch (err) {
        setError(err as Error);
        toast.error((err as Error).message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    isLoading,
    error,
    analyze,
    analyzeBatch,
    predictEngagement,
    getTrends,
    updateActuals,
  };
}

export default useSentimentAnalysis;
