'use client';

/**
 * Profile Analyser Page
 *
 * Step 1 — Enter a public profile URL (Instagram, Twitter/X, LinkedIn, TikTok)
 * Step 2 — Apify scrapes and returns structured profile data
 * Step 3 — User enters an optional topic and generates personalised posts
 * Step 4 — Scheduling recommendations and improvement tips are shown
 */

import { useState, useCallback } from 'react';
import {
  Search,
  Loader2,
  RefreshCw,
  Users,
  FileText,
  TrendingUp,
  Hash,
  Clock,
  Star,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Calendar,
  Lightbulb,
  Sparkles,
} from '@/components/icons';
import { toast } from 'sonner';
import type { ProfileData } from '@/app/api/profile-analyser/route';
import type { GenerateContentResult, ScheduleSlot } from '@/app/api/profile-analyser/generate-content/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 px-5 py-4 border-[0.5px] border-white/6 bg-white/1 rounded-sm hover:bg-white/2 transition-colors">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-white/40" />
        <span className="text-[9px] uppercase tracking-[0.2em] text-white/40">{label}</span>
      </div>
      <span className="font-mono text-xl font-medium tabular-nums leading-none" style={{ color: accent }}>
        {value}
      </span>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-white/3 border-[0.5px] border-white/6 rounded-sm" />
        ))}
      </div>
      <div className="h-24 bg-white/2 border-[0.5px] border-white/4 rounded-sm" />
    </div>
  );
}

function ContentSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-32 bg-white/2 border-[0.5px] border-white/4 rounded-sm" />
      ))}
    </div>
  );
}

