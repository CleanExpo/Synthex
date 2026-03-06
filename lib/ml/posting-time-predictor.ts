/**
 * ML-Based Optimal Posting Time Predictor
 *
 * @description Predicts the best times to post content for maximum engagement
 * using historical engagement data and platform-specific patterns
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase URL (PUBLIC)
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (SECRET)
 *
 * FAILURE MODE: Falls back to industry-standard optimal times
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// Platform types
export type Platform = 'twitter' | 'instagram' | 'linkedin' | 'facebook' | 'tiktok' | 'youtube';

// Time slot prediction
export interface TimeSlot {
  day: number; // 0-6 (Sunday-Saturday)
  hour: number; // 0-23
  score: number; // 0-100 engagement prediction score
  confidence: number; // 0-1 prediction confidence
}

// Optimal time result
export interface OptimalTimeResult {
  platform: Platform;
  timezone: string;
  slots: TimeSlot[];
  topSlot: TimeSlot;
  nextOptimalTime: Date;
  basedOnDataPoints: number;
  methodology: 'historical' | 'industry' | 'hybrid';
}

// Engagement data point
interface EngagementDataPoint {
  timestamp: Date;
  dayOfWeek: number;
  hourOfDay: number;
  engagementRate: number;
  impressions: number;
  interactions: number;
}

// Industry baseline optimal times (fallback)
const INDUSTRY_OPTIMAL_TIMES: Record<Platform, Array<{ day: number; hour: number; score: number }>> = {
  twitter: [
    { day: 1, hour: 9, score: 85 }, // Monday 9am
    { day: 2, hour: 10, score: 90 }, // Tuesday 10am
    { day: 3, hour: 12, score: 88 }, // Wednesday 12pm
    { day: 4, hour: 9, score: 87 }, // Thursday 9am
    { day: 5, hour: 11, score: 82 }, // Friday 11am
  ],
  instagram: [
    { day: 1, hour: 11, score: 90 }, // Monday 11am
    { day: 2, hour: 10, score: 88 }, // Tuesday 10am
    { day: 3, hour: 11, score: 92 }, // Wednesday 11am (best)
    { day: 5, hour: 10, score: 85 }, // Friday 10am
    { day: 6, hour: 9, score: 80 }, // Saturday 9am
  ],
  linkedin: [
    { day: 2, hour: 10, score: 92 }, // Tuesday 10am (best)
    { day: 3, hour: 12, score: 90 }, // Wednesday 12pm
    { day: 4, hour: 9, score: 88 }, // Thursday 9am
    { day: 1, hour: 7, score: 85 }, // Monday 7am
    { day: 3, hour: 17, score: 82 }, // Wednesday 5pm
  ],
  facebook: [
    { day: 3, hour: 13, score: 90 }, // Wednesday 1pm
    { day: 4, hour: 12, score: 88 }, // Thursday 12pm
    { day: 5, hour: 11, score: 86 }, // Friday 11am
    { day: 1, hour: 9, score: 84 }, // Monday 9am
    { day: 2, hour: 10, score: 82 }, // Tuesday 10am
  ],
  tiktok: [
    { day: 2, hour: 9, score: 92 }, // Tuesday 9am
    { day: 4, hour: 12, score: 90 }, // Thursday 12pm
    { day: 5, hour: 17, score: 88 }, // Friday 5pm
    { day: 6, hour: 11, score: 86 }, // Saturday 11am
    { day: 0, hour: 10, score: 84 }, // Sunday 10am
  ],
  youtube: [
    { day: 4, hour: 15, score: 92 }, // Thursday 3pm
    { day: 5, hour: 15, score: 90 }, // Friday 3pm
    { day: 6, hour: 12, score: 88 }, // Saturday 12pm
    { day: 3, hour: 14, score: 86 }, // Wednesday 2pm
    { day: 0, hour: 11, score: 84 }, // Sunday 11am
  ],
};

class PostingTimePredictor {
  private supabase: SupabaseClient;
  private cache: Map<string, { result: OptimalTimeResult; expiry: number }> = new Map();
  private readonly CACHE_TTL = 3600000; // 1 hour
  private readonly MIN_DATA_POINTS = 10; // Minimum posts needed for reliable prediction

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Get optimal posting times for a user and platform
   */
  async getOptimalTimes(
    userId: string,
    platform: Platform,
    timezone: string = 'UTC'
  ): Promise<OptimalTimeResult> {
    const cacheKey = `${userId}-${platform}-${timezone}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.result;
    }

    try {
      // Fetch historical engagement data
      const engagementData = await this.fetchEngagementData(userId, platform, 90); // Last 90 days

      let slots: TimeSlot[];
      let methodology: 'historical' | 'industry' | 'hybrid';
      let basedOnDataPoints = engagementData.length;

      if (engagementData.length >= this.MIN_DATA_POINTS) {
        // Use ML prediction based on historical data
        slots = this.predictFromHistorical(engagementData);
        methodology = 'historical';
      } else if (engagementData.length > 0) {
        // Hybrid: blend historical with industry data
        const historicalSlots = this.predictFromHistorical(engagementData);
        const industrySlots = this.getIndustrySlots(platform);
        slots = this.blendSlots(historicalSlots, industrySlots, engagementData.length / this.MIN_DATA_POINTS);
        methodology = 'hybrid';
      } else {
        // Fall back to industry standards
        slots = this.getIndustrySlots(platform);
        methodology = 'industry';
        basedOnDataPoints = 0;
      }

      // Adjust for timezone
      slots = this.adjustForTimezone(slots, timezone);

      // Sort by score
      slots.sort((a, b) => b.score - a.score);

      // Calculate next optimal time
      const topSlot = slots[0];
      const nextOptimalTime = this.calculateNextOptimalTime(topSlot, timezone);

      const result: OptimalTimeResult = {
        platform,
        timezone,
        slots: slots.slice(0, 10), // Top 10 slots
        topSlot,
        nextOptimalTime,
        basedOnDataPoints,
        methodology,
      };

      // Cache result
      this.cache.set(cacheKey, { result, expiry: Date.now() + this.CACHE_TTL });

      return result;
    } catch (error: unknown) {
      logger.error('Failed to get optimal posting times:', { error, userId, platform });

      // Return industry fallback on error
      const slots = this.getIndustrySlots(platform);
      const topSlot = slots[0];

      return {
        platform,
        timezone,
        slots,
        topSlot,
        nextOptimalTime: this.calculateNextOptimalTime(topSlot, timezone),
        basedOnDataPoints: 0,
        methodology: 'industry',
      };
    }
  }

  /**
   * Get optimal times for multiple platforms
   */
  async getOptimalTimesMultiPlatform(
    userId: string,
    platforms: Platform[],
    timezone: string = 'UTC'
  ): Promise<Map<Platform, OptimalTimeResult>> {
    const results = new Map<Platform, OptimalTimeResult>();

    await Promise.all(
      platforms.map(async (platform) => {
        const result = await this.getOptimalTimes(userId, platform, timezone);
        results.set(platform, result);
      })
    );

    return results;
  }

  /**
   * Get auto-schedule recommendations for the next week
   */
  async getWeeklySchedule(
    userId: string,
    platform: Platform,
    postsPerWeek: number,
    timezone: string = 'UTC'
  ): Promise<Date[]> {
    const optimalTimes = await this.getOptimalTimes(userId, platform, timezone);
    const scheduledTimes: Date[] = [];
    const now = new Date();

    // Get top slots, evenly distributed
    const slotsToUse = optimalTimes.slots.slice(0, Math.min(postsPerWeek, optimalTimes.slots.length));

    // Calculate actual dates for the next week
    for (let i = 0; i < postsPerWeek; i++) {
      const slot = slotsToUse[i % slotsToUse.length];
      const scheduledTime = this.getNextOccurrence(slot, now, scheduledTimes, timezone);
      scheduledTimes.push(scheduledTime);
    }

    // Sort chronologically
    scheduledTimes.sort((a, b) => a.getTime() - b.getTime());

    return scheduledTimes;
  }

  /**
   * Predict engagement score for a specific time
   */
  async predictEngagementScore(
    userId: string,
    platform: Platform,
    scheduledTime: Date,
    timezone: string = 'UTC'
  ): Promise<{ score: number; confidence: number; recommendation: string }> {
    const optimalTimes = await this.getOptimalTimes(userId, platform, timezone);

    const dayOfWeek = scheduledTime.getDay();
    const hourOfDay = scheduledTime.getHours();

    // Find matching or closest slot
    const matchingSlot = optimalTimes.slots.find(
      s => s.day === dayOfWeek && s.hour === hourOfDay
    );

    if (matchingSlot) {
      return {
        score: matchingSlot.score,
        confidence: matchingSlot.confidence,
        recommendation: matchingSlot.score >= 80
          ? 'Excellent time to post!'
          : matchingSlot.score >= 60
            ? 'Good time to post'
            : 'Consider scheduling for a different time',
      };
    }

    // Calculate score based on proximity to optimal slots
    const closestSlot = this.findClosestSlot(optimalTimes.slots, dayOfWeek, hourOfDay);
    const distance = this.calculateSlotDistance(closestSlot, dayOfWeek, hourOfDay);
    const adjustedScore = Math.max(0, closestSlot.score - (distance * 5));

    return {
      score: adjustedScore,
      confidence: Math.max(0.3, closestSlot.confidence - (distance * 0.1)),
      recommendation: adjustedScore >= 60
        ? 'Reasonable time to post'
        : `Consider posting at ${this.formatTime(closestSlot.hour)} on ${this.getDayName(closestSlot.day)} for better engagement`,
    };
  }

  // ==================== Private Methods ====================

  private async fetchEngagementData(
    userId: string,
    platform: Platform,
    days: number
  ): Promise<EngagementDataPoint[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: posts, error } = await this.supabase
      .from('scheduled_posts')
      .select('published_at, analytics')
      .eq('user_id', userId)
      .eq('platform', platform)
      .eq('status', 'published')
      .gte('published_at', startDate.toISOString())
      .not('analytics', 'is', null);

    if (error || !posts) {
      return [];
    }

    return posts.map(post => {
      const publishedAt = new Date(post.published_at);
      const analytics = post.analytics || {};
      const impressions = analytics.impressions || 1;
      const interactions = (analytics.likes || 0) + (analytics.comments || 0) + (analytics.shares || 0);

      return {
        timestamp: publishedAt,
        dayOfWeek: publishedAt.getDay(),
        hourOfDay: publishedAt.getHours(),
        engagementRate: (interactions / impressions) * 100,
        impressions,
        interactions,
      };
    });
  }

  private predictFromHistorical(data: EngagementDataPoint[]): TimeSlot[] {
    // Group data by day/hour
    const slotData: Map<string, number[]> = new Map();

    data.forEach(point => {
      const key = `${point.dayOfWeek}-${point.hourOfDay}`;
      const existing = slotData.get(key) || [];
      existing.push(point.engagementRate);
      slotData.set(key, existing);
    });

    // Calculate average engagement for each slot
    const slots: TimeSlot[] = [];

    slotData.forEach((rates, key) => {
      const [day, hour] = key.split('-').map(Number);
      const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
      const variance = this.calculateVariance(rates, avgRate);

      // Normalize score to 0-100
      const maxRate = Math.max(...data.map(d => d.engagementRate));
      const score = Math.round((avgRate / maxRate) * 100);

      // Confidence based on sample size and variance
      const sampleConfidence = Math.min(1, rates.length / 5);
      const varianceConfidence = Math.max(0, 1 - (variance / avgRate));
      const confidence = (sampleConfidence + varianceConfidence) / 2;

      slots.push({
        day,
        hour,
        score,
        confidence,
      });
    });

    return slots;
  }

  private getIndustrySlots(platform: Platform): TimeSlot[] {
    const industryData = INDUSTRY_OPTIMAL_TIMES[platform] || INDUSTRY_OPTIMAL_TIMES.instagram;

    return industryData.map(d => ({
      day: d.day,
      hour: d.hour,
      score: d.score,
      confidence: 0.6, // Industry data has moderate confidence
    }));
  }

  private blendSlots(
    historical: TimeSlot[],
    industry: TimeSlot[],
    historicalWeight: number
  ): TimeSlot[] {
    const blended: Map<string, TimeSlot> = new Map();
    const industryWeight = 1 - historicalWeight;

    // Add historical slots
    historical.forEach(slot => {
      const key = `${slot.day}-${slot.hour}`;
      blended.set(key, {
        ...slot,
        score: slot.score * historicalWeight,
        confidence: slot.confidence * historicalWeight,
      });
    });

    // Blend with industry slots
    industry.forEach(slot => {
      const key = `${slot.day}-${slot.hour}`;
      const existing = blended.get(key);

      if (existing) {
        blended.set(key, {
          ...existing,
          score: existing.score + (slot.score * industryWeight),
          confidence: existing.confidence + (slot.confidence * industryWeight),
        });
      } else {
        blended.set(key, {
          ...slot,
          score: slot.score * industryWeight,
          confidence: slot.confidence * industryWeight,
        });
      }
    });

    return Array.from(blended.values());
  }

  private adjustForTimezone(slots: TimeSlot[], timezone: string): TimeSlot[] {
    // For simplicity, we assume slots are in UTC and adjust
    // In production, use a proper timezone library like date-fns-tz
    try {
      const offset = this.getTimezoneOffset(timezone);

      return slots.map(slot => {
        let adjustedHour = slot.hour + offset;
        let adjustedDay = slot.day;

        if (adjustedHour >= 24) {
          adjustedHour -= 24;
          adjustedDay = (adjustedDay + 1) % 7;
        } else if (adjustedHour < 0) {
          adjustedHour += 24;
          adjustedDay = (adjustedDay - 1 + 7) % 7;
        }

        return {
          ...slot,
          hour: adjustedHour,
          day: adjustedDay,
        };
      });
    } catch {
      return slots; // Return unadjusted if timezone handling fails
    }
  }

  private getTimezoneOffset(timezone: string): number {
    // Simplified timezone offsets
    const offsets: Record<string, number> = {
      'UTC': 0,
      'America/New_York': -5,
      'America/Los_Angeles': -8,
      'America/Chicago': -6,
      'Europe/London': 0,
      'Europe/Paris': 1,
      'Asia/Tokyo': 9,
      'Asia/Singapore': 8,
      'Australia/Sydney': 10,
    };

    return offsets[timezone] || 0;
  }

  private calculateNextOptimalTime(slot: TimeSlot, timezone: string): Date {
    const now = new Date();
    const targetDay = slot.day;
    const targetHour = slot.hour;

    const currentDay = now.getDay();
    const currentHour = now.getHours();

    let daysUntil = targetDay - currentDay;
    if (daysUntil < 0 || (daysUntil === 0 && currentHour >= targetHour)) {
      daysUntil += 7;
    }

    const nextTime = new Date(now);
    nextTime.setDate(nextTime.getDate() + daysUntil);
    nextTime.setHours(targetHour, 0, 0, 0);

    return nextTime;
  }

  private getNextOccurrence(
    slot: TimeSlot,
    after: Date,
    excluding: Date[],
    timezone: string
  ): Date {
    const candidate = this.calculateNextOptimalTime(slot, timezone);

    // Ensure it's after the reference time
    while (candidate <= after) {
      candidate.setDate(candidate.getDate() + 7);
    }

    // Ensure it doesn't conflict with existing scheduled times (minimum 1 hour apart)
    while (excluding.some(t => Math.abs(t.getTime() - candidate.getTime()) < 3600000)) {
      candidate.setHours(candidate.getHours() + 1);
    }

    return candidate;
  }

  private findClosestSlot(slots: TimeSlot[], day: number, hour: number): TimeSlot {
    let closest = slots[0];
    let minDistance = Infinity;

    slots.forEach(slot => {
      const distance = this.calculateSlotDistance(slot, day, hour);
      if (distance < minDistance) {
        minDistance = distance;
        closest = slot;
      }
    });

    return closest;
  }

  private calculateSlotDistance(slot: TimeSlot, day: number, hour: number): number {
    const dayDiff = Math.min(
      Math.abs(slot.day - day),
      7 - Math.abs(slot.day - day)
    );
    const hourDiff = Math.abs(slot.hour - hour);
    return dayDiff * 24 + hourDiff;
  }

  private calculateVariance(values: number[], mean: number): number {
    if (values.length <= 1) return 0;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  private formatTime(hour: number): string {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:00 ${ampm}`;
  }

  private getDayName(day: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day];
  }
}

// Export singleton
export const postingTimePredictor = new PostingTimePredictor();
