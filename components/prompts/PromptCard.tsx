'use client';

/**
 * PromptCard (Phase 96)
 *
 * Card for a single tracked prompt showing its test status, category badge,
 * brand mention result, and a Test button.
 *
 * @module components/prompts/PromptCard
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Sparkles, Loader2 as Loader } from '@/components/icons';
import { Button } from '@/components/ui/button';
import type { PromptCategory } from '@/lib/prompts/types';
import { CATEGORY_CONFIG } from '@/lib/prompts/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PromptCardData {
  id: string
  promptText: string
  promptCategory: string
  status: string          // pending | tested | scheduled
  brandMentioned: boolean | null
  brandPosition: number | null
  entityName: string
}

interface PromptCardProps {
  tracker: PromptCardData
  onTested?: (trackerId: string, brandMentioned: boolean, brandPosition: number | null) => void
}

// ─── Category badge colours ───────────────────────────────────────────────────

const CATEGORY_COLOURS: Record<PromptCategory, string> = {
  'brand-awareness':      'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'competitor-comparison': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'local-discovery':      'bg-green-500/20 text-green-300 border-green-500/30',
  'use-case':             'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'how-to':               'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  'product-feature':      'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

function categoryColour(cat: string): string {
  return CATEGORY_COLOURS[cat as PromptCategory] ?? 'bg-slate-500/20 text-slate-300 border-slate-500/30';
}

function categoryLabel(cat: string): string {
  return CATEGORY_CONFIG[cat as PromptCategory]?.label ?? cat;
}

// ─── Status indicator ────────────────────────────────────────────────────────

function StatusBadge({
  status,
  brandMentioned,
  brandPosition,
}: {
  status: string
  brandMentioned: boolean | null
  brandPosition: number | null
}) {
  if (status === 'pending' || brandMentioned === null) {
    return (
      <span className="text-xs text-slate-400 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-500 inline-block" />
        Not tested
      </span>
    );
  }

  if (brandMentioned) {
    return (
      <span className="text-xs text-green-400 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
        Brand mentioned
        {brandPosition != null && (
          <span className="ml-1 px-1.5 py-0.5 rounded bg-green-500/20 text-green-300 text-[10px] border border-green-500/30">
            #{brandPosition}
          </span>
        )}
      </span>
    );
  }

  return (
    <span className="text-xs text-red-400 flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
      Not mentioned
    </span>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PromptCard({ tracker, onTested }: PromptCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localResult, setLocalResult] = useState<{
    brandMentioned: boolean
    brandPosition: number | null
  } | null>(null);

  const effectiveMentioned = localResult !== null ? localResult.brandMentioned : tracker.brandMentioned;
  const effectivePosition  = localResult !== null ? localResult.brandPosition  : tracker.brandPosition;
  const effectiveStatus    = localResult !== null ? 'tested' : tracker.status;

  async function handleTest() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/prompts/test', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackerId: tracker.id }),
      });

      if (res.status === 429) {
        const data = await res.json();
        setError(data.error ?? 'Rate limit exceeded');
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Test failed');
        return;
      }

      const data = await res.json();
      const result = {
        brandMentioned: data.brandMentioned as boolean,
        brandPosition:  data.brandPosition as number | null,
      };
      setLocalResult(result);
      onTested?.(tracker.id, result.brandMentioned, result.brandPosition);
    } catch (err) {
      setError('Network error — please try again');
      console.error('[PromptCard.handleTest]', err);
    } finally {
      setLoading(false);
    }
  }

  const truncatedText =
    tracker.promptText.length > 120
      ? tracker.promptText.slice(0, 117) + '…'
      : tracker.promptText;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 flex flex-col gap-3 hover:border-white/20 transition-colors">
      {/* Category badge + status */}
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border',
            categoryColour(tracker.promptCategory)
          )}
        >
          {categoryLabel(tracker.promptCategory)}
        </span>
        <StatusBadge
          status={effectiveStatus}
          brandMentioned={effectiveMentioned}
          brandPosition={effectivePosition}
        />
      </div>

      {/* Prompt text */}
      <p
        className="text-sm text-slate-200 leading-relaxed"
        title={tracker.promptText}
      >
        {truncatedText}
      </p>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {/* Test button */}
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={handleTest}
          disabled={loading}
          className="text-xs border-white/20 hover:bg-white/10 text-slate-300"
        >
          {loading ? (
            <>
              <Loader className="w-3 h-3 mr-1.5 animate-spin" />
              Testing…
            </>
          ) : (
            <>
              <Sparkles className="w-3 h-3 mr-1.5" />
              Test prompt
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
