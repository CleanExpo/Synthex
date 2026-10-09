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
  Loader2,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { BRAND_CONFIDENCE_THRESHOLD } from '@/lib/constants/onboarding';
import type { PipelineResult } from '@/lib/ai/onboarding-pipeline';

interface BrandMirrorProps {
  result: PipelineResult;
  onContinue: () => void;
  onSkip: () => void;
  /** Low-confidence: return to the website form without losing the flow. */
  onTryAgain?: () => void;
  busy?: 'continue' | 'review' | null;
}

const DATA_REQUIRED_LABELS: Record<string, string> = {
  industry: 'Industry',
  description: 'Description',
  'brandColors.primary': 'Brand colour',
  logo: 'Logo',
  logoUrl: 'Logo',
  keyTopics: 'Key topics',
  targetAudience: 'Target audience',
  socialHandles: 'Social profiles',
  abn: 'ABN',
};

function uniqueMissingLabels(
  fields: string[],
  result: PipelineResult
): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const field of fields) {
    const label = DATA_REQUIRED_LABELS[field] ?? field;
    if (label === 'Logo' && result.logoUrl) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
  return labels;
}

function ToneChip({ tone }: { tone: string }) {
  const label = tone.charAt(0).toUpperCase() + tone.slice(1);

  return (
    <span className="px-2.5 py-1 rounded-sm text-xs font-medium border-[0.5px] bg-orange-500/10 text-orange-300 border-orange-500/20">
      {label}
    </span>
  );
}

export function BrandMirror({
  result,
  onContinue,
  onSkip,
  onTryAgain,
  busy = null,
}: BrandMirrorProps) {
  const isLowConfidence = result.confidence < BRAND_CONFIDENCE_THRESHOLD;
  const missingLabels = uniqueMissingLabels(result.dataRequired ?? [], result);

  if (isLowConfidence) {
    return (
      <LowConfidenceFallback
        result={result}
        onContinue={onContinue}
        onSkip={onSkip}
        onTryAgain={onTryAgain}
        busy={busy}
      />
    );
  }

  return (
    <div className="w-full space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-5 sm:p-6 rounded-sm bg-white/1 border-[0.5px] border-white/6 space-y-5">
        <div className="flex items-start gap-3">
          {result.logoUrl ? (
            <img
              src={result.logoUrl}
              alt={`${result.businessName} logo`}
              className="w-12 h-12 rounded-sm object-contain bg-white/5 shrink-0"
              onError={e => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-12 h-12 rounded-sm bg-orange-500/10 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5 text-orange-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-lg font-light text-white truncate">
              {result.businessName}
            </p>
            <p className="text-xs text-white/40 capitalize">
              {result.industry.replace(/-/g, ' ')}
            </p>
          </div>
          <p className="shrink-0 text-xs text-white/35 tabular-nums">
            {result.confidence}% match
          </p>
        </div>

        {result.description && (
          <p className="text-sm text-white/55 leading-relaxed">
            {result.description.length > 220
              ? `${result.description.slice(0, 220)}…`
              : result.description}
          </p>
        )}

        <div className="h-px bg-white/6" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-2">
            <p className="text-xs font-medium text-white/35 uppercase tracking-wider">
              Tone of voice
            </p>
            <div className="flex flex-wrap gap-2">
              <ToneChip tone={result.suggestedTone} />
            </div>
          </div>

          {result.brandColours.primary && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-white/35 uppercase tracking-wider">
                Brand colour
              </p>
              <div className="flex items-center gap-2">
                <span
                  className="w-6 h-6 rounded-sm border-[0.5px] border-white/10 shrink-0"
                  style={{ backgroundColor: result.brandColours.primary }}
                />
                <span className="text-xs text-white/45 font-mono">
                  {result.brandColours.primary}
                </span>
              </div>
            </div>
          )}
        </div>

        {result.keyTopics.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-white/35 uppercase tracking-wider">
              Key topics
            </p>
            <div className="flex flex-wrap gap-2">
              {result.keyTopics.slice(0, 5).map(topic => (
                <span
                  key={topic}
                  className="px-2.5 py-1 rounded-sm text-xs font-medium bg-white/5 text-white/70 border-[0.5px] border-white/10"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {missingLabels.length > 0 && (
        <div className="p-4 rounded-sm bg-white/1 border-[0.5px] border-white/10 space-y-2">
          <p className="text-xs font-medium text-white/35 uppercase tracking-wider">
            Add these on the next screen
          </p>
          <div className="flex flex-wrap gap-2">
            {missingLabels.map(label => (
              <span
                key={label}
                className="px-2.5 py-1 rounded-sm bg-white/5 border-[0.5px] border-white/10 text-xs text-white/45"
              >
                {label}
              </span>
            ))}
          </div>
          <p className="text-xs text-white/40">
            We couldn&rsquo;t confirm these from your site — add them so your
            content stays accurate.
          </p>
        </div>
      )}

      {result.sampleCaption && (
        <div className="p-4 rounded-sm bg-orange-500/5 border-[0.5px] border-orange-500/15 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            <p className="text-xs font-medium text-orange-400 uppercase tracking-wider">
              Sample caption
            </p>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            &ldquo;{result.sampleCaption}&rdquo;
          </p>
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3 pt-1">
        <button
          type="button"
          onClick={onContinue}
          disabled={busy !== null}
          className="sm:flex-1 text-sm text-white/45 hover:text-white/80 py-2.5 transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          {busy === 'continue' ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing…
            </span>
          ) : (
            'This looks right — continue'
          )}
        </button>
        <Button
          size="lg"
          onClick={onSkip}
          disabled={busy !== null}
          className="sm:flex-1 bg-orange-500 hover:bg-orange-400 text-black shadow-none rounded-sm"
        >
          {busy === 'review' ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing…
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Review your profile
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function LowConfidenceFallback({
  result,
  onContinue,
  onSkip,
  onTryAgain,
  busy = null,
}: BrandMirrorProps) {
  return (
    <div className="w-full space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <div className="w-12 h-12 rounded-sm bg-orange-500/15 border-[0.5px] border-orange-500/30 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-orange-400" />
        </div>
        <h2 className="text-xl font-light text-white">
          Limited information found
        </h2>
        <p className="text-sm text-white/45 leading-relaxed">
          We couldn&apos;t extract much from{' '}
          <span className="text-orange-400 font-medium">{result.url}</span>.
          This can happen with simple or password-protected sites.
        </p>
      </div>

      <div className="p-4 rounded-sm bg-orange-500/5 border-[0.5px] border-orange-500/15 space-y-2">
        <p className="text-sm text-white/70">
          You can still continue — we&apos;ll refine your brand voice as you
          create content. Completing the profile first gives better drafts.
        </p>
      </div>

      <div className="flex flex-col gap-3 pt-1">
        <Button
          size="lg"
          onClick={onSkip}
          disabled={busy !== null}
          className="w-full bg-orange-500 hover:bg-orange-400 text-black shadow-none rounded-sm"
        >
          {busy === 'review' ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing…
            </>
          ) : (
            <>
              Complete your profile
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
        <button
          type="button"
          onClick={onContinue}
          disabled={busy !== null}
          className="text-sm text-white/40 hover:text-white/70 py-2 transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          {busy === 'continue' ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing…
            </span>
          ) : (
            'Continue anyway'
          )}
        </button>
        {onTryAgain && (
          <button
            type="button"
            onClick={onTryAgain}
            className="text-xs text-white/35 hover:text-white/60 underline underline-offset-2 transition-colors"
          >
            Go back and try a different URL
          </button>
        )}
      </div>
    </div>
  );
}
