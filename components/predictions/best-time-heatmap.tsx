'use client';

/**
 * BestTimeHeatmap Component
 *
 * @description Interactive 7x24 grid heatmap for optimal posting times.
 * Color intensity reflects engagement score for each day/hour combination.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { OptimalTimeSlot } from './types';

// ============================================================================
// TYPES
// ============================================================================

interface BestTimeHeatmapProps {
  slots: OptimalTimeSlot[];
  isLoading: boolean;
}

interface TooltipState {
  day: number;
  hour: number;
  score: number;
  confidence: number;
  x: number;
  y: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOUR_LABEL_INDICES = [0, 3, 6, 9, 12, 15, 18, 21];

// ============================================================================
// HELPERS
// ============================================================================

function formatHour(hour: number): string {
  if (hour === 0) return '12am';
  if (hour === 12) return '12pm';
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

function getScoreColor(score: number | undefined): string {
  if (score === undefined || score === 0) return 'bg-slate-800/30';
  if (score <= 20) return 'bg-slate-800/50';
  if (score <= 40) return 'bg-cyan-900/40';
  if (score <= 60) return 'bg-cyan-700/50';
  if (score <= 80) return 'bg-cyan-500/60';
  return 'bg-cyan-400/80';
}

function buildScoreMap(slots: OptimalTimeSlot[]): Map<string, OptimalTimeSlot> {
  const map = new Map<string, OptimalTimeSlot>();
  for (const slot of slots) {
    map.set(`${slot.day}-${slot.hour}`, slot);
  }
  return map;
}

// ============================================================================
// LOADING SKELETON
// ============================================================================

function HeatmapSkeleton() {
  return (
    <Card variant="glass">
      <CardHeader>
        <div className="h-5 w-44 rounded bg-gradient-to-r from-white/5 to-white/10 animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {Array.from({ length: 7 }).map((_, rowIdx) => (
            <div key={rowIdx} className="flex gap-1">
              <div className="w-8 h-5 rounded bg-gradient-to-r from-white/[0.03] to-white/[0.06] animate-pulse" />
              {Array.from({ length: 24 }).map((_, colIdx) => (
                <div
                  key={colIdx}
                  className="flex-1 h-5 rounded-sm bg-gradient-to-r from-white/[0.02] to-white/[0.05] animate-pulse"
                  style={{ animationDelay: `${(rowIdx * 24 + colIdx) * 5}ms` }}
                />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function HeatmapEmpty() {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="text-white">Best Posting Times</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] flex items-center justify-center">
          <p className="text-sm text-slate-500">No optimal time data available for this platform</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function BestTimeHeatmap({ slots, isLoading }: BestTimeHeatmapProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  if (isLoading) return <HeatmapSkeleton />;
  if (!slots || slots.length === 0) return <HeatmapEmpty />;

  const scoreMap = buildScoreMap(slots);

  function handleCellMouseEnter(
    e: React.MouseEvent<HTMLDivElement>,
    day: number,
    hour: number,
    slot: OptimalTimeSlot | undefined
  ) {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      day,
      hour,
      score: slot?.score ?? 0,
      confidence: slot?.confidence ?? 0,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  }

  function handleCellMouseLeave() {
    setTooltip(null);
  }

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="text-white">Best Posting Times</CardTitle>
        <p className="text-xs text-slate-400 mt-0.5">Engagement score by day and hour</p>
      </CardHeader>
      <CardContent>
        {/* Heatmap grid */}
        <div className="overflow-x-auto">
          <div className="min-w-[520px]">
            {/* Hour labels row */}
            <div
              className="grid mb-1"
              style={{ gridTemplateColumns: 'auto repeat(24, 1fr)' }}
            >
              <div className="w-8" />
              {Array.from({ length: 24 }).map((_, hour) => (
                <div key={hour} className="flex justify-center">
                  {HOUR_LABEL_INDICES.includes(hour) ? (
                    <span className="text-[9px] text-slate-500">{formatHour(hour)}</span>
                  ) : null}
                </div>
              ))}
            </div>

            {/* Day rows */}
            {DAY_LABELS.map((dayLabel, day) => (
              <div
                key={day}
                className="grid mb-1"
                style={{ gridTemplateColumns: 'auto repeat(24, 1fr)' }}
              >
                {/* Day label */}
                <div className="w-8 flex items-center">
                  <span className="text-[10px] text-slate-500 font-medium">{dayLabel}</span>
                </div>

                {/* Hour cells */}
                {Array.from({ length: 24 }).map((_, hour) => {
                  const slot = scoreMap.get(`${day}-${hour}`);
                  const colorClass = getScoreColor(slot?.score);

                  return (
                    <div
                      key={hour}
                      className={`h-5 mx-px rounded-sm cursor-pointer transition-all duration-150 hover:ring-1 hover:ring-cyan-400/60 hover:brightness-125 ${colorClass}`}
                      onMouseEnter={(e) => handleCellMouseEnter(e, day, hour, slot)}
                      onMouseLeave={handleCellMouseLeave}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-[10px] text-slate-500">Low activity</span>
          <div className="flex items-center gap-0.5">
            <div className="w-4 h-2.5 rounded-sm bg-slate-800/50" />
            <div className="w-4 h-2.5 rounded-sm bg-cyan-900/40" />
            <div className="w-4 h-2.5 rounded-sm bg-cyan-700/50" />
            <div className="w-4 h-2.5 rounded-sm bg-cyan-500/60" />
            <div className="w-4 h-2.5 rounded-sm bg-cyan-400/80" />
          </div>
          <span className="text-[10px] text-slate-500">High activity</span>
        </div>

        {/* Fixed tooltip rendered via portal-like approach (positioned fixed) */}
        {tooltip && (
          <div
            className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-full"
            style={{ left: tooltip.x, top: tooltip.y - 6 }}
          >
            <div className="rounded-lg bg-surface-base/90 border border-white/10 px-2.5 py-1.5 shadow-xl text-xs">
              <p className="text-slate-300 font-medium">
                {DAY_FULL[tooltip.day]}, {formatHour(tooltip.hour)}
              </p>
              <p className="text-cyan-400">
                Score: <span className="text-white">{tooltip.score}</span>
              </p>
              <p className="text-slate-400">
                Confidence: {Math.round(tooltip.confidence * 100)}%
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
