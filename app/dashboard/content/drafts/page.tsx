'use client';

/**
 * Drafts Library Page
 *
 * Displays all saved content drafts for the authenticated user.
 * Supports filtering by platform and status, copying to clipboard,
 * editing, and deleting drafts.
 *
 * Route: /dashboard/content/drafts
 */

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Copy,
  Trash2,
  Check,
  Loader2,
  Filter,
  Edit,
  Clock,
  Plus,
} from '@/components/icons';
import { toast } from 'sonner';
import { fetchWithCSRF } from '@/lib/csrf';

// =============================================================================
// Types
// =============================================================================

interface ContentDraft {
  id: string;
  platform: string;
  content: string;
  title: string | null;
  hashtags: string[];
  hookType: string | null;
  tone: string | null;
  topic: string | null;
  targetLength: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
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

function getPlatformMeta(platform: string) {
  return PLATFORM_COLORS[platform.toLowerCase()] ?? { dot: 'bg-violet-400', label: platform };
}

const STATUS_BADGES: Record<string, string> = {
  draft: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  scheduled: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/20',
  published: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

// =============================================================================
// Skeleton loader
// =============================================================================

function DraftsSkeleton() {
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
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="rounded-full bg-cyan-500/10 p-5 mb-4">
        <FileText className="h-8 w-8 text-cyan-400" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">
        {filtered ? 'No matching drafts' : 'No drafts yet'}
      </h3>
      <p className="text-sm text-slate-400 max-w-xs mb-4">
        {filtered
          ? 'Try adjusting the filters to find what you are looking for.'
          : 'Generate content and click Save to create your first draft.'}
      </p>
      {!filtered && (
        <Button
          onClick={() => router.push('/dashboard/content')}
          className="gradient-primary text-white"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Content
        </Button>
      )}
    </div>
  );
}

// =============================================================================
// Draft Card
// =============================================================================

interface DraftCardProps {
  draft: ContentDraft;
  onCopy: (content: string) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

function DraftCard({ draft, onCopy, onDelete, isDeleting }: DraftCardProps) {
  const [copied, setCopied] = useState(false);
  const platform = getPlatformMeta(draft.platform);
  const badgeClass = STATUS_BADGES[draft.status] ?? STATUS_BADGES.draft;
  const preview = draft.content.length > 180 ? draft.content.slice(0, 180) + '...' : draft.content;

  const handleCopy = useCallback(() => {
    onCopy(draft.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [draft.content, onCopy]);

  return (
    <div className="group rounded-xl border border-zinc-800/50 bg-zinc-900/50 p-5 flex flex-col gap-3 hover:border-zinc-700/60 transition-colors">
      {/* Header row: platform dot + label, status badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`flex-shrink-0 h-2.5 w-2.5 rounded-full ${platform.dot}`} />
          <span className="text-xs font-medium text-slate-400 truncate">{platform.label}</span>
        </div>
        <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${badgeClass}`}>
          {draft.status}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2">
        {draft.title || draft.topic || `${platform.label} draft`}
      </h3>

      {/* Content preview */}
      <p className="text-xs text-slate-400 leading-relaxed flex-1">
        {preview}
      </p>

      {/* Tags row */}
      {draft.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {draft.hashtags.slice(0, 4).map((tag) => (
            <span key={tag} className="text-[10px] text-cyan-400/70 bg-cyan-500/10 px-1.5 py-0.5 rounded">
              #{tag.replace(/^#/, '')}
            </span>
          ))}
          {draft.hashtags.length > 4 && (
            <span className="text-[10px] text-slate-500">
              +{draft.hashtags.length - 4} more
            </span>
          )}
        </div>
      )}

      {/* Footer: relative time + actions */}
      <div className="flex items-center justify-between pt-1 gap-2">
        <span className="text-xs text-slate-500 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatRelativeTime(draft.updatedAt)}
        </span>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopy}
            className="h-7 px-2 text-xs text-slate-400 hover:text-white hover:bg-zinc-800/70 gap-1"
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
            onClick={() => onDelete(draft.id)}
            disabled={isDeleting}
            className="h-7 px-2 text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 gap-1"
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

const ALL_STATUSES = ['draft', 'scheduled', 'published'];

interface FilterBarProps {
  platform: string;
  status: string;
  onPlatformChange: (v: string) => void;
  onStatusChange: (v: string) => void;
}

function FilterBar({ platform, status, onPlatformChange, onStatusChange }: FilterBarProps) {
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
        className="text-xs bg-zinc-900/70 border border-zinc-800/50 text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
      >
        <option value="">All platforms</option>
        {ALL_PLATFORMS.map((p) => (
          <option key={p} value={p}>
            {getPlatformMeta(p).label}
          </option>
        ))}
      </select>

      {/* Status selector */}
      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        className="text-xs bg-zinc-900/70 border border-zinc-800/50 text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
      >
        <option value="">All statuses</option>
        {ALL_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </option>
        ))}
      </select>
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function DraftsLibraryPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------

  const fetchDrafts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (platformFilter) params.set('platform', platformFilter);
      if (statusFilter) params.set('status', statusFilter);

      const response = await fetch(`/api/content-drafts?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load drafts');
      }

      const json = await response.json();
      setDrafts(json.drafts ?? []);
      setTotal(json.total ?? 0);
    } catch {
      toast.error('Failed to load drafts');
    } finally {
      setIsLoading(false);
    }
  }, [platformFilter, statusFilter]);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

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
        const response = await fetchWithCSRF(`/api/content-drafts/${id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error || 'Failed to delete');
        }

        // Optimistic removal from local state
        setDrafts((prev) => prev.filter((d) => d.id !== id));
        setTotal((prev) => Math.max(0, prev - 1));
        toast.success('Draft deleted');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete draft');
      } finally {
        setDeletingId(null);
      }
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isFiltered = Boolean(platformFilter || statusFilter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Drafts"
        description="Your saved content drafts — edit, refine, and publish"
        actions={
          <div className="flex items-center gap-3">
            {!isLoading && (
              <span className="text-xs text-slate-400">
                {total} {total === 1 ? 'draft' : 'drafts'}
              </span>
            )}
            <Button
              onClick={() => router.push('/dashboard/content')}
              className="gradient-primary text-white"
              size="sm"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Content
            </Button>
          </div>
        }
      />

      {/* Filter bar */}
      <Card className="bg-zinc-900/50 border-zinc-800/50">
        <CardContent className="p-4">
          <FilterBar
            platform={platformFilter}
            status={statusFilter}
            onPlatformChange={setPlatformFilter}
            onStatusChange={setStatusFilter}
          />
        </CardContent>
      </Card>

      {/* Drafts grid */}
      {isLoading ? (
        <DraftsSkeleton />
      ) : drafts.length === 0 ? (
        <Card className="bg-zinc-900/50 border-zinc-800/50">
          <CardContent className="p-0">
            <EmptyState filtered={isFiltered} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {drafts.map((draft) => (
            <DraftCard
              key={draft.id}
              draft={draft}
              onCopy={handleCopy}
              onDelete={handleDelete}
              isDeleting={deletingId === draft.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
