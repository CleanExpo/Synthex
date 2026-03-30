'use client';

/**
 * MonthlyStoryCard — SYN-553
 *
 * Full-screen overlay shown on first dashboard login after a story is generated.
 * Dismissable — the story remains accessible from nav after dismissal.
 *
 * Fetches the latest unread story via SWR.
 * Posts to /api/monthly-story/[id]/dismiss on close.
 */

import { useState, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import { X, TrendingUp, Clock, Users, Share2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => r.json());

interface StoryData {
  id: string;
  monthYear: string;
  storyText: string;
  totalReach: number;
  postsPublished: number;
  autonomousPosts: number;
  minutesSaved: number;
  referralClicked: boolean;
  generatedAt: string;
  deliveredAt: string;
}

function getMonthLabel(monthYear: string): string {
  const [year, month] = monthYear.split('-');
  return new Date(Number(year), Number(month) - 1, 1).toLocaleString('en-AU', {
    month: 'long',
    year: 'numeric',
  });
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-AU');
}

interface MonthlyStoryCardProps {
  className?: string;
}

export function MonthlyStoryCard({ className }: MonthlyStoryCardProps) {
  const [dismissing, setDismissing] = useState(false);

  const { data } = useSWR<{ story: StoryData | null }>(
    '/api/monthly-story/latest',
    fetchJson,
    { revalidateOnFocus: false }
  );

  const story = data?.story ?? null;

  const handleDismiss = useCallback(async () => {
    if (!story) return;
    setDismissing(true);
    try {
      await fetch(`/api/monthly-story/${story.id}/dismiss`, {
        method: 'POST',
        credentials: 'include',
      });
      // Invalidate so the card disappears
      await mutate('/api/monthly-story/latest');
    } catch {
      toast.error('Could not dismiss — please try again.');
    } finally {
      setDismissing(false);
    }
  }, [story]);

  if (!story) return null;

  const monthLabel = getMonthLabel(story.monthYear);
  const hoursaved = Math.round(story.minutesSaved / 60);
  const paragraphs = story.storyText.split('\n\n').filter(Boolean);

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4',
        className
      )}
      role="dialog"
      aria-modal="true"
      aria-label={`${monthLabel} monthly marketing story`}
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#111111] border border-white/[0.08] rounded-lg shadow-2xl">
        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          disabled={dismissing}
          className="absolute top-4 right-4 text-white/30 hover:text-white/70 transition-colors z-10"
          aria-label="Dismiss monthly story"
        >
          {dismissing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <X className="h-5 w-5" />
          )}
        </button>

        {/* Header */}
        <div className="p-6 pb-0">
          <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">
            Monthly Marketing Story
          </p>
          <h2 className="text-xl font-light text-white">{monthLabel}</h2>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 p-6">
          <div className="text-center p-3 bg-white/[0.03] border border-white/[0.06] rounded-sm">
            <div className="flex items-center justify-center mb-1">
              <Users className="h-3.5 w-3.5 text-white/30" />
            </div>
            <p className="text-xl font-light text-white">
              {formatNumber(story.totalReach)}
            </p>
            <p className="text-[10px] text-white/30 uppercase tracking-wider mt-0.5">
              Total Reach
            </p>
          </div>
          <div className="text-center p-3 bg-white/[0.03] border border-white/[0.06] rounded-sm">
            <div className="flex items-center justify-center mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-white/30" />
            </div>
            <p className="text-xl font-light text-white">
              {story.postsPublished}
            </p>
            <p className="text-[10px] text-white/30 uppercase tracking-wider mt-0.5">
              Posts Published
            </p>
          </div>
          <div className="text-center p-3 bg-orange-500/[0.06] border border-orange-500/20 rounded-sm">
            <div className="flex items-center justify-center mb-1">
              <Clock className="h-3.5 w-3.5 text-orange-400/60" />
            </div>
            <p className="text-xl font-light text-orange-400">{hoursaved}h</p>
            <p className="text-[10px] text-orange-400/50 uppercase tracking-wider mt-0.5">
              Time Saved
            </p>
          </div>
        </div>

        {/* Story text */}
        <div className="px-6 pb-6 space-y-4">
          {paragraphs.map((para, i) => (
            <p key={i} className="text-sm text-white/70 leading-relaxed">
              {para}
            </p>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-0 border-t border-white/[0.06] flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDismiss}
            disabled={dismissing}
            className="border-white/10 text-white/50 hover:text-white hover:border-white/20"
          >
            {dismissing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : null}
            Close
          </Button>

          {story.autonomousPosts > 0 && (
            <p className="text-xs text-white/25">
              {story.autonomousPosts} of {story.postsPublished} posts published
              automatically
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
