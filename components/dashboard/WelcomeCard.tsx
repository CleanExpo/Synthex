'use client';

/**
 * Welcome Card Component
 *
 * Surfaces the onboarding analysis (SEO score, detected platforms, key topics,
 * audience, tone) on the dashboard so new users understand what the AI found
 * about their business and know what to do next.
 *
 * Dismissible only after 3 dashboard visits — prevents premature dismissal.
 *
 * @see Phase B of the Guided Walkthrough Enhancement plan
 */

import { useEffect, useState, useCallback } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { glassStyles } from '@/components/ui/index';
import {
  Sparkles,
  Globe,
  ArrowRight,
  X,
  Zap,
  Users,
  BarChart,
} from '@/components/icons';

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

// ── Fetcher ──────────────────────────────────────────────────────────────────

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

// ── SEO Score Colour ─────────────────────────────────────────────────────────

function seoScoreColour(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
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
  const [dismissed, setDismissed] = useState(true); // hidden until hydrated
  const [viewCount, setViewCount] = useState(0);

  const { data, isLoading } = useSWR<OnboardingSummary>(
    '/api/dashboard/onboarding-summary',
    fetchJson,
    { revalidateOnFocus: false, dedupingInterval: 120_000 }
  );

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      setDismissed(stored === 'true');

      // Increment view counter
      const views = parseInt(localStorage.getItem(VIEW_COUNT_KEY) ?? '0', 10) + 1;
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

  // Don't render if loading, dismissed, or no data
  if (isLoading || dismissed || !data?.exists) {
    return null;
  }

  const canDismiss = viewCount >= MIN_VIEWS_BEFORE_DISMISS;
  const firstName = data.userName?.split(' ')[0] ?? 'there';

  // Determine next recommended action
  const nextActions = [];
  if (connectedPlatforms === 0) {
    nextActions.push({
      label: data.detectedPlatforms.length > 0
        ? `Connect your platforms (we detected ${data.detectedPlatforms.slice(0, 2).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')})`
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
    <Card className={cn(glassStyles.base, 'border-cyan-500/20 overflow-hidden', className)}>
      {/* Gradient accent bar */}
      <div className="h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500" />

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg sm:text-xl">
              Welcome to Synthex, {firstName}!
            </CardTitle>
            <p className="text-sm text-slate-400 mt-1">
              {data.businessName
                ? `Here's what we discovered about ${data.businessName}`
                : 'Here\'s what our AI discovered about your business'}
            </p>
          </div>
          {canDismiss && (
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss welcome card"
              className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/[0.05] transition-colors flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ── Metrics Row ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* SEO Score */}
          {data.seoScore !== null && (
            <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <BarChart className="h-4 w-4 text-slate-400" />
                <span className="text-xs text-slate-400">SEO Score</span>
              </div>
              <p className={cn('text-2xl font-bold', seoScoreColour(data.seoScore))}>
                {data.seoScore}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">{seoScoreLabel(data.seoScore)}</p>
              {data.seoScore < 80 && (
                <Progress
                  value={data.seoScore}
                  variant="glass-primary"
                  size="sm"
                  className="mt-2"
                  aria-label="SEO score"
                />
              )}
            </div>
          )}

          {/* Detected Platforms */}
          {data.detectedPlatforms.length > 0 && (
            <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Globe className="h-4 w-4 text-slate-400" />
                <span className="text-xs text-slate-400">Detected</span>
              </div>
              <p className="text-2xl font-bold text-cyan-400">
                {data.detectedPlatforms.length}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {data.detectedPlatforms.slice(0, 3).map(p =>
                  p.charAt(0).toUpperCase() + p.slice(1)
                ).join(', ')}
              </p>
            </div>
          )}

          {/* Target Audience */}
          {data.targetAudience && (
            <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-center col-span-2 sm:col-span-1">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Users className="h-4 w-4 text-slate-400" />
                <span className="text-xs text-slate-400">Audience</span>
              </div>
              <p className="text-xs text-white font-medium line-clamp-2 mt-1">
                {data.targetAudience}
              </p>
            </div>
          )}
        </div>

        {/* ── Key Topics ───────────────────────────────────────────────── */}
        {data.keyTopics.length > 0 && (
          <div>
            <p className="text-xs text-slate-400 mb-2">Key topics from your website</p>
            <div className="flex flex-wrap gap-1.5">
              {data.keyTopics.map((topic) => (
                <span
                  key={topic}
                  className="inline-flex items-center px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300"
                >
                  {topic}
                </span>
              ))}
              {data.suggestedTone && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300">
                  Tone: {data.suggestedTone}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Brand Colours ────────────────────────────────────────────── */}
        {data.brandColours.length > 0 && (
          <div>
            <p className="text-xs text-slate-400 mb-2">Your brand colours</p>
            <div className="flex gap-2">
              {data.brandColours.map((colour) => (
                <div
                  key={colour}
                  className="h-6 w-6 rounded-full border border-white/20"
                  style={{ backgroundColor: colour }}
                  title={colour}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── What's Next ──────────────────────────────────────────────── */}
        {nextActions.length > 0 && (
          <div className="border-t border-white/[0.06] pt-4">
            <p className="text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wider">
              What&apos;s Next
            </p>
            <div className="space-y-2">
              {nextActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-cyan-500/[0.06] hover:border-cyan-500/20 transition-all group"
                >
                  <div className="h-8 w-8 rounded-full bg-cyan-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-cyan-500/20 transition-colors">
                    <action.icon className="h-4 w-4 text-cyan-400" />
                  </div>
                  <p className="text-sm text-white flex-1">{action.label}</p>
                  <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Footer actions ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-2">
            <Link href="/dashboard/seo">
              <Button variant="ghost" size="sm" className="text-xs text-slate-400 hover:text-cyan-300 h-7">
                Re-run Analysis
              </Button>
            </Link>
            <Link href="/dashboard/settings">
              <Button variant="ghost" size="sm" className="text-xs text-slate-400 hover:text-cyan-300 h-7">
                Edit Settings
              </Button>
            </Link>
          </div>
          {!canDismiss && (
            <p className="text-[10px] text-slate-600">
              Visible for {MIN_VIEWS_BEFORE_DISMISS - viewCount} more visit{MIN_VIEWS_BEFORE_DISMISS - viewCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
