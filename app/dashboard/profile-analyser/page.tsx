'use client';

/**
 * Profile Analyser — scrape a public LinkedIn or Facebook profile via Apify
 * and surface engagement, content mix, and recommendations.
 */

import { useState } from 'react';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Linkedin,
  Facebook,
  Loader2,
  AlertCircle,
  Sparkles,
} from '@/components/icons';
import type {
  ProfileAnalysisResult,
  ProfilePlatform,
} from '@/lib/profile-analyser/types';

const PLATFORMS: Array<{
  id: ProfilePlatform;
  label: string;
  Icon: typeof Linkedin;
  placeholder: string;
}> = [
  {
    id: 'linkedin',
    label: 'LinkedIn',
    Icon: Linkedin,
    placeholder: 'https://www.linkedin.com/in/username',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    Icon: Facebook,
    placeholder: 'https://www.facebook.com/pagename',
  },
];

async function postAnalyse(
  platform: ProfilePlatform,
  profileUrl: string
): Promise<ProfileAnalysisResult> {
  const res = await fetch('/api/profile-analyser', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform, profileUrl }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    data?: ProfileAnalysisResult;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(body.error ?? 'Failed to analyse profile');
  }
  if (!body.data) {
    throw new Error('Analysis returned no data');
  }
  return body.data;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/50">{label}</span>
        <span className="font-medium text-white/80">{value}</span>
      </div>
      <Progress
        value={value}
        size="sm"
        variant="glass-primary"
        aria-label={`${label} ${value} of 100`}
      />
    </div>
  );
}

function MixBar({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-white/40">
        <span>{label}</span>
        <span className="text-white/70">{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className="h-full rounded-full bg-[#FF6B35]"
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}

export default function ProfileAnalyserPage() {
  const [platform, setPlatform] = useState<ProfilePlatform>('linkedin');
  const [profileUrl, setProfileUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProfileAnalysisResult | null>(null);

  const placeholder =
    PLATFORMS.find(p => p.id === platform)?.placeholder ?? '';

  async function onAnalyse(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await postAnalyse(platform, profileUrl.trim());
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Research & media"
        title="Profile Analyser"
        description="Score a public LinkedIn or Facebook profile from live posts — engagement, content mix, and what to post next."
      />

      <Card variant="glass">
        <CardContent className="p-5">
          <form onSubmit={onAnalyse} className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(({ id, label, Icon }) => {
                const active = platform === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPlatform(id)}
                    className={`inline-flex items-center gap-2 rounded-[10px] border px-3 py-2 text-sm transition-colors ${
                      active
                        ? 'border-[#FF6B35]/40 bg-[#FF6B35]/10 text-white'
                        : 'border-white/[0.08] bg-white/[0.02] text-white/50 hover:text-white/80'
                    }`}
                    aria-pressed={active}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                variant="glass"
                inputSize="lg"
                type="url"
                required
                value={profileUrl}
                onChange={e => setProfileUrl(e.target.value)}
                placeholder={placeholder}
                aria-label="Public profile URL"
                className="flex-1"
              />
              <Button
                type="submit"
                variant="premium-primary"
                size="lg"
                disabled={loading || !profileUrl.trim()}
                className="sm:w-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analysing…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Analyse
                  </>
                )}
              </Button>
            </div>

            {loading && (
              <p className="text-xs text-white/40">
                Live scrape can take 1–3 minutes. Keep this tab open.
              </p>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-[10px] border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {result && <AnalysisResult result={result} />}
    </div>
  );
}

function AnalysisResult({ result }: { result: ProfileAnalysisResult }) {
  const PlatformIcon = result.platform === 'linkedin' ? Linkedin : Facebook;
  const mix = result.content.contentMix;

  return (
    <div className="space-y-4">
      <Card variant="glass-primary">
        <CardContent className="flex flex-col gap-6 p-5 sm:flex-row sm:items-center">
          <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-[14px] border border-[#FF6B35]/30 bg-[#FF6B35]/10">
            <span className="font-[var(--font-space-grotesk)] text-4xl font-light tracking-tight text-white">
              {result.score.overall}
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">
              Overall
            </span>
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <PlatformIcon className="h-5 w-5 text-white/70" />
              <h2 className="font-[var(--font-space-grotesk)] text-xl font-light tracking-tight text-white">
                {result.displayName}
              </h2>
              <Badge variant="glass-primary" className="capitalize">
                {result.platform}
              </Badge>
            </div>
            {result.headline && (
              <p className="text-sm text-white/50">{result.headline}</p>
            )}
            <div className="flex flex-wrap gap-4 text-xs text-white/40">
              <span>
                {formatNumber(result.followersCount)} followers
              </span>
              {result.connectionsCount != null && (
                <span>
                  {formatNumber(result.connectionsCount)} connections
                </span>
              )}
              <span>{result.postsAnalysed} posts analysed</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-white/50">
              Score breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScoreBar
              label="Profile completeness"
              value={result.score.profileCompleteness}
            />
            <ScoreBar
              label="Content consistency"
              value={result.score.contentConsistency}
            />
            <ScoreBar
              label="Audience engagement"
              value={result.score.audienceEngagement}
            />
            <ScoreBar
              label="Growth velocity"
              value={result.score.growthVelocity}
            />
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-white/50">
              Engagement
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Metric
              label="Avg likes"
              value={formatNumber(result.engagement.averageLikes)}
            />
            <Metric
              label="Avg comments"
              value={formatNumber(result.engagement.averageComments)}
            />
            <Metric
              label="Avg shares"
              value={formatNumber(result.engagement.averageShares)}
            />
            <Metric
              label="Engagement rate"
              value={`${result.engagement.engagementRate}%`}
            />
            <Metric
              label="Top post type"
              value={result.engagement.topPostType}
            />
            <Metric
              label="Cadence"
              value={result.content.postingFrequency}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-white/50">
              Content mix
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <MixBar label="Text" value={mix.text} />
            <MixBar label="Image" value={mix.image} />
            <MixBar label="Video" value={mix.video} />
            <MixBar label="Link" value={mix.link} />
            <p className="pt-2 text-xs text-white/40">
              Best window: {result.content.bestPostingTime}
            </p>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-white/50">
              Topics & hashtags
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {result.content.primaryTopics.length ? (
                result.content.primaryTopics.map(topic => (
                  <Badge key={topic} variant="glass">
                    {topic}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-white/40">
                  Not enough repeated language to infer topics.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {result.content.recommendedHashtags.map(tag => (
                <Badge key={tag} variant="glass-primary">
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card variant="glass">
        <CardHeader>
          <CardTitle className="text-sm font-medium uppercase tracking-wider text-white/50">
            Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2">
            {result.recommendations.map((rec, i) => (
              <li
                key={i}
                className="flex gap-3 text-sm text-white/70"
              >
                <span className="mt-0.5 font-[var(--font-space-grotesk)] text-xs text-[#FF6B35]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>{rec}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {result.recentPosts.length > 0 && (
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-white/50">
              Recent posts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.recentPosts.map((post, i) => (
              <div
                key={`${post.postedAt}-${i}`}
                className="rounded-[10px] border border-white/[0.06] bg-white/[0.02] p-3"
              >
                <p className="text-sm text-white/70">
                  {post.text || '(no text)'}
                </p>
                <p className="mt-2 text-[11px] text-white/35">
                  {post.likes} likes · {post.comments} comments
                  {post.postedAt ? ` · ${post.postedAt}` : ''}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-white/40">
        {label}
      </p>
      <p className="mt-1 font-[var(--font-space-grotesk)] text-lg font-light capitalize text-white">
        {value}
      </p>
    </div>
  );
}
