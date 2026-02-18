'use client';

/**
 * Link in Bio Dashboard Page
 *
 * @description Manage bio pages - create, edit, preview, delete.
 * Shows list of all bio pages with stats and actions.
 */

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLinkBio, LinkBioPage } from '@/hooks/useLinkBio';
import { PageHeader } from '@/components/dashboard/page-header';
import { DashboardEmptyState } from '@/components/dashboard/empty-state';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Link2,
  Plus,
  Eye,
  MousePointer,
  ExternalLink,
  Edit,
  Copy,
  Trash2,
  Loader2,
  FileText,
  Check,
} from '@/components/icons';
import { cn } from '@/lib/utils';

// Slugify helper for preview
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function BioPagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pages, totals, isLoading, error, createPage, deletePage, refresh } = useLinkBio();

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<LinkBioPage | null>(null);

  // Form state
  const [newTitle, setNewTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Check for ?action=create
  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      setShowCreateDialog(true);
    }
  }, [searchParams]);

  // Handle create page
  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) return;

    setIsCreating(true);
    const page = await createPage(newTitle.trim());
    setIsCreating(false);

    if (page) {
      setShowCreateDialog(false);
      setNewTitle('');
      router.push(`/dashboard/bio/${page.id}`);
    }
  }, [newTitle, createPage, router]);

  // Handle delete page
  const handleDelete = useCallback(async () => {
    if (!pageToDelete) return;

    await deletePage(pageToDelete.id);
    setShowDeleteDialog(false);
    setPageToDelete(null);
  }, [pageToDelete, deletePage]);

  // Copy URL to clipboard
  const handleCopyUrl = useCallback((page: LinkBioPage) => {
    const url = `${window.location.origin}/bio/${page.slug}`;
    navigator.clipboard.writeText(url);
    setCopiedId(page.id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // Get base URL for preview
  const getPublicUrl = (slug: string) => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/bio/${slug}`;
    }
    return `/bio/${slug}`;
  };

  return (
    <div className="flex-1 space-y-6 p-6">
      <PageHeader
        title="Link in Bio"
        description="Create customizable landing pages for your social profiles"
        actions={
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Create Page
          </Button>
        }
      />

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900/50 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <FileText className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Pages</p>
              <p className="text-2xl font-bold text-white">{totals.totalPages}</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-900/50 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Eye className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Views</p>
              <p className="text-2xl font-bold text-white">{totals.totalViews.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-900/50 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <MousePointer className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Clicks</p>
              <p className="text-2xl font-bold text-white">{totals.totalClicks.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && pages.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && pages.length === 0 && (
        <DashboardEmptyState
          icon={Link2}
          title="Create your first Link in Bio page"
          description="Build a customizable landing page for your social profiles with links, themes, and analytics."
          action={{
            label: 'Create Page',
            onClick: () => setShowCreateDialog(true),
          }}
        />
      )}

      {/* Pages Grid */}
      {pages.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pages.map((page) => (
            <div
              key={page.id}
              className="bg-gray-900/50 border border-white/10 rounded-xl p-4 hover:border-white/20 transition-colors"
            >
              {/* Header */}
              <div className="flex items-start gap-3 mb-3">
                {page.avatarUrl ? (
                  <img
                    src={page.avatarUrl}
                    alt={page.title}
                    className="w-12 h-12 rounded-full object-cover border border-white/10"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center">
                    <Link2 className="w-6 h-6 text-cyan-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white truncate">{page.title}</h3>
                  <p className="text-sm text-gray-400 truncate">/{page.slug}</p>
                </div>
                <Badge
                  variant={page.isPublished ? 'default' : 'secondary'}
                  className={cn(
                    page.isPublished
                      ? 'bg-green-500/10 text-green-400 border-green-500/20'
                      : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                  )}
                >
                  {page.isPublished ? 'Published' : 'Draft'}
                </Badge>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 mb-4 text-sm text-gray-400">
                <div className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  <span>{page.totalViews.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MousePointer className="w-4 h-4" />
                  <span>{page.totalClicks.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Link2 className="w-4 h-4" />
                  <span>{page._count?.links ?? 0} links</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/dashboard/bio/${page.id}`)}
                  className="flex-1"
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => window.open(getPublicUrl(page.slug), '_blank')}
                  title="Preview"
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCopyUrl(page)}
                  title="Copy URL"
                >
                  {copiedId === page.id ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setPageToDelete(page);
                    setShowDeleteDialog(true);
                  }}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Bio Page</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Page Title</Label>
              <Input
                id="title"
                placeholder="My Links"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            {newTitle && (
              <p className="text-sm text-gray-400">
                URL will be: /bio/<span className="text-cyan-400">{slugify(newTitle)}</span>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newTitle.trim() || isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Page'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Bio Page</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-400 py-4">
            Are you sure you want to delete "{pageToDelete?.title}"? This action cannot be undone
            and all links and analytics will be permanently lost.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
