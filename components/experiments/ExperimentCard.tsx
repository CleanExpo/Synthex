'use client';

/**
 * ExperimentCard
 *
 * Displays a single SEO experiment with status, hypothesis,
 * original vs variant values, metric progress, and action buttons.
 */

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Play,
  Pause,
  CheckCircle,
  X,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Beaker,
} from '@/components/icons';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

interface Observation {
  id: string;
  variant: string;
  metricValue: number;
  recordedAt: string;
}

interface ExperimentCardProps {
  experiment: {
    id: string;
    name: string;
    description?: string | null;
    experimentType: string;
    targetUrl: string;
    hypothesis: string;
    metricToTrack: string;
    originalValue: string;
    variantValue: string;
    status: string;
    winnerVariant?: string | null;
    baselineScore?: number | null;
    variantScore?: number | null;
    improvement?: number | null;
    createdAt: string;
    observations?: Observation[];
  };
  onRefresh?: () => void;
}

// ============================================================================
// Helpers
// ============================================================================

const TYPE_COLOURS: Record<string, string> = {
  'title-tag': 'bg-blue-500/20 text-blue-300',
  'meta-description': 'bg-purple-500/20 text-purple-300',
  h1: 'bg-cyan-500/20 text-cyan-300',
  schema: 'bg-green-500/20 text-green-300',
  'content-structure': 'bg-amber-500/20 text-amber-300',
  'internal-links': 'bg-rose-500/20 text-rose-300',
};

const STATUS_COLOURS: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-400',
  running: 'bg-green-500/20 text-green-400',
  paused: 'bg-yellow-500/20 text-yellow-400',
  completed: 'bg-blue-500/20 text-blue-400',
  cancelled: 'bg-red-500/20 text-red-400',
};

const TYPE_LABELS: Record<string, string> = {
  'title-tag': 'Title Tag',
  'meta-description': 'Meta Description',
  h1: 'H1 Heading',
  schema: 'Schema Markup',
  'content-structure': 'Content Structure',
  'internal-links': 'Internal Links',
};

const METRIC_LABELS: Record<string, string> = {
  'geo-score': 'GEO Score',
  'eeat-score': 'E-E-A-T Score',
  'quality-score': 'Quality Score',
  position: 'Search Position',
  clicks: 'Organic Clicks',
};

// ============================================================================
// Component
// ============================================================================

export function ExperimentCard({ experiment, onRefresh }: ExperimentCardProps) {
  const [loading, setLoading] = useState(false);

  const typeLabel = TYPE_LABELS[experiment.experimentType] ?? experiment.experimentType;
  const typeColour = TYPE_COLOURS[experiment.experimentType] ?? 'bg-gray-500/20 text-gray-300';
  const statusColour = STATUS_COLOURS[experiment.status] ?? STATUS_COLOURS.draft;
  const metricLabel = METRIC_LABELS[experiment.metricToTrack] ?? experiment.metricToTrack;

  const improvement = experiment.improvement;
  const hasScores =
    experiment.baselineScore !== null && experiment.variantScore !== null;

  async function callAction(endpoint: string, body?: Record<string, unknown>) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/experiments/experiments/${experiment.id}/${endpoint}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: body ? JSON.stringify(body) : undefined,
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Action failed');
      }
      toast.success(`Experiment ${endpoint}ed`);
      onRefresh?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card variant="glass" className="hover:border-white/20 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Badges row */}
            <div className="flex flex-wrap gap-2 mb-2">
              <Badge className={cn('text-xs', typeColour)}>{typeLabel}</Badge>
              <Badge className={cn('text-xs', statusColour)}>
                {experiment.status.charAt(0).toUpperCase() + experiment.status.slice(1)}
              </Badge>
            </div>
            <CardTitle className="text-base text-white leading-snug">
              {experiment.name}
            </CardTitle>
          </div>

          {/* Winner badge */}
          {experiment.status === 'completed' && experiment.winnerVariant && (
            <div className="shrink-0">
              {experiment.winnerVariant === 'variant' && (
                <Badge className="bg-green-500/20 text-green-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Variant Won
                </Badge>
              )}
              {experiment.winnerVariant === 'original' && (
                <Badge className="bg-amber-500/20 text-amber-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Original Won
                </Badge>
              )}
              {experiment.winnerVariant === 'inconclusive' && (
                <Badge className="bg-gray-500/20 text-gray-400">
                  Inconclusive
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Hypothesis */}
        <p className="text-xs text-gray-400 mt-1 line-clamp-2">
          <span className="text-gray-500">Hypothesis: </span>
          {experiment.hypothesis}
        </p>

        {/* Target URL */}
        <p className="text-xs text-gray-500 truncate mt-1">
          {experiment.targetUrl}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Original vs Variant */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-white/5 rounded-lg">
            <p className="text-xs font-medium text-gray-400 mb-1">Original</p>
            <p className="text-sm text-white break-words line-clamp-3">
              {experiment.originalValue}
            </p>
          </div>
          <div className="p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-lg">
            <p className="text-xs font-medium text-cyan-400 mb-1">Variant</p>
            <p className="text-sm text-white break-words line-clamp-3">
              {experiment.variantValue}
            </p>
          </div>
        </div>

        {/* Metric progress */}
        {hasScores && (
          <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg">
            <div className="flex-1">
              <p className="text-xs text-gray-400 mb-1">{metricLabel}</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-white">
                  {experiment.baselineScore?.toFixed(1)}
                </span>
                <ArrowRight className="w-3 h-3 text-gray-500" />
                <span className="text-sm font-mono text-white">
                  {experiment.variantScore?.toFixed(1)}
                </span>
              </div>
            </div>
            {improvement !== null && improvement !== undefined && (
              <div
                className={cn(
                  'flex items-center gap-1 text-sm font-semibold',
                  improvement >= 0 ? 'text-green-400' : 'text-red-400'
                )}
              >
                {improvement >= 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                {improvement >= 0 ? '+' : ''}
                {improvement.toFixed(1)}%
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          {experiment.status === 'draft' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => callAction('start')}
              disabled={loading}
            >
              <Play className="w-3 h-3 mr-1" />
              Start
            </Button>
          )}
          {experiment.status === 'running' && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => callAction('record', { variant: 'variant', metricValue: 0 })}
                disabled={loading}
              >
                <Beaker className="w-3 h-3 mr-1" />
                Record
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => callAction('complete')}
                disabled={loading}
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                Complete
              </Button>
            </>
          )}
          {experiment.status === 'paused' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => callAction('start')}
              disabled={loading}
            >
              <Play className="w-3 h-3 mr-1" />
              Resume
            </Button>
          )}
          {['draft', 'running', 'paused'].includes(experiment.status) && (
            <Button
              size="sm"
              variant="outline"
              className="text-red-400 border-red-500/30 hover:bg-red-500/10"
              onClick={async () => {
                if (!window.confirm('Cancel this experiment?')) return;
                await callAction('complete', { winnerVariant: 'inconclusive' });
              }}
              disabled={loading}
            >
              <X className="w-3 h-3 mr-1" />
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
