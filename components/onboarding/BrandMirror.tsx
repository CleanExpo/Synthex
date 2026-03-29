'use client';

/**
 * BrandMirror — Brand voice preview shown after the onboarding pipeline completes.
 *
 * Displays extracted brand voice attributes, tone descriptors, key topics, and a
 * sample AI-generated caption. If the pipeline confidence is below the threshold,
 * a friendly fallback message is shown instead of potentially low-quality output.
 *
 * Part of SYN-503 (Async-First Onboarding Quick-Start Flow).
 * Decision: SYN-502 Board Session 3 — show value before asking for trust.
 */

import React from 'react';
import {
  Sparkles,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Globe,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BRAND_CONFIDENCE_THRESHOLD } from '@/lib/constants/onboarding';
import type { PipelineResult } from '@/lib/ai/onboarding-pipeline';

// ============================================================================
// TYPES
// ============================================================================

interface BrandMirrorProps {
  result: PipelineResult;
  onContinue: () => void;
  onSkip: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Maps a tone string to a human-readable descriptor chip. */
function ToneChip({ tone }: { tone: string }) {
  const toneMap: Record<string, { label: string; colour: string }> = {
    professional: { label: 'Professional', colour: 'bg-blue-500/15 text-blue-300 border-blue-500/20' },
    friendly: { label: 'Friendly', colour: 'bg-green-500/15 text-green-300 border-green-500/20' },
    authoritative: { label: 'Authoritative', colour: 'bg-purple-500/15 text-purple-300 border-purple-500/20' },
    casual: { label: 'Casual', colour: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20' },
    educational: { label: 'Educational', colour: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/20' },
    inspirational: { label: 'Inspirational', colour: 'bg-pink-500/15 text-pink-300 border-pink-500/20' },
  };
  const match = toneMap[tone.toLowerCase()] ?? { label: tone.charAt(0).toUpperCase() + tone.slice(1), colour: 'bg-orange-500/15 text-orange-300 border-orange-500/20' };

  return (
    <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium border', match.colour)}>
      {match.label}
    </span>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BrandMirror({ result, onContinue, onSkip }: BrandMirrorProps) {
  const isLowConfidence = result.confidence < BRAND_CONFIDENCE_THRESHOLD;

  if (isLowConfidence) {
    return <LowConfidenceFallback result={result} onContinue={onContinue} onSkip={onSkip} />;
  }

  return (
    <div className="max-w-lg mx-auto space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-center mx-auto shadow-lg shadow-orange-500/30">
          <Sparkles className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-xl font-bold text-white">Here&apos;s your brand</h2>
        <p className="text-sm text-gray-400">
          Our AI read your website and extracted your brand voice. Does this feel right?
        </p>
      </div>

      {/* Brand voice card */}
      <div className="p-5 rounded-xl bg-surface-base/80 border border-orange-500/10 backdrop-blur-sm space-y-4">
        {/* Business + industry */}
        <div className="flex items-start gap-3">
          {result.logoUrl ? (
            <img
              src={result.logoUrl}
              alt={`${result.businessName} logo`}
              className="w-10 h-10 rounded-lg object-contain bg-white/5 shrink-0"
              onError={e => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5 text-orange-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white truncate">{result.businessName}</p>
            <p className="text-xs text-gray-400 capitalize">{result.industry.replace(/-/g, ' ')}</p>
          </div>
          <div className="shrink-0">
            <span className="text-xs text-orange-400 font-medium">
              {result.confidence}% confident
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/5" />

        {/* Tone of voice */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Tone of Voice</p>
          <div className="flex flex-wrap gap-2">
            <ToneChip tone={result.suggestedTone} />
          </div>
        </div>

        {/* Key topics */}
        {result.keyTopics.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Key Topics</p>
            <div className="flex flex-wrap gap-2">
              {result.keyTopics.slice(0, 5).map(topic => (
                <span
                  key={topic}
                  className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 text-gray-300 border border-white/10"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Brand colour swatch */}
        {result.brandColours.primary && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Brand Colour</p>
            <div className="flex items-center gap-2">
              <span
                className="w-6 h-6 rounded-full border border-white/10 shrink-0"
                style={{ backgroundColor: result.brandColours.primary }}
              />
              <span className="text-xs text-gray-400 font-mono">{result.brandColours.primary}</span>
            </div>
          </div>
        )}
      </div>

      {/* Sample caption */}
      {result.sampleCaption && (
        <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/15 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            <p className="text-xs font-medium text-orange-400 uppercase tracking-wider">
              Sample AI Caption
            </p>
          </div>
          <p className="text-sm text-gray-200 leading-relaxed italic">
            &ldquo;{result.sampleCaption}&rdquo;
          </p>
        </div>
      )}

      {/* Description */}
      {result.description && (
        <p className="text-sm text-gray-400 text-center leading-relaxed">
          {result.description.length > 120
            ? result.description.slice(0, 120) + '…'
            : result.description}
        </p>
      )}

      {/* CTAs */}
      <div className="flex flex-col gap-3 pt-1">
        <Button
          size="lg"
          onClick={onContinue}
          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all"
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          Yes, connect my accounts
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
        <button
          onClick={onSkip}
          className="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2 transition-colors"
        >
          This doesn&apos;t look right — let me edit it first
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// LOW CONFIDENCE FALLBACK
// ============================================================================

function LowConfidenceFallback({
  result,
  onContinue,
  onSkip,
}: BrandMirrorProps) {
  return (
    <div className="max-w-lg mx-auto space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-full bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center mx-auto">
          <AlertCircle className="w-7 h-7 text-yellow-400" />
        </div>
        <h2 className="text-xl font-bold text-white">Limited information found</h2>
        <p className="text-sm text-gray-400 max-w-xs mx-auto">
          We couldn&apos;t extract much from{' '}
          <span className="text-orange-400 font-medium">{result.url}</span>. This can
          happen with simple or password-protected sites.
        </p>
      </div>

      <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/15 space-y-2">
        <p className="text-sm text-gray-300">
          You can still connect your accounts — we&apos;ll refine your brand voice as you
          create content.
        </p>
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-3 pt-1">
        <Button
          size="lg"
          onClick={onContinue}
          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white shadow-lg shadow-orange-500/25 transition-all"
        >
          Continue anyway
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
        <button
          onClick={onSkip}
          className="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2 transition-colors"
        >
          Go back and try a different URL
        </button>
      </div>
    </div>
  );
}
