'use client';

/**
 * Queue Management Page
 *
 * Flat-list view of all pending posts with bulk selection, bulk actions,
 * filtering, sorting, and pagination. Powered by SWR for data fetching.
 *
 * Route: /dashboard/schedule/queue
 * Linear: SYN-44
 */

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { fetchWithCSRF } from '@/lib/csrf';
import { QueueTable, QueueBulkActions, QueueFilters, QueueStats } from '@/components/queue';
import type { QueuePost } from '@/components/queue';
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton';
import { APIErrorCard } from '@/components/error-states/api-error';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronLeft, ChevronRight, Layers } from '@/components/icons';
import { BulkScheduleWizard } from '@/components/scheduling';

// =============================================================================
// SWR Fetcher
// =============================================================================

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

// =============================================================================
// Page Component
// =============================================================================

export default function QueuePage() {
  const router = useRouter();

  // ---------------------------------------------------------------------------
  // Filter + sort state
  // ---------------------------------------------------------------------------
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<string>('scheduledAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkWizardOpen, setBulkWizardOpen] = useState(false);

  const limit = 25;

  // ---------------------------------------------------------------------------
  // Build query string
  // ---------------------------------------------------------------------------
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    params.set('sortBy', sortBy);
    params.set('sortOrder', sortOrder);

    if (filterPlatform !== 'all') params.set('platform', filterPlatform);
    if (filterStatus !== 'all') params.set('status', filterStatus);
    if (startDate) params.set('startDate', new Date(startDate).toISOString());
    if (endDate) params.set('endDate', new Date(endDate).toISOString());

    return params.toString();
  }, [page, sortBy, sortOrder, filterPlatform, filterStatus, startDate, endDate]);

  // ---------------------------------------------------------------------------
  // SWR
  // ---------------------------------------------------------------------------
  const { data, isLoading, error, mutate } = useSWR(
    `/api/scheduler/posts?${queryString}`,
    fetchJson,
    { revalidateOnFocus: false }
  );

  const posts: QueuePost[] = useMemo(() => data?.data ?? [], [data]);
  const pagination = data?.pagination ?? { page: 1, totalPages: 1, total: 0 };
  const stats = data?.stats ?? { scheduled: 0, published: 0, draft: 0, failed: 0 };

  // Client-side search filter (API doesn't support search param so we filter locally)
  const filteredPosts = useMemo(() => {
    if (!searchQuery) return posts;
    const q = searchQuery.toLowerCase();
    return posts.filter((p) => p.content.toLowerCase().includes(q));
  }, [posts, searchQuery]);

  // ---------------------------------------------------------------------------
  // Published today count (approximate from current page — stats don't expose this)
  // ---------------------------------------------------------------------------
  const publishedToday = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return posts.filter(
      (p) => p.status === 'published' && p.publishedAt && new Date(p.publishedAt) >= todayStart
    ).length;
  }, [posts]);

  // Next scheduled post
  const nextScheduledAt = useMemo(() => {
    const now = Date.now();
    const upcoming = posts
      .filter((p) => p.status === 'scheduled' && p.scheduledAt && new Date(p.scheduledAt).getTime() > now)
      .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());
    return upcoming[0]?.scheduledAt ?? null;
  }, [posts]);

  // ---------------------------------------------------------------------------
  // Selection helpers
  // ---------------------------------------------------------------------------
  const selectedPosts = useMemo(
    () => posts.filter((p) => selectedIds.has(p.id)),
    [posts, selectedIds]
  );
  const hasFailedSelected = selectedPosts.some((p) => p.status === 'failed');
  const hasDraftSelected = selectedPosts.some((p) => p.status === 'draft');
  const hasScheduledSelected = selectedPosts.some((p) => p.status === 'scheduled');

  // ---------------------------------------------------------------------------
  // Bulk action handler
  // ---------------------------------------------------------------------------
  const executeBulkAction = useCallback(
    async (body: Record<string, unknown>) => {
      try {
        const res = await fetchWithCSRF('/api/scheduler/posts/bulk', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json();
          console.error('Bulk action failed:', err);
        }
        setSelectedIds(new Set());
        mutate();
      } catch (err) {
        console.error('Bulk action error:', err);
      }
    },
    [mutate]
  );

  function handleReschedule(scheduledAt?: string, offsetHours?: number) {
    const body: Record<string, unknown> = {
      action: 'reschedule',
      postIds: Array.from(selectedIds),
    };
    if (scheduledAt) body.scheduledAt = scheduledAt;
    if (offsetHours !== undefined) body.offsetHours = offsetHours;
    executeBulkAction(body);
  }

  function handleDelete() {
    executeBulkAction({
      action: 'delete',
      postIds: Array.from(selectedIds),
    });
  }

  function handlePause() {
    executeBulkAction({
      action: 'set-status',
      postIds: Array.from(selectedIds),
      status: 'draft',
    });
  }

  function handleResume() {
    executeBulkAction({
      action: 'set-status',
      postIds: Array.from(selectedIds),
      status: 'scheduled',
    });
  }

  function handleRetryFailed() {
    executeBulkAction({
      action: 'retry',
      postIds: Array.from(selectedIds),
    });
  }

  function handleSingleDelete(postId: string) {
    executeBulkAction({
      action: 'delete',
      postIds: [postId],
    });
  }

  function handleSingleRetry(postId: string) {
    executeBulkAction({
      action: 'retry',
      postIds: [postId],
    });
  }

  function handleSortChange(field: string, order: 'asc' | 'desc') {
    setSortBy(field);
    setSortOrder(order);
    setPage(1);
  }

  function handleClearFilters() {
    setFilterPlatform('all');
    setFilterStatus('all');
    setStartDate('');
    setEndDate('');
    setSearchQuery('');
    setPage(1);
  }

  function handlePostClick(post: QueuePost) {
    // Navigate to schedule page for editing — could also open a modal
    router.push(`/dashboard/schedule?postId=${post.id}`);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (isLoading && !data) {
    return <DashboardSkeleton />;
  }

  if (error && !data) {
    return (
      <div className="p-6">
        <APIErrorCard error={error} onRetry={() => mutate()} showDetails />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
            onClick={() => router.push('/dashboard/schedule')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold gradient-text">Post Queue</h1>
            <p className="text-slate-400 mt-1">
              Manage, filter, and bulk-action your scheduled posts
            </p>
          </div>
        </div>
        <Button
          className="gradient-primary text-white"
          onClick={() => setBulkWizardOpen(true)}
        >
          <Layers className="h-4 w-4 mr-2" />
          Bulk Schedule
        </Button>
      </div>

      {/* Bulk Schedule Wizard */}
      <BulkScheduleWizard
        open={bulkWizardOpen}
        onOpenChange={setBulkWizardOpen}
        onComplete={() => mutate()}
      />

      {/* Stats */}
      <QueueStats
        total={pagination.total}
        scheduled={stats.scheduled}
        failed={stats.failed}
        publishedToday={publishedToday}
        nextScheduledAt={nextScheduledAt}
      />

      {/* Filters */}
      <QueueFilters
        platform={filterPlatform}
        status={filterStatus}
        startDate={startDate}
        endDate={endDate}
        searchQuery={searchQuery}
        onPlatformChange={(v) => { setFilterPlatform(v); setPage(1); }}
        onStatusChange={(v) => { setFilterStatus(v); setPage(1); }}
        onStartDateChange={(v) => { setStartDate(v); setPage(1); }}
        onEndDateChange={(v) => { setEndDate(v); setPage(1); }}
        onSearchChange={setSearchQuery}
        onClearFilters={handleClearFilters}
      />

      {/* Table or empty state */}
      {filteredPosts.length === 0 && !isLoading ? (
        <EmptyState
          type="schedule"
          title="No posts in queue"
          description="Create content to start building your publishing queue."
          actionLabel="Create Content"
          onAction={() => router.push('/dashboard/content')}
        />
      ) : (
        <QueueTable
          posts={filteredPosts}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onPostClick={handlePostClick}
          onRetryPost={handleSingleRetry}
          onDeletePost={handleSingleDelete}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
        />
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} posts)
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="bg-white/5 border-white/10 text-white hover:bg-white/10"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="bg-white/5 border-white/10 text-white hover:bg-white/10"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Bulk actions bar */}
      <QueueBulkActions
        selectedCount={selectedIds.size}
        onReschedule={handleReschedule}
        onDelete={handleDelete}
        onPause={handlePause}
        onResume={handleResume}
        onRetryFailed={handleRetryFailed}
        onClearSelection={() => setSelectedIds(new Set())}
        hasFailedSelected={hasFailedSelected}
        hasDraftSelected={hasDraftSelected}
        hasScheduledSelected={hasScheduledSelected}
      />
    </div>
  );
}
