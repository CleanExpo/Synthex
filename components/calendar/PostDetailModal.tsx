'use client';

/**
 * Post Detail Modal Component
 *
 * Modal for viewing and editing scheduled post details.
 */

import React, { useState, useEffect } from 'react';
import { ScheduledPost, PLATFORM_COLORS } from './CalendarTypes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  X,
  Calendar,
  Clock,
  Twitter,
  Linkedin,
  Instagram,
  Facebook,
  Video,
  Send,
  Trash2,
  Copy,
  Save,
  AlertTriangle,
  CheckCircle,
  Loader2,
  RotateCcw,
} from '@/components/icons';

const platformIcons: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  twitter: Twitter,
  linkedin: Linkedin,
  instagram: Instagram,
  facebook: Facebook,
  tiktok: Video,
};

const platformNames: Record<string, string> = {
  twitter: 'Twitter/X',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
};

interface PostDetailModalProps {
  post: ScheduledPost | null;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (post: ScheduledPost) => void;
  onDelete?: (postId: string) => void;
  onPublishNow?: (postId: string) => void;
  onDuplicate?: (post: ScheduledPost) => void;
}

export function PostDetailModal({
  post,
  isOpen,
  onClose,
  onSave,
  onDelete,
  onPublishNow,
  onDuplicate,
}: PostDetailModalProps) {
  const [editedPost, setEditedPost] = useState<ScheduledPost | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    if (post) {
      setEditedPost({ ...post });
    }
  }, [post]);

  if (!isOpen || !editedPost) return null;

  const handleSave = async () => {
    if (!editedPost) return;
    setIsSaving(true);
    try {
      await onSave?.(editedPost);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editedPost) return;
    setIsDeleting(true);
    try {
      await onDelete?.(editedPost.id);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePublishNow = async () => {
    if (!editedPost) return;
    setIsPublishing(true);
    try {
      await onPublishNow?.(editedPost.id);
      onClose();
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDuplicate = () => {
    if (!editedPost) return;
    onDuplicate?.(editedPost);
    onClose();
  };

  const togglePlatform = (platform: string) => {
    if (!editedPost) return;
    const platforms = editedPost.platforms.includes(platform)
      ? editedPost.platforms.filter((p) => p !== platform)
      : [...editedPost.platforms, platform];

    if (platforms.length > 0) {
      setEditedPost({ ...editedPost, platforms });
    }
  };

  const formatDateTimeLocal = (date: Date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-gray-900 rounded-xl border border-white/10 shadow-2xl max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">
            {editedPost.status === 'draft' ? 'Edit Draft' : 'Post Details'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Status Banner */}
          <div
            className={`
            flex items-center gap-2 p-3 rounded-lg
            ${
              editedPost.status === 'published'
                ? 'bg-green-500/20 text-green-300'
                : editedPost.status === 'failed'
                ? 'bg-red-500/20 text-red-300'
                : editedPost.status === 'scheduled'
                ? 'bg-cyan-500/20 text-cyan-300'
                : 'bg-gray-500/20 text-gray-300'
            }
          `}
          >
            {editedPost.status === 'published' ? (
              <CheckCircle className="h-4 w-4" />
            ) : editedPost.status === 'failed' ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <Clock className="h-4 w-4" />
            )}
            <span className="text-sm font-medium capitalize">
              {editedPost.status}
            </span>
            {editedPost.status === 'scheduled' && (
              <span className="text-sm">
                - Scheduled for{' '}
                {new Date(editedPost.scheduledFor).toLocaleString()}
              </span>
            )}
          </div>

          {/* Conflict Warning */}
          {editedPost.conflict && (
            <div
              className={`
              flex items-center gap-2 p-3 rounded-lg
              ${
                editedPost.conflict.severity === 'error'
                  ? 'bg-red-500/20 text-red-300'
                  : 'bg-yellow-500/20 text-yellow-300'
              }
            `}
            >
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{editedPost.conflict.message}</span>
            </div>
          )}

          {/* Platforms */}
          <div>
            <Label className="text-gray-400 mb-2 block">Platforms</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(platformNames).map(([key, name]) => {
                const Icon = platformIcons[key];
                const isSelected = editedPost.platforms.includes(key);
                const color = PLATFORM_COLORS[key];

                return (
                  <button
                    key={key}
                    onClick={() => togglePlatform(key)}
                    disabled={editedPost.status === 'published'}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-lg border transition-all
                      ${
                        isSelected
                          ? 'border-transparent'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }
                      ${
                        editedPost.status === 'published'
                          ? 'opacity-50 cursor-not-allowed'
                          : 'cursor-pointer'
                      }
                    `}
                    style={
                      isSelected
                        ? { backgroundColor: `${color}30`, borderColor: color }
                        : {}
                    }
                  >
                    {Icon && (
                      <Icon
                        className="h-4 w-4"
                        style={{ color: isSelected ? color : undefined }}
                      />
                    )}
                    <span
                      className={`text-sm ${
                        isSelected ? '' : 'text-gray-400'
                      }`}
                      style={{ color: isSelected ? color : undefined }}
                    >
                      {name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div>
            <Label htmlFor="content" className="text-gray-400 mb-2 block">
              Content
            </Label>
            <Textarea
              id="content"
              value={editedPost.content}
              onChange={(e) =>
                setEditedPost({ ...editedPost, content: e.target.value })
              }
              disabled={editedPost.status === 'published'}
              className="min-h-[120px] bg-white/5 border-white/10 text-white"
              placeholder="Write your post content..."
            />
            <div className="flex justify-end mt-1 text-xs text-gray-500">
              <span>{editedPost.content.length} characters</span>
            </div>
          </div>

          {/* Schedule Time */}
          <div>
            <Label htmlFor="scheduledFor" className="text-gray-400 mb-2 block">
              Schedule Time
            </Label>
            <Input
              id="scheduledFor"
              type="datetime-local"
              value={formatDateTimeLocal(new Date(editedPost.scheduledFor))}
              onChange={(e) =>
                setEditedPost({
                  ...editedPost,
                  scheduledFor: new Date(e.target.value),
                })
              }
              disabled={editedPost.status === 'published'}
              className="bg-white/5 border-white/10 text-white"
            />
          </div>

          {/* Hashtags */}
          <div>
            <Label htmlFor="hashtags" className="text-gray-400 mb-2 block">
              Hashtags
            </Label>
            <Input
              id="hashtags"
              value={editedPost.hashtags?.join(' ') || ''}
              onChange={(e) =>
                setEditedPost({
                  ...editedPost,
                  hashtags: e.target.value
                    .split(' ')
                    .filter((h) => h.startsWith('#') || h.length > 0)
                    .map((h) => (h.startsWith('#') ? h : `#${h}`)),
                })
              }
              disabled={editedPost.status === 'published'}
              className="bg-white/5 border-white/10 text-white"
              placeholder="#marketing #socialmedia #ai"
            />
          </div>

          {/* Engagement Stats (for published posts) */}
          {editedPost.status === 'published' && editedPost.engagement && (
            <div>
              <Label className="text-gray-400 mb-2 block">Engagement</Label>
              <div className="grid grid-cols-4 gap-4">
                <div className="p-3 bg-white/5 rounded-lg text-center">
                  <div className="text-lg font-semibold text-white">
                    {editedPost.engagement.likes || 0}
                  </div>
                  <div className="text-xs text-gray-400">Likes</div>
                </div>
                <div className="p-3 bg-white/5 rounded-lg text-center">
                  <div className="text-lg font-semibold text-white">
                    {editedPost.engagement.comments || 0}
                  </div>
                  <div className="text-xs text-gray-400">Comments</div>
                </div>
                <div className="p-3 bg-white/5 rounded-lg text-center">
                  <div className="text-lg font-semibold text-white">
                    {editedPost.engagement.shares || 0}
                  </div>
                  <div className="text-xs text-gray-400">Shares</div>
                </div>
                <div className="p-3 bg-white/5 rounded-lg text-center">
                  <div className="text-lg font-semibold text-green-400">
                    {editedPost.engagement.actual || 0}%
                  </div>
                  <div className="text-xs text-gray-400">Engagement</div>
                </div>
              </div>
            </div>
          )}

          {/* Post Lifecycle Timeline */}
          <PostLifecycleTimeline metadata={editedPost.metadata} />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 border-t border-white/10 bg-gray-900/80">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDuplicate}
              className="text-gray-400 hover:text-white"
            >
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </Button>
            {editedPost.status !== 'published' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="bg-white/5 border-white/10 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            {editedPost.status === 'scheduled' && (
              <Button
                variant="outline"
                onClick={handlePublishNow}
                disabled={isPublishing}
                className="bg-green-500/20 border-green-500/50 text-green-300 hover:bg-green-500/30"
              >
                {isPublishing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Publish Now
              </Button>
            )}
            {editedPost.status !== 'published' && (
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="gradient-primary text-white"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Post Lifecycle Timeline Sub-Component
// =============================================================================

interface HistoryEntry {
  event: string;
  at: string;
  reason?: string;
  attempt?: number;
  retryAt?: string;
  platformPostId?: string;
  attempts?: number;
}

const EVENT_CONFIG: Record<
  string,
  { label: string; dotClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  published: {
    label: 'Published',
    dotClass: 'bg-emerald-500',
    icon: CheckCircle,
  },
  retry_scheduled: {
    label: 'Retry Scheduled',
    dotClass: 'bg-amber-500',
    icon: RotateCcw,
  },
  failed_permanently: {
    label: 'Failed Permanently',
    dotClass: 'bg-red-500',
    icon: AlertTriangle,
  },
  scheduled: {
    label: 'Scheduled',
    dotClass: 'bg-cyan-500',
    icon: Clock,
  },
  created: {
    label: 'Created',
    dotClass: 'bg-gray-500',
    icon: Calendar,
  },
};

function formatTimelineDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function PostLifecycleTimeline({ metadata }: { metadata?: Record<string, unknown> | null }) {
  if (!metadata) return null;

  const history = (metadata.history as HistoryEntry[]) || [];
  if (history.length === 0) return null;

  // Sort newest first
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );

  return (
    <div>
      <Label className="text-gray-400 mb-3 block">History</Label>
      <div className="relative space-y-0">
        {/* Vertical line */}
        <div className="absolute left-[9px] top-2 bottom-2 w-px bg-white/10" />

        {sortedHistory.map((entry, idx) => {
          const config = EVENT_CONFIG[entry.event] ?? EVENT_CONFIG.created;
          const Icon = config.icon;

          return (
            <div key={idx} className="relative flex items-start gap-3 py-2">
              {/* Dot */}
              <div
                className={`relative z-10 mt-0.5 h-[18px] w-[18px] rounded-full ${config.dotClass} flex items-center justify-center flex-shrink-0`}
              >
                <Icon className="h-2.5 w-2.5 text-white" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-white">
                    {config.label}
                    {entry.attempt !== undefined && (
                      <span className="text-xs text-gray-400 ml-1">
                        ({entry.attempt}/{(metadata?.maxRetries as number) ?? 3})
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatTimelineDate(entry.at)}
                  </span>
                </div>
                {entry.reason && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {entry.reason}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PostDetailModal;
