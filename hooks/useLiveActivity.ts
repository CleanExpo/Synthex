/**
 * Live Activity Hook
 *
 * @description Hook for subscribing to real-time activity updates.
 * Combines WebSocket, SSE, and Supabase realtime for comprehensive
 * activity tracking.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL (PUBLIC)
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY: Supabase anonymous key (PUBLIC)
 *
 * FAILURE MODE: Falls back to polling on subscription failure
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { realtimeService, RealtimeMessage } from '@/lib/realtime';

// ============================================================================
// TYPES
// ============================================================================

export type ActivityType =
  | 'post_created'
  | 'post_published'
  | 'post_scheduled'
  | 'post_edited'
  | 'post_deleted'
  | 'engagement_spike'
  | 'new_follower'
  | 'comment_received'
  | 'mention'
  | 'team_member_joined'
  | 'team_member_action'
  | 'system_alert'
  | 'campaign_started'
  | 'campaign_ended'
  | 'milestone_reached';

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: Date;
  userId?: string;
  userName?: string;
  userAvatar?: string;
  platform?: string;
  metadata?: Record<string, unknown>;
  read?: boolean;
}

export interface UseLiveActivityOptions {
  /**
   * User ID to filter activities
   */
  userId?: string;

  /**
   * Team ID to filter activities
   */
  teamId?: string;

  /**
   * Activity types to subscribe to
   */
  types?: ActivityType[];

  /**
   * Maximum number of activities to keep in memory
   * @default 50
   */
  maxActivities?: number;

  /**
   * Enable real-time updates
   * @default true
   */
  enableRealtime?: boolean;

  /**
   * Polling fallback interval (ms)
   * @default 30000
   */
  pollingInterval?: number;

  /**
   * Callback when new activity is received
   */
  onActivity?: (activity: Activity) => void;
}

export interface UseLiveActivityReturn {
  activities: Activity[];
  isConnected: boolean;
  isLoading: boolean;
  error: Error | null;
  addActivity: (activity: Activity) => void;
  clearActivities: () => void;
  markAsRead: (activityId: string) => void;
  refresh: () => Promise<void>;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useLiveActivity(
  options: UseLiveActivityOptions = {}
): UseLiveActivityReturn {
  const {
    userId,
    teamId,
    types,
    maxActivities = 50,
    enableRealtime = true,
    pollingInterval = 30000,
    onActivity,
  } = options;

  const [activities, setActivities] = useState<Activity[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mountedRef = useRef(true);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Add activity to the list
   */
  const addActivity = useCallback(
    (activity: Activity) => {
      if (!mountedRef.current) return;

      // Filter by type if specified
      if (types && !types.includes(activity.type)) return;

      setActivities((prev) => {
        // Prevent duplicates
        if (prev.some((a) => a.id === activity.id)) return prev;

        // Add to start and limit size
        const updated = [activity, ...prev].slice(0, maxActivities);
        return updated;
      });

      // Call callback
      onActivity?.(activity);
    },
    [types, maxActivities, onActivity]
  );

  /**
   * Clear all activities
   */
  const clearActivities = useCallback(() => {
    setActivities([]);
  }, []);

  /**
   * Mark activity as read
   */
  const markAsRead = useCallback((activityId: string) => {
    setActivities((prev) =>
      prev.map((a) => (a.id === activityId ? { ...a, read: true } : a))
    );
  }, []);

  /**
   * Fetch activities from API
   */
  const fetchActivities = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      setIsLoading(true);

      const params = new URLSearchParams();
      if (userId) params.set('userId', userId);
      if (teamId) params.set('teamId', teamId);
      if (types?.length) params.set('types', types.join(','));
      params.set('limit', maxActivities.toString());

      const response = await fetch(`/api/activity?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        // API might not exist yet, that's okay
        if (response.status === 404) {
          return;
        }
        throw new Error(`Failed to fetch activities: ${response.status}`);
      }

      const data = await response.json();

      if (mountedRef.current && data.activities) {
        setActivities(
          data.activities.map((a: any) => ({
            ...a,
            timestamp: new Date(a.timestamp),
          }))
        );
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err as Error);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [userId, teamId, types, maxActivities]);

  /**
   * Handle real-time message
   */
  const handleMessage = useCallback(
    (message: RealtimeMessage) => {
      const activity: Activity = {
        id: message.id,
        type: (message.metadata?.activityType as ActivityType) || 'team_member_action',
        title: message.title || 'Activity',
        description: message.content,
        timestamp: message.timestamp,
        userId: message.userId,
        userName: message.metadata?.userName as string,
        userAvatar: message.metadata?.userAvatar as string,
        platform: message.metadata?.platform as string,
        metadata: message.metadata,
        read: false,
      };

      addActivity(activity);
    },
    [addActivity]
  );

  /**
   * Set up real-time subscription
   */
  useEffect(() => {
    if (!enableRealtime) return;

    mountedRef.current = true;

    const channelName = teamId
      ? `activity:team:${teamId}`
      : userId
      ? `activity:user:${userId}`
      : 'activity:global';

    const setup = async () => {
      try {
        const channel = await realtimeService.subscribeToChannel(channelName, {
          onMessage: handleMessage,
          onUpdate: (payload) => {
            // Handle database changes for posts
            if (payload.table === 'content_posts' || payload.table === 'posts') {
              const eventType = payload.eventType;
              const post = payload.new || payload.old;

              let activityType: ActivityType = 'post_edited';
              let title = 'Post updated';

              if (eventType === 'INSERT') {
                activityType = 'post_created';
                title = 'New post created';
              } else if (eventType === 'DELETE') {
                activityType = 'post_deleted';
                title = 'Post deleted';
              } else if (post?.status === 'published') {
                activityType = 'post_published';
                title = 'Post published';
              } else if (post?.status === 'scheduled') {
                activityType = 'post_scheduled';
                title = 'Post scheduled';
              }

              addActivity({
                id: `post-${post?.id || Date.now()}-${Date.now()}`,
                type: activityType,
                title,
                description: post?.content?.slice(0, 100) || 'Content update',
                timestamp: new Date(),
                platform: post?.platform,
                metadata: { postId: post?.id },
              });
            }

            // Handle engagement changes
            if (payload.table === 'platform_metrics') {
              const metrics = payload.new;
              if (metrics?.likes > 100 || metrics?.comments > 50) {
                addActivity({
                  id: `engagement-${Date.now()}`,
                  type: 'engagement_spike',
                  title: 'Engagement Spike!',
                  description: `Your post is getting ${metrics.likes} likes and ${metrics.comments} comments`,
                  timestamp: new Date(),
                  platform: metrics?.platform,
                });
              }
            }
          },
        });

        if (channel && mountedRef.current) {
          setIsConnected(true);
          setError(null);
        }
      } catch (err) {
        if (mountedRef.current) {
          console.error('Failed to setup realtime:', err);
          setIsConnected(false);

          // Start polling fallback
          if (!pollingRef.current) {
            pollingRef.current = setInterval(fetchActivities, pollingInterval);
          }
        }
      }
    };

    setup();

    return () => {
      mountedRef.current = false;
      realtimeService.unsubscribe(channelName);
      setIsConnected(false);

      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [
    userId,
    teamId,
    enableRealtime,
    handleMessage,
    addActivity,
    fetchActivities,
    pollingInterval,
  ]);

  /**
   * Initial fetch
   */
  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  return {
    activities,
    isConnected,
    isLoading,
    error,
    addActivity,
    clearActivities,
    markAsRead,
    refresh: fetchActivities,
  };
}

export default useLiveActivity;
