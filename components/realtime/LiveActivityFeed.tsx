'use client';

/**
 * Live Activity Feed Component
 *
 * Real-time activity stream showing team actions, post updates,
 * engagement metrics, and system events.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Activity,
  User,
  MessageSquare,
  Heart,
  Share2,
  Send,
  Calendar,
  Edit,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Bell,
  TrendingUp,
  Users,
} from '@/components/icons';
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

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: Date;
  userId?: string;
  userName?: string;
  userAvatar?: string;
  metadata?: Record<string, unknown>;
  platform?: string;
  actionUrl?: string;
}

interface LiveActivityFeedProps {
  userId?: string;
  teamId?: string;
  maxItems?: number;
  showTimestamps?: boolean;
  showAvatars?: boolean;
  className?: string;
  emptyMessage?: string;
  onActivityClick?: (activity: ActivityItem) => void;
}

// ============================================================================
// ICON MAPPING
// ============================================================================

const activityIcons: Record<ActivityType, React.ReactNode> = {
  post_created: <Edit className="h-4 w-4 text-blue-400" />,
  post_published: <Send className="h-4 w-4 text-green-400" />,
  post_scheduled: <Calendar className="h-4 w-4 text-purple-400" />,
  post_edited: <Edit className="h-4 w-4 text-yellow-400" />,
  post_deleted: <Trash2 className="h-4 w-4 text-red-400" />,
  engagement_spike: <TrendingUp className="h-4 w-4 text-green-400" />,
  new_follower: <User className="h-4 w-4 text-blue-400" />,
  comment_received: <MessageSquare className="h-4 w-4 text-purple-400" />,
  mention: <Bell className="h-4 w-4 text-yellow-400" />,
  team_member_joined: <Users className="h-4 w-4 text-green-400" />,
  team_member_action: <Activity className="h-4 w-4 text-blue-400" />,
  system_alert: <AlertTriangle className="h-4 w-4 text-orange-400" />,
  campaign_started: <CheckCircle className="h-4 w-4 text-green-400" />,
  campaign_ended: <CheckCircle className="h-4 w-4 text-gray-400" />,
  milestone_reached: <TrendingUp className="h-4 w-4 text-yellow-400" />,
};

const activityColors: Record<ActivityType, string> = {
  post_created: 'border-blue-500/30 bg-blue-500/10',
  post_published: 'border-green-500/30 bg-green-500/10',
  post_scheduled: 'border-purple-500/30 bg-purple-500/10',
  post_edited: 'border-yellow-500/30 bg-yellow-500/10',
  post_deleted: 'border-red-500/30 bg-red-500/10',
  engagement_spike: 'border-green-500/30 bg-green-500/10',
  new_follower: 'border-blue-500/30 bg-blue-500/10',
  comment_received: 'border-purple-500/30 bg-purple-500/10',
  mention: 'border-yellow-500/30 bg-yellow-500/10',
  team_member_joined: 'border-green-500/30 bg-green-500/10',
  team_member_action: 'border-blue-500/30 bg-blue-500/10',
  system_alert: 'border-orange-500/30 bg-orange-500/10',
  campaign_started: 'border-green-500/30 bg-green-500/10',
  campaign_ended: 'border-gray-500/30 bg-gray-500/10',
  milestone_reached: 'border-yellow-500/30 bg-yellow-500/10',
};

// ============================================================================
// COMPONENT
// ============================================================================

export function LiveActivityFeed({
  userId,
  teamId,
  maxItems = 20,
  showTimestamps = true,
  showAvatars = true,
  className = '',
  emptyMessage = 'No recent activity',
  onActivityClick,
}: LiveActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  // Format relative time
  const formatTime = useCallback((date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 10) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  }, []);

  // Add new activity with animation
  const addActivity = useCallback(
    (activity: ActivityItem) => {
      setActivities((prev) => {
        // Prevent duplicates
        if (prev.some((a) => a.id === activity.id)) return prev;

        // Add to top and limit size
        const updated = [activity, ...prev].slice(0, maxItems);
        return updated;
      });
    },
    [maxItems]
  );

  // Handle incoming real-time message
  const handleMessage = useCallback(
    (message: RealtimeMessage) => {
      const activity: ActivityItem = {
        id: message.id,
        type: (message.metadata?.activityType as ActivityType) || 'team_member_action',
        title: message.title || 'Activity',
        description: message.content,
        timestamp: message.timestamp,
        userId: message.userId,
        userName: message.metadata?.userName as string,
        userAvatar: message.metadata?.userAvatar as string,
        metadata: message.metadata,
        platform: message.metadata?.platform as string,
        actionUrl: message.metadata?.actionUrl as string,
      };

      addActivity(activity);
    },
    [addActivity]
  );

  // Set up real-time subscription
  useEffect(() => {
    const channelName = teamId
      ? `activity:team:${teamId}`
      : userId
      ? `activity:user:${userId}`
      : 'activity:global';

    const setup = async () => {
      const channel = await realtimeService.subscribeToChannel(channelName, {
        onMessage: handleMessage,
        onUpdate: (payload) => {
          // Handle database changes
          if (payload.table === 'content_posts') {
            const eventType = payload.eventType;
            const post = payload.new || payload.old;

            const activity: ActivityItem = {
              id: `post-${post.id}-${Date.now()}`,
              type:
                eventType === 'INSERT'
                  ? 'post_created'
                  : eventType === 'UPDATE'
                  ? post.status === 'published'
                    ? 'post_published'
                    : 'post_edited'
                  : 'post_deleted',
              title:
                eventType === 'INSERT'
                  ? 'New post created'
                  : eventType === 'UPDATE'
                  ? 'Post updated'
                  : 'Post deleted',
              description: post.content?.slice(0, 100) || 'Content update',
              timestamp: new Date(),
              platform: post.platform,
              metadata: { postId: post.id },
            };

            addActivity(activity);
          }
        },
      });

      if (channel) {
        setIsConnected(true);
      }
    };

    setup();

    return () => {
      realtimeService.unsubscribe(channelName);
      setIsConnected(false);
    };
  }, [userId, teamId, handleMessage, addActivity]);

  // Add demo activities for development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && activities.length === 0) {
      const demoActivities: ActivityItem[] = [
        {
          id: 'demo-1',
          type: 'post_published',
          title: 'Post Published',
          description: 'Your scheduled post has been published to Twitter',
          timestamp: new Date(Date.now() - 60000),
          platform: 'twitter',
        },
        {
          id: 'demo-2',
          type: 'engagement_spike',
          title: 'Engagement Spike',
          description: 'Your LinkedIn post is getting 3x more engagement than usual',
          timestamp: new Date(Date.now() - 300000),
          platform: 'linkedin',
        },
        {
          id: 'demo-3',
          type: 'new_follower',
          title: 'New Followers',
          description: '+24 new followers on Instagram today',
          timestamp: new Date(Date.now() - 600000),
          platform: 'instagram',
        },
        {
          id: 'demo-4',
          type: 'comment_received',
          title: 'New Comment',
          description: '@john_doe commented on your recent post',
          timestamp: new Date(Date.now() - 900000),
          userName: 'John Doe',
        },
        {
          id: 'demo-5',
          type: 'milestone_reached',
          title: 'Milestone Reached!',
          description: 'You reached 10,000 total followers across all platforms',
          timestamp: new Date(Date.now() - 1800000),
        },
      ];
      setActivities(demoActivities);
    }
  }, [activities.length]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-purple-400" />
          <h3 className="font-semibold text-white">Live Activity</h3>
        </div>
        <div className="flex items-center gap-2">
          {isConnected && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Live
            </span>
          )}
        </div>
      </div>

      {/* Activity Feed */}
      <div ref={feedRef} className="flex-1 overflow-y-auto">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
            <Activity className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-center">{emptyMessage}</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {activities.map((activity, index) => (
              <div
                key={activity.id}
                onClick={() => onActivityClick?.(activity)}
                className={`
                  p-4 hover:bg-white/5 transition-all duration-200 cursor-pointer
                  ${index === 0 ? 'animate-slideIn' : ''}
                `}
                style={{
                  animationDelay: index === 0 ? '0ms' : undefined,
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className={`
                      flex-shrink-0 p-2 rounded-lg border
                      ${activityColors[activity.type]}
                    `}
                  >
                    {activityIcons[activity.type]}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-white">
                        {activity.title}
                      </p>
                      {showTimestamps && (
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {formatTime(activity.timestamp)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mt-0.5 line-clamp-2">
                      {activity.description}
                    </p>

                    {/* Platform Badge */}
                    {activity.platform && (
                      <span
                        className={`
                          inline-flex items-center mt-2 px-2 py-0.5 rounded text-xs
                          bg-white/5 text-gray-400 capitalize
                        `}
                      >
                        {activity.platform}
                      </span>
                    )}
                  </div>

                  {/* Avatar */}
                  {showAvatars && activity.userAvatar && (
                    <img
                      src={activity.userAvatar}
                      alt={activity.userName || 'User'}
                      className="w-8 h-8 rounded-full border border-white/10"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-white/10 text-center">
        <button className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
          View all activity
        </button>
      </div>

      {/* Animation styles */}
      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

export default LiveActivityFeed;
