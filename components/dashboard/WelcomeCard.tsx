'use client';

/**
 * Welcome Card Component
 *
 * Surfaces the onboarding analysis (SEO score, detected platforms, key topics,
 * audience, tone) on the dashboard so new users understand what the AI found
 * about their business and know what to do next.
 *
 * Dismissible only after 3 dashboard visits — prevents premature dismissal.
 */

import { useEffect, useState, useCallback } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Sparkles,
  Globe,
  X,
  Zap,
  Users,
  BarChart,
  AlertCircle,
} from '@/components/icons';
import { Icon3D } from '@/components/icons/Icon3D';
import { fetchJson } from '@/lib/fetcher';

// ── Types ────────────────────────────────────────────────────────────────────

interface OnboardingSummary {
  exists: boolean;
  userName: string | null;
  businessName: string | null;
  website: string | null;
  seoScore: number | null;
  pageSpeedMobile: number | null;
  pageSpeedDesktop: number | null;
  keyTopics: string[];
  targetAudience: string | null;
  suggestedTone: string | null;
  brandColours: string[];
  industry: string | null;
  detectedPlatforms: string[];
  quickWins: string[];
}

interface WelcomeCardProps {
  connectedPlatforms?: number;
  totalPosts?: number;
  scheduledPosts?: number;
  className?: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'synthex_welcome_dismissed';
const VIEW_COUNT_KEY = 'synthex_welcome_view_count';
const MIN_VIEWS_BEFORE_DISMISS = 3;

// ── SEO Score helpers ─────────────────────────────────────────────────────────

function seoScoreColour(score: number): string {
  if (score >= 80) return '#00FF88';
  if (score >= 50) return '#FFB800';
  return '#FF4444';
}

function seoScoreLabel(score: number): string {
  if (score >= 80) return 'Great';
  if (score >= 50) return 'Needs work';
  return 'Needs attention';
}

// ── Component ────────────────────────────────────────────────────────────────

export function WelcomeCard({
  connectedPlatforms = 0,
  totalPosts = 0,
  scheduledPosts = 0,
  className,
}: WelcomeCardProps) {
  const [dismissed, setDismissed] = useState(true);
  const [viewCount, setViewCount] = useState(0);

  const { data, isLoading, error, mutate } = useSWR<OnboardingSummary>(
    '/api/dashboard/onboarding-summary',
    fetchJson,
    { revalidateOnFocus: false, dedupingInterval: 120_000 }
  );

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      setDismissed(stored === 'true');
      const views =
        parseInt(localStorage.getItem(VIEW_COUNT_KEY) ?? '0', 10) + 1;
      localStorage.setItem(VIEW_COUNT_KEY, String(views));
      setViewCount(views);
    } catch {
      setDismissed(false);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Silently fail
    }
  }, []);

  if (isLoading || dismissed) {
    return null;
  }

  if (error) {
    return (
      <div
        className={cn(
          'border-[0.5px] border-orange-500/20 bg-orange-500/[0.04] rounded-sm p-6 text-center',
          className
        )}
      >
        <AlertCircle className="h-5 w-5 text-orange-400 mx-auto mb-2" />
        <p className="text-white/50 text-sm">
          Couldn&apos;t load your progress summary
        </p>
        <button
          onClick={() => mutate()}
          className="mt-3 text-xs text-orange-400 hover:text-orange-300 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data?.exists) {
    return (
      <div
        className={cn(
          'border-[0.5px] border-orange-500/20 bg-orange-500/[0.02] rounded-sm overflow-hidden',
          className
        )}
      >
        {/* Top accent line */}
        <div className="h-px bg-gradient-to-r from-orange-500/60 via-orange-400/30 to-transparent" />
        <div className="px-6 pt-5 pb-4">
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/50 block mb-1">
            Getting Started
          </span>
          <h2 className="text-xl font-light text-white tracking-tight">
            Welcome to Synthex!
          </h2>
          <p className="text-sm text-white/40 mt-1">
            Complete your setup to get personalised AI recommendations.
          </p>
        </div>
        <div className="border-t-[0.5px] border-white/[0.06] px-6 py-4">
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-sm bg-orange-500/[0.12] border-[0.5px] border-orange-500/30 text-sm text-orange-300 hover:bg-orange-500/[0.2] hover:border-orange-500/50 transition-all"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Complete Setup
            <Icon3D
              name="arrow-right"
              category="actions"
              size={24}
              className="h-3.5 w-3.5"
            />
          </Link>
        </div>
      </div>
    );
  }

  const canDismiss = viewCount >= MIN_VIEWS_BEFORE_DISMISS;
  const firstName = data.userName?.split(' ')[0] ?? 'there';

  const nextActions = [];
  if (connectedPlatforms === 0) {
    nextActions.push({
      label:
        data.detectedPlatforms.length > 0
          ? `Connect your platforms (we detected ${data.detectedPlatforms
              .slice(0, 2)
              .map(p => p.charAt(0).toUpperCase() + p.slice(1))
              .join(', ')})`
          : 'Connect your first social platform',
      href: '/dashboard/platforms',
      icon: Globe,
    });
  }
  if (totalPosts === 0) {
    nextActions.push({
      label: 'Generate your first AI post using your brand voice',
      href: '/dashboard/content',
      icon: Sparkles,
    });
  }
  if (totalPosts > 0 && scheduledPosts === 0) {
    nextActions.push({
      label: 'Schedule your first post for the optimal time',
      href: '/dashboard/schedule',
      icon: Zap,
    });
  }

  return (
    <div
      className={cn(
        'border-[0.5px] border-orange-500/20 bg-orange-500/[0.02] rounded-sm overflow-hidden',
        className
      )}
    >
      {/* Top accent line */}
      <div className="h-px bg-gradient-to-r from-orange-500/60 via-orange-400/30 to-transparent" />

      {/* Header */}
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/50 block mb-1">
              AI Analysis
            </span>
            <h2 className="text-xl font-light text-white tracking-tight">
              Welcome to Synthex, {firstName}.
            </h2>
            <p className="text-sm text-white/40 mt-1">
              {data.businessName
                ? `Here's what we discovered about ${data.businessName}`
                : "Here's what our AI discovered about your business"}
            </p>
          </div>
          {canDismiss && (
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss welcome card"
              className="p-2 rounded-sm text-white/50 hover:text-white/50 hover:bg-white/[0.05] transition-colors flex-shrink-0 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Metrics strip */}
      <div className="border-t-[0.5px] border-white/[0.06] grid grid-cols-2 sm:grid-cols-3 divide-x-[0.5px] divide-white/[0.06]">
        {data.seoScore !== null && (
          <div className="px-5 py-4 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <BarChart className="h-3 w-3 text-white/50" />
              <span className="text-[9px] uppercase tracking-[0.2em] text-white/50">
                SEO Score
              </span>
            </div>
            <p
              className="font-mono text-2xl font-medium tabular-nums"
              style={{ color: seoScoreColour(data.seoScore) }}
            >
              {data.seoScore}
            </p>
            <p className="text-[10px] text-white/50 mt-0.5">
              {seoScoreLabel(data.seoScore)}
            </p>
            {data.seoScore < 80 && (
              <div className="mt-2 h-0.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${data.seoScore}%`,
                    backgroundColor: seoScoreColour(data.seoScore),
                  }}
                />
              </div>
            )}
          </div>
        )}

        {data.detectedPlatforms.length > 0 && (
          <div className="px-5 py-4 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <Globe className="h-3 w-3 text-white/50" />
              <span className="text-[9px] uppercase tracking-[0.2em] text-white/50">
                Detected
              </span>
            </div>
            <p className="font-mono text-2xl font-medium text-orange-400 tabular-nums">
              {data.detectedPlatforms.length}
            </p>
            <p className="text-[10px] text-white/50 mt-0.5">
              {data.detectedPlatforms
                .slice(0, 3)
                .map(p => p.charAt(0).toUpperCase() + p.slice(1))
                .join(', ')}
            </p>
          </div>
        )}

        {data.targetAudience && (
          <div className="px-5 py-4 text-center col-span-2 sm:col-span-1">
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <Users className="h-3 w-3 text-white/50" />
              <span className="text-[9px] uppercase tracking-[0.2em] text-white/50">
                Audience
              </span>
            </div>
            <p className="text-xs text-white/60 line-clamp-2 mt-1">
              {data.targetAudience}
            </p>
          </div>
        )}
      </div>

      {/* Key Topics */}
      {data.keyTopics.length > 0 && (
        <div className="border-t-[0.5px] border-white/[0.06] px-6 py-4">
          <p className="text-[9px] uppercase tracking-[0.2em] text-white/50 mb-2.5">
            Key topics from your website
          </p>
          <div className="flex flex-wrap gap-1.5">
            {data.keyTopics.map(topic => (
              <span
                key={topic}
                className="inline-flex items-center px-2.5 py-1 rounded-sm bg-orange-500/[0.08] border-[0.5px] border-orange-500/20 text-[10px] text-orange-300"
              >
                {topic}
              </span>
            ))}
            {data.suggestedTone && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-sm bg-white/[0.04] border-[0.5px] border-white/[0.1] text-[10px] text-white/50">
                Tone: {data.suggestedTone}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Brand Colours */}
      {data.brandColours.length > 0 && (
        <div className="border-t-[0.5px] border-white/[0.06] px-6 py-4">
          <p className="text-[9px] uppercase tracking-[0.2em] text-white/50 mb-2.5">
            Brand colours
          </p>
          <div className="flex gap-2">
            {data.brandColours.map(colour => (
              <div
                key={colour}
                className="h-5 w-5 rounded-sm border-[0.5px] border-white/20"
                style={{ backgroundColor: colour }}
                title={colour}
              />
            ))}
          </div>
        </div>
      )}

      {/* What's Next */}
      {nextActions.length > 0 && (
        <div className="border-t-[0.5px] border-white/[0.06] px-6 py-4">
          <p className="text-[9px] uppercase tracking-[0.2em] text-white/50 mb-3">
            What&apos;s Next
          </p>
          <div className="space-y-2">
            {nextActions.map(action => (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center gap-3 p-3 border-[0.5px] border-white/[0.06] rounded-sm bg-white/[0.01] hover:bg-orange-500/[0.05] hover:border-orange-500/20 transition-all group"
              >
                <div className="h-7 w-7 border-[0.5px] border-white/[0.08] bg-white/[0.03] rounded-sm flex items-center justify-center flex-shrink-0 group-hover:border-orange-500/30 group-hover:bg-orange-500/[0.08] transition-colors">
                  <action.icon className="h-3.5 w-3.5 text-white/40 group-hover:text-orange-400 transition-colors" />
                </div>
                <p className="text-xs text-white/60 flex-1 group-hover:text-white/80 transition-colors">
                  {action.label}
                </p>
                <Icon3D
                  name="arrow-right"
                  category="actions"
                  size={24}
                  className="h-3.5 w-3.5 text-white/50 group-hover:text-orange-400 transition-colors flex-shrink-0"
                />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div className="border-t-[0.5px] border-white/[0.06] px-6 py-3 flex items-center justify-between">
        <div className="flex gap-4">
          <Link href="/dashboard/seo">
            <span className="text-xs text-white/50 hover:text-orange-400 transition-colors cursor-pointer">
              Re-run Analysis
            </span>
          </Link>
          <Link href="/dashboard/settings">
            <span className="text-xs text-white/50 hover:text-orange-400 transition-colors cursor-pointer">
              Edit Settings
            </span>
          </Link>
        </div>
        {!canDismiss && (
          <p className="text-[10px] text-white/50">
            Visible for {MIN_VIEWS_BEFORE_DISMISS - viewCount} more visit
            {MIN_VIEWS_BEFORE_DISMISS - viewCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}
