'use client';

/**
 * Best Times Heatmap
 *
 * @description 7×24 grid showing optimal posting times with engagement scores.
 */

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface BestTimesHeatmapProps {
  data: Array<{ day: number; hour: number; engagement: number }>;
  isLoading?: boolean;
  className?: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getEngagementColor(value: number): string {
  // 0-33: gray shades
  if (value < 34) {
    const intensity = Math.round((value / 33) * 40 + 20);
    return `rgb(${intensity}, ${intensity}, ${intensity + 5})`;
  }
  // 34-66: cyan shades
  if (value < 67) {
    const normalized = (value - 34) / 33;
    const r = Math.round(6 + normalized * 28);
    const g = Math.round(78 + normalized * 134);
    const b = Math.round(120 + normalized * 92);
    return `rgb(${r}, ${g}, ${b})`;
  }
  // 67-100: green shades
  const normalized = (value - 67) / 33;
  const r = Math.round(16 + normalized * 58);
  const g = Math.round(163 + normalized * 32);
  const b = Math.round(74 - normalized * 20);
  return `rgb(${r}, ${g}, ${b})`;
}

function getEngagementLabel(value: number): string {
  if (value < 34) return 'Low';
  if (value < 67) return 'Medium';
  return 'High';
}

function formatHour(hour: number): string {
  if (hour === 0) return '12am';
  if (hour === 12) return '12pm';
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-1">
      {DAYS.map((day) => (
        <div key={day} className="flex gap-1">
          <div className="w-8 h-6 flex items-center">
            <span className="text-xs text-gray-500">{day}</span>
          </div>
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="w-4 h-6 bg-white/5 rounded-sm animate-pulse"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

interface TooltipState {
  x: number;
  y: number;
  day: string;
  hour: string;
  engagement: number;
}

export function BestTimesHeatmap({
  data,
  isLoading,
  className,
}: BestTimesHeatmapProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ day: number; hour: number } | null>(null);

  // Build engagement map for O(1) lookup
  const engagementMap = useMemo(() => {
    const map = new Map<string, number>();
    data?.forEach((item) => {
      map.set(`${item.day}-${item.hour}`, item.engagement);
    });
    return map;
  }, [data]);

  // Get current day/hour for highlighting
  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();

  const handleMouseEnter = (
    e: React.MouseEvent,
    day: number,
    hour: number,
    engagement: number
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
      day: DAYS[day],
      hour: formatHour(hour),
      engagement,
    });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  const handleCellClick = (day: number, hour: number) => {
    if (selectedCell?.day === day && selectedCell?.hour === hour) {
      setSelectedCell(null);
    } else {
      setSelectedCell({ day, hour });
    }
  };

  if (isLoading) {
    return (
      <div className={cn('bg-gray-900/30 border border-white/10 rounded-xl p-4', className)}>
        <h4 className="text-sm font-medium text-gray-400 mb-4">Best Posting Times</h4>
        <LoadingSkeleton />
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className={cn('bg-gray-900/30 border border-white/10 rounded-xl p-4', className)}>
        <h4 className="text-sm font-medium text-gray-400 mb-4">Best Posting Times</h4>
        <p className="text-gray-500 text-sm text-center py-8">No timing data available</p>
      </div>
    );
  }

  return (
    <div className={cn('bg-gray-900/30 border border-white/10 rounded-xl p-4', className)}>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-gray-400">Best Posting Times</h4>
        {/* Legend */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: getEngagementColor(20) }} />
            <span className="text-xs text-gray-500">Low</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: getEngagementColor(50) }} />
            <span className="text-xs text-gray-500">Medium</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: getEngagementColor(85) }} />
            <span className="text-xs text-gray-500">High</span>
          </div>
        </div>
      </div>

      {/* Hour labels */}
      <div className="flex gap-1 mb-1 ml-10">
        {HOURS.filter((h) => h % 3 === 0).map((hour) => (
          <div
            key={hour}
            className="text-xs text-gray-500 text-center"
            style={{ width: 'calc((100% - 40px) / 8)' }}
          >
            {formatHour(hour)}
          </div>
        ))}
      </div>

      {/* Heatmap grid */}
      <div className="space-y-1">
        {DAYS.map((dayName, dayIndex) => (
          <div key={dayName} className="flex gap-1 items-center">
            <div className="w-8 flex-shrink-0">
              <span className="text-xs text-gray-500">{dayName}</span>
            </div>
            <div className="flex gap-0.5 flex-1">
              {HOURS.map((hour) => {
                const engagement = engagementMap.get(`${dayIndex}-${hour}`) || 0;
                const isCurrentTime = dayIndex === currentDay && hour === currentHour;
                const isSelected = selectedCell?.day === dayIndex && selectedCell?.hour === hour;

                return (
                  <div
                    key={hour}
                    className={cn(
                      'flex-1 h-6 rounded-sm cursor-pointer transition-all',
                      isCurrentTime && 'ring-2 ring-yellow-400',
                      isSelected && 'ring-2 ring-white'
                    )}
                    style={{ backgroundColor: getEngagementColor(engagement) }}
                    onMouseEnter={(e) => handleMouseEnter(e, dayIndex, hour, engagement)}
                    onMouseLeave={handleMouseLeave}
                    onClick={() => handleCellClick(dayIndex, hour)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Selected cell details */}
      {selectedCell && (
        <div className="mt-4 p-3 bg-white/5 rounded-lg border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">
              {DAYS[selectedCell.day]} at {formatHour(selectedCell.hour)}
            </span>
            <span className="text-sm font-medium text-white">
              {getEngagementLabel(engagementMap.get(`${selectedCell.day}-${selectedCell.hour}`) || 0)} engagement (
              {engagementMap.get(`${selectedCell.day}-${selectedCell.hour}`) || 0}%)
            </span>
          </div>
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-gray-900 border border-white/10 rounded-lg p-2 shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <p className="text-xs text-white font-medium">
            {tooltip.day} at {tooltip.hour}
          </p>
          <p className="text-xs text-gray-400">
            {getEngagementLabel(tooltip.engagement)} ({tooltip.engagement}%)
          </p>
        </div>
      )}
    </div>
  );
}

export default BestTimesHeatmap;
