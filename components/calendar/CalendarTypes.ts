/**
 * Calendar Component Types
 *
 * Shared types for the content calendar system
 */

export interface ScheduledPost {
  id: string;
  title?: string;
  content: string;
  platforms: string[];
  scheduledFor: Date;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  mediaUrls?: string[];
  tags?: string[];
  hashtags?: string[];
  engagement?: {
    estimated?: number;
    actual?: number;
    likes?: number;
    comments?: number;
    shares?: number;
  };
  persona?: string;
  recurrence?: {
    type: 'daily' | 'weekly' | 'monthly' | 'custom';
    interval?: number;
    endDate?: Date;
    daysOfWeek?: number[];
  };
  conflict?: ConflictInfo;
}

export interface ConflictInfo {
  type: 'overlap' | 'too_close' | 'rate_limit';
  severity: 'warning' | 'error';
  message: string;
  conflictingPostId?: string;
}

export interface TimeSlot {
  hour: number;
  date: Date;
  posts: ScheduledPost[];
  isOptimal?: boolean;
}

export interface CalendarViewProps {
  posts: ScheduledPost[];
  currentDate: Date;
  onPostClick?: (post: ScheduledPost) => void;
  onPostReschedule?: (postId: string, newTime: Date) => void;
  onPostCreate?: (date: Date, hour: number) => void;
  optimalTimes?: Record<string, number[]>;
  conflicts?: ConflictInfo[];
}

export interface DragItem {
  id: string;
  type: 'post';
  post: ScheduledPost;
}

export type ViewMode = 'month' | 'week' | 'day' | 'list';

// Platform colors for visual consistency
export const PLATFORM_COLORS: Record<string, string> = {
  twitter: '#1DA1F2',
  linkedin: '#0A66C2',
  instagram: '#E4405F',
  facebook: '#1877F2',
  tiktok: '#000000',
  youtube: '#FF0000',
};

// Platform cooldown windows (minutes)
export const PLATFORM_COOLDOWNS: Record<string, number> = {
  twitter: 30,
  linkedin: 120,
  instagram: 60,
  facebook: 90,
  tiktok: 45,
  youtube: 240,
};

// Optimal posting times by platform (24-hour format)
export const OPTIMAL_TIMES: Record<string, number[]> = {
  twitter: [9, 12, 15, 18],
  linkedin: [7, 10, 12, 17],
  instagram: [8, 11, 14, 17, 21],
  facebook: [9, 13, 16, 20],
  tiktok: [10, 15, 19, 22],
  youtube: [12, 15, 18, 21],
};
