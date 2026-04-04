/**
 * Competitor Tracking Hook
 *
 * @description Hook for competitor tracking and monitoring:
 * - List and manage tracked competitors
 * - View competitor snapshots and trends
 * - Monitor competitor posts
 * - Manage alerts
 *
 * Usage:
 * ```tsx
 * const {
 *   competitors, alerts, isLoading,
 *   addCompetitor, removeCompetitor,
 *   triggerSnapshot, markAlertsRead
 * } = useCompetitorTracking();
 * ```
 */

'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================

export interface TrackedCompetitor {
  id: string;
  name: string;
  domain?: string;
  logoUrl?: string;
  description?: string;
  industry?: string;
  twitterHandle?: string;
  instagramHandle?: string;
  linkedinHandle?: string;
  facebookHandle?: string;
  youtubeHandle?: string;
  tiktokHandle?: string;
  isActive: boolean;
  trackPosts: boolean;
  trackMetrics: boolean;
  trackingFrequency: 'hourly' | 'daily' | 'weekly';
  alertsEnabled: boolean;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  lastTrackedAt?: string;
  latestSnapshot?: CompetitorSnapshot;
  unreadAlerts?: number;
}

export interface CompetitorSnapshot {
  id: string;
  competitorId: string;
  platform: string;
  followersCount?: number;
  followingCount?: number;
  followerGrowth?: number;
  totalPosts?: number;
  avgLikes?: number;
  avgComments?: number;
  avgShares?: number;
  engagementRate?: number;
  postFrequency?: number;
  topHashtags?: string[];
  contentTypes?: Record<string, number>;
  postingTimes?: Record<string, number>;
  performanceScore?: number;
  growthScore?: number;
  engagementScore?: number;
  snapshotAt: string;
  dataSource: string;
}

export interface CompetitorPost {
  id: string;
  competitorId: string;
  platform: string;
  externalId?: string;
  postUrl?: string;
  content?: string;
  mediaUrls?: string[];
  mediaType?: string;
  likes: number;
  comments: number;
  shares: number;
  views?: number;
  saves?: number;
  engagementRate?: number;
  sentiment?: string;
  hashtags?: string[];
  mentions?: string[];
  topics?: string[];
  isTopPerforming: boolean;
  performancePercentile?: number;
  postedAt?: string;
  trackedAt: string;
}

export interface CompetitorAlert {
  id: string;
  userId: string;
  competitorId: string;
  alertType: string;
  severity: 'info' | 'warning' | 'important';
  title: string;
  description: string;
  relatedPostId?: string;
  metrics?: Record<string, any>;
  isRead: boolean;
  isDismissed: boolean;
  actionTaken?: string;
  createdAt: string;
  readAt?: string;
  competitor?: {
    id: string;
    name: string;
    logoUrl?: string;
  };
}

export interface AddCompetitorInput {
  name: string;
  domain?: string;
  description?: string;
  industry?: string;
  twitterHandle?: string;
  instagramHandle?: string;
  linkedinHandle?: string;
  facebookHandle?: string;
  youtubeHandle?: string;
  tiktokHandle?: string;
  trackingFrequency?: 'hourly' | 'daily' | 'weekly';
  tags?: string[];
  notes?: string;
}

export interface UpdateCompetitorInput {
  name?: string;
  description?: string;
  industry?: string;
  twitterHandle?: string | null;
  instagramHandle?: string | null;
  linkedinHandle?: string | null;
  facebookHandle?: string | null;
  youtubeHandle?: string | null;
  tiktokHandle?: string | null;
  isActive?: boolean;
  trackPosts?: boolean;
  trackMetrics?: boolean;
  trackingFrequency?: 'hourly' | 'daily' | 'weekly';
  alertsEnabled?: boolean;
  tags?: string[];
  notes?: string | null;
}

