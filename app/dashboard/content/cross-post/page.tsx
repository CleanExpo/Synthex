'use client';

/**
 * Cross-Post Dashboard Page
 *
 * @description Two-phase UI for cross-posting content to multiple platforms.
 * Phase 1 (input): Content textarea, platform selector, tone/goal options.
 * Phase 2 (preview): Platform-specific content variants with scores.
 * Phase 3 (results): Publishing results with success/failure status.
 */

import { useState } from 'react';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Send,
  Sparkles,
  ArrowLeft,
  Loader2,
  Check,
  X,
  Copy,
  Eye,
  Twitter,
  Linkedin,
  Youtube,
  Instagram,
  Facebook,
  Reddit,
} from '@/components/icons';
import {
  useCrossPost,
  ALL_PLATFORMS,
  TONE_OPTIONS,
  GOAL_OPTIONS,
} from '@/hooks/use-cross-post';
import type { SupportedPlatform } from '@/lib/social';
import type { PlatformVariant } from '@/lib/ai/multi-format-adapter';

// ============================================================================
// PLATFORM CONFIG
// ============================================================================

const PLATFORM_CONFIG: Record<SupportedPlatform, {
  name: string;
  icon: React.ElementType;
  color: string;
}> = {
  twitter: { name: 'Twitter/X', icon: Twitter, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  linkedin: { name: 'LinkedIn', icon: Linkedin, color: 'bg-blue-600/20 text-blue-300 border-blue-600/30' },
  instagram: { name: 'Instagram', icon: Instagram, color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
  facebook: { name: 'Facebook', icon: Facebook, color: 'bg-blue-700/20 text-blue-300 border-blue-700/30' },
  tiktok: { name: 'TikTok', icon: Sparkles, color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  youtube: { name: 'YouTube', icon: Youtube, color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  pinterest: { name: 'Pinterest', icon: Sparkles, color: 'bg-red-600/20 text-red-300 border-red-600/30' },
  reddit: { name: 'Reddit', icon: Reddit, color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  threads: { name: 'Threads', icon: Sparkles, color: 'bg-slate-600/20 text-slate-300 border-slate-600/30' },
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function PlatformBadge({ platform }: { platform: SupportedPlatform }) {
  const config = PLATFORM_CONFIG[platform];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
      <Icon className="w-3 h-3" />
      {config.name}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const getScoreStyle = (s: number) => {
    if (s >= 70) return 'bg-green-500/20 border-green-500/30 text-green-400';
    if (s >= 40) return 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400';
    return 'bg-red-500/20 border-red-500/30 text-red-400';
  };

  return (
    <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full border text-xs font-bold ${getScoreStyle(score)}`}>
      {score}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable
    }
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={handleCopy}
      className="flex-shrink-0 text-xs bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10"
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 mr-1 text-green-400" />
          <span className="text-green-400">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="w-3 h-3 mr-1" />
          Copy
        </>
      )}
    </Button>
  );
}

function VariantCard({ variant }: { variant: PlatformVariant }) {
  const platform = variant.platform as SupportedPlatform;
  const config = PLATFORM_CONFIG[platform];
  const Icon = config.icon;

  return (
    <Card className="bg-[#0f172a]/80 border border-cyan-500/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Icon className="w-4 h-4 text-cyan-400" />
            <PlatformBadge platform={platform} />
          </CardTitle>
          <div className="flex items-center gap-2">
            {variant.score !== undefined && <ScoreBadge score={variant.score} />}
            <CopyButton text={variant.content} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Content preview */}
        <div className="whitespace-pre-wrap text-sm text-slate-300 bg-white/5 rounded-md px-3 py-2 max-h-48 overflow-y-auto leading-relaxed">
          {variant.content}
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span>{variant.metadata.characterCount.toLocaleString()} / {variant.metadata.characterLimit.toLocaleString()} chars</span>
          <span>{variant.metadata.wordCount.toLocaleString()} words</span>
          {variant.metadata.hashtags.length > 0 && (
            <span className="text-cyan-400">{variant.metadata.hashtags.length} hashtags</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ResultCard({ result, variant }: {
  result: { platform: SupportedPlatform; success: boolean; url?: string; error?: string };
  variant?: PlatformVariant;
}) {
  const platform = result.platform;
  const config = PLATFORM_CONFIG[platform];
  const Icon = config.icon;

  return (
    <Card className={`bg-[#0f172a]/80 border ${result.success ? 'border-green-500/30' : 'border-red-500/30'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Icon className="w-4 h-4" />
            <PlatformBadge platform={platform} />
          </CardTitle>
          <div className={`flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium ${
            result.success
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400'
          }`}>
            {result.success ? (
              <>
                <Check className="w-3 h-3" />
                Published
              </>
            ) : (
              <>
                <X className="w-3 h-3" />
                Failed
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {result.success && result.url && (
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-cyan-400 hover:text-cyan-300 underline"
          >
            View post
          </a>
        )}
        {!result.success && result.error && (
          <p className="text-sm text-red-400">{result.error}</p>
        )}
        {variant && (
          <div className="whitespace-pre-wrap text-xs text-slate-400 bg-white/5 rounded-md px-2 py-1 max-h-20 overflow-y-auto">
            {variant.content.substring(0, 200)}{variant.content.length > 200 ? '...' : ''}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function CrossPostPage() {
  const {
    content,
    setContent,
    platforms,
    selectedPlatforms,
    togglePlatform,
    selectAllPlatforms,
    clearPlatforms,
    tone,
    setTone,
    goal,
    setGoal,
    variants,
    results,
    summary,
    isLoading,
    error,
    phase,
    preview,
    publish,
    reset,
    backToInput,
    canPreview,
    canPublish,
  } = useCrossPost();

  // ============================================================================
  // PHASE 3: RESULTS
  // ============================================================================

  if (phase === 'results' && results) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader
            title="Cross-Post Results"
            description={`Published to ${summary?.publishedCount || 0} of ${summary?.totalCount || 0} platforms.`}
          />
          <Button
            variant="ghost"
            onClick={reset}
            className="flex-shrink-0 text-slate-300 hover:text-white hover:bg-white/5 border border-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Start Over
          </Button>
        </div>

        {/* Summary */}
        {summary && (
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-green-500/10 border border-green-500/30">
              <CardContent className="py-4 text-center">
                <div className="text-2xl font-bold text-green-400">{summary.publishedCount}</div>
                <div className="text-xs text-green-300">Published</div>
              </CardContent>
            </Card>
            <Card className="bg-yellow-500/10 border border-yellow-500/30">
              <CardContent className="py-4 text-center">
                <div className="text-2xl font-bold text-yellow-400">{summary.scheduledCount}</div>
                <div className="text-xs text-yellow-300">Scheduled</div>
              </CardContent>
            </Card>
            <Card className="bg-red-500/10 border border-red-500/30">
              <CardContent className="py-4 text-center">
                <div className="text-2xl font-bold text-red-400">{summary.failedCount}</div>
                <div className="text-xs text-red-300">Failed</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Result cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {results.map((result) => {
            const variant = variants?.find(v => v.platform === result.platform);
            return (
              <ResultCard key={result.platform} result={result} variant={variant} />
            );
          })}
        </div>
      </div>
    );
  }

  // ============================================================================
  // PHASE 2: PREVIEW
  // ============================================================================

  if (phase === 'preview' && variants) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader
            title="Preview Adaptations"
            description={`Review ${variants.length} platform-specific versions before publishing.`}
          />
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={backToInput}
              className="flex-shrink-0 text-slate-300 hover:text-white hover:bg-white/5 border border-white/10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={publish}
              disabled={!canPublish}
              className="bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Publish to {variants.length} Platforms
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="px-4 py-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Variant cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {variants.map((variant) => (
            <VariantCard key={variant.platform} variant={variant} />
          ))}
        </div>
      </div>
    );
  }

  // ============================================================================
  // PHASE 1: INPUT
  // ============================================================================

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cross-Post"
        description="Compose once, publish to all platforms with AI-powered adaptation."
      />

      {/* Input card */}
      <Card className="bg-[#0f172a]/80 border border-cyan-500/10">
        <CardHeader className="pb-4">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Send className="w-5 h-5 text-cyan-400" />
            Create Cross-Post
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* 1. Content textarea */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Your Content
              <span className="ml-2 text-cyan-400 normal-case font-normal">
                (min 10 characters)
              </span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your content here. It will be automatically adapted for each platform..."
              rows={6}
              className="w-full px-4 py-3 rounded-md bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/30 min-h-[150px]"
            />
            <div className="flex justify-end text-xs text-slate-500">
              {content.length.toLocaleString()} characters
            </div>
          </div>

          {/* 2. Platform selector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Target Platforms
                {selectedPlatforms.length > 0 && (
                  <span className="ml-2 text-cyan-400 normal-case font-normal">
                    ({selectedPlatforms.length} selected)
                  </span>
                )}
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllPlatforms}
                  className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  Select All
                </button>
                <span className="text-slate-600">|</span>
                <button
                  type="button"
                  onClick={clearPlatforms}
                  className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ALL_PLATFORMS.map((platform) => {
                const isSelected = platforms.has(platform);
                const config = PLATFORM_CONFIG[platform];
                const Icon = config.icon;
                return (
                  <label
                    key={platform}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-cyan-500/15 border-cyan-500/40 text-white'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => togglePlatform(platform)}
                      className="sr-only"
                    />
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelected ? 'bg-cyan-500 border-cyan-500' : 'border-white/30 bg-white/5'
                      }`}
                    >
                      {isSelected && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <Icon className="w-4 h-4 text-slate-400" />
                    <span className="text-sm">{config.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 3. Tone and Goal selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Tone
              </label>
              <select
                value={tone || ''}
                onChange={(e) => setTone(e.target.value as typeof tone || undefined)}
                className="w-full h-10 px-3 rounded-md bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/30"
              >
                <option value="" className="bg-slate-900 text-white">Auto-detect</option>
                {TONE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Goal
              </label>
              <select
                value={goal || ''}
                onChange={(e) => setGoal(e.target.value as typeof goal || undefined)}
                className="w-full h-10 px-3 rounded-md bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/30"
              >
                <option value="" className="bg-slate-900 text-white">Default (Engagement)</option>
                {GOAL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="px-4 py-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* 4. Preview button */}
          <div className="flex flex-col sm:flex-row sm:justify-end">
            <Button
              onClick={preview}
              disabled={!canPreview}
              className="w-full sm:w-auto bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Previews...
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  Preview Adaptations
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
