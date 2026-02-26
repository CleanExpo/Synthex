'use client';

/**
 * Content Drafts Library Page
 *
 * Displays all saved content items for the authenticated user.
 * Supports filtering by platform and content type, copying to clipboard,
 * and soft-deleting items.
 *
 * Route: /dashboard/content/library
 */

import { useState, useCallback, useEffect } from 'react';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BookOpen,
  Copy,
  Trash2,
  Check,
  Loader2,
  Filter,
} from '@/components/icons';
import { toast } from 'sonner';

// =============================================================================
// Types
// =============================================================================

interface ContentLibraryItem {
  id: string;
  title: string;
  content: string;
  contentType: string;
  platform: string | null;
  category: string | null;
  tags: string[];
  status: string;
  metadata: Record<string, unknown> | null;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Platform display helpers
// =============================================================================

const PLATFORM_COLORS: Record<string, { dot: string; label: string }> = {
  twitter: { dot: 'bg-sky-400', label: 'Twitter / X' },
  instagram: { dot: 'bg-pink-400', label: 'Instagram' },
  linkedin: { dot: 'bg-blue-400', label: 'LinkedIn' },
  tiktok: { dot: 'bg-rose-400', label: 'TikTok' },
  facebook: { dot: 'bg-indigo-400', label: 'Facebook' },
  youtube: { dot: 'bg-red-400', label: 'YouTube' },
  pinterest: { dot: 'bg-rose-500', label: 'Pinterest' },
  reddit: { dot: 'bg-orange-400', label: 'Reddit' },
  threads: { dot: 'bg-slate-400', label: 'Threads' },
};

function getPlatformMeta(platform: string | null) {
  if (!platform) return { dot: 'bg-violet-400', label: 'General' };
  return PLATFORM_COLORS[platform.toLowerCase()] ?? { dot: 'bg-violet-400', label: platform };
}

const CONTENT_TYPE_BADGES: Record<string, string> = {
  post: 'bg-violet-500/15 text-violet-300 border-violet-500/20',
  caption: 'bg-pink-500/15 text-pink-300 border-pink-500/20',
  story: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  thread: 'bg-sky-500/15 text-sky-300 border-sky-500/20',
  template: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  snippet: 'bg-slate-500/15 text-slate-300 border-slate-500/20',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// =============================================================================
// Skeleton loader
// =============================================================================

function LibrarySkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-zinc-800/50 bg-zinc-900/50 p-5 space-y-3 animate-pulse"
        >
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
            <div className="h-3 w-20 rounded bg-zinc-700" />
          </div>
          <div className="h-4 w-3/4 rounded bg-zinc-700" />
          <div className="space-y-1.5">
            <div className="h-3 w-full rounded bg-zinc-800" />
            <div className="h-3 w-5/6 rounded bg-zinc-800" />
            <div className="h-3 w-4/6 rounded bg-zinc-800" />
          </div>
          <div className="flex justify-between items-center pt-1">
            <div className="h-3 w-16 rounded bg-zinc-700" />
            <div className="flex gap-2">
              <div className="h-7 w-16 rounded bg-zinc-700" />
              <div className="h-7 w-16 rounded bg-zinc-700" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Empty state
// =============================================================================

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="rounded-full bg-violet-500/10 p-5 mb-4">
        <BookOpen className="h-8 w-8 text-violet-400" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">
        {filtered ? 'No matching content' : 'Your library is empty'}
      </h3>
      <p className="text-sm text-slate-400 max-w-xs">
        {filtered
          ? 'Try adjusting the filters to find what you are looking for.'
          : 'Generate content and click Save to build your drafts library.'}
      </p>
    </div>
  );
}

// =============================================================================
// Content Card
// =============================================================================

