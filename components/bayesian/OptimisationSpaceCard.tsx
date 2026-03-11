'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, RefreshCw } from '@/components/icons';
import { LearningIndicator } from './LearningIndicator';
import { SURFACE_LABELS } from './surface-labels';

export interface BOSpaceData {
  id: string;
  surface: string;
  name: string | null;
  totalObservations: number;
  bestTarget: number | null;
  bestParameters: Record<string, number> | null;
  status: string;
  updatedAt: string;
}

interface OptimisationSpaceCardProps {
  space: BOSpaceData;
  onRunOptimisation: (spaceId: string) => void;
  isRunning?: boolean;
}

function formatSurface(surface: string): string {
  return SURFACE_LABELS[surface] ?? surface
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/**
 * Card displaying a single Bayesian Optimisation space's current state.
 */
export function OptimisationSpaceCard({
  space,
  onRunOptimisation,
  isRunning = false,
}: OptimisationSpaceCardProps) {
  const isDisabled = isRunning || space.status === 'running';
  const topParams = space.bestParameters
    ? Object.entries(space.bestParameters).slice(0, 3)
    : null;

  return (
    <Card className="bg-surface-base/80 backdrop-blur-xl border border-violet-500/10 hover:border-violet-500/30 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-white text-sm font-semibold leading-tight">
            {formatSurface(space.surface)}
            {space.name && (
              <span className="block text-xs font-normal text-gray-400 mt-0.5">{space.name}</span>
            )}
          </CardTitle>
          <LearningIndicator
            totalObservations={space.totalObservations}
            bestTarget={space.bestTarget}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-lg font-bold text-white">{space.totalObservations}</div>
            <div className="text-xs text-gray-500">Observations</div>
          </div>
          <div>
            <div className="text-lg font-bold text-white">
              {space.bestTarget !== null ? space.bestTarget.toFixed(2) : '—'}
            </div>
            <div className="text-xs text-gray-500">Best Score</div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-300">{relativeTime(space.updatedAt)}</div>
            <div className="text-xs text-gray-500">Last Activity</div>
          </div>
        </div>

        {/* Best parameters */}
        {topParams && topParams.length > 0 && (
          <div className="bg-white/[0.03] rounded-lg p-2 space-y-1">
            <div className="text-xs text-gray-500 mb-1.5">Best Parameters</div>
            {topParams.map(([key, value]) => (
              <div key={key} className="flex justify-between items-center text-xs">
                <span className="text-gray-400 font-mono">{key}</span>
                <span className="text-violet-300 font-mono">{value.toFixed(3)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Status badge for running */}
        {space.status === 'running' && (
          <Badge className="bg-amber-500/20 text-amber-400 text-xs w-full justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse mr-1.5" />
            Optimisation running…
          </Badge>
        )}

        {/* Run button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onRunOptimisation(space.id)}
          disabled={isDisabled}
          className="w-full border-violet-500/30 text-violet-400 hover:bg-violet-500/10 hover:border-violet-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDisabled ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Running…
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 mr-1.5" />
              Run Optimisation
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export default OptimisationSpaceCard;
