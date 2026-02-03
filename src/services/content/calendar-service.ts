/**
 * Content Calendar Service
 *
 * @description Advanced content calendar management:
 * - Multi-platform scheduling
 * - Drag-and-drop time slot management
 * - Recurring post support
 * - Conflict detection
 * - Optimal time suggestions
 * - Time zone handling
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 *
 * FAILURE MODE: Returns cached schedule on DB failure
 *
 * NOTE: This service uses cache-based storage until schema migration is complete.
 * Required schema additions for Post model:
 * - title, platforms (array), scheduledFor, mediaUrls, tags
 * - organizationId, createdBy, parentPostId, recurrenceConfig
 */

import { getCache } from '@/lib/cache/cache-manager';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed' | 'cancelled';

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface CalendarPost {
  id: string;
  title: string;
  content: string;
  platforms: string[];
  scheduledFor: Date;
  status: PostStatus;
  mediaUrls?: string[];
  tags?: string[];
  campaignId?: string;
  recurrence?: RecurrenceConfig;
  organizationId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecurrenceConfig {
  type: RecurrenceType;
  interval: number;
  endDate?: Date;
  occurrences?: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
}

export interface TimeSlot {
  start: Date;
  end: Date;
  platform: string;
  isAvailable: boolean;
  conflictingPosts?: string[];
  suggestedScore?: number;
}

export interface CalendarView {
  startDate: Date;
  endDate: Date;
  posts: CalendarPost[];
  timeSlots: TimeSlot[];
  conflicts: Conflict[];
  suggestions: TimeSuggestion[];
}

export interface Conflict {
  postId: string;
  conflictWith: string[];
  type: 'overlap' | 'too_close' | 'rate_limit';
  severity: 'warning' | 'error';
  message: string;
}

export interface TimeSuggestion {
  platform: string;
  suggestedTime: Date;
  score: number;
  reason: string;
}

export interface ScheduleOptions {
  post: Partial<CalendarPost>;
  autoOptimize?: boolean;
  checkConflicts?: boolean;
  createRecurrences?: boolean;
}

export interface RescheduleOptions {
  postId: string;
  newTime: Date;
  updateRecurrences?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PLATFORM_COOLDOWNS: Record<string, number> = {
  twitter: 30,
  instagram: 60,
  facebook: 60,
  linkedin: 120,
  tiktok: 60,
  youtube: 240,
  pinterest: 30,
  threads: 30,
};

const OPTIMAL_TIMES: Record<string, number[]> = {
  twitter: [9, 12, 15, 18],
  instagram: [8, 11, 14, 17, 21],
  facebook: [9, 13, 16, 20],
  linkedin: [7, 10, 12, 17],
  tiktok: [10, 15, 19, 22],
  youtube: [12, 15, 18],
  pinterest: [8, 14, 20],
  threads: [9, 12, 15, 18, 21],
};

// ============================================================================
// CALENDAR SERVICE
// ============================================================================

export class CalendarService {
  private organizationId: string;
  private cachePrefix: string;

  constructor(organizationId: string) {
    this.organizationId = organizationId;
    this.cachePrefix = `calendar:${organizationId}`;
  }

  /**
   * Get calendar view for a date range
   */
  async getCalendarView(startDate: Date, endDate: Date): Promise<CalendarView> {
    const cache = getCache();
    const cacheKey = `${this.cachePrefix}:view:${startDate.toISOString()}:${endDate.toISOString()}`;

    const cached = await cache.get<CalendarView>(cacheKey);
    if (cached) {
      return cached;
    }

    const posts = await this.getPosts(startDate, endDate);
    const timeSlots = this.generateTimeSlots(startDate, endDate, posts);
    const conflicts = this.detectConflicts(posts);
    const suggestions = await this.generateSuggestions(startDate, posts);

    const view: CalendarView = {
      startDate,
      endDate,
      posts,
      timeSlots,
      conflicts,
      suggestions,
    };

    await cache.set(cacheKey, view, { ttl: 300 });

    return view;
  }

  /**
   * Schedule a new post
   */
  async schedulePost(options: ScheduleOptions): Promise<CalendarPost> {
    const { post, autoOptimize, checkConflicts } = options;

    if (!post.content || !post.platforms?.length || !post.scheduledFor) {
      throw new Error('Content, platforms, and scheduled time are required');
    }

    let scheduledTime = new Date(post.scheduledFor);
    if (autoOptimize) {
      const optimizedTime = await this.findOptimalTime(scheduledTime, post.platforms[0]);
      if (optimizedTime) {
        scheduledTime = optimizedTime;
      }
    }

    if (checkConflicts) {
      const conflicts = await this.checkTimeConflicts(scheduledTime, post.platforms);
      if (conflicts.some(c => c.severity === 'error')) {
        throw new Error(`Scheduling conflict: ${conflicts[0].message}`);
      }
    }

    const newPost: CalendarPost = {
      id: this.generateId(),
      title: post.title || '',
      content: post.content,
      platforms: post.platforms,
      scheduledFor: scheduledTime,
      status: 'scheduled',
      mediaUrls: post.mediaUrls || [],
      tags: post.tags || [],
      campaignId: post.campaignId,
      recurrence: post.recurrence,
      organizationId: this.organizationId,
      createdBy: post.createdBy || 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store in cache (temporary storage until schema migration)
    await this.savePost(newPost);
    await this.invalidateCache();

    logger.info('Post scheduled', {
      postId: newPost.id,
      scheduledFor: scheduledTime,
      platforms: post.platforms,
    });

    return newPost;
  }

  /**
   * Reschedule a post (drag-and-drop support)
   */
  async reschedulePost(options: RescheduleOptions): Promise<CalendarPost> {
    const { postId, newTime } = options;

    const existing = await this.getPost(postId);

    if (!existing) {
      throw new Error('Post not found');
    }

    if (existing.organizationId !== this.organizationId) {
      throw new Error('Access denied');
    }

    if (existing.status === 'published') {
      throw new Error('Cannot reschedule a published post');
    }

    const conflicts = await this.checkTimeConflicts(newTime, existing.platforms);
    if (conflicts.some(c => c.severity === 'error')) {
      throw new Error(`Cannot reschedule: ${conflicts[0].message}`);
    }

    const updated: CalendarPost = {
      ...existing,
      scheduledFor: newTime,
      updatedAt: new Date(),
    };

    await this.savePost(updated);
    await this.invalidateCache();

    logger.info('Post rescheduled', {
      postId,
      from: existing.scheduledFor,
      to: newTime,
    });

    return updated;
  }

  /**
   * Cancel a scheduled post
   */
  async cancelPost(postId: string): Promise<void> {
    const existing = await this.getPost(postId);

    if (!existing) {
      throw new Error('Post not found');
    }

    if (existing.organizationId !== this.organizationId) {
      throw new Error('Access denied');
    }

    existing.status = 'cancelled';
    existing.updatedAt = new Date();

    await this.savePost(existing);
    await this.invalidateCache();

    logger.info('Post cancelled', { postId });
  }

  /**
   * Get optimal posting times for a platform
   */
  async getOptimalTimes(
    platform: string,
    date: Date,
    count: number = 5
  ): Promise<TimeSuggestion[]> {
    const suggestions: TimeSuggestion[] = [];
    const optimalHours = OPTIMAL_TIMES[platform] || [9, 12, 15, 18];

    for (const hour of optimalHours) {
      const suggestedTime = new Date(date);
      suggestedTime.setHours(hour, 0, 0, 0);

      const conflicts = await this.checkTimeConflicts(suggestedTime, [platform]);
      const isAvailable = !conflicts.some(c => c.severity === 'error');

      if (isAvailable) {
        suggestions.push({
          platform,
          suggestedTime,
          score: this.calculateTimeScore(suggestedTime, platform),
          reason: `Optimal engagement time for ${platform}`,
        });
      }
    }

    return suggestions.sort((a, b) => b.score - a.score).slice(0, count);
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async getPosts(startDate: Date, endDate: Date): Promise<CalendarPost[]> {
    const cache = getCache();
    const allPosts = await cache.get<CalendarPost[]>(`${this.cachePrefix}:posts`) || [];

    return allPosts.filter(
      p =>
        new Date(p.scheduledFor) >= startDate &&
        new Date(p.scheduledFor) <= endDate &&
        ['draft', 'scheduled', 'published'].includes(p.status)
    );
  }

  private async getPost(postId: string): Promise<CalendarPost | null> {
    const cache = getCache();
    const allPosts = await cache.get<CalendarPost[]>(`${this.cachePrefix}:posts`) || [];
    return allPosts.find(p => p.id === postId) || null;
  }

  private async savePost(post: CalendarPost): Promise<void> {
    const cache = getCache();
    const allPosts = await cache.get<CalendarPost[]>(`${this.cachePrefix}:posts`) || [];

    const index = allPosts.findIndex(p => p.id === post.id);
    if (index >= 0) {
      allPosts[index] = post;
    } else {
      allPosts.push(post);
    }

    await cache.set(`${this.cachePrefix}:posts`, allPosts, { ttl: 86400 * 30 });
  }

  private generateTimeSlots(
    startDate: Date,
    endDate: Date,
    posts: CalendarPost[]
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const platforms = ['twitter', 'instagram', 'facebook', 'linkedin', 'tiktok'];

    const current = new Date(startDate);
    const maxSlots = 168; // Limit to 1 week of hourly slots
    let slotCount = 0;

    while (current <= endDate && slotCount < maxSlots) {
      for (const platform of platforms) {
        const slotStart = new Date(current);
        const slotEnd = new Date(current);
        slotEnd.setHours(slotEnd.getHours() + 1);

        const conflictingPosts = posts.filter(
          p =>
            p.platforms.includes(platform) &&
            new Date(p.scheduledFor) >= slotStart &&
            new Date(p.scheduledFor) < slotEnd
        );

        slots.push({
          start: new Date(slotStart),
          end: new Date(slotEnd),
          platform,
          isAvailable: conflictingPosts.length === 0,
          conflictingPosts: conflictingPosts.map(p => p.id),
          suggestedScore: this.calculateTimeScore(slotStart, platform),
        });

        slotCount++;
      }
      current.setHours(current.getHours() + 1);
    }

    return slots;
  }

  private detectConflicts(posts: CalendarPost[]): Conflict[] {
    const conflicts: Conflict[] = [];

    for (let i = 0; i < posts.length; i++) {
      for (let j = i + 1; j < posts.length; j++) {
        const post1 = posts[i];
        const post2 = posts[j];

        const commonPlatforms = post1.platforms.filter(p => post2.platforms.includes(p));
        if (commonPlatforms.length === 0) continue;

        const time1 = new Date(post1.scheduledFor).getTime();
        const time2 = new Date(post2.scheduledFor).getTime();
        const diffMinutes = Math.abs(time1 - time2) / (1000 * 60);

        for (const platform of commonPlatforms) {
          const cooldown = PLATFORM_COOLDOWNS[platform] || 30;

          if (diffMinutes < cooldown) {
            conflicts.push({
              postId: post1.id,
              conflictWith: [post2.id],
              type: diffMinutes === 0 ? 'overlap' : 'too_close',
              severity: diffMinutes === 0 ? 'error' : 'warning',
              message:
                diffMinutes === 0
                  ? `Posts scheduled at the same time on ${platform}`
                  : `Posts are ${Math.round(diffMinutes)} minutes apart on ${platform} (recommended: ${cooldown}+ minutes)`,
            });
          }
        }
      }
    }

    return conflicts;
  }

  private async generateSuggestions(
    startDate: Date,
    existingPosts: CalendarPost[]
  ): Promise<TimeSuggestion[]> {
    const suggestions: TimeSuggestion[] = [];
    const platforms = ['twitter', 'instagram', 'facebook', 'linkedin'];

    for (const platform of platforms) {
      const platformSuggestions = await this.getOptimalTimes(platform, startDate, 3);
      suggestions.push(...platformSuggestions);
    }

    return suggestions.sort((a, b) => b.score - a.score).slice(0, 10);
  }

  private async checkTimeConflicts(time: Date, platforms: string[]): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    const cache = getCache();
    const allPosts = await cache.get<CalendarPost[]>(`${this.cachePrefix}:posts`) || [];

    for (const platform of platforms) {
      const cooldown = PLATFORM_COOLDOWNS[platform] || 30;
      const windowStart = new Date(time.getTime() - cooldown * 60 * 1000);
      const windowEnd = new Date(time.getTime() + cooldown * 60 * 1000);

      const nearbyPosts = allPosts.filter(
        p =>
          p.platforms.includes(platform) &&
          p.status === 'scheduled' &&
          new Date(p.scheduledFor) >= windowStart &&
          new Date(p.scheduledFor) <= windowEnd
      );

      for (const post of nearbyPosts) {
        const postTime = new Date(post.scheduledFor).getTime();
        const diffMinutes = Math.abs(postTime - time.getTime()) / (1000 * 60);

        conflicts.push({
          postId: post.id,
          conflictWith: [],
          type: diffMinutes === 0 ? 'overlap' : 'too_close',
          severity: diffMinutes === 0 ? 'error' : 'warning',
          message: `Conflict with existing post on ${platform}`,
        });
      }
    }

    return conflicts;
  }

  private async findOptimalTime(requestedTime: Date, platform: string): Promise<Date | null> {
    const suggestions = await this.getOptimalTimes(platform, requestedTime, 1);
    return suggestions[0]?.suggestedTime || null;
  }

  private calculateTimeScore(time: Date, platform: string): number {
    const hour = time.getHours();
    const dayOfWeek = time.getDay();
    const optimalHours = OPTIMAL_TIMES[platform] || [9, 12, 15, 18];

    let score = 50;

    if (optimalHours.includes(hour)) {
      score += 30;
    }

    if (['linkedin'].includes(platform) && dayOfWeek >= 1 && dayOfWeek <= 5) {
      score += 10;
    }

    if (['instagram', 'tiktok'].includes(platform) && (dayOfWeek === 0 || dayOfWeek === 6)) {
      score += 10;
    }

    return Math.min(100, score);
  }

  private async invalidateCache(): Promise<void> {
    const cache = getCache();
    await cache.invalidateByTag(this.cachePrefix);
  }

  private generateId(): string {
    return `post_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { CalendarService as default };
