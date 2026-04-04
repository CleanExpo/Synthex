/**
 * Unit tests for autopilot content strategy
 * Tests theme selection (deficit-based), slot allocation, and mix normalisation
 */

import {
  selectTheme,
  allocateSlots,
  normaliseMix,
} from '@/lib/autopilot/content-strategy';
import type { ContentMix, ContentTheme } from '@/lib/autopilot/types';
import { DEFAULT_CONTENT_MIX } from '@/lib/autopilot/types';

describe('selectTheme', () => {
  it('returns the theme with the largest deficit when history exists', () => {
    // educational=30%, promotional=20%, engagement=25%, storytelling=25%
    // If history is all 'educational', the other themes have the biggest deficit
    const recentThemes: ContentTheme[] = [
      'educational',
      'educational',
      'educational',
      'educational',
    ];
    const theme = selectTheme(DEFAULT_CONTENT_MIX, recentThemes);
    // educational is 100% of history (target 30%) — any other theme should be picked
    expect(theme).not.toBe('educational');
  });

  it('returns any valid theme when history is empty', () => {
    const validThemes: ContentTheme[] = [
      'educational',
      'promotional',
      'engagement',
      'storytelling',
      'behind_the_scenes',
      'social_proof',
      'trend_reactive',
    ];
    const theme = selectTheme(DEFAULT_CONTENT_MIX, []);
    expect(validThemes).toContain(theme);
  });

  it('respects custom mix weights', () => {
    const customMix: ContentMix = {
      promotional: 100,
    };
    const theme = selectTheme(customMix, []);
    expect(theme).toBe('promotional');
  });

  it('skips themes with zero weight', () => {
    const mix: ContentMix = {
      educational: 0,
      promotional: 100,
    };
    const recentThemes: ContentTheme[] = [];
    const theme = selectTheme(mix, recentThemes);
    expect(theme).toBe('promotional');
  });

  it('converges toward target distribution over many selections', () => {
    const themes: ContentTheme[] = [];
    for (let i = 0; i < 100; i++) {
      const next = selectTheme(DEFAULT_CONTENT_MIX, themes);
      themes.push(next);
    }

    const counts: Record<string, number> = {};
    for (const t of themes) {
      counts[t] = (counts[t] ?? 0) + 1;
    }

    // Each theme should be within 10% of its target
    expect(counts['educational']).toBeGreaterThan(15);
    expect(counts['educational']).toBeLessThan(45);
    expect(counts['promotional']).toBeGreaterThan(5);
    expect(counts['engagement']).toBeGreaterThan(10);
    expect(counts['storytelling']).toBeGreaterThan(10);
  });
});

describe('allocateSlots', () => {
  it('creates slots for each platform × day × postsPerDay', () => {
    const slots = allocateSlots(
      ['twitter', 'instagram'],
      3,
      1,
      DEFAULT_CONTENT_MIX
    );
    // 2 platforms × 3 days × 1 post = 6 slots
    expect(slots).toHaveLength(6);
  });

  it('assigns a valid theme to every slot', () => {
    const validThemes: ContentTheme[] = [
      'educational',
      'promotional',
      'engagement',
      'storytelling',
      'behind_the_scenes',
      'social_proof',
      'trend_reactive',
    ];
    const slots = allocateSlots(['twitter'], 5, 1, DEFAULT_CONTENT_MIX);
    for (const slot of slots) {
      expect(validThemes).toContain(slot.theme);
      expect(slot.platform).toBe('twitter');
      expect(slot.date).toBeInstanceOf(Date);
      expect(slot.reason).toBeTruthy();
    }
  });

  it('marks first-day slots as kickstart when no existing themes', () => {
    const slots = allocateSlots(['twitter'], 2, 1, DEFAULT_CONTENT_MIX, []);
    const firstDaySlot = slots[0];
    expect(firstDaySlot?.reason).toContain('kickstart');
  });

  it('marks slots as scheduled when existing themes provided', () => {
    const slots = allocateSlots(['twitter'], 2, 1, DEFAULT_CONTENT_MIX, [
      'educational',
    ]);
    // Even first-day slots should say 'scheduled' since we have history
    const firstDaySlot = slots[0];
    expect(firstDaySlot?.reason).toContain('scheduled');
  });

  it('handles multiple posts per day per platform', () => {
    const slots = allocateSlots(['twitter'], 1, 3, DEFAULT_CONTENT_MIX);
    expect(slots).toHaveLength(3);
  });

  it('returns empty array for zero days', () => {
    const slots = allocateSlots(['twitter'], 0, 1, DEFAULT_CONTENT_MIX);
    expect(slots).toHaveLength(0);
  });

  it('returns empty array for empty platforms', () => {
    const slots = allocateSlots([], 3, 1, DEFAULT_CONTENT_MIX);
    expect(slots).toHaveLength(0);
  });
});

describe('normaliseMix', () => {
  it('normalises values to sum to 100', () => {
    const mix: ContentMix = { educational: 50, promotional: 50 };
    const normalised = normaliseMix(mix);
    const total = Object.values(normalised).reduce((s, v) => s + (v ?? 0), 0);
    expect(total).toBe(100);
  });

  it('drops zero-weight themes', () => {
    const mix: ContentMix = {
      educational: 50,
      promotional: 0,
      engagement: 50,
    };
    const normalised = normaliseMix(mix);
    expect(normalised.promotional).toBeUndefined();
  });

  it('returns default mix when all values are zero', () => {
    const mix: ContentMix = { educational: 0, promotional: 0 };
    const normalised = normaliseMix(mix);
    expect(normalised).toEqual(DEFAULT_CONTENT_MIX);
  });

  it('returns default mix for empty object', () => {
    const normalised = normaliseMix({});
    expect(normalised).toEqual(DEFAULT_CONTENT_MIX);
  });

  it('handles uneven ratios with rounding', () => {
    const mix: ContentMix = {
      educational: 1,
      promotional: 1,
      engagement: 1,
    };
    const normalised = normaliseMix(mix);
    const total = Object.values(normalised).reduce((s, v) => s + (v ?? 0), 0);
    expect(total).toBe(100);
    // Each should be ~33
    for (const val of Object.values(normalised)) {
      expect(val).toBeGreaterThanOrEqual(33);
      expect(val).toBeLessThanOrEqual(34);
    }
  });
});