interface ContentCardProps {
  item: ContentLibraryItem;
  onCopy: (content: string) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

function ContentCard({ item, onCopy, onDelete, isDeleting }: ContentCardProps) {
  const [copied, setCopied] = useState(false);
  const platform = getPlatformMeta(item.platform);
  const badgeClass = CONTENT_TYPE_BADGES[item.contentType] ?? CONTENT_TYPE_BADGES.snippet;
  const preview = item.content.length > 150 ? item.content.slice(0, 150) + '...' : item.content;

  const handleCopy = useCallback(() => {
    onCopy(item.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [item.content, onCopy]);

  return (
    <div className="group rounded-xl border border-zinc-800/50 bg-zinc-900/50 p-5 flex flex-col gap-3 hover:border-zinc-700/60 transition-colors">
      {/* Header row: platform dot + label, content-type badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`flex-shrink-0 h-2.5 w-2.5 rounded-full ${platform.dot}`} />
          <span className="text-xs font-medium text-slate-400 truncate">{platform.label}</span>
        </div>
        <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${badgeClass}`}>
          {item.contentType}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2">
        {item.title}
      </h3>

      {/* Content preview */}
      <p className="text-xs text-slate-400 leading-relaxed flex-1">
        {preview}
      </p>

      {/* Footer: date + actions */}
      <div className="flex items-center justify-between pt-1 gap-2">
        <span className="text-xs text-slate-500">{formatDate(item.createdAt)}</span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopy}
            className="h-7 px-2.5 text-xs text-slate-400 hover:text-white hover:bg-zinc-800/70 gap-1"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(item.id)}
            disabled={isDeleting}
            className="h-7 px-2.5 text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 gap-1"
          >
            {isDeleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Filter Bar
// =============================================================================

const ALL_PLATFORMS = [
  'twitter',
  'instagram',
  'linkedin',
  'tiktok',
  'facebook',
  'youtube',
  'pinterest',
  'reddit',
  'threads',
];

const ALL_CONTENT_TYPES = ['post', 'caption', 'story', 'thread', 'template', 'snippet'];

interface FilterBarProps {
  platform: string;
  contentType: string;
  onPlatformChange: (v: string) => void;
  onContentTypeChange: (v: string) => void;
}

function FilterBar({ platform, contentType, onPlatformChange, onContentTypeChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <Filter className="h-3.5 w-3.5" />
        <span>Filter:</span>
      </div>

      {/* Platform selector */}
      <select
        value={platform}
        onChange={(e) => onPlatformChange(e.target.value)}
        className="text-xs bg-zinc-900/70 border border-zinc-800/50 text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
      >
        <option value="">All platforms</option>
        {ALL_PLATFORMS.map((p) => (
          <option key={p} value={p}>
            {getPlatformMeta(p).label}
          </option>
        ))}
      </select>

      {/* Content type selector */}
      <select
        value={contentType}
        onChange={(e) => onContentTypeChange(e.target.value)}
        className="text-xs bg-zinc-900/70 border border-zinc-800/50 text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
      >
        <option value="">All types</option>
        {ALL_CONTENT_TYPES.map((t) => (
          <option key={t} value={t}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </option>
        ))}
      </select>
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function ContentLibraryPage() {
  const [items, setItems] = useState<ContentLibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState('');
  const [contentTypeFilter, setContentTypeFilter] = useState('');

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ status: 'active', limit: '100' });
      if (platformFilter) params.set('platform', platformFilter);
      if (contentTypeFilter) params.set('contentType', contentTypeFilter);

      const response = await fetch(`/api/content-library?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load library');
      }

      const json = await response.json();
      setItems(json.data ?? []);
    } catch {
      toast.error('Failed to load content library');
    } finally {
      setIsLoading(false);
    }
  }, [platformFilter, contentTypeFilter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleCopy = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard!');
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      setDeletingId(id);
      try {
        const response = await fetch(`/api/content-library/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error((data as { message?: string }).message || 'Failed to delete');
        }

        // Remove from local state immediately (optimistic)
        setItems((prev) => prev.filter((item) => item.id !== id));
        toast.success('Item deleted');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete item');
      } finally {
        setDeletingId(null);
      }
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isFiltered = Boolean(platformFilter || contentTypeFilter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Library"
        description="Your saved drafts and content snippets"
        actions={
          <div className="text-xs text-slate-400">
            {!isLoading && (
              <span>
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </span>
            )}
          </div>
        }
      />

      {/* Filter bar */}
      <Card className="bg-zinc-900/50 border-zinc-800/50">
        <CardContent className="p-4">
          <FilterBar
            platform={platformFilter}
            contentType={contentTypeFilter}
            onPlatformChange={setPlatformFilter}
            onContentTypeChange={setContentTypeFilter}
          />
        </CardContent>
      </Card>

      {/* Content grid */}
      {isLoading ? (
        <LibrarySkeleton />
      ) : items.length === 0 ? (
        <Card className="bg-zinc-900/50 border-zinc-800/50">
          <CardContent className="p-0">
            <EmptyState filtered={isFiltered} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              onCopy={handleCopy}
              onDelete={handleDelete}
              isDeleting={deletingId === item.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
