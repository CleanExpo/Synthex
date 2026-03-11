'use client';

/**
 * Brand Builder — Brand Calendar View Component (Phase 91)
 *
 * 90-day brand publishing + maintenance calendar grouped by week.
 * Event type badges with generate button.
 *
 * @module components/brand/BrandCalendarView
 */

import { useState } from 'react';
import { Calendar, Loader2, Info } from '@/components/icons';
import { cn } from '@/lib/utils';
import { useMutation } from '@/hooks/use-api';
import type { BrandCalendar, CalendarEvent, CalendarEventType } from '@/lib/brand/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BrandCalendarViewProps {
  brandId: string;
}

// ---------------------------------------------------------------------------
// Event type colours + labels
// ---------------------------------------------------------------------------

const EVENT_TYPE_META: Record<CalendarEventType, { label: string; className: string }> = {
  'publish-article':     { label: 'Publish Article',     className: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  'social-post':         { label: 'Social Post',         className: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  'credential-refresh':  { label: 'Credential Refresh',  className: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  'mention-review':      { label: 'Mention Review',      className: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  'schema-audit':        { label: 'Schema Audit',        className: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  'wikidata-update':     { label: 'Wikidata Update',     className: 'bg-green-500/20 text-green-300 border-green-500/30' },
};

const PRIORITY_INDICATOR: Record<string, string> = {
  high:   'bg-red-400',
  medium: 'bg-amber-400',
  low:    'bg-gray-500',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatWeekHeader(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * Group events by calendar week (start on Monday)
 */
function groupByWeek(events: CalendarEvent[]): Array<{ weekStart: string; events: CalendarEvent[] }> {
  const weeks = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    const d = new Date(event.date + 'T00:00:00');
    const day = d.getDay(); // 0=Sun, 1=Mon
    const daysFromMonday = (day === 0 ? 6 : day - 1);
    const monday = new Date(d);
    monday.setDate(d.getDate() - daysFromMonday);
    const key = monday.toISOString().split('T')[0];

    if (!weeks.has(key)) weeks.set(key, []);
    weeks.get(key)!.push(event);
  }

  return [...weeks.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, evs]) => ({ weekStart, events: evs }));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BrandCalendarView({ brandId }: BrandCalendarViewProps) {
  const [calendar, setCalendar] = useState<BrandCalendar | null>(null);
  const { mutate: generateCalendar, isLoading: loading } = useMutation<BrandCalendar, { brandId: string }>(
    async (vars) => {
      const res = await fetch('/api/brand/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(vars),
      });
      if (!res.ok) throw new Error('Calendar generation failed');
      return res.json();
    }
  );

  const handleGenerate = async () => {
    const result = await generateCalendar({ brandId });
    if (result) setCalendar(result);
  };

  const weeks = calendar ? groupByWeek(calendar.events) : [];

  return (
    <div className="space-y-4">
      {/* Header + Generate Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Brand Publishing Calendar</h3>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-300 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Calendar className="w-4 h-4" />
          )}
          Generate Calendar
        </button>
      </div>

      {/* Empty State */}
      {!calendar && !loading && (
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-8 text-center">
          <Calendar className="w-8 h-8 text-gray-500 mx-auto mb-3" />
          <p className="text-sm text-gray-400 font-medium">No calendar generated yet</p>
          <p className="text-xs text-gray-500 mt-1">
            Generate a 90-day brand publishing and maintenance schedule with publishing, social, and credential events.
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="py-12 text-center">
          <Loader2 className="w-8 h-8 text-gray-500 mx-auto animate-spin" />
        </div>
      )}

      {calendar && !loading && (
        <div className="space-y-4">
          {/* Summary Chips */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total Events',  value: calendar.summary.totalEvents },
              { label: 'High Priority', value: calendar.summary.highPriority },
              { label: 'Publishing',    value: calendar.summary.publishingEvents },
              { label: 'Maintenance',   value: calendar.summary.maintenanceEvents },
            ].map(chip => (
              <div key={chip.label} className="bg-white/[0.03] border border-white/10 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-white tabular-nums">{chip.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{chip.label}</div>
              </div>
            ))}
          </div>

          {/* Event Legend */}
          <div className="flex flex-wrap gap-2">
            {(Object.entries(EVENT_TYPE_META) as Array<[CalendarEventType, (typeof EVENT_TYPE_META)[CalendarEventType]]>).map(([type, meta]) => (
              <span key={type} className={cn('text-xs px-2 py-0.5 rounded-full border', meta.className)}>
                {meta.label}
              </span>
            ))}
          </div>

          {/* Week Groups */}
          <div className="space-y-4">
            {weeks.map(week => (
              <div key={week.weekStart}>
                <div className="flex items-center gap-3 mb-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Week of {formatWeekHeader(week.weekStart)}
                  </p>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>
                <div className="space-y-2">
                  {week.events.map((event, i) => {
                    const meta = EVENT_TYPE_META[event.type] ?? { label: event.type, className: 'bg-gray-500/20 text-gray-300 border-gray-500/30' };
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg hover:bg-white/[0.04] transition-colors"
                      >
                        <div className={cn('w-2 h-2 rounded-full shrink-0', PRIORITY_INDICATOR[event.priority] ?? 'bg-gray-500')} />
                        <span className="text-xs text-gray-500 w-24 shrink-0">{formatEventDate(event.date)}</span>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full border shrink-0', meta.className)}>
                          {meta.label}
                        </span>
                        <p className="text-xs text-gray-300 flex-1 min-w-0 truncate">{event.title}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Coverage info */}
          <p className="text-xs text-gray-500 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            Calendar covers {calendar.coverageDays} days · Generated {new Date(calendar.generatedAt).toLocaleDateString('en-AU')}
          </p>
        </div>
      )}
    </div>
  );
}
