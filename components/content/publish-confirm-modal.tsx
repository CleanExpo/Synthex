'use client';

/**
 * Publish Confirmation Modal
 *
 * Reusable modal for scheduling/publishing content. Shows a date/time
 * picker, platform account selector (fetched from connected accounts),
 * and a content summary before confirming the schedule action.
 *
 * Used by:
 * - Content page (/dashboard/content)
 * - Drafts page (/dashboard/content/drafts)
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import useSWR from 'swr';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Send,
  Check,
} from '@/components/icons';
import Link from 'next/link';

// =============================================================================
// Types
// =============================================================================

export interface PublishOptions {
  scheduledAt: string; // ISO datetime
  platform: string;
  connectionId?: string; // specific platform connection to use
}

export interface PublishConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  platform: string;
  mediaUrls?: string[];
  hashtags?: string[];
  onConfirm: (options: PublishOptions) => Promise<void>;
}

// =============================================================================
// Helpers
// =============================================================================

interface ConnectionStatus {
  platform: string;
  connected: boolean;
  username?: string;
  avatar?: string;
  connectedAt?: string;
  expiresAt?: string;
  isExpired: boolean;
  needsRefresh: boolean;
}

interface ConnectionsResponse {
  connections: ConnectionStatus[];
  summary: { total: number; connected: number; needsAttention: number };
}

const PLATFORM_LABELS: Record<string, string> = {
  twitter: 'Twitter / X',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  youtube: 'YouTube',
  pinterest: 'Pinterest',
  reddit: 'Reddit',
  threads: 'Threads',
};

function getPlatformLabel(platform: string): string {
  return PLATFORM_LABELS[platform.toLowerCase()] ?? platform;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

/**
 * Returns a datetime-local string 1 hour from now in the user's local
 * timezone, which is used as the default value for the date picker.
 */
function getDefaultScheduleTime(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  // datetime-local expects YYYY-MM-DDTHH:mm
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Minimum datetime-local value (now, rounded to the minute) */
function getMinDateTime(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// =============================================================================
// Component
// =============================================================================

export function PublishConfirmModal({
  open,
  onOpenChange,
  content,
  platform,
  mediaUrls,
  hashtags,
  onConfirm,
}: PublishConfirmModalProps) {
  const [scheduledAt, setScheduledAt] = useState(getDefaultScheduleTime);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset time picker when modal opens
  useEffect(() => {
    if (open) {
      setScheduledAt(getDefaultScheduleTime());
    }
  }, [open]);

  // Fetch connected accounts for the selected platform
  const { data: connectionsData, isLoading: connectionsLoading } =
    useSWR<ConnectionsResponse>(
      open ? '/api/auth/connections' : null,
      fetchJson,
      { revalidateOnFocus: false }
    );

  // Filter to only the connections for this platform
  const platformConnections = useMemo(() => {
    if (!connectionsData?.connections) return [];
    return connectionsData.connections.filter(
      (c) => c.platform === platform.toLowerCase() && c.connected
    );
  }, [connectionsData, platform]);

  const hasConnection = platformConnections.length > 0;
  const connectionLabel =
    platformConnections.length === 1 ? platformConnections[0].username : undefined;

  // Content preview
  const preview =
    content.length > 100 ? content.slice(0, 100) + '...' : content;

  const handleConfirm = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const isoDate = new Date(scheduledAt).toISOString();
      await onConfirm({
        scheduledAt: isoDate,
        platform,
      });
      onOpenChange(false);
    } catch {
      // Error handling left to the parent (toast, etc.)
    } finally {
      setIsSubmitting(false);
    }
  }, [scheduledAt, platform, onConfirm, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="glass-solid" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-cyan-400" />
            Schedule Post
          </DialogTitle>
          <DialogDescription>
            Confirm the date, time, and platform account before scheduling.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Content summary */}
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-2">
            <p className="text-xs text-slate-400 leading-relaxed">{preview}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-medium text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                {getPlatformLabel(platform)}
              </span>
              {mediaUrls && mediaUrls.length > 0 && (
                <span className="text-[10px] text-slate-400">
                  {mediaUrls.length} {mediaUrls.length === 1 ? 'image' : 'images'}
                </span>
              )}
              {hashtags && hashtags.length > 0 && (
                <span className="text-[10px] text-slate-400">
                  {hashtags.length} {hashtags.length === 1 ? 'hashtag' : 'hashtags'}
                </span>
              )}
            </div>
          </div>

          {/* Date / time picker */}
          <div className="space-y-1.5">
            <label
              htmlFor="schedule-datetime"
              className="text-xs font-medium text-slate-300"
            >
              Schedule for
            </label>
            <input
              id="schedule-datetime"
              type="datetime-local"
              value={scheduledAt}
              min={getMinDateTime()}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/40 [color-scheme:dark]"
            />
          </div>

          {/* Platform account status */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Platform account
            </label>

            {connectionsLoading ? (
              <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Checking connected accounts...
              </div>
            ) : hasConnection ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                <span className="text-xs text-emerald-300">
                  Connected{connectionLabel ? ` as ${connectionLabel}` : ''}
                </span>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-amber-300">
                    No connected {getPlatformLabel(platform)} account. The post
                    will fail to publish without a connected account.
                  </span>
                </div>
                <Link
                  href="/dashboard/platforms"
                  className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  Connect account
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-slate-400 hover:text-white hover:bg-white/5"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting || !scheduledAt}
            className="gradient-primary text-white gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {isSubmitting ? 'Scheduling...' : 'Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
