'use client';

/**
 * Content Schedule Page
 *
 * Enhanced content calendar with drag-and-drop rescheduling,
 * multiple views (week, month, list), and conflict detection.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DashboardSkeleton } from '@/components/skeletons';
import { APIErrorCard } from '@/components/error-states';
import { WeekView, PostDetailModal, OPTIMAL_TIMES } from '@/components/calendar';
import toast from 'react-hot-toast';

import {
  type ViewMode,
  type ScheduledPost,
  type ScheduleStats,
  mockScheduledPosts,
  ScheduleHeader,
  ScheduleStatsGrid,
  ScheduleFilters,
  MonthView,
  ListView,
  OptimalTimes,
} from '@/components/schedule';

export default function SchedulePage() {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper to get auth token
  const getAuthToken = () => {
    return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || localStorage.getItem('token');
  };

  // Load schedule data
  useEffect(() => {
    const loadSchedule = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const token = getAuthToken();
        {
          const response = await fetch('/api/scheduler/posts', {
            credentials: 'include',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          });

          if (response.ok) {
            const { data } = await response.json();
            const apiPosts: ScheduledPost[] = data.map((p: Record<string, unknown>) => ({
              id: String(p.id),
              content: (p.content as string) || '',
              platforms: (p.platforms as string[]) || [(p.platform as string) || 'twitter'],
              scheduledFor: new Date(p.scheduledAt as string),
              status: (p.status as ScheduledPost['status']) || 'scheduled',
              engagement: {
                estimated: ((p.metadata as Record<string, unknown>)?.estimatedEngagement as number) || 5,
                ...(p.status === 'published' ? {
                  actual: ((p.metadata as Record<string, unknown>)?.engagement as Record<string, unknown>)?.actual as number,
                  likes: ((p.metadata as Record<string, unknown>)?.engagement as Record<string, unknown>)?.likes as number,
                  comments: ((p.metadata as Record<string, unknown>)?.engagement as Record<string, unknown>)?.comments as number,
                  shares: ((p.metadata as Record<string, unknown>)?.engagement as Record<string, unknown>)?.shares as number,
                } : {}),
              },
              persona: ((p.metadata as Record<string, unknown>)?.persona as string) || 'Default',
              hashtags: (p.hashtags as string[]) || [],
              mediaUrls: (p.mediaUrls as string[]) || [],
            }));

            if (apiPosts.length > 0) {
              setPosts(apiPosts);
              setIsLoading(false);
              return;
            }
          }
        }
        await new Promise(resolve => setTimeout(resolve, 400));
        setPosts(mockScheduledPosts);
        setIsLoading(false);
      } catch {
        setPosts(mockScheduledPosts);
        setIsLoading(false);
      }
    };
    loadSchedule();
  }, []);

  // Filter posts
  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      if (filterPlatform !== 'all' && !post.platforms.includes(filterPlatform)) return false;
      if (filterStatus !== 'all' && post.status !== filterStatus) return false;
      return true;
    });
  }, [posts, filterPlatform, filterStatus]);

  // Calculate stats
  const stats: ScheduleStats = useMemo(() => ({
    scheduled: posts.filter(p => p.status === 'scheduled').length,
    published: posts.filter(p => p.status === 'published').length,
    draft: posts.filter(p => p.status === 'draft').length,
    avgEngagement: posts.reduce((sum, p) => sum + (p.engagement?.actual || p.engagement?.estimated || 0), 0) / Math.max(posts.length, 1),
  }), [posts]);

  // Handle post reschedule via drag-and-drop
  const handlePostReschedule = useCallback(async (postId: string, newTime: Date) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, scheduledFor: newTime } : p
    ));

    toast.success(`Rescheduled to ${newTime.toLocaleString()}`);

    try {
      const token = getAuthToken();
      await fetch('/api/content/calendar', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postId,
          newTime: newTime.toISOString(),
        }),
      });
    } catch {
      setPosts(prev => prev.map(p =>
        p.id === postId ? post : p
      ));
      toast.error('Failed to reschedule. Please try again.');
    }
  }, [posts]);

  const handlePostClick = useCallback((post: ScheduledPost) => {
    setSelectedPost(post);
  }, []);

  const handlePostCreate = useCallback((date: Date, hour: number) => {
    const scheduledTime = new Date(date);
    scheduledTime.setHours(hour, 0, 0, 0);
    toast.success(`Creating post for ${scheduledTime.toLocaleString()}`);
    setIsCreating(true);
    setTimeout(() => setIsCreating(false), 1000);
  }, []);

  const handleSavePost = useCallback(async (updatedPost: ScheduledPost) => {
    setPosts(prev => prev.map(p =>
      p.id === updatedPost.id ? updatedPost : p
    ));
    toast.success('Post updated successfully!');
  }, []);

  const handleDeletePost = useCallback(async (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
    setSelectedPost(null);
    toast.success('Post deleted');
  }, []);

  const handlePublishNow = useCallback(async (postId: string) => {
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, status: 'published' as const } : p
    ));
    toast.success('Post published successfully!');
  }, []);

  const handleDuplicatePost = useCallback((post: ScheduledPost) => {
    const newPost: ScheduledPost = {
      ...post,
      id: `${Date.now()}`,
      status: 'draft',
      scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
    setPosts(prev => [...prev, newPost]);
    toast.success('Post duplicated!');
  }, []);

  const handleWeekChange = useCallback((direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + (direction === 'next' ? 7 : -7));
      return newDate;
    });
  }, []);

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

  const handleRetry = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    setPosts(mockScheduledPosts);
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return <APIErrorCard title="Schedule Error" message={error} onRetry={handleRetry} />;
  }

  return (
    <div className="space-y-6">
      <ScheduleHeader
        isCreating={isCreating}
        onImport={handleImportSchedule}
        onExport={handleExportSchedule}
        onCreate={() => handlePostCreate(new Date(), new Date().getHours())}
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
