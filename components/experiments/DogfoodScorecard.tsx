'use client';

/**
 * DogfoodScorecard
 *
 * Shows how Synthex.social scores on its own tools:
 * GEO, Entity Coherence, Quality Gate, E-E-A-T, Authority.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  RefreshCw,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Globe,
} from '@/components/icons';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

type DogfoodStatus = 'excellent' | 'good' | 'needs-work' | 'unknown';

interface DogfoodModuleScore {
  module: string;
  score: number;
  benchmark: number;
  status: DogfoodStatus;
  details: string;
  recommendations: string[];
}

interface DogfoodReport {
  url: string;
  overallScore: number;
  checkedAt: string;
  modules: DogfoodModuleScore[];
  topRecommendations: string[];
  summary: string;
}

// ============================================================================
// Helpers
// ============================================================================

const STATUS_CONFIG: Record<
  DogfoodStatus,
  { label: string; colour: string; barColour: string }
> = {
  excellent: {
    label: 'Excellent',
    colour: 'bg-green-500/20 text-green-400',
    barColour: 'bg-green-500',
  },
  good: {
    label: 'Good',
    colour: 'bg-cyan-500/20 text-cyan-400',
    barColour: 'bg-cyan-500',
  },
  'needs-work': {
    label: 'Needs Work',
    colour: 'bg-amber-500/20 text-amber-400',
    barColour: 'bg-amber-500',
  },
  unknown: {
    label: 'Unknown',
    colour: 'bg-gray-500/20 text-gray-400',
    barColour: 'bg-gray-500',
  },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================================================
// Module Card
// ============================================================================

function ModuleCard({ module }: { module: DogfoodModuleScore }) {
  const [showRecs, setShowRecs] = useState(false);
  const config = STATUS_CONFIG[module.status];

  return (
    <Card variant="glass" className="hover:border-white/20 transition-colors">
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-white">{module.module}</p>
          <Badge className={cn('text-xs', config.colour)}>{config.label}</Badge>
        </div>

        {/* Score bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">
              Score: <span className="text-white font-mono">{module.score}/100</span>
            </span>
            <span className="text-gray-500">
              Benchmark: <span className="text-gray-400 font-mono">{module.benchmark}</span>
            </span>
          </div>
          <div className="relative h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className={cn('absolute left-0 top-0 h-full rounded-full transition-all', config.barColour)}
              style={{ width: `${module.score}%` }}
            />
            {/* Benchmark marker */}
            <div
              className="absolute top-0 h-full w-px bg-white/40"
              style={{ left: `${module.benchmark}%` }}
            />
          </div>
        </div>

        <p className="text-xs text-gray-400">{module.details}</p>

        {module.recommendations.length > 0 && (
          <div>
            <button
              onClick={() => setShowRecs(!showRecs)}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            >
              {showRecs ? 'Hide' : 'Show'} recommendations
              <span className="text-gray-500">({module.recommendations.length})</span>
            </button>
            {showRecs && (
              <ul className="mt-2 space-y-1">
                {module.recommendations.map((rec, i) => (
                  <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                    <span className="text-cyan-500 shrink-0 mt-0.5">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DogfoodScorecard() {
  const [report, setReport] = useState<DogfoodReport | null>(null);
  const [loading, setLoading] = useState(false);

  async function runCheck() {
    setLoading(true);
    try {
      const res = await fetch('/api/experiments/dogfood', {
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Dog-food check failed');
      }
      const data = await res.json();
      setReport(data.report);
      toast.success('Dog-food check complete');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Dog-food check failed');
    } finally {
      setLoading(false);
    }
  }

  if (!report) {
    return (
      <Card variant="glass">
        <CardContent className="py-16 text-center space-y-4">
          <Globe className="w-16 h-16 mx-auto text-cyan-500/50" />
          <div>
            <h3 className="text-lg font-semibold text-white">
              Dog-food Check
            </h3>
            <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
              Run all Synthex analysers against{' '}
              <span className="text-cyan-400">synthex.social</span> to see how
              well Synthex&apos;s own content scores on GEO, E-E-A-T, and more.
            </p>
          </div>
          <Button
            onClick={runCheck}
            disabled={loading}
            className="gradient-primary text-white"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Globe className="w-4 h-4 mr-2" />
            )}
            {loading ? 'Running check...' : 'Run Full Check'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const overallStatus: DogfoodStatus =
    report.overallScore >= 80
      ? 'excellent'
      : report.overallScore >= 70
      ? 'good'
      : 'needs-work';
  const overallConfig = STATUS_CONFIG[overallStatus];

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <Card variant="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-cyan-400" />
                synthex.social — Dog-food Report
              </CardTitle>
              <p className="text-xs text-gray-400 mt-1">
                Last checked: {formatDate(report.checkedAt)}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={runCheck}
              disabled={loading}
            >
              <RefreshCw className={cn('w-3 h-3 mr-1', loading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Big score */}
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-5xl font-bold text-white">{report.overallScore}</p>
              <p className="text-xs text-gray-400 mt-1">Overall Score</p>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={cn('text-sm', overallConfig.colour)}>
                  {overallConfig.label}
                </Badge>
              </div>
              <Progress value={report.overallScore} className="h-3" />
              <p className="text-xs text-gray-400 mt-2">{report.summary}</p>
            </div>
          </div>

          {/* Top recommendations */}
          {report.topRecommendations.length > 0 && (
            <div className="pt-3 border-t border-white/10">
              <p className="text-xs font-medium text-gray-300 mb-2 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-cyan-400" />
                Top Priority Improvements
              </p>
              <div className="space-y-2">
                {report.topRecommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2">
                    {i === 0 ? (
                      <AlertCircle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle className="w-3 h-3 text-gray-500 shrink-0 mt-0.5" />
                    )}
                    <p className="text-xs text-gray-400">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Module Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {report.modules.map((module) => (
          <ModuleCard key={module.module} module={module} />
        ))}
      </div>
    </div>
  );
}
