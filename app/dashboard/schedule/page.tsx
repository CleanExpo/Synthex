'use client';

/**
 * Content Schedule Page
 *
 * Enhanced content calendar with drag-and-drop rescheduling,
 * multiple views (week, month, list), and conflict detection.
 *
 * All mutations use fetchWithCSRF for CSRF protection and
 * call /api/scheduler/posts for persistence.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardSkeleton } from '@/components/skeletons';
import { APIErrorCard } from '@/components/error-states';
import { WeekView, PostDetailModal, OPTIMAL_TIMES } from '@/components/calendar';
import { toast } from 'sonner';
import { fetchWithCSRF } from '@/lib/csrf';

import {
  type ViewMode,
  type ScheduledPost,
  type ScheduleStats,
  ScheduleHeader,
  ScheduleStatsGrid,
  ScheduleFilters,
  MonthView,
  ListView,
  OptimalTimes,
} from '@/components/schedule';
import { EmptyState } from '@/components/error-states';
import { BulkScheduleWizard } from '@/components/scheduling';

// Map API post shape → frontend ScheduledPost
function mapApiPost(p: Record<string, unknown>): ScheduledPost {
  const metadata = (p.metadata as Record<string, unknown>) || {};
  const metaHashtags = (metadata.hashtags as string[]) || [];
  // scheduledAt may be null for draft posts — fall back to createdAt or now
  const rawScheduledAt = p.scheduledAt ?? p.createdAt ?? new Date().toISOString();
  return {
    id: String(p.id),
    content: (p.content as string) || '',
    platforms: (p.platforms as string[]) || [(p.platform as string) || 'twitter'],
    scheduledFor: new Date(rawScheduledAt as string),
    status: (p.status as ScheduledPost['status']) || 'scheduled',
    engagement: {
      estimated: (metadata.estimatedEngagement as number) || 5,
      ...(p.status === 'published' ? {
        actual: (metadata.engagement as Record<string, unknown>)?.actual as number,
        likes: (metadata.engagement as Record<string, unknown>)?.likes as number,
        comments: (metadata.engagement as Record<string, unknown>)?.comments as number,
        shares: (metadata.engagement as Record<string, unknown>)?.shares as number,
      } : {}),
    },
    persona: (metadata.persona as string) || 'Default',
    hashtags: metaHashtags,
    mediaUrls: (metadata.images as string[]) || [],
  };
}

export default function SchedulePage() {
  const router = useRouter();
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bulkWizardOpen, setBulkWizardOpen] = useState(false);
  const mountedRef = useRef(true);

  // ── Shared data fetcher ───────────────────────────────────────────────────
  const fetchPosts = useCallback(async () => {
    try {
      const response = await fetch('/api/scheduler/posts', {
        credentials: 'include',
      });

      if (!response.ok) {
        // Non-OK but not a crash — show empty state for 401/404
        if (response.status === 401 || response.status === 404) {
          return [];
        }
        throw new Error(`API returned ${response.status}`);
      }

      const json = await response.json();
      const data = Array.isArray(json.data) ? json.data : [];
      return data.map(mapApiPost);
    } catch (err) {
      console.error('Schedule fetch error:', err);
      throw err;
    }
  }, []);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const loadedPosts = await fetchPosts();
        if (!cancelled) {
          setPosts(loadedPosts);
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load scheduled posts. Please try again.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => { cancelled = true; };
  }, [fetchPosts]);

  // Cleanup ref
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Filter posts ──────────────────────────────────────────────────────────
  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      if (filterPlatform !== 'all' && !post.platforms.includes(filterPlatform)) return false;
      if (filterStatus !== 'all' && post.status !== filterStatus) return false;
      return true;
    });
  }, [posts, filterPlatform, filterStatus]);

  // ── Calculate stats ───────────────────────────────────────────────────────
  const stats: ScheduleStats = useMemo(() => ({
    scheduled: posts.filter(p => p.status === 'scheduled').length,
    published: posts.filter(p => p.status === 'published').length,
    draft: posts.filter(p => p.status === 'draft').length,
    avgEngagement: posts.reduce((sum, p) => sum + (p.engagement?.actual || p.engagement?.estimated || 0), 0) / Math.max(posts.length, 1),
  }), [posts]);

  // ── Reschedule via drag-and-drop ──────────────────────────────────────────
  const handlePostReschedule = useCallback(async (postId: string, newTime: Date) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    // Optimistic update
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, scheduledFor: newTime } : p
    ));

    try {
      const response = await fetchWithCSRF('/api/scheduler/posts', {
        method: 'PATCH',
        body: JSON.stringify({
          id: postId,
          scheduledAt: newTime.toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to reschedule (${response.status})`);
      }

      toast.success(`Rescheduled to ${newTime.toLocaleString()}`);
    } catch {
      // Rollback on failure
      setPosts(prev => prev.map(p =>
        p.id === postId ? post : p
      ));
      toast.error('Failed to reschedule. Please try again.');
    }
  }, [posts]);

  const handlePostClick = useCallback((post: ScheduledPost) => {
    setSelectedPost(post);
  }, []);

  const handlePostCreate = useCallback((_date?: Date, _hour?: number) => {
    router.push('/dashboard/content');
  }, [router]);

  // ── Save (update) post ────────────────────────────────────────────────────
  const handleSavePost = useCallback(async (updatedPost: ScheduledPost) => {
    const originalPost = posts.find(p => p.id === updatedPost.id);

    // Optimistic update
    setPosts(prev => prev.map(p =>
      p.id === updatedPost.id ? updatedPost : p
    ));

    try {
      const response = await fetchWithCSRF('/api/scheduler/posts', {
        method: 'PATCH',
        body: JSON.stringify({
          id: updatedPost.id,
          content: updatedPost.content,
          platform: updatedPost.platforms[0] || 'twitter',
          status: updatedPost.status,
          scheduledAt: new Date(updatedPost.scheduledFor).toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save (${response.status})`);
      }

      toast.success('Post updated successfully!');
    } catch {
      // Rollback on failure
      if (originalPost) {
        setPosts(prev => prev.map(p =>
          p.id === updatedPost.id ? originalPost : p
        ));
      }
      toast.error('Failed to save post. Please try again.');
    }
  }, [posts]);

  // ── Delete post ───────────────────────────────────────────────────────────
  const handleDeletePost = useCallback(async (postId: string) => {
    const originalPost = posts.find(p => p.id === postId);

    // Optimistic update
    setPosts(prev => prev.filter(p => p.id !== postId));
    setSelectedPost(null);

    try {
      const response = await fetchWithCSRF(`/api/scheduler/posts?id=${postId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete (${response.status})`);
      }

      toast.success('Post deleted');
    } catch {
      // Rollback on failure
      if (originalPost) {
        setPosts(prev => [...prev, originalPost]);
      }
      toast.error('Failed to delete post. Please try again.');
    }
  }, [posts]);

  // ── Publish now ───────────────────────────────────────────────────────────
  const handlePublishNow = useCallback(async (postId: string) => {
    const originalPost = posts.find(p => p.id === postId);

    // Optimistic update
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, status: 'published' as const } : p
    ));

    try {
      const response = await fetchWithCSRF('/api/scheduler/posts', {
        method: 'PATCH',
        body: JSON.stringify({
          id: postId,
          status: 'published',
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to publish (${response.status})`);
      }

      toast.success('Post published successfully!');
    } catch {
      // Rollback on failure
      if (originalPost) {
        setPosts(prev => prev.map(p =>
          p.id === postId ? originalPost : p
        ));
      }
      toast.error('Failed to publish post. Please try again.');
    }
  }, [posts]);

  // ── Duplicate post ────────────────────────────────────────────────────────
  const handleDuplicatePost = useCallback(async (post: ScheduledPost) => {
    const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    try {
      const response = await fetchWithCSRF('/api/scheduler/posts', {
        method: 'POST',
        body: JSON.stringify({
          content: post.content,
          platform: post.platforms[0] || 'twitter',
          scheduledAt: scheduledAt.toISOString(),
          metadata: {
            persona: post.persona !== 'Default' ? post.persona : undefined,
            hashtags: post.hashtags || [],
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to duplicate (${response.status})`);
      }

      const result = await response.json();
      if (result.data) {
        setPosts(prev => [...prev, mapApiPost(result.data)]);
      }

      toast.success('Post duplicated!');
    } catch {
      toast.error('Failed to duplicate post. Please try again.');
    }
  }, []);

  // ── Week navigation ───────────────────────────────────────────────────────
  const handleWeekChange = useCallback((direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + (direction === 'next' ? 7 : -7));
      return newDate;
    });
  }, []);

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExportSchedule = useCallback(() => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      posts: filteredPosts.map(post => ({
        ...post,
        scheduledFor: new Date(post.scheduledFor).toISOString(),
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `content-schedule-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Schedule exported successfully!');
  }, [filteredPosts]);

  // ── Import ─────────────────────────────────────────────────────────────────
  const handleImportSchedule = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (data.posts && Array.isArray(data.posts)) {
            const importedPosts: ScheduledPost[] = data.posts.map((post: ScheduledPost, index: number) => ({
              ...post,
              id: `${Date.now()}-${index}`,
              scheduledFor: new Date(post.scheduledFor),
            }));
            setPosts(prev => [...prev, ...importedPosts]);
            toast.success(`Imported ${importedPosts.length} posts!`);
          } else {
            toast.error('Invalid schedule file format');
          }
        } catch {
          toast.error('Failed to parse schedule file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  // ── Retry (uses shared fetcher) ───────────────────────────────────────────
  const handleRetry = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const loadedPosts = await fetchPosts();
      if (mountedRef.current) {
        setPosts(loadedPosts);
      }
    } catch {
      if (mountedRef.current) {
        setError('Failed to load scheduled posts. Please try again.');
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [fetchPosts]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return <APIErrorCard title="Schedule Error" message={error} onRetry={handleRetry} />;
  }

  if (posts.length === 0) {
    return (
      <EmptyState
        title="No posts scheduled yet"
        message="Generate content, then click Schedule to add posts to your calendar."
        actionLabel="Create Content"
        onAction={() => router.push('/dashboard/content')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <ScheduleHeader
        isCreating={isCreating}
        onImport={handleImportSchedule}
        onExport={handleExportSchedule}
        onCreate={() => handlePostCreate(new Date(), new Date().getHours())}
        onBulkSchedule={() => setBulkWizardOpen(true)}
      />

      <BulkScheduleWizard
        open={bulkWizardOpen}
        onOpenChange={setBulkWizardOpen}
        onComplete={async () => {
          const refreshedPosts = await fetchPosts();
          if (mountedRef.current) setPosts(refreshedPosts);
        }}
      />

      <ScheduleStatsGrid stats={stats} />

      <ScheduleFilters
        filterPlatform={filterPlatform}
        filterStatus={filterStatus}
        viewMode={viewMode}
        onPlatformChange={setFilterPlatform}
        onStatusChange={setFilterStatus}
        onViewModeChange={setViewMode}
      />

      {viewMode === 'week' ? (
        <div className="h-[600px]">
          <WeekView
            posts={filteredPosts}
            currentDate={currentDate}
            onPostClick={handlePostClick}
            onPostReschedule={handlePostReschedule}
            onPostCreate={handlePostCreate}
            optimalTimes={OPTIMAL_TIMES}
            onWeekChange={handleWeekChange}
          />
        </div>
      ) : viewMode === 'month' ? (
        <MonthView
          posts={filteredPosts}
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          onPostClick={handlePostClick}
          onCreatePost={handlePostCreate}
        />
      ) : (
        <ListView
          posts={filteredPosts}
          hasFilters={filterPlatform !== 'all' || filterStatus !== 'all'}
          onPostClick={handlePostClick}
          onCreatePost={() => handlePostCreate(new Date(), new Date().getHours())}
          onPublishNow={handlePublishNow}
          onDeletePost={handleDeletePost}
        />
      )}

      <OptimalTimes />

      <PostDetailModal
        post={selectedPost}
        isOpen={!!selectedPost}
        onClose={() => setSelectedPost(null)}
        onSave={handleSavePost}
        onDelete={handleDeletePost}
        onPublishNow={handlePublishNow}
        onDuplicate={handleDuplicatePost}
      />
    </div>
  );
}
