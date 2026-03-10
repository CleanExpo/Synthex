'use client';

/**
 * TimeSlotPicker Component
 *
 * Visual time selection with ML-optimal slot highlighting and conflict markers.
 * Shows a 7-day date strip, an hour grid colour-coded by ML score, conflict
 * dots for overlapping posts, and a "Suggest Best Time" auto-pick button.
 *
 * @module components/scheduling/time-slot-picker
 */

import { useState, useMemo, useCallback } from 'react';
import { useOptimalTimes, type OptimalTimeSlot } from '@/hooks/use-optimal-times';
import { useScheduleConflicts } from '@/hooks/use-schedule-conflicts';
import { Sparkles, AlertCircle, Clock, ChevronLeft, ChevronRight } from '@/components/icons';

// =============================================================================
// Types
// =============================================================================

export interface TimeSlotPickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
  /** Primary platform for conflict + optimal checks */
  platform: string;
  /** All platforms being scheduled (for multi-platform conflict checks) */
  platforms?: string[];
  /** Prevent scheduling in the past */
  minDate?: Date;
  /** Show ML-optimal slot colouring (default true) */
  showOptimalSlots?: boolean;
  /** Show conflict markers (default true) */
  showConflicts?: boolean;
  /** Compact mode for use inside popovers */
  compact?: boolean;
}

// =============================================================================
// Helpers
// =============================================================================

const DAY_ABBREVS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MINUTES = [0, 15, 30, 45];

function formatHour(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  return `${h}:00 ${period}`;
}

