'use client';

/**
 * Engagement Predictor Component
 *
 * @description Form card for predicting engagement on new content.
 * Includes text input, platform/content type selectors, media options,
 * and displays prediction results with metrics, factors, and recommendations.
 */

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, TrendingUp, TrendingDown, Minus } from '@/components/icons';
import type { PredictionInput, PredictionResult } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

const PLATFORMS = [
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'pinterest', label: 'Pinterest' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'threads', label: 'Threads' },
] as const;

const CONTENT_TYPES = [
  { value: 'post', label: 'Post' },
  { value: 'campaign', label: 'Campaign' },
  { value: 'story', label: 'Story' },
  { value: 'reel', label: 'Reel' },
  { value: 'thread', label: 'Thread' },
] as const;

const MEDIA_TYPES = [
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
  { value: 'carousel', label: 'Carousel' },
  { value: 'gif', label: 'GIF' },
] as const;

// ============================================================================
// HELPERS
// ============================================================================

function getConfidenceColor(confidence: number): string {
  if (confidence > 0.7) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  if (confidence >= 0.5) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  return 'bg-red-500/20 text-red-400 border-red-500/30';
}

function getImpactIcon(impact: 'positive' | 'neutral' | 'negative') {
  switch (impact) {
    case 'positive':
      return TrendingUp;
    case 'negative':
      return TrendingDown;
    default:
      return Minus;
  }
}

function getImpactColor(impact: 'positive' | 'neutral' | 'negative'): string {
  switch (impact) {
    case 'positive':
      return 'text-emerald-400';
    case 'negative':
      return 'text-red-400';
    default:
      return 'text-slate-400';
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

interface EngagementPredictorProps {
  onPredict: (input: PredictionInput) => Promise<void>;
  result: PredictionResult | null;
  isLoading: boolean;
}

export function EngagementPredictor({
  onPredict,
  result,
  isLoading,
}: EngagementPredictorProps) {
  const [text, setText] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [contentType, setContentType] = useState('post');
  const [hasMedia, setHasMedia] = useState(false);
  const [mediaType, setMediaType] = useState('image');

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!text.trim()) return;

      await onPredict({
        text,
        platform,
        contentType,
        hasMedia,
        mediaType: hasMedia ? mediaType : undefined,
      });
    },
    [text, platform, contentType, hasMedia, mediaType, onPredict]
  );

  const selectClasses =
    'w-full rounded-lg bg-white/5 border border-white/10 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50';

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2 text-white">
          <Sparkles className="h-5 w-5 text-cyan-400" />
          Engagement Predictor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Content Text */}
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">
              Content Text
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter your content to predict engagement..."
              rows={4}
              required
              className="w-full rounded-lg bg-white/5 border border-white/10 text-white px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 resize-none"
            />
          </div>

          {/* Platform & Content Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">
                Platform
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className={selectClasses}
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">
                Content Type
              </label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                className={selectClasses}
              >
                {CONTENT_TYPES.map((ct) => (
                  <option key={ct.value} value={ct.value}>
                    {ct.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Media Options */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={hasMedia}
                onChange={(e) => setHasMedia(e.target.checked)}
                className="rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
              />
              Has Media
            </label>
            {hasMedia && (
              <select
                value={mediaType}
                onChange={(e) => setMediaType(e.target.value)}
                className={`${selectClasses} w-auto`}
              >
                {MEDIA_TYPES.map((mt) => (
                  <option key={mt.value} value={mt.value}>
                    {mt.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            variant="glass-primary"
            className="w-full"
            disabled={isLoading || !text.trim()}
          >
            {isLoading ? 'Predicting...' : 'Predict Engagement'}
          </Button>
        </form>

        {/* Results */}
        {result && (
          <div className="space-y-4 pt-4 border-t border-white/10">
            {/* Predicted Metrics */}
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-3">
                Predicted Metrics
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Likes', value: result.prediction.likes },
                  { label: 'Comments', value: result.prediction.comments },
                  { label: 'Shares', value: result.prediction.shares },
                  { label: 'Reach', value: result.prediction.reach },
                  {
                    label: 'Eng. Rate',
                    value: `${result.prediction.engagementRate}%`,
                  },
                ].map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-lg bg-white/5 border border-white/10 p-3"
                  >
                    <p className="text-xs text-slate-400">{metric.label}</p>
                    <p className="text-lg font-semibold text-white">
                      {typeof metric.value === 'number'
                        ? metric.value.toLocaleString()
                        : metric.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Confidence Badge */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Confidence:</span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getConfidenceColor(
                  result.prediction.confidence
                )}`}
              >
                {Math.round(result.prediction.confidence * 100)}%
              </span>
            </div>

            {/* Factors */}
            {result.factors.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-2">
                  Factors
                </h4>
                <ul className="space-y-1.5">
                  {result.factors.map((f, i) => {
                    const ImpactIcon = getImpactIcon(f.impact);
                    return (
                      <li
                        key={i}
                        className="flex items-center gap-2 text-sm"
                      >
                        <ImpactIcon
                          className={`h-3.5 w-3.5 ${getImpactColor(
                            f.impact
                          )}`}
                        />
                        <span className="text-slate-300">{f.factor}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {result.recommendations.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-2">
                  Recommendations
                </h4>
                <ul className="space-y-1.5">
                  {result.recommendations.map((rec, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-slate-400"
                    >
                      <span className="text-cyan-400 mt-0.5">-</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
