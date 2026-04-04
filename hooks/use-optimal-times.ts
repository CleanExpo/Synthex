'use client';

/**
 * useOptimalTimes Hook
 *
 * SWR-based hook wrapping the auto-schedule API for ML-predicted
 * optimal posting times. Provides a `bestNextSlot()` function that
 * returns the next conflict-free, high-scoring time slot.
 *
 * Falls back to industry defaults from schedule-config.ts when
 * ML predictions are unavailable.
 *
 * @module hooks/use-optimal-times
 */

import useSWR from 'swr';
import { useMemo, useCallback } from 'react';
import { bestTimes } from '@/components/schedule/schedule-config';

// =============================================================================
// Types
// =============================================================================

export interface OptimalTimeSlot {
  day: string; // 'Monday', 'Tuesday', etc.
  hour: number; // 0-23
  score: number; // 0-100
  confidence: number; // 0-1
  platform: string;
}

export interface UseOptimalTimesOptions {
  platforms: string[];
  timezone?: string;
  enabled?: boolean;
}

export interface UseOptimalTimesResult {
  /** All optimal slots across requested platforms */
  slots: OptimalTimeSlot[];
  /** Whether data is still loading */
  isLoading: boolean;
  /**
   * Given a platform and a "not before" date, find the highest-scoring ML slot
   * that falls after the given date. Returns a concrete Date in the next 7 days,
   * or null if no suitable slot exists.
   */
  bestNextSlot: (platform: string, afterDate: Date) => Date | null;
}

// =============================================================================
// Helpers
// =============================================================================

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Map string day name to 0-6 index (Sunday=0) */
function dayNameToIndex(dayName: string): number {
  const idx = DAY_NAMES.findIndex(
    (d) => d.toLowerCase() === dayName.toLowerCase()
  );
  return idx >= 0 ? idx : 0;
}

/**
 * Parse industry-default best times (e.g. "9:00 AM") into hour numbers.
 */
function parseTimeToHour(timeStr: string): number {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 12;
  let hour = parseInt(match[1], 10);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return hour;
}

interface ApiPlatformPrediction {
  topSlot: { day: string; hour: number; score: number; confidence: number };
  slots: Array<{ day: string; hour: number; score: number; confidence: number }>;
  nextOptimalTime: string;
  methodology: string;
}

interface ApiResponse {
  success?: boolean;
  timezone: string;
  platforms: Record<string, ApiPlatformPrediction>;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch optimal times');
  return res.json();
}

/**
 * Build industry-default slots from schedule-config.ts bestTimes map.
 * Assigns a synthetic score and distributes across all weekdays.
 */
function buildFallbackSlots(platforms: string[]): OptimalTimeSlot[] {
  const slots: OptimalTimeSlot[] = [];

  for (const platform of platforms) {
    const times = bestTimes[platform.toLowerCase()];
    if (!times) continue;

    for (const dayName of DAY_NAMES) {
      times.forEach((timeStr, idx) => {
        const hour = parseTimeToHour(timeStr);
        slots.push({
          day: dayName,
          hour,
          score: Math.max(60, 90 - idx * 10), // first time gets 90, second 80, etc.
          confidence: 0.5, // industry default confidence
          platform: platform.toLowerCase(),
        });
      });
    }
  }

  return slots;
}

// =============================================================================
// Hook
// =============================================================================

export function useOptimalTimes({
  platforms,
  timezone,
  enabled = true,
}: UseOptimalTimesOptions): UseOptimalTimesResult {
  const tz =
    timezone ||
    (typeof window !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      : 'UTC');

  const platformsKey = platforms
    .map((p) => p.toLowerCase())
    .sort()
    .join(',');

  const apiUrl =
    enabled && platformsKey
      ? `/api/optimize/auto-schedule?action=multi-platform&platforms=${encodeURIComponent(platformsKey)}&timezone=${encodeURIComponent(tz)}`
      : null;

  const { data, isLoading } = useSWR<ApiResponse>(apiUrl, fetchJson, {
    revalidateOnFocus: false,
    dedupingInterval: 5 * 60 * 1000, // cache for 5 minutes
  });

  // Transform API data into flat OptimalTimeSlot[]
  const slots = useMemo<OptimalTimeSlot[]>(() => {
    if (!data?.platforms) {
      // Fall back to industry defaults
      return buildFallbackSlots(platforms);
    }

    const result: OptimalTimeSlot[] = [];
    for (const [platform, prediction] of Object.entries(data.platforms)) {
      if (!prediction?.slots) continue;
      for (const slot of prediction.slots) {
        result.push({
          day: slot.day,
          hour: slot.hour,
          score: slot.score,
          confidence: slot.confidence,
          platform: platform.toLowerCase(),
        });
      }
    }

    // If API returned empty results, use fallback
    return result.length > 0 ? result : buildFallbackSlots(platforms);
  }, [data, platforms]);

  // bestNextSlot: find the best concrete Date after `afterDate` for a platform
  const bestNextSlot = useCallback(
    (platform: string, afterDate: Date): Date | null => {
      const platformLower = platform.toLowerCase();

      // Get slots for this platform, sorted by score descending
      const platformSlots = slots
        .filter((s) => s.platform === platformLower)
        .sort((a, b) => b.score - a.score);

      if (platformSlots.length === 0) return null;

      // Try each slot (highest score first) and find the next occurrence
      for (const slot of platformSlots) {
        const targetDay = dayNameToIndex(slot.day);
        const candidate = new Date(afterDate);

        // Calculate days until target day
        const currentDay = candidate.getDay();
        let daysUntil = (targetDay - currentDay + 7) % 7;

        // If same day but hour already passed, go to next week
        if (daysUntil === 0 && candidate.getHours() >= slot.hour) {
          daysUntil = 7;
        }

        candidate.setDate(candidate.getDate() + daysUntil);
        candidate.setHours(slot.hour, 0, 0, 0);

        // Ensure candidate is in the future
        if (candidate > afterDate) {
          return candidate;
        }
      }

      // Fallback: try again with +7 days offset for the top slot
      const topSlot = platformSlots[0];
      const fallback = new Date(afterDate);
      const targetDay = dayNameToIndex(topSlot.day);
      const currentDay = fallback.getDay();
      let daysUntil = (targetDay - currentDay + 7) % 7;
      if (daysUntil === 0) daysUntil = 7;
      fallback.setDate(fallback.getDate() + daysUntil);
      fallback.setHours(topSlot.hour, 0, 0, 0);
      return fallback;
    },
    [slots]
  );

  return { slots, isLoading, bestNextSlot };
}
