'use client';

import React from 'react';
import { format, parseISO } from 'date-fns';
import type { SpatiotemporalPredictionResult } from '@/lib/forecasting/types';

interface PlatformHeatmapProps {
  predictions: SpatiotemporalPredictionResult[];
  metric: string;
}

/**
 * CSS-grid colour heatmap for cross-platform spatiotemporal predictions.
 *
 * Layout:
 *   Y-axis: platforms (rows)
 *   X-axis: dates (columns)
 *   Colour: emerald intensity proportional to predicted mean value
 *
 * No Recharts — pure CSS grid with inline styles.
 */
export function PlatformHeatmap({ predictions, metric }: PlatformHeatmapProps) {
  if (predictions.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-500 text-sm">
        No prediction data to display
      </div>
    );
  }

  // Extract unique platforms and dates, sorted
  const platforms = [...new Set(predictions.map((p) => String(p.point.platform)))].sort();
  const dates = [...new Set(predictions.map((p) => String(p.point.date)))].sort();

  // Lookup map: "platform__date" → result
  const lookup = new Map<string, SpatiotemporalPredictionResult>();
  for (const r of predictions) {
    lookup.set(`${String(r.point.platform)}__${String(r.point.date)}`, r);
  }

  // Normalise mean values to [0, 1]
  const means = predictions.map((p) => p.mean);
  const minVal = Math.min(...means);
  const maxVal = Math.max(...means);
  const normalise = (v: number): number =>
    maxVal === minVal ? 0.5 : (v - minVal) / (maxVal - minVal);

  function toEmeraldColour(norm: number): string {
    const opacity = 0.1 + norm * 0.75;
    return `rgba(16, 185, 129, ${opacity.toFixed(2)})`;
  }

  return (
    <div className="overflow-x-auto">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `120px repeat(${dates.length}, minmax(44px, 1fr))`,
        }}
        className="gap-y-1"
      >
        {/* Header row — empty label cell + date headers */}
        <div />
        {dates.map((d) => (
          <div key={d} className="text-xs text-gray-500 text-center pb-1">
            {format(parseISO(d), 'dd/MM')}
          </div>
        ))}

        {/* Data rows — one per platform */}
        {platforms.map((platform) => (
          <React.Fragment key={platform}>
            <div className="text-xs text-gray-400 capitalize flex items-center pr-2">
              {platform}
            </div>
            {dates.map((date) => {
              const result = lookup.get(`${platform}__${date}`);
              const norm = result ? normalise(result.mean) : 0;
              const colour = result ? toEmeraldColour(norm) : 'rgba(255,255,255,0.03)';
              return (
                <div
                  key={date}
                  title={
                    result
                      ? `${platform} · ${format(parseISO(date), 'dd/MM')}\n${metric}: ${result.mean.toFixed(2)} ±${result.std.toFixed(2)}`
                      : 'No data'
                  }
                  style={{ backgroundColor: colour }}
                  className="h-10 rounded-sm border border-white/[0.04] mx-0.5"
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {/* Colour scale legend */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-xs text-gray-500">Low</span>
        <div
          className="flex-1 h-3 rounded-sm"
          style={{
            background:
              'linear-gradient(to right, rgba(16,185,129,0.1), rgba(16,185,129,0.85))',
          }}
        />
        <span className="text-xs text-gray-500">High</span>
      </div>
    </div>
  );
}

export default PlatformHeatmap;
