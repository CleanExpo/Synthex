/**
 * Calendar Hook
 *
 * @description Manages calendar state and operations.
 * Provides calendar view data, scheduling, and rescheduling functionality.
 *
 * Uses raw fetch + useState pattern (no SWR/TanStack Query).
 * Follows the same pattern as hooks/use-cross-post.ts.
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { ScheduledPost, ConflictInfo } from '@/components/calendar/CalendarTypes';

// ============================================================================
// TYPES
// ============================================================================

export interface CalendarStats {
  totalPosts: number;
  scheduledPosts: number;
  publishedPosts: number;
  conflictCount: number;
}

export interface TimeSuggestion {
  platform: string;
  suggestedTime: string;
  score: number;
  reason: string;
}

export interface CalendarViewData {
  startDate: string;
  endDate: string;
  posts: ScheduledPost[];
  conflicts: ConflictInfo[];
  suggestions: TimeSuggestion[];
  stats: CalendarStats;
}

export interface SchedulePostOptions {
  title?: string;
  content: string;
  platforms: string[];
  scheduledFor: Date;
  mediaUrls?: string[];
  tags?: string[];
  campaignId?: string;
  autoOptimize?: boolean;
}

export interface UseCalendarOptions {
  organizationId: string;
  startDate?: Date;
  endDate?: Date;
  userId?: string; // For team filtering
}

// ============================================================================
// HELPERS
// ============================================================================

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem('auth_token') ||
    sessionStorage.getItem('auth_token') ||
    localStorage.getItem('token')
  );
}

function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function formatDateParam(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getDefaultDateRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - start.getDay()); // Start of week (Sunday)
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

// ============================================================================
// HOOK
// ============================================================================

export function useCalendar(options: UseCalendarOptions) {
  const { organizationId, startDate, endDate, userId } = options;

  // Data state
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [suggestions, setSuggestions] = useState<TimeSuggestion[]>([]);
  const [stats, setStats] = useState<CalendarStats>({
    totalPosts: 0,
    scheduledPosts: 0,
    publishedPosts: 0,
    conflictCount: 0,
  });

  // Current date range
  const [currentStartDate, setCurrentStartDate] = useState<Date>(() => {
    if (startDate) return startDate;
    return getDefaultDateRange().start;
  });
  const [currentEndDate, setCurrentEndDate] = useState<Date>(() => {
    if (endDate) return endDate;
    return getDefaultDateRange().end;
  });

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Fetch calendar view data from API
   */
  const fetchCalendarView = useCallback(async (
    start: Date = currentStartDate,
    end: Date = currentEndDate
  ): Promise<void> => {
    if (!organizationId) {
      setError('Organization ID is required');
      return;
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        organizationId,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });

      if (userId) {
        params.set('userId', userId);
      }

      const response = await fetch(`/api/content/calendar?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers: getAuthHeaders(),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch calendar');
      }

      if (mountedRef.current) {
        const calendarData = data.calendar as CalendarViewData;

        // Transform posts to match ScheduledPost type
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const transformedPosts: ScheduledPost[] = (calendarData.posts as any[]).map((post) => ({
          id: post.id as string,
          title: post.title as string | undefined,
          content: post.content as string,
          platforms: post.platforms as string[],
          scheduledFor: new Date(post.scheduledFor as string),
          status: post.status as 'draft' | 'scheduled' | 'published' | 'failed',
          mediaUrls: post.mediaUrls as string[] | undefined,
          tags: post.tags as string[] | undefined,
          hashtags: post.hashtags as string[] | undefined,
          engagement: post.engagement as ScheduledPost['engagement'],
          persona: post.persona as string | undefined,
          recurrence: post.recurrence as ScheduledPost['recurrence'],
        }));

        setPosts(transformedPosts);
        setConflicts(calendarData.conflicts || []);
        setSuggestions(calendarData.suggestions || []);
        setStats(calendarData.stats || {
          totalPosts: transformedPosts.length,
          scheduledPosts: transformedPosts.filter(p => p.status === 'scheduled').length,
          publishedPosts: transformedPosts.filter(p => p.status === 'published').length,
          conflictCount: calendarData.conflicts?.length || 0,
        });
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [organizationId, userId, currentStartDate, currentEndDate]);

  /**
   * Schedule a new post
   */
  const schedulePost = useCallback(async (options: SchedulePostOptions): Promise<ScheduledPost | null> => {
    if (!organizationId) {
      setError('Organization ID is required');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/content/calendar', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          organizationId,
          ...options,
          scheduledFor: options.scheduledFor.toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to schedule post');
      }

      // Add new post to local state (optimistic update)
      const newPost: ScheduledPost = {
        id: data.post.id,
        title: data.post.title,
        content: data.post.content,
        platforms: data.post.platforms,
        scheduledFor: new Date(data.post.scheduledFor),
        status: data.post.status,
        mediaUrls: data.post.mediaUrls,
        tags: data.post.tags,
      };

      if (mountedRef.current) {
        setPosts(prev => [...prev, newPost]);
        setStats(prev => ({
          ...prev,
          totalPosts: prev.totalPosts + 1,
          scheduledPosts: prev.scheduledPosts + 1,
        }));
      }

      return newPost;
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
      return null;
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [organizationId]);

  /**
   * Reschedule a post (drag-and-drop support)
   */
  const reschedulePost = useCallback(async (postId: string, newTime: Date): Promise<boolean> => {
    if (!organizationId) {
      setError('Organization ID is required');
      return false;
    }

    // Optimistic update - update local state immediately
    const previousPosts = posts;
    setPosts(prev =>
      prev.map(post =>
        post.id === postId
          ? { ...post, scheduledFor: newTime }
          : post
      )
    );

    try {
      const response = await fetch('/api/content/calendar', {
        method: 'PATCH',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          organizationId,
          postId,
          newTime: newTime.toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to reschedule post');
      }

      return true;
    } catch (err) {
      // Rollback optimistic update on error
      if (mountedRef.current) {
        setPosts(previousPosts);
        setError(err instanceof Error ? err.message : String(err));
      }
      return false;
    }
  }, [organizationId, posts]);

  /**
   * Navigate to previous week
   */
  const goToPreviousWeek = useCallback(() => {
    const newStart = new Date(currentStartDate);
    newStart.setDate(newStart.getDate() - 7);
    const newEnd = new Date(currentEndDate);
    newEnd.setDate(newEnd.getDate() - 7);

    setCurrentStartDate(newStart);
    setCurrentEndDate(newEnd);
  }, [currentStartDate, currentEndDate]);

  /**
   * Navigate to next week
   */
  const goToNextWeek = useCallback(() => {
    const newStart = new Date(currentStartDate);
    newStart.setDate(newStart.getDate() + 7);
    const newEnd = new Date(currentEndDate);
    newEnd.setDate(newEnd.getDate() + 7);

    setCurrentStartDate(newStart);
    setCurrentEndDate(newEnd);
  }, [currentStartDate, currentEndDate]);

  /**
   * Navigate to today
   */
  const goToToday = useCallback(() => {
    const { start, end } = getDefaultDateRange();
    setCurrentStartDate(start);
    setCurrentEndDate(end);
  }, []);

  /**
   * Refresh calendar data
   */
  const refresh = useCallback(() => {
    fetchCalendarView(currentStartDate, currentEndDate);
  }, [fetchCalendarView, currentStartDate, currentEndDate]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Fetch data on mount and when date range changes
  useEffect(() => {
    if (organizationId) {
      fetchCalendarView(currentStartDate, currentEndDate);
    }
  }, [organizationId, userId, currentStartDate, currentEndDate, fetchCalendarView]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    // Data
    posts,
    conflicts,
    suggestions,
    stats,

    // Date range
    currentStartDate,
    currentEndDate,

    // UI state
    isLoading,
    error,

    // Actions
    fetchCalendarView,
    schedulePost,
    reschedulePost,
    goToPreviousWeek,
    goToNextWeek,
    goToToday,
    refresh,
    clearError,
  };
}

export default useCalendar;
