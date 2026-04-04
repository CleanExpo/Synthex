/**
 * Schedule Types
 * Type definitions for content scheduling
 */

import type { ScheduledPost } from '@/components/calendar';

export type ViewMode = 'week' | 'month' | 'list';

export interface ScheduleStats {
  scheduled: number;
  published: number;
  draft: number;
  avgEngagement: number;
}

export interface ScheduleFilters {
  platform: string;
  status: string;
}

export type { ScheduledPost };
