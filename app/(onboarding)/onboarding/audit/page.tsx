'use client';

/**
 * Onboarding — Step 2: Website Audit (UNI-1187)
 *
 * Runs a live website audit via POST /api/onboarding/audit-website:
 *   - Cheerio SEO signals (title, meta, headings, OG, image alt, links)
 *   - Google PageSpeed Insights (mobile + desktop)
 *   - AI content gap + keyword opportunity analysis
 *
 * Results are cached to sessionStorage and forwarded to step 3.
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, Globe, CheckCircle, XCircle, Loader2,
  Zap, Search, TrendingUp, AlertCircle,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { StepProgressV2 } from '@/components/onboarding';
import type {
  WebsiteAuditResult,
  SEOAuditSignals,
  PageSpeedResult,
} from '@/app/api/onboarding/audit-website/route';

// ============================================================================
// HELPERS
// ============================================================================

/** Compute a 0–100 SEO health score from the 5 core signal groups. */
function computeSEOScore(seo: SEOAuditSignals): number {
  let score = 0;
  if (seo.title) score += 20;
  if (seo.metaDescription) score += 20;
  if (seo.h1) score += 20;
  if (seo.ogTitle && seo.ogDescription && seo.ogImage) score += 20;
  if (seo.totalImages === 0 || seo.imagesWithoutAlt / seo.totalImages < 0.3) score += 20;
  return score;
}

