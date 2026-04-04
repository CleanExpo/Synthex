/**
 * Hooks Index
 *
 * @description Central export point for all custom hooks
 */

// Core API hooks
export {
  useApi,
  useMutation,
  fetchWithAuth,
  getAuthToken,
  type UseApiOptions,
  type UseApiResult,
  type UseMutationOptions,
  type UseMutationResult,
  type ApiRequestOptions,
} from './use-api';

// Dashboard-specific hooks
export {
  // Dashboard
  useDashboardStats,
  // Analytics
  useAnalytics,
  useAnalyticsDashboard,
  useEngagementMetrics,
  useRealtimeAnalytics,
  // Tasks
  useTasks,
  useTask,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  // Activity & Trending
  useActivityFeed,
  useTrendingTopics,
  // Platform
  usePlatformMetrics,
  useAllPlatformMetrics,
  // Content
  useContent,
  useScheduledContent,
  // Team
  useTeamMembers,
  // Types
  type DashboardStats,
  type DashboardData,
  type EngagementData,
  type PlatformData,
  type ActivityItem,
  type TrendingTopic,
  type Task,
  type AnalyticsMetrics,
  type AnalyticsTimeSeriesData,
  type AnalyticsData,
  type ContentItem,
  type TeamMember,
} from './use-dashboard';

// Re-export existing hooks
export { useToast, toast } from './use-toast';
