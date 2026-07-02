'use client';

/**
 * Quick Post Modal
 * Minimal 3-field post creation triggered from the GetStartedChecklist.
 * Fields: platform, text, scheduled time.
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2, Zap } from '@/components/icons';
import { toast } from 'sonner';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';

interface ConnectedPlatform {
  id: string;
  platform: string;
  profileName: string | null;
}

interface QuickPostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const PLATFORM_LABELS: Record<string, string> = {
  twitter: 'Twitter / X',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  threads: 'Threads',
  youtube: 'YouTube',
  pinterest: 'Pinterest',
  reddit: 'Reddit',
};

const ALL_PLATFORMS = Object.keys(PLATFORM_LABELS);

export function QuickPostModal({
  open,
  onOpenChange,
  onSuccess,
}: QuickPostModalProps) {
  // SYN-847: the active child-brand org selected in the workspace brand-
  // switcher. When the owner has switched brands, send that org so the
  // campaign is created under the active brand instead of falling back to the
  // user's default org. null for non-owners / no active brand (API handles it).
  const { activeOrganizationId } = useActiveBusiness();

  const [platforms, setPlatforms] = useState<ConnectedPlatform[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [content, setContent] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Load connected platforms when modal opens
  useEffect(() => {
    if (!open) return;
    fetch('/api/integrations', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.integrations?.length) {
          setPlatforms(data.integrations);
          setSelectedPlatform(data.integrations[0].platform);
        }
      })
      .catch(() => {
        /* silently fallback to static list */
      });
  }, [open]);

  // Default to 1 hour from now
  useEffect(() => {
    if (!open) return;
    const d = new Date(Date.now() + 60 * 60 * 1000);
    // Format for datetime-local input: YYYY-MM-DDTHH:MM
    const pad = (n: number) => String(n).padStart(2, '0');
    setScheduledAt(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
  }, [open]);

  const handleSubmit = async (asDraft = false) => {
    if (!content.trim()) {
      toast.error('Please write something first.');
      return;
    }
    if (!selectedPlatform) {
      toast.error('Please select a platform.');
      return;
    }

    const setBusy = asDraft ? setIsSavingDraft : setIsSubmitting;
    setBusy(true);
    try {
      const now = new Date();
      // "Save as Draft" deliberately omits the schedule so the post lands as a
      // draft the user can pick up later — act first, schedule later.
      const scheduled = asDraft || !scheduledAt ? null : new Date(scheduledAt);

      const res = await fetch('/api/campaigns', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Quick Post — ${now.toLocaleDateString('en-AU')}`,
          platform: selectedPlatform,
          content: content.trim(),
          // SYN-847: scope to the active child brand when one is selected.
          ...(activeOrganizationId
            ? { organizationId: activeOrganizationId }
            : {}),
          settings: scheduled
            ? { scheduledAt: scheduled.toISOString() }
            : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create post');
      }

      toast.success(scheduled ? 'Post scheduled!' : 'Draft saved!', {
        description: scheduled
          ? `Scheduled for ${scheduled.toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}`
          : 'Find it on the Content page when you’re ready to schedule.',
      });

      setContent('');
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  // Available platforms: connected ones if available, otherwise full list
  const availablePlatforms =
    platforms.length > 0 ? platforms.map(p => p.platform) : ALL_PLATFORMS;

  const remainingChars = 280 - content.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#12121E] border-white/[0.08] max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white font-light">
            <div className="w-7 h-7 flex items-center justify-center bg-orange-500/10 border-[0.5px] border-orange-500/20 rounded-sm">
              <Zap className="h-3.5 w-3.5 text-orange-400" />
            </div>
            Quick Post
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Platform */}
          <div className="space-y-1.5">
            <Label className="text-xs text-white/50 uppercase tracking-wide">
              Platform
            </Label>
            <Select
              value={selectedPlatform}
              onValueChange={setSelectedPlatform}
            >
              <SelectTrigger className="bg-white/[0.03] border-white/[0.08] text-white">
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent className="bg-[#12121E] border-white/[0.08]">
                {availablePlatforms.map(p => (
                  <SelectItem
                    key={p}
                    value={p}
                    className="text-white hover:bg-white/[0.05]"
                  >
                    {PLATFORM_LABELS[p] ?? p}
                    {platforms.find(c => c.platform === p)?.profileName
                      ? ` · ${platforms.find(c => c.platform === p)!.profileName}`
                      : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <Label className="text-xs text-white/50 uppercase tracking-wide">
              Content
            </Label>
            <Textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="What do you want to share?"
              rows={4}
              maxLength={280}
              className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/50 resize-none"
            />
            <p
              className={`text-[10px] text-right ${remainingChars < 20 ? 'text-orange-400' : 'text-white/50'}`}
            >
              {remainingChars} chars remaining
            </p>
          </div>

          {/* Schedule time */}
          <div className="space-y-1.5">
            <Label className="text-xs text-white/50 uppercase tracking-wide">
              Schedule for
            </Label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              className="bg-white/[0.03] border-white/[0.08] text-white"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="border-white/[0.08] text-white/50 hover:text-white bg-transparent"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || isSavingDraft}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-white/[0.08] text-white/70 hover:text-white bg-transparent"
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting || isSavingDraft || !content.trim()}
            >
              {isSavingDraft ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save as Draft'
              )}
            </Button>
            <Button
              className="flex-1 bg-orange-500 hover:bg-orange-400 text-[#050505] font-semibold"
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting || isSavingDraft || !content.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Posting...
                </>
              ) : (
                'Create Post'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