function formatTime(date: Date): string {
  const h = date.getHours() % 12 || 12;
  const m = date.getMinutes().toString().padStart(2, '0');
  const period = date.getHours() >= 12 ? 'PM' : 'AM';
  return `${h}:${m} ${period}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getDayName(date: Date): string {
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return names[date.getDay()];
}

function formatShortDate(date: Date): string {
  const day = date.getDate();
  const month = date.toLocaleString('en-AU', { month: 'short' });
  return `${day} ${month}`;
}

// =============================================================================
// Sub-components
// =============================================================================

interface DayStripProps {
  days: Date[];
  selectedDay: Date;
  onSelect: (day: Date) => void;
}

function DayStrip({ days, selectedDay, onSelect }: DayStripProps) {
  const today = new Date();

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {days.map((day) => {
        const isSelected = isSameDay(day, selectedDay);
        const isToday = isSameDay(day, today);

        return (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => onSelect(day)}
            className={`flex flex-col items-center min-w-[3.5rem] px-2 py-2 rounded-lg text-xs font-medium transition-all ${
              isSelected
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 ring-1 ring-cyan-500/20'
                : isToday
                  ? 'bg-white/5 text-white border border-white/10'
                  : 'bg-white/[0.02] text-slate-400 border border-white/[0.06] hover:bg-white/5 hover:text-slate-300'
            }`}
          >
            <span className="text-[10px] uppercase tracking-wide opacity-70">
              {DAY_ABBREVS[day.getDay()]}
            </span>
            <span className="text-sm font-semibold mt-0.5">
              {day.getDate()}
            </span>
            {isToday && (
              <span className="text-[8px] text-cyan-400 mt-0.5">Today</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface HourGridProps {
  selectedDay: Date;
  selectedHour: number | null;
  onSelectHour: (hour: number) => void;
  optimalSlots: OptimalTimeSlot[];
  conflictHours: Map<number, string>; // hour -> conflict tooltip
  minDate?: Date;
  platform: string;
}

function HourGrid({
  selectedDay,
  selectedHour,
  onSelectHour,
  optimalSlots,
  conflictHours,
  minDate,
  platform,
}: HourGridProps) {
  const now = new Date();
  const isToday = isSameDay(selectedDay, now);
  const dayName = getDayName(selectedDay);

  // Build a score map for this day + platform
  const scoreMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const slot of optimalSlots) {
      if (
        slot.platform === platform.toLowerCase() &&
        slot.day.toLowerCase() === dayName.toLowerCase()
      ) {
        const existing = map.get(slot.hour) ?? 0;
        if (slot.score > existing) {
          map.set(slot.hour, slot.score);
        }
      }
    }
    return map;
  }, [optimalSlots, platform, dayName]);

  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
      {Array.from({ length: 24 }, (_, hour) => {
        const isSelected = selectedHour === hour;
        const score = scoreMap.get(hour) ?? 0;
        const conflict = conflictHours.get(hour);
        const isPast = isToday && hour <= now.getHours();
        const isDisabled = isPast && minDate;

        // Score-based background
        let scoreBg = 'bg-gray-800/50 border-white/[0.06]';
        let scoreIndicator = '';
        if (score >= 80) {
          scoreBg = 'bg-green-500/10 border-green-500/30';
          scoreIndicator = 'text-green-400';
        } else if (score >= 50) {
          scoreBg = 'bg-amber-500/10 border-amber-500/20';
          scoreIndicator = 'text-amber-400';
        }

        return (
          <button
            key={hour}
            type="button"
            disabled={!!isDisabled}
            onClick={() => onSelectHour(hour)}
            className={`relative flex items-center justify-center px-2 py-2.5 rounded-lg text-xs font-medium border transition-all ${
              isDisabled
                ? 'opacity-30 cursor-not-allowed bg-gray-900/50 border-white/[0.04] text-slate-600'
                : isSelected
                  ? 'ring-2 ring-cyan-500 bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                  : `${scoreBg} text-slate-300 hover:bg-white/10 hover:border-white/20 cursor-pointer`
            }`}
            title={
              conflict
                ? `Conflict: ${conflict}`
                : score >= 80
                  ? `Optimal time (score: ${score})`
                  : score >= 50
                    ? `Good time (score: ${score})`
                    : undefined
            }
          >
            <span>{formatHour(hour)}</span>

            {/* Score indicator dot */}
            {score >= 80 && !isSelected && (
              <span className={`absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-green-400`} />
            )}

            {/* Conflict marker */}
            {conflict && (
              <span className="absolute top-1 left-1 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </button>
        );
      })}
    </div>
  );
}

interface MinuteSelectorProps {
  selectedMinute: number;
  onSelect: (minute: number) => void;
}

function MinuteSelector({ selectedMinute, onSelect }: MinuteSelectorProps) {
  return (
    <div className="flex gap-2">
      {MINUTES.map((minute) => (
        <button
          key={minute}
          type="button"
          onClick={() => onSelect(minute)}
          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all border ${
            selectedMinute === minute
              ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
              : 'bg-white/[0.03] text-slate-400 border-white/[0.06] hover:bg-white/5 hover:text-slate-300'
          }`}
        >
          :{minute.toString().padStart(2, '0')}
        </button>
      ))}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function TimeSlotPicker({
  value,
  onChange,
  platform,
  platforms,
  minDate,
  showOptimalSlots = true,
  showConflicts = true,
  compact = false,
}: TimeSlotPickerProps) {
  const allPlatforms = platforms ?? [platform];

  // Build 7-day range starting from today
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [weekOffset, setWeekOffset] = useState(0);

  const days = useMemo(() => {
    const result: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i + weekOffset * 7);
      result.push(d);
    }
    return result;
  }, [today, weekOffset]);

  // Selected day / hour / minute
  const [selectedDay, setSelectedDay] = useState<Date>(() => {
    if (value) {
      const d = new Date(value);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    return today;
  });

  const [selectedHour, setSelectedHour] = useState<number | null>(() =>
    value ? value.getHours() : null
  );

  const [selectedMinute, setSelectedMinute] = useState<number>(() =>
    value ? value.getMinutes() : 0
  );

  // Conflict detection date range (cover the 7-day window)
  const conflictRange = useMemo(() => {
    const start = new Date(days[0]);
    const end = new Date(days[6]);
    end.setHours(23, 59, 59, 999);
    return { startDate: start, endDate: end };
  }, [days]);

  // Hooks
  const { slots: optimalSlots, isLoading: optimalLoading, bestNextSlot } =
    useOptimalTimes({
      platforms: allPlatforms,
      enabled: showOptimalSlots,
    });

  const { existingPosts, checkConflict, isLoading: conflictsLoading } =
    useScheduleConflicts({
      ...conflictRange,
      enabled: showConflicts,
    });

  // Build conflict map for the selected day (hour -> tooltip)
  const conflictHours = useMemo(() => {
    const map = new Map<number, string>();
    if (!showConflicts) return map;

    const dayName = getDayName(selectedDay);

    for (const post of existingPosts) {
      // Check all platforms being scheduled
      for (const p of allPlatforms) {
        if (post.platform === p.toLowerCase() && isSameDay(post.scheduledAt, selectedDay)) {
          const hour = post.scheduledAt.getHours();
          map.set(hour, `${post.platform} post at ${formatTime(post.scheduledAt)}: "${post.content}"`);
        }
      }
    }

    return map;
  }, [existingPosts, selectedDay, showConflicts, allPlatforms]);

  // Emit onChange when selections change
  const emitChange = useCallback(
    (day: Date, hour: number, minute: number) => {
      const result = new Date(day);
      result.setHours(hour, minute, 0, 0);
      onChange(result);
    },
    [onChange]
  );

  const handleDaySelect = useCallback(
    (day: Date) => {
      setSelectedDay(day);
      if (selectedHour !== null) {
        emitChange(day, selectedHour, selectedMinute);
      }
    },
    [selectedHour, selectedMinute, emitChange]
  );

  const handleHourSelect = useCallback(
    (hour: number) => {
      setSelectedHour(hour);
      emitChange(selectedDay, hour, selectedMinute);
    },
    [selectedDay, selectedMinute, emitChange]
  );

  const handleMinuteSelect = useCallback(
    (minute: number) => {
      setSelectedMinute(minute);
      if (selectedHour !== null) {
        emitChange(selectedDay, selectedHour, minute);
      }
    },
    [selectedDay, selectedHour, emitChange]
  );

  // "Suggest Best Time" handler
  const handleSuggestBestTime = useCallback(() => {
    const now = new Date();
    const afterDate = minDate && minDate > now ? minDate : now;

    // Try each platform, pick the slot with the highest score
    const candidate = bestNextSlot(platform, afterDate);
    if (!candidate) return;

    // Check for conflicts and try alternatives if needed
    const conflict = checkConflict(platform, candidate);
    if (!conflict) {
      // No conflict -- use this slot
      const day = new Date(candidate);
      day.setHours(0, 0, 0, 0);
      setSelectedDay(day);
      setSelectedHour(candidate.getHours());
      setSelectedMinute(0);
      onChange(candidate);
      return;
    }

    // If conflict, offset by 1 hour and try again
    const offset = new Date(candidate.getTime() + 60 * 60 * 1000);
    const conflict2 = checkConflict(platform, offset);
    if (!conflict2) {
      const day = new Date(offset);
      day.setHours(0, 0, 0, 0);
      setSelectedDay(day);
      setSelectedHour(offset.getHours());
      setSelectedMinute(0);
      onChange(offset);
      return;
    }

    // Last resort: just use the original suggestion
    const day = new Date(candidate);
    day.setHours(0, 0, 0, 0);
    setSelectedDay(day);
    setSelectedHour(candidate.getHours());
    setSelectedMinute(0);
    onChange(candidate);
  }, [platform, minDate, bestNextSlot, checkConflict, onChange]);

  // Current selection display text
  const selectionText = useMemo(() => {
    if (!value) return null;
    const dayStr = formatShortDate(value);
    const timeStr = formatTime(value);
    return `${dayStr} at ${timeStr}`;
  }, [value]);

  const containerClass = compact
    ? 'space-y-3'
    : 'rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4';

  return (
    <div className={containerClass}>
      {/* Header with Suggest Best Time button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {!compact && (
            <Clock className="h-4 w-4 text-cyan-400" />
          )}
          <span className="text-xs font-medium text-slate-300">
            {selectionText || 'Select a time'}
          </span>
        </div>

        <button
          type="button"
          onClick={handleSuggestBestTime}
          disabled={optimalLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
        >
          <Sparkles className="h-3 w-3" />
          Suggest Best Time
        </button>
      </div>

      {/* Day strip with navigation */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
          disabled={weekOffset === 0}
          className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <DayStrip
            days={days}
            selectedDay={selectedDay}
            onSelect={handleDaySelect}
          />
        </div>
        <button
          type="button"
          onClick={() => setWeekOffset((w) => w + 1)}
          className="p-1 rounded text-slate-400 hover:text-white transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Hour grid */}
      <HourGrid
        selectedDay={selectedDay}
        selectedHour={selectedHour}
        onSelectHour={handleHourSelect}
        optimalSlots={optimalSlots}
        conflictHours={conflictHours}
        minDate={minDate}
        platform={platform}
      />

      {/* Minute selector (shown after hour is selected) */}
      {selectedHour !== null && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
            Minutes
          </span>
          <MinuteSelector
            selectedMinute={selectedMinute}
            onSelect={handleMinuteSelect}
          />
        </div>
      )}

      {/* Conflict warning for current selection */}
      {showConflicts && value && selectedHour !== null && (() => {
        const conflict = checkConflict(platform, value);
        if (!conflict) return null;
        return (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-red-300">
              <span className="font-medium">Scheduling conflict:</span>{' '}
              A {conflict.platform} post is already scheduled at{' '}
              {formatTime(conflict.scheduledAt)}.
              {conflict.content && (
                <span className="text-red-400/70 ml-1">
                  &ldquo;{conflict.content}&rdquo;
                </span>
              )}
            </div>
          </div>
        );
      })()}

      {/* Legend */}
      {!compact && showOptimalSlots && (
        <div className="flex items-center gap-4 text-[10px] text-slate-500 pt-1">
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-green-400" />
            Optimal (80+)
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Good (50-79)
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            Conflict
          </div>
        </div>
      )}
    </div>
  );
}
