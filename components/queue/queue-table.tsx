'use client';

/**
 * QueueTable Component
 *
 * Selectable post table with checkbox selection, sortable columns,
 * and inline actions for the queue management page.
 */

import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  RefreshCw,
  AlertCircle,
  RotateCcw,
} from '@/components/icons';
import { getPlatformIconComponent } from '@/components/schedule/schedule-config';
import { PLATFORM_COLORS } from '@/components/calendar';

// Post shape returned by /api/scheduler/posts
export interface QueuePost {
  id: string;
  content: string;
  platform: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  metadata: Record<string, unknown> | null;
  campaign?: { id: string; name: string } | null;
}

interface QueueTableProps {
  posts: QueuePost[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onPostClick: (post: QueuePost) => void;
  onRetryPost: (postId: string) => void;
  onDeletePost: (postId: string) => void;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSortChange: (field: string, order: 'asc' | 'desc') => void;
}

// ============================================================================
// STATUS BADGE
// ============================================================================

const STATUS_COLOURS: Record<string, string> = {
  scheduled: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  published: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  failed: 'bg-red-500/20 text-red-300 border-red-500/30',
  draft: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  cancelled: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLOURS[status] ?? STATUS_COLOURS.cancelled;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ============================================================================
// RETRY BADGE
// ============================================================================

function RetryBadge({ metadata }: { metadata: Record<string, unknown> | null }) {
  if (!metadata) return null;
  const retryCount = metadata.retryCount as number | undefined;
  if (!retryCount || retryCount <= 0) return null;

  return (
    <span
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30"
      title={`${retryCount} retry attempt${retryCount > 1 ? 's' : ''}`}
    >
      <RotateCcw className="h-2.5 w-2.5" />
      {retryCount}
    </span>
  );
}

// ============================================================================
// PLATFORM BADGE
// ============================================================================

function PlatformBadge({ platform }: { platform: string }) {
  const Icon = getPlatformIconComponent(platform);
  const colour = PLATFORM_COLORS[platform] ?? '#888';

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-white/5 border border-white/10"
      style={{ color: colour }}
    >
      {Icon && <Icon className="h-3.5 w-3.5" style={{ color: colour }} />}
      {platform.charAt(0).toUpperCase() + platform.slice(1)}
    </span>
  );
}

// ============================================================================
// SORTABLE HEADER
// ============================================================================

function SortableHeader({
  label,
  field,
  sortBy,
  sortOrder,
  onSortChange,
}: {
  label: string;
  field: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSortChange: (field: string, order: 'asc' | 'desc') => void;
}) {
  const isActive = sortBy === field;
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-gray-400 hover:text-white transition-colors"
      onClick={() =>
        onSortChange(field, isActive && sortOrder === 'asc' ? 'desc' : 'asc')
      }
    >
      {label}
      {isActive &&
        (sortOrder === 'asc' ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        ))}
    </button>
  );
}

// ============================================================================
// DATE FORMATTER
// ============================================================================

function formatScheduledDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// ============================================================================
// QUEUE TABLE
// ============================================================================

export function QueueTable({
  posts,
  selectedIds,
  onSelectionChange,
  onPostClick,
  onRetryPost,
  onDeletePost,
  sortBy,
  sortOrder,
  onSortChange,
}: QueueTableProps) {
  const allSelected = posts.length > 0 && posts.every((p) => selectedIds.has(p.id));
  const someSelected = posts.some((p) => selectedIds.has(p.id)) && !allSelected;

  function toggleAll() {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(posts.map((p) => p.id)));
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
  }

  return (
    <div className="rounded-xl border border-white/10 bg-gray-900/50 backdrop-blur-sm overflow-hidden">
      {/* Table header */}
      <div className="grid grid-cols-[40px_100px_1fr_100px_170px_100px] gap-2 px-4 py-3 border-b border-white/10 bg-white/[0.02]">
        <div className="flex items-center justify-center">
          <Checkbox
            checked={allSelected}
            // Radix uses data-state so indeterminate is not directly supported; use checked
            onCheckedChange={toggleAll}
            variant="glass"
            aria-label={allSelected ? 'Deselect all' : 'Select all'}
            className={someSelected ? 'opacity-60' : ''}
          />
        </div>
        <SortableHeader label="Platform" field="platform" sortBy={sortBy} sortOrder={sortOrder} onSortChange={onSortChange} />
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Content</span>
        <SortableHeader label="Status" field="status" sortBy={sortBy} sortOrder={sortOrder} onSortChange={onSortChange} />
        <SortableHeader label="Scheduled For" field="scheduledAt" sortBy={sortBy} sortOrder={sortOrder} onSortChange={onSortChange} />
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 text-right">Actions</span>
      </div>

      {/* Table rows */}
      {posts.map((post) => {
        const isFailed = post.status === 'failed';
        const errorMsg =
          isFailed && post.metadata
            ? (post.metadata as Record<string, unknown>).publishError as string | undefined
            : undefined;

        return (
          <div key={post.id} className="group">
            <div
              className={`grid grid-cols-[40px_100px_1fr_100px_170px_100px] gap-2 px-4 py-3 border-b border-white/5 hover:bg-white/[0.03] transition-colors cursor-pointer ${
                selectedIds.has(post.id) ? 'bg-cyan-500/[0.05]' : ''
              }`}
            >
              {/* Checkbox */}
              <div
                className="flex items-center justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={selectedIds.has(post.id)}
                  onCheckedChange={() => toggleOne(post.id)}
                  variant="glass"
                  aria-label={`Select post ${post.id}`}
                />
              </div>

              {/* Platform */}
              <div
                className="flex items-center"
                onClick={() => onPostClick(post)}
              >
                <PlatformBadge platform={post.platform} />
              </div>

              {/* Content preview */}
              <div
                className="flex items-center min-w-0"
                onClick={() => onPostClick(post)}
              >
                <span className="text-sm text-gray-300 truncate">
                  {post.content.length > 80
                    ? post.content.slice(0, 80) + '...'
                    : post.content}
                </span>
              </div>

              {/* Status */}
              <div
                className="flex items-center gap-1.5"
                onClick={() => onPostClick(post)}
              >
                <StatusBadge status={post.status} />
                <RetryBadge metadata={post.metadata} />
              </div>

              {/* Scheduled For */}
              <div
                className="flex items-center text-sm text-gray-400"
                onClick={() => onPostClick(post)}
              >
                {formatScheduledDate(post.scheduledAt)}
              </div>

              {/* Actions */}
              <div
                className="flex items-center justify-end gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                {isFailed && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-cyan-400 hover:text-cyan-300 hover:bg-white/10"
                    onClick={() => onRetryPost(post.id)}
                    aria-label="Retry post"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-gray-400 hover:text-red-400 hover:bg-white/10"
                  onClick={() => onDeletePost(post.id)}
                  aria-label="Delete post"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Failed error bar */}
            {isFailed && errorMsg && (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-500/[0.05] border-b border-white/5">
                <AlertCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                <span className="text-xs text-red-400 truncate">{errorMsg}</span>
              </div>
            )}
          </div>
        );
      })}

      {posts.length === 0 && (
        <div className="py-12 text-center text-gray-500">
          No posts match your current filters.
        </div>
      )}
    </div>
  );
}
