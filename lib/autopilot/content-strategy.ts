/**
 * Autopilot Content Strategy
 *
 * @description Selects content themes based on the organisation's content mix
 * configuration and what's already been generated. Ensures variety and balance
 * across themes and platforms.
 *
 * @module lib/autopilot/content-strategy
 */

import type { ContentMix, ContentTheme, ContentSlot } from './types';
import { DEFAULT_CONTENT_MIX } from './types';

// ============================================================================
// THEME SELECTION
// ============================================================================

/**
 * Select the next content theme based on the target mix and recent history.
 *
 * Uses a deficit-based approach: the theme furthest below its target percentage
 * gets chosen next, ensuring the actual distribution converges on the target.
 */
export function selectTheme(
  targetMix: ContentMix,
  recentThemes: ContentTheme[]
): ContentTheme {
  const mix = { ...DEFAULT_CONTENT_MIX, ...targetMix };
  const themes = Object.keys(mix) as ContentTheme[];
  const total = recentThemes.length || 1;

  // Count occurrences of each theme in recent history
  const counts: Partial<Record<ContentTheme, number>> = {};
  for (const t of recentThemes) {
    counts[t] = (counts[t] ?? 0) + 1;
  }

  // Find the theme with the largest deficit vs target
  let bestTheme: ContentTheme = themes[0] ?? 'educational';
  let bestDeficit = -Infinity;

  for (const theme of themes) {
    const targetPct = mix[theme] ?? 0;
    if (targetPct <= 0) continue;

    const actualPct = ((counts[theme] ?? 0) / total) * 100;
    const deficit = targetPct - actualPct;

    if (deficit > bestDeficit) {
      bestDeficit = deficit;
      bestTheme = theme;
    }
  }

  return bestTheme;
}

/**
 * Allocate content themes across multiple slots for a planning horizon.
 *
 * @param platforms - Active platforms to generate for
 * @param days - Number of days to plan
 * @param postsPerDayPerPlatform - Posts per platform per day
 * @param targetMix - Target content mix weights
 * @param existingThemes - Themes of recently published autopilot posts (for continuity)
 */
export function allocateSlots(
  platforms: string[],
  days: number,
  postsPerDayPerPlatform: number,
  targetMix: ContentMix,
  existingThemes: ContentTheme[] = []
): ContentSlot[] {
  const slots: ContentSlot[] = [];
  const runningThemes = [...existingThemes];
  const now = new Date();

  for (let day = 0; day < days; day++) {
    const date = new Date(now);
    date.setDate(date.getDate() + day + 1); // Start from tomorrow
    date.setHours(9, 0, 0, 0);

    for (const platform of platforms) {
      for (let post = 0; post < postsPerDayPerPlatform; post++) {
        const theme = selectTheme(targetMix, runningThemes);
        runningThemes.push(theme);

        slots.push({
          platform,
          date,
          theme,
          reason:
            day === 0 && existingThemes.length === 0
              ? 'kickstart — first-week content'
              : 'scheduled — content mix allocation',
        });
      }
    }
  }

  return slots;
}

/**
 * Validate and normalise a content mix so values sum to 100.
 * Drops any zero-weight themes.
 */
export function normaliseMix(mix: ContentMix): ContentMix {
  const entries = Object.entries(mix).filter(([, v]) => (v ?? 0) > 0) as [
    ContentTheme,
    number,
  ][];
  if (entries.length === 0) return { ...DEFAULT_CONTENT_MIX };

  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  if (total === 0) return { ...DEFAULT_CONTENT_MIX };

  const normalised: ContentMix = {};
  for (const [key, value] of entries) {
    normalised[key] = Math.round((value / total) * 100);
  }

  // Fix rounding errors — adjust the largest category
  const normTotal = Object.values(normalised).reduce((s, v) => s + (v ?? 0), 0);
  if (normTotal !== 100) {
    const largest = entries.sort((a, b) => b[1] - a[1])[0]?.[0];
    if (largest && normalised[largest] != null) {
      normalised[largest]! += 100 - normTotal;
    }
  }

  return normalised;
}