function scoreColour(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

function speedColour(score: number): string {
  if (score >= 90) return 'text-green-400';
  if (score >= 50) return 'text-yellow-400';
  return 'text-red-400';
}

function healthBadge(health: WebsiteAuditResult['insights']['overallHealth']): {
  label: string;
  className: string;
} {
  switch (health) {
    case 'excellent':
      return { label: 'Excellent', className: 'bg-green-500/15 border-green-500/30 text-green-400' };
    case 'good':
      return { label: 'Good', className: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400' };
    case 'needs-work':
      return { label: 'Needs Work', className: 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400' };
    case 'poor':
      return { label: 'Poor', className: 'bg-red-500/15 border-red-500/30 text-red-400' };
  }
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function SEORow({
  label,
  value,
  present,
}: {
  label: string;
  value?: string | null;
  present: boolean;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {present ? (
        <CheckCircle className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
      ) : (
        <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
      )}
      <div>
        <span className={cn('font-medium', present ? 'text-white' : 'text-gray-400')}>
          {label}
        </span>
        {value && (
          <p className="text-gray-500 text-xs mt-0.5 truncate max-w-[280px]">{value}</p>
        )}
      </div>
    </div>
  );
}

function SpeedCard({
  label,
  result,
}: {
  label: string;
  result: PageSpeedResult | null;
}) {
  if (!result) {
    return (
      <div className="p-4 rounded-lg bg-white/3 border border-white/5 text-center">
        <p className="text-xs text-gray-500 mb-1">{label}</p>
        <p className="text-sm text-gray-600">Unavailable</p>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg bg-white/3 border border-white/5">
      <p className="text-xs text-gray-500 mb-2">{label}</p>
      <p className={cn('text-3xl font-bold mb-1', speedColour(result.score))}>
        {result.score}
        <span className="text-sm font-normal text-gray-500">/100</span>
      </p>
      <div className="space-y-1 text-xs text-gray-500">
        <div className="flex justify-between">
          <span>LCP</span>
          <span className="text-white">{(result.lcp / 1000).toFixed(1)}s</span>
        </div>
        <div className="flex justify-between">
          <span>FCP</span>
          <span className="text-white">{(result.fcp / 1000).toFixed(1)}s</span>
        </div>
        <div className="flex justify-between">
          <span>CLS</span>
          <span className="text-white">{result.cls.toFixed(3)}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PAGE
// ============================================================================

const SESSION_KEY = 'synthex_onboarding_audit';

export default function OnboardingAuditPage() {
  const router = useRouter();

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WebsiteAuditResult | null>(null);

  // Restore cached result on mount (so a page refresh doesn't lose results)
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(SESSION_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as WebsiteAuditResult;
        setResult(parsed);
        setUrl(parsed.url);
      }
    } catch {
      // Ignore corrupt cache
    }
  }, []);

  const runAudit = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setLoadingStage('Fetching website…');

    try {
      // Stagger loading messages to give user feedback during the ~15-25s wait
      const stages = [
        { delay: 3000, text: 'Analysing SEO signals…' },
        { delay: 8000, text: 'Running PageSpeed tests…' },
        { delay: 16000, text: 'Generating AI insights…' },
      ];
      const timers = stages.map(({ delay, text }) =>
        setTimeout(() => setLoadingStage(text), delay),
      );

      const res = await fetch('/api/onboarding/audit-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: trimmed }),
      });

      timers.forEach(clearTimeout);

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? 'Audit failed');
      }

      const data = (await res.json()) as WebsiteAuditResult;
      setResult(data);

      // Cache so the user doesn't lose results on accidental refresh
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data)); } catch { /* ignore */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Audit failed. Please try again.');
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  const handleContinue = () => {
    // Results already cached to sessionStorage above; just proceed
    router.push('/onboarding/goals');
  };

  // Derived UI state
  const seoScore = result ? computeSEOScore(result.seo) : null;
  const badge = result ? healthBadge(result.insights.overallHealth) : null;

  return (
    <div className="space-y-8">
      {/* Progress */}
      <StepProgressV2 currentStep={2} />

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
          <Globe className="w-7 h-7 text-cyan-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Audit your website</h1>
        <p className="text-gray-400 max-w-sm mx-auto text-sm">
          We'll check your SEO health, page speed, and surface marketing opportunities.
          Takes about 20 seconds.
        </p>
      </div>

      {/* URL Input */}
      <div className="max-w-lg mx-auto">
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && runAudit()}
            placeholder="https://yoursite.com.au"
            type="url"
            className="bg-surface-dark/50 border border-cyan-500/20 text-white placeholder:text-gray-600 focus:border-cyan-500/50 focus:ring-cyan-500/20 flex-1"
            disabled={loading}
          />
          <Button
            onClick={runAudit}
            disabled={!url.trim() || loading}
            className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="mt-4 p-4 rounded-xl bg-surface-base/80 border border-cyan-500/10 backdrop-blur-sm flex items-center gap-3">
            <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
            <p className="text-sm text-cyan-400">{loadingStage}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="max-w-lg mx-auto space-y-4">
          {/* Overall health + summary */}
          <div className="p-5 rounded-xl bg-surface-base/80 border border-cyan-500/10 backdrop-blur-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Overall Marketing Health</h2>
              {badge && (
                <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border', badge.className)}>
                  {badge.label}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">{result.insights.summary}</p>
          </div>

          {/* SEO Signals */}
          <div className="p-5 rounded-xl bg-surface-base/80 border border-cyan-500/10 backdrop-blur-sm space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <Search className="w-4 h-4 text-cyan-400" />
                SEO Health
              </h2>
              {seoScore !== null && (
                <span className={cn('text-sm font-bold', scoreColour(seoScore))}>
                  {seoScore}/100
                </span>
              )}
            </div>
            <div className="space-y-2.5">
              <SEORow label="Page Title" value={result.seo.title} present={!!result.seo.title} />
              <SEORow label="Meta Description" value={result.seo.metaDescription} present={!!result.seo.metaDescription} />
              <SEORow label="H1 Heading" value={result.seo.h1} present={!!result.seo.h1} />
              <SEORow
                label="Open Graph Tags"
                present={!!(result.seo.ogTitle && result.seo.ogDescription && result.seo.ogImage)}
                value={result.seo.ogTitle ? undefined : 'og:title, og:description, og:image — set these for social sharing'}
              />
              <SEORow
                label="Image Alt Text"
                present={result.seo.totalImages === 0 || result.seo.imagesWithoutAlt === 0}
                value={
                  result.seo.imagesWithoutAlt > 0
                    ? `${result.seo.imagesWithoutAlt} of ${result.seo.totalImages} images missing alt text`
                    : undefined
                }
              />
            </div>
          </div>

          {/* Page Speed */}
          <div className="p-5 rounded-xl bg-surface-base/80 border border-cyan-500/10 backdrop-blur-sm">
            <h2 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-3">
              <Zap className="w-4 h-4 text-cyan-400" />
              Page Speed
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <SpeedCard label="Mobile" result={result.performance.mobile} />
              <SpeedCard label="Desktop" result={result.performance.desktop} />
            </div>
          </div>

          {/* AI Insights */}
          <div className="p-5 rounded-xl bg-surface-base/80 border border-cyan-500/10 backdrop-blur-sm space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              Marketing Insights
            </h2>

            {result.insights.quickWins.length > 0 && (
              <div>
                <p className="text-xs font-medium text-cyan-400 mb-2">Quick Wins</p>
                <ul className="space-y-1.5">
                  {result.insights.quickWins.map((win, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-cyan-500 mt-0.5 shrink-0">→</span>
                      {win}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.insights.contentGaps.length > 0 && (
              <div>
                <p className="text-xs font-medium text-yellow-400 mb-2">Content Gaps</p>
                <ul className="space-y-1.5">
                  {result.insights.contentGaps.map((gap, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-yellow-500 mt-0.5 shrink-0">→</span>
                      {gap}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.insights.keywordOpportunities.length > 0 && (
              <div>
                <p className="text-xs font-medium text-purple-400 mb-2">Keyword Opportunities</p>
                <ul className="space-y-1.5">
                  {result.insights.keywordOpportunities.map((kw, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-purple-500 mt-0.5 shrink-0">→</span>
                      {kw}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="max-w-lg mx-auto flex items-center justify-between pt-2">
        <button
          onClick={() => router.push('/onboarding/goals')}
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          Skip for now
        </button>

        <Button
          onClick={handleContinue}
          disabled={!result}
          className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>

      <p className="text-center text-xs text-gray-600 pb-2">
        Audit data helps SYNTHEX tailor your marketing plan. It's stored securely and never shared.
      </p>
    </div>
  );
}
