/**
 * Dashboard Data Fetching Hooks
 *
 * @description Specialized hooks for dashboard data:
 * - Dashboard stats
 * - Analytics data
 * - Tasks management
 * - Activity feed
 * - Platform metrics
 *
 * Uses the useApi hook for consistent caching and revalidation
 */

'use client';

import { useApi, useMutation, fetchWithAuth, UseApiOptions } from './use-api';
import type { PerformanceData } from '@/components/analytics/types';

// ============================================================================
// TYPES
// ============================================================================

export interface DashboardStats {
  totalPosts: number;
  scheduledPosts: number;
  engagementRate: number;
  followers: number;
  followersChange: number;
  postsChange: number;
  engagementChange: number;
}

export interface EngagementData {
  name: string;
  likes: number;
  comments: number;
  shares: number;
}

export interface PlatformData {
  platform: string;
  engagement: number;
  followers: number;
  color: string;
}

export interface ActivityItem {
  id: string;
  type: 'post' | 'engagement' | 'follower' | 'campaign' | 'comment';
  title: string;
  description: string;
  timestamp: string;
  platform?: string;
  metadata?: Record<string, unknown>;
}

export interface TrendingTopic {
  id: string;
  topic: string;
  volume: number;
  change: number;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface DashboardData {
  stats: DashboardStats;
  engagementData: EngagementData[];
  platformData: PlatformData[];
  recentActivity: ActivityItem[];
  trendingTopics: TrendingTopic[];
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  type: 'content' | 'campaign' | 'analytics' | 'admin' | 'other';
  dueDate?: string;
  assignee?: {
    id: string;
    name: string;
    avatar?: string;
  };
  tags?: string[];
  subtasks?: { id: string; title: string; completed: boolean }[];
  comments?: { id: string; text: string; author: string; createdAt: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsMetrics {
  impressions: number;
  reach: number;
  engagement: number;
  clicks: number;
  conversions: number;
  shares: number;
}

export interface AnalyticsTimeSeriesData {
  date: string;
  impressions: number;
  engagement: number;
  followers: number;
}

export interface AnalyticsData {
  metrics: AnalyticsMetrics;
  timeSeries: AnalyticsTimeSeriesData[];
  platformBreakdown: PlatformData[];
  topPosts: {
    id: string;
    title: string;
    platform: string;
    engagement: number;
    impressions: number;
  }[];
}

// ============================================================================
// DASHBOARD STATS HOOK
// ============================================================================

export function useDashboardStats(options?: UseApiOptions<DashboardData>) {
  return useApi<DashboardData>('/api/dashboard/stats', {
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 5 * 60 * 1000, // 5 minutes
    revalidateOnFocus: true,
    ...options,
  });
}

// ============================================================================
// ANALYTICS HOOKS
// ============================================================================

export function useAnalytics(
  period: 'day' | 'week' | 'month' | 'year' = 'week',
  options?: UseApiOptions<AnalyticsData>
) {
  return useApi<AnalyticsData>(`/api/analytics?period=${period}`, {
    staleTime: 60 * 1000, // 1 minute
    cacheTime: 10 * 60 * 1000, // 10 minutes
    ...options,
    deps: [period, ...(options?.deps || [])],
  });
}

export function useAnalyticsDashboard(options?: UseApiOptions<AnalyticsData>) {
  return useApi<AnalyticsData>('/api/analytics/dashboard', {
    staleTime: 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    ...options,
  });
}

export function useEngagementMetrics(
  platform?: string,
  options?: UseApiOptions<EngagementData[]>
) {
  const url = platform
    ? `/api/analytics/engagement?platform=${platform}`
    : '/api/analytics/engagement';

  return useApi<EngagementData[]>(url, {
    staleTime: 30 * 1000,
    cacheTime: 5 * 60 * 1000,
    ...options,
    deps: [platform, ...(options?.deps || [])],
  });
}

export function useRealtimeAnalytics(options?: UseApiOptions<AnalyticsMetrics>) {
  return useApi<AnalyticsMetrics>('/api/analytics/realtime', {
    staleTime: 10 * 1000, // 10 seconds
    pollingInterval: 30 * 1000, // Poll every 30 seconds
    ...options,
  });
}

export interface PerformanceAnalyticsParams {
  period?: string;
  platform?: string;
  startDate?: string;
  endDate?: string;
  granularity?: string;
}

export function usePerformanceAnalytics(
  params: PerformanceAnalyticsParams = {},
  options?: UseApiOptions<{ success: boolean; data: PerformanceData; period: { start: string; end: string }; generatedAt: string }>
) {
  const { period = '30d', platform, startDate, endDate, granularity = 'day' } = params;
  const searchParams = new URLSearchParams();

  if (startDate && endDate) {
    searchParams.set('startDate', startDate);
    searchParams.set('endDate', endDate);
  } else {
    // Map period values to API-supported values
    const periodMap: Record<string, string> = {
      '24h': '7d',
      '7d': '7d',
      '30d': '30d',
      '90d': '90d',
      '1y': '1y',
    };
    searchParams.set('period', periodMap[period] || '30d');
  }

  if (platform && platform !== 'all') {
    searchParams.set('platform', platform);
  }
  searchParams.set('granularity', granularity);

  const url = `/api/analytics/performance?${searchParams.toString()}`;

  return useApi<{ success: boolean; data: PerformanceData; period: { start: string; end: string }; generatedAt: string }>(url, {
    staleTime: 60 * 1000, // 1 minute
    cacheTime: 10 * 60 * 1000, // 10 minutes
    ...options,
    deps: [period, platform, startDate, endDate, granularity, ...(options?.deps || [])],
  });
}

// ============================================================================
// TASKS HOOKS
// ============================================================================

export function useTasks(
  filters?: {
    status?: Task['status'];
    priority?: Task['priority'];
    type?: Task['type'];
    search?: string;
  },
  options?: UseApiOptions<Task[]>
) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.priority) params.set('priority', filters.priority);
  if (filters?.type) params.set('type', filters.type);
  if (filters?.search) params.set('search', filters.search);

  const queryString = params.toString();
  const url = queryString ? `/api/tasks?${queryString}` : '/api/tasks';

  return useApi<Task[]>(url, {
    staleTime: 30 * 1000,
    cacheTime: 5 * 60 * 1000,
    ...options,
    deps: [
      filters?.status,
      filters?.priority,
      filters?.type,
      filters?.search,
      ...(options?.deps || []),
    ],
  });
}

export function useTask(taskId: string | null, options?: UseApiOptions<Task>) {
  return useApi<Task>(taskId ? `/api/tasks/${taskId}` : null, {
    skip: !taskId,
    staleTime: 30 * 1000,
    cacheTime: 5 * 60 * 1000,
    ...options,
  });
}

export function useCreateTask() {
  return useMutation(
    async (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
      return fetchWithAuth<Task>('/api/tasks', {
        method: 'POST',
        body: task,
      });
    }
  );
}

export function useUpdateTask() {
  return useMutation(
    async ({ id, ...updates }: Partial<Task> & { id: string }) => {
      return fetchWithAuth<Task>(`/api/tasks/${id}`, {
        method: 'PATCH',
        body: updates,
      });
    }
  );
}

export function useDeleteTask() {
  return useMutation(async (taskId: string) => {
    return fetchWithAuth<{ success: boolean }>(`/api/tasks/${taskId}`, {
      method: 'DELETE',
    });
  });
}

// ============================================================================
// ACTIVITY FEED HOOK
// ============================================================================

export function useActivityFeed(
  limit: number = 10,
  options?: UseApiOptions<ActivityItem[]>
) {
  return useApi<ActivityItem[]>(`/api/activity?limit=${limit}`, {
    staleTime: 30 * 1000,
    cacheTime: 5 * 60 * 1000,
    revalidateOnFocus: true,
    ...options,
    deps: [limit, ...(options?.deps || [])],
  });
}

// ============================================================================
// TRENDING TOPICS HOOK
// ============================================================================

export function useTrendingTopics(options?: UseApiOptions<TrendingTopic[]>) {
  return useApi<TrendingTopic[]>('/api/trending', {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 15 * 60 * 1000, // 15 minutes
    ...options,
  });
}

// ============================================================================
// PLATFORM METRICS HOOK
// ============================================================================

export function usePlatformMetrics(
  platform: string,
  options?: UseApiOptions<PlatformData>
) {
  return useApi<PlatformData>(`/api/platforms/${platform}/metrics`, {
    staleTime: 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    skip: !platform,
    ...options,
    deps: [platform, ...(options?.deps || [])],
  });
}

export function useAllPlatformMetrics(options?: UseApiOptions<PlatformData[]>) {
  return useApi<PlatformData[]>('/api/platforms/metrics', {
    staleTime: 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    ...options,
  });
}

// ============================================================================
// CONTENT HOOKS
// ============================================================================

export interface ContentItem {
  id: string;
  title: string;
  content: string;
  platform: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  scheduledFor?: string;
  publishedAt?: string;
  metrics?: {
    likes: number;
    comments: number;
    shares: number;
    impressions: number;
  };
  createdAt: string;
  updatedAt: string;
}

export function useContent(
  filters?: {
    status?: ContentItem['status'];
    platform?: string;
  },
  options?: UseApiOptions<ContentItem[]>
) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.platform) params.set('platform', filters.platform);

  const queryString = params.toString();
  const url = queryString ? `/api/content?${queryString}` : '/api/content';

  return useApi<ContentItem[]>(url, {
    staleTime: 30 * 1000,
    cacheTime: 5 * 60 * 1000,
    ...options,
    deps: [filters?.status, filters?.platform, ...(options?.deps || [])],
  });
}

export function useScheduledContent(options?: UseApiOptions<ContentItem[]>) {
  return useContent({ status: 'scheduled' }, options);
}

// ============================================================================
// TEAM HOOKS
// ============================================================================

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  avatar?: string;
  lastActive?: string;
  stats?: {
    posts: number;
    engagement: number;
  };
}

export function useTeamMembers(options?: UseApiOptions<TeamMember[]>) {
  return useApi<TeamMember[]>('/api/team', {
    staleTime: 5 * 60 * 1000,
    cacheTime: 15 * 60 * 1000,
    ...options,
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  useApi,
  useMutation,
  fetchWithAuth,
} from './use-api';