function PostCard({
  post,
}: {
  post: { variation: number; content: string; hashtags: string[] };
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const full = post.content + (post.hashtags.length ? '\n\n' + post.hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' ') : '');
    navigator.clipboard.writeText(full).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [post]);

  return (
    <div className="border-[0.5px] border-white/8 bg-white/2 rounded-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-[0.2em] text-white/30">
          Variation {post.variation}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[10px] text-white/40 hover:text-white/70 transition-colors"
        >
          {copied ? <CheckCircle className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{post.content}</p>
      {post.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {post.hashtags.map(tag => (
            <span
              key={tag}
              className="text-[10px] px-2 py-0.5 rounded-full border-[0.5px] border-orange-500/20 bg-orange-500/5 text-orange-400/70"
            >
              #{tag.replace(/^#/, '')}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SlotCard({ slot }: { slot: ScheduleSlot }) {
  return (
    <div className="border-[0.5px] border-white/6 bg-white/1 rounded-sm px-4 py-3 space-y-1">
      <div className="flex items-center gap-2">
        <Calendar className="h-3.5 w-3.5 text-cyan-400/60" />
        <span className="text-sm font-medium text-white/80">{slot.day}</span>
        <span className="ml-auto font-mono text-xs text-cyan-400/80">{slot.time}</span>
      </div>
      <p className="text-xs text-white/40 leading-relaxed">{slot.rationale}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ProfileAnalyserPage() {
  const [url, setUrl] = useState('');
  const [analysing, setAnalysing] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [analyseError, setAnalyseError] = useState<string | null>(null);

  const [topic, setTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerateContentResult | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // ----- analyse -----

  const handleAnalyse = useCallback(async () => {
    if (!url.trim()) {
      toast.error('Enter a profile URL first');
      return;
    }
    setAnalysing(true);
    setAnalyseError(null);
    setProfile(null);
    setResult(null);

    try {
      const res = await fetch('/api/profile-analyser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: url.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Analysis failed');
      setProfile(body.profile as ProfileData);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setAnalyseError(msg);
      toast.error(msg);
    } finally {
      setAnalysing(false);
    }
  }, [url]);

  // ----- generate -----

  const handleGenerate = useCallback(async () => {
    if (!profile) return;
    setGenerating(true);
    setGenerateError(null);
    setResult(null);

    try {
      const res = await fetch('/api/profile-analyser/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ profile, topic: topic.trim() || undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Generation failed');
      setResult(body.result as GenerateContentResult);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setGenerateError(msg);
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  }, [profile, topic]);

  const platformLabel =
    profile?.platform
      ? { instagram: 'Instagram', twitter: 'Twitter/X', linkedin: 'LinkedIn', tiktok: 'TikTok' }[profile.platform]
      : null;

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Page header */}
      <div className="space-y-1">
        <p className="text-[9px] uppercase tracking-[0.25em] text-white/30">Advanced</p>
        <h1 className="text-3xl font-light text-white">Profile Analyser</h1>
        <p className="text-sm text-white/40">
          Enter any public Instagram, Twitter/X, LinkedIn, or TikTok profile URL to get
          data-driven content, scheduling, and improvement insights.
        </p>
      </div>

      {/* URL input */}
      <div className="space-y-3">
        <label className="block text-xs text-white/50">
          Public profile URL
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 pointer-events-none" />
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAnalyse()}
              placeholder="https://instagram.com/username"
              className="w-full pl-9 pr-4 h-10 text-sm bg-white/2 border-[0.5px] border-white/8 rounded-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20 focus:bg-white/3 transition-colors"
            />
          </div>
          <button
            onClick={handleAnalyse}
            disabled={analysing || !url.trim()}
            className="flex items-center gap-2 px-4 h-10 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-[#050505] text-xs font-semibold rounded-sm transition-colors"
          >
            {analysing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            {analysing ? 'Analysing…' : 'Analyse'}
          </button>
        </div>
        <p className="text-[10px] text-white/25">
          Supports: instagram.com · twitter.com · x.com · linkedin.com · tiktok.com
        </p>
      </div>

      {/* Loading skeleton */}
      {analysing && <ProfileSkeleton />}

      {/* Analyse error */}
      {analyseError && !analysing && (
        <div className="border-[0.5px] border-red-500/20 bg-red-500/5 rounded-sm p-4 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-red-300">{analyseError}</p>
          </div>
          <button
            onClick={handleAnalyse}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors shrink-0"
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      )}

      {/* Profile results */}
      {profile && !analysing && (
        <div className="space-y-6">
          {/* Identity strip */}
          <div className="flex items-center gap-4 border-[0.5px] border-white/6 bg-white/1 rounded-sm px-4 py-3">
            {profile.avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatarUrl}
                alt={profile.username}
                className="h-10 w-10 rounded-full object-cover border border-white/10"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white truncate">
                  {profile.displayName ?? `@${profile.username}`}
                </span>
                {profile.verified && <Star className="h-3.5 w-3.5 text-yellow-400 shrink-0" />}
                <span className="ml-auto text-[9px] uppercase tracking-[0.2em] text-white/30 shrink-0">
                  {platformLabel}
                </span>
              </div>
              <p className="text-xs text-white/40 truncate">@{profile.username}</p>
              {profile.bio && (
                <p className="text-xs text-white/50 mt-1 line-clamp-2">{profile.bio}</p>
              )}
            </div>
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard
              icon={Users}
              label="Followers"
              value={formatNumber(profile.followerCount)}
              accent="#00FF88"
            />
            <MetricCard
              icon={Users}
              label="Following"
              value={formatNumber(profile.followingCount)}
              accent="#6B7280"
            />
            <MetricCard
              icon={FileText}
              label="Posts"
              value={formatNumber(profile.postCount)}
              accent="#00F5FF"
            />
            <MetricCard
              icon={TrendingUp}
              label="Engagement"
              value={
                profile.engagementRate != null
                  ? `${profile.engagementRate.toFixed(2)}%`
                  : '—'
              }
              accent="#FFB800"
            />
          </div>

          {/* Top hashtags */}
          {profile.topHashtags.length > 0 && (
            <div className="border-[0.5px] border-white/6 bg-white/1 rounded-sm px-4 py-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <Hash className="h-3 w-3 text-white/30" />
                <span className="text-[9px] uppercase tracking-[0.2em] text-white/30">Top Hashtags</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {profile.topHashtags.map(tag => (
                  <span
                    key={tag}
                    className="text-[10px] px-2 py-0.5 rounded-full border-[0.5px] border-white/8 bg-white/2 text-white/50"
                  >
                    #{tag.replace(/^#/, '')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Generate content section */}
          <div className="space-y-3 pt-2 border-t border-white/6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-orange-400" />
              <h2 className="text-base font-medium text-white">Generate Content</h2>
            </div>
            <p className="text-xs text-white/40">
              Get three post variations personalised to this profile's tone, hashtag style, and audience.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                placeholder="Optional topic — leave blank for on-brand suggestions"
                className="flex-1 px-3 h-9 text-sm bg-white/2 border-[0.5px] border-white/8 rounded-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-colors"
              />
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-2 px-4 h-9 bg-white/6 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed border-[0.5px] border-white/8 text-white text-xs font-medium rounded-sm transition-colors"
              >
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronRight className="h-3.5 w-3.5" />}
                {generating ? 'Generating…' : 'Generate'}
              </button>
            </div>
          </div>

          {/* Generating skeleton */}
          {generating && <ContentSkeleton />}

          {/* Generate error */}
          {generateError && !generating && (
            <div className="border-[0.5px] border-red-500/20 bg-red-500/5 rounded-sm p-4 flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-red-300 flex-1">{generateError}</p>
              <button
                onClick={handleGenerate}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors shrink-0"
              >
                <RefreshCw className="h-3 w-3" /> Retry
              </button>
            </div>
          )}

          {/* Results */}
          {result && !generating && (
            <div className="space-y-8">
              {/* Post variations */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-white/40" />
                  <h2 className="text-sm font-medium text-white/80">Post Variations</h2>
                </div>
                <div className="space-y-3">
                  {result.posts.map(post => (
                    <PostCard key={post.variation} post={post} />
                  ))}
                </div>
              </div>

              {/* Scheduling recommendations */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-cyan-400/60" />
                  <h2 className="text-sm font-medium text-white/80">Best Times to Post</h2>
                </div>
                <div className="space-y-2">
                  {result.schedulingSlots.map((slot, i) => (
                    <SlotCard key={i} slot={slot} />
                  ))}
                </div>
              </div>

              {/* Improvement tips */}
              {result.improvementTips.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-yellow-400/60" />
                    <h2 className="text-sm font-medium text-white/80">Profile Improvement Tips</h2>
                  </div>
                  <ol className="space-y-2">
                    {result.improvementTips.map((tip, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 border-[0.5px] border-yellow-500/10 bg-yellow-500/3 rounded-sm px-4 py-3"
                      >
                        <span className="font-mono text-xs text-yellow-400/60 mt-0.5 shrink-0 w-4">
                          {i + 1}.
                        </span>
                        <p className="text-sm text-white/70 leading-relaxed">{tip}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
