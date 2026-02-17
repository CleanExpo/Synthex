'use client';

/**
 * Multi-format Generation Dashboard Page
 *
 * @description Two-phase UI for generating platform-optimized content variants.
 * Phase 1 (input): source content textarea, platform multi-select, tone/goal dropdowns, generate button.
 * Phase 2 (results): platform variant cards with content, character count, score badge, copy button, hashtags.
 */

import { useState } from 'react';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Layers, Copy, Check, ArrowLeft, Loader2 } from '@/components/icons';
import type { PlatformVariant } from '@/lib/ai/multi-format-adapter';

// ============================================================================
// CONSTANTS
// ============================================================================

const PLATFORMS = [
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'pinterest', label: 'Pinterest' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'threads', label: 'Threads' },
] as const;

const TONES = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'playful', label: 'Playful' },
  { value: 'authoritative', label: 'Authoritative' },
  { value: 'friendly', label: 'Friendly' },
] as const;

const GOALS = [
  { value: 'engagement', label: 'Engagement' },
  { value: 'reach', label: 'Reach' },
  { value: 'conversions', label: 'Conversions' },
  { value: 'brand_awareness', label: 'Brand Awareness' },
  { value: 'traffic', label: 'Traffic' },
] as const;

const FORMAT_COLORS: Record<string, string> = {
  thread: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'long-form': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'short-form': 'bg-green-500/20 text-green-400 border-green-500/30',
  carousel: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  script: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  standard: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
};

// ============================================================================
// SCORE COLOR HELPERS
// ============================================================================

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-green-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-red-400';
}

function getScoreBgColor(score: number): string {
  if (score >= 70) return 'bg-green-500/20 border-green-500/30';
  if (score >= 40) return 'bg-yellow-500/20 border-yellow-500/30';
  return 'bg-red-500/20 border-red-500/30';
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function FormatBadge({ format }: { format: PlatformVariant['format'] }) {
  const colorClass = FORMAT_COLORS[format] ?? FORMAT_COLORS['standard'];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}
    >
      {format}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <div
      className={`inline-flex items-center justify-center w-8 h-8 rounded-full border text-xs font-bold ${getScoreBgColor(score)} ${getScoreColor(score)}`}
    >
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
      // Clipboard API unavailable — silent fail
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
  const { characterCount, characterLimit, hashtags } = variant.metadata;
  const isOverLimit = characterCount > characterLimit;

  return (
    <Card className="bg-[#0f172a]/80 border border-cyan-500/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-white text-base flex items-center gap-2">
            {variant.platform.charAt(0).toUpperCase() + variant.platform.slice(1)}
            <FormatBadge format={variant.format} />
          </CardTitle>
          <div className="flex items-center gap-2">
            {variant.score !== undefined && <ScoreBadge score={variant.score} />}
            <CopyButton text={variant.content} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Content text */}
        <div className="whitespace-pre-wrap text-sm text-slate-300 bg-white/5 rounded-md px-3 py-2 max-h-48 overflow-y-auto leading-relaxed">
          {variant.content}
        </div>

        {/* Character count */}
        <div className="flex items-center justify-between text-xs">
          <span className={isOverLimit ? 'text-red-400' : 'text-green-400'}>
            {characterCount.toLocaleString()} / {characterLimit.toLocaleString()} characters
          </span>
          {isOverLimit && (
            <span className="text-red-400 font-semibold">
              {(characterCount - characterLimit).toLocaleString()} over limit
            </span>
          )}
        </div>

        {/* Hashtags */}
        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {hashtags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
              >
                {tag.startsWith('#') ? tag : `#${tag}`}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function MultiFormatPage() {
  const [content, setContent] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [tone, setTone] = useState('professional');
  const [goal, setGoal] = useState('engagement');
  const [variants, setVariants] = useState<PlatformVariant[] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'input' | 'results'>('input');

  const togglePlatform = (value: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]
    );
  };

  const selectAll = () => setSelectedPlatforms(PLATFORMS.map((p) => p.value));
  const clearAll = () => setSelectedPlatforms([]);

  const handleGenerate = async () => {
    if (!content.trim() || selectedPlatforms.length === 0 || isGenerating) return;
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/content/multi-format', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content, targetPlatforms: selectedPlatforms, tone, goal }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Request failed (${response.status})`);
      }

      const data = await response.json();
      if (data?.success && Array.isArray(data?.variants)) {
        setVariants(data.variants as PlatformVariant[]);
        setPhase('results');
      } else {
        throw new Error('Unexpected response format from server.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBackToEditor = () => {
    setPhase('input');
    setError(null);
  };

  const canGenerate = content.trim().length > 0 && selectedPlatforms.length > 0;

  // ============================================================================
  // PHASE 2: RESULTS
  // ============================================================================

  if (phase === 'results' && variants) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader
            title="Multi-format Generator"
            description={`Generated ${variants.length} platform variant${variants.length !== 1 ? 's' : ''} from your content.`}
          />
          <Button
            variant="ghost"
            onClick={handleBackToEditor}
            className="flex-shrink-0 text-slate-300 hover:text-white hover:bg-white/5 border border-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Editor
          </Button>
        </div>

        {/* Variant cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        title="Multi-format Generator"
        description="Transform your content into platform-optimized versions for every channel."
      />

      {/* Input card */}
      <Card className="bg-[#0f172a]/80 border border-cyan-500/10">
        <CardHeader className="pb-4">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            Content & Platforms
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* 1. Source content textarea */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Source Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste or type your content here..."
              rows={6}
              className="w-full px-4 py-3 rounded-md bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/30 min-h-[120px]"
            />
          </div>

          {/* 2. Platform multi-select */}
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
                  onClick={selectAll}
                  className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  Select All
                </button>
                <span className="text-slate-600">|</span>
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {PLATFORMS.map((platform) => {
                const isSelected = selectedPlatforms.includes(platform.value);
                return (
                  <label
                    key={platform.value}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-cyan-500/15 border-cyan-500/40 text-white'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => togglePlatform(platform.value)}
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
                    <span className="text-sm">{platform.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 3. Options row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Tone
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/30"
              >
                {TONES.map((t) => (
                  <option key={t.value} value={t.value} className="bg-slate-900 text-white">
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Goal
              </label>
              <select
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/30"
              >
                {GOALS.map((g) => (
                  <option key={g.value} value={g.value} className="bg-slate-900 text-white">
                    {g.label}
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

          {/* 4. Generate button */}
          <div className="flex flex-col sm:flex-row sm:justify-end">
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate || isGenerating}
              className="w-full sm:w-auto bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Variants
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