export interface UseCompetitorTrackingReturn {
  isLoading: boolean;
  error: Error | null;
  listCompetitors: (options?: {
    active?: boolean;
    industry?: string;
    limit?: number;
    offset?: number;
  }) => Promise<{ competitors: TrackedCompetitor[]; total: number } | null>;
  getCompetitor: (id: string) => Promise<{
    competitor: TrackedCompetitor & {
      snapshots: CompetitorSnapshot[];
      posts: CompetitorPost[];
      alerts: CompetitorAlert[];
      trends?: {
        followersChange?: number;
        engagementChange?: number;
        performanceChange?: number;
      };
      topPosts?: CompetitorPost[];
    };
  } | null>;
  addCompetitor: (data: AddCompetitorInput) => Promise<TrackedCompetitor | null>;
  updateCompetitor: (id: string, data: UpdateCompetitorInput) => Promise<TrackedCompetitor | null>;
  removeCompetitor: (id: string) => Promise<boolean>;
  triggerSnapshot: (competitorId: string) => Promise<{
    snapshots: CompetitorSnapshot[];
    platformsTracked: string[];
  } | null>;
  getSnapshots: (
    competitorId: string,
    options?: { platform?: string; days?: number }
  ) => Promise<{
    snapshots: CompetitorSnapshot[];
    trends: Record<string, any>;
  } | null>;
  listAlerts: (options?: {
    competitorId?: string;
    type?: string;
    read?: boolean;
    severity?: string;
    limit?: number;
  }) => Promise<{
    alerts: CompetitorAlert[];
    total: number;
    unreadCount: number;
  } | null>;
  markAlertsRead: (alertIds: string[]) => Promise<boolean>;
  dismissAlerts: (alertIds: string[], actionTaken?: string) => Promise<boolean>;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useCompetitorTracking(): UseCompetitorTrackingReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * List tracked competitors
   */
  const listCompetitors = useCallback(
    async (options?: {
      active?: boolean;
      industry?: string;
      limit?: number;
      offset?: number;
    }): Promise<{ competitors: TrackedCompetitor[]; total: number } | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (options?.active !== undefined) params.set('active', String(options.active));
        if (options?.industry) params.set('industry', options.industry);
        if (options?.limit) params.set('limit', String(options.limit));
        if (options?.offset) params.set('offset', String(options.offset));

        const response = await fetch(`/api/competitors/track?${params}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to list competitors');
        }

        return await response.json();
      } catch (err) {
        setError(err as Error);
        toast.error((err as Error).message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Get competitor details
   */
  const getCompetitor = useCallback(
    async (id: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/competitors/track/${id}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to get competitor');
        }

        return await response.json();
      } catch (err) {
        setError(err as Error);
        toast.error((err as Error).message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Add a new tracked competitor
   */
  const addCompetitor = useCallback(
    async (data: AddCompetitorInput): Promise<TrackedCompetitor | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/competitors/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to add competitor');
        }

        const result = await response.json();
        toast.success('Competitor added to tracking');
        return result.competitor;
      } catch (err) {
        setError(err as Error);
        toast.error((err as Error).message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Update competitor settings
   */
  const updateCompetitor = useCallback(
    async (id: string, data: UpdateCompetitorInput): Promise<TrackedCompetitor | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/competitors/track/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update competitor');
        }

        const result = await response.json();
        toast.success('Competitor updated');
        return result.competitor;
      } catch (err) {
        setError(err as Error);
        toast.error((err as Error).message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Remove competitor from tracking
   */
  const removeCompetitor = useCallback(
    async (id: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/competitors/track/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to remove competitor');
        }

        toast.success('Competitor removed from tracking');
        return true;
      } catch (err) {
        setError(err as Error);
        toast.error((err as Error).message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Trigger a new snapshot
   */
  const triggerSnapshot = useCallback(
    async (competitorId: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/competitors/track/${competitorId}/snapshot`, {
          method: 'POST',
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create snapshot');
        }

        const result = await response.json();
        toast.success('Snapshot created');
        return result;
      } catch (err) {
        setError(err as Error);
        toast.error((err as Error).message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Get snapshot history
   */
  const getSnapshots = useCallback(
    async (
      competitorId: string,
      options?: { platform?: string; days?: number }
    ) => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (options?.platform) params.set('platform', options.platform);
        if (options?.days) params.set('days', String(options.days));

        const response = await fetch(
          `/api/competitors/track/${competitorId}/snapshot?${params}`,
          { credentials: 'include' }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to get snapshots');
        }

        return await response.json();
      } catch (err) {
        setError(err as Error);
        toast.error((err as Error).message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * List alerts
   */
  const listAlerts = useCallback(
    async (options?: {
      competitorId?: string;
      type?: string;
      read?: boolean;
      severity?: string;
      limit?: number;
    }) => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (options?.competitorId) params.set('competitorId', options.competitorId);
        if (options?.type) params.set('type', options.type);
        if (options?.read !== undefined) params.set('read', String(options.read));
        if (options?.severity) params.set('severity', options.severity);
        if (options?.limit) params.set('limit', String(options.limit));

        const response = await fetch(`/api/competitors/alerts?${params}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to list alerts');
        }

        return await response.json();
      } catch (err) {
        setError(err as Error);
        toast.error((err as Error).message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Mark alerts as read
   */
  const markAlertsRead = useCallback(
    async (alertIds: string[]): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/competitors/alerts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ alertIds, action: 'read' }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to mark alerts as read');
        }

        return true;
      } catch (err) {
        setError(err as Error);
        toast.error((err as Error).message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Dismiss alerts
   */
  const dismissAlerts = useCallback(
    async (alertIds: string[], actionTaken?: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/competitors/alerts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ alertIds, action: 'dismiss', actionTaken }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to dismiss alerts');
        }

        toast.success('Alerts dismissed');
        return true;
      } catch (err) {
        setError(err as Error);
        toast.error((err as Error).message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    isLoading,
    error,
    listCompetitors,
    getCompetitor,
    addCompetitor,
    updateCompetitor,
    removeCompetitor,
    triggerSnapshot,
    getSnapshots,
    listAlerts,
    markAlertsRead,
    dismissAlerts,
  };
}

export default useCompetitorTracking;
