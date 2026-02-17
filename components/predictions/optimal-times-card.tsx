'use client';

/**
 * Optimal Times Card Component
 *
 * @description Displays ML-predicted optimal posting times:
 * - Next optimal time (prominent display)
 * - Methodology badge (historical/industry/hybrid)
 * - Top 5 time slots with score bars
 * - Data point count
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from '@/components/icons';
import type { OptimalTimesResult } from './types';

// ============================================================================
// HELPERS
// ============================================================================

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

function formatNextTime(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function getMethodologyLabel(
  methodology: 'historical' | 'industry' | 'hybrid'
): { label: string; color: string } {
  switch (methodology) {
    case 'historical':
      return {
        label: 'Based on your data',
        color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      };
    case 'hybrid':
      return {
        label: 'Your data + industry',
        color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      };
    case 'industry':
    default:
      return {
        label: 'Industry averages',
        color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      };
  }
}

function getScoreBarColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-cyan-500';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
}

// ============================================================================
// LOADING SKELETON
// ============================================================================

function OptimalTimesSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-16 rounded-lg bg-white/5" />
      <div className="h-4 w-24 rounded bg-white/5" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-4 w-20 rounded bg-white/5" />
            <div className="flex-1 h-3 rounded-full bg-white/5" />
            <div className="h-4 w-8 rounded bg-white/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

interface OptimalTimesCardProps {
  data: OptimalTimesResult | null;
  isLoading: boolean;
}

export function OptimalTimesCard({ data, isLoading }: OptimalTimesCardProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2 text-white">
          <Clock className="h-5 w-5 text-cyan-400" />
          Best Posting Times
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <OptimalTimesSkeleton />
        ) : !data ? (
          <p className="text-sm text-slate-400 text-center py-8">
            Select a platform to see optimal posting times.
          </p>
        ) : (
          <div className="space-y-5">
            {/* Next Optimal Time */}
            <div className="rounded-lg bg-white/5 border border-white/10 p-4 text-center">
              <p className="text-xs text-slate-400 mb-1">Next Optimal Time</p>
              <p className="text-xl font-semibold text-white">
                {formatNextTime(data.nextOptimalTime)}
              </p>
            </div>

            {/* Methodology Badge */}
            {(() => {
              const { label, color } = getMethodologyLabel(data.methodology);
              return (
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${color}`}
                  >
                    {label}
                  </span>
                  <span className="text-xs text-slate-500">
                    Based on {data.basedOnDataPoints.toLocaleString()} data
                    points
                  </span>
                </div>
              );
            })()}

            {/* Top 5 Slots */}
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-3">
                Top Time Slots
              </h4>
              <div className="space-y-2.5">
                {data.slots.slice(0, 5).map((slot, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-24 shrink-0">
                      {DAY_NAMES[slot.day]} {formatHour(slot.hour)}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${getScoreBarColor(
                          slot.score
                        )}`}
                        style={{ width: `${slot.score}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-300 w-8 text-right font-medium">
                      {slot.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
