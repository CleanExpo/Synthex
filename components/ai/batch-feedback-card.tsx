/**
 * Batch Feedback Card Component
 *
 * @description Tap-to-rank feedback UI for a 3-variant image generation
 * batch. Always sends the complete current verdict state on every save (the
 * PATCH endpoint performs an idempotent whole-batch replace) — never a
 * delta, so a re-save can never silently drop a previously-ranked variant.
 */

'use client';

import { useState } from 'react';
import {
  BatchResult,
  BatchImage,
  mediaAssetImageSrc,
} from '@/hooks/use-image-generation';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  X,
  Loader2,
  Image as ImageIcon,
} from '@/components/icons';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

type VerdictState = { state: 'ranked'; rank: number } | { state: 'rejected' };
type VerdictMap = Record<string, VerdictState>;

interface BatchFeedbackCardProps {
  batch: BatchResult;
  /** Fired after a successful save so the page can refresh the insights panel. */
  onSaved?: () => void;
  className?: string;
}

// ============================================================================
// PURE VERDICT-MAP HELPERS
// ============================================================================

/** Renumbers ranked entries to a contiguous 1..k sequence, preserving order. */
function renumberRanked(map: VerdictMap): VerdictMap {
  const rankedIds = Object.entries(map)
    .filter(
      (entry): entry is [string, { state: 'ranked'; rank: number }] =>
        entry[1].state === 'ranked'
    )
    .sort((a, b) => a[1].rank - b[1].rank)
    .map(([id]) => id);

  const next = { ...map };
  rankedIds.forEach((id, index) => {
    next[id] = { state: 'ranked', rank: index + 1 };
  });
  return next;
}

/** Tap an unranked/rejected image → next free rank. Tap a ranked image → clear + renumber. */
function tapImage(map: VerdictMap, generationId: string): VerdictMap {
  const current = map[generationId];

  if (current?.state === 'ranked') {
    const { [generationId]: _removed, ...rest } = map;
    return renumberRanked(rest);
  }

  const usedRanks = new Set(
    Object.values(map)
      .filter(
        (v): v is { state: 'ranked'; rank: number } => v.state === 'ranked'
      )
      .map(v => v.rank)
  );
  let nextRank = 1;
  while (usedRanks.has(nextRank)) nextRank++;
  if (nextRank > 3) return map;

  return { ...map, [generationId]: { state: 'ranked', rank: nextRank } };
}

/** Toggles the reject state. Rejecting a ranked image clears + renumbers first. */
function toggleReject(map: VerdictMap, generationId: string): VerdictMap {
  const current = map[generationId];

  if (current?.state === 'rejected') {
    const { [generationId]: _removed, ...rest } = map;
    return rest;
  }

  let base = map;
  if (current?.state === 'ranked') {
    const { [generationId]: _removed, ...rest } = map;
    base = renumberRanked(rest);
  }

  return { ...base, [generationId]: { state: 'rejected' } };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BatchFeedbackCard({
  batch,
  onSaved,
  className,
}: BatchFeedbackCardProps) {
  const [verdictMap, setVerdictMap] = useState<VerdictMap>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [noneGoodOpen, setNoneGoodOpen] = useState(false);
  const [noneGoodReason, setNoneGoodReason] = useState('');

  const successfulImages = batch.images.filter(image => image.success);

  const verdicts = successfulImages
    .filter(image => verdictMap[image.generationId])
    .map(image => {
      const verdict = verdictMap[image.generationId];
      return verdict.state === 'ranked'
        ? { generationId: image.generationId, kept: true, rank: verdict.rank }
        : { generationId: image.generationId, kept: false };
    });

  const handleTapImage = (generationId: string) => {
    if (saving) return;
    setVerdictMap(prev => tapImage(prev, generationId));
    setSaved(false);
    setSaveError(false);
  };

  const handleToggleReject = (generationId: string) => {
    if (saving) return;
    setVerdictMap(prev => toggleReject(prev, generationId));
    setSaved(false);
    setSaveError(false);
  };

  const handleNoneGood = () => {
    if (saving || successfulImages.length === 0) return;
    const rejectedAll: VerdictMap = {};
    successfulImages.forEach(image => {
      rejectedAll[image.generationId] = { state: 'rejected' };
    });
    setVerdictMap(rejectedAll);
    setNoneGoodOpen(true);
    setSaved(false);
    setSaveError(false);
  };

  const handleSave = async () => {
    if (saving || verdicts.length === 0) return;

    setSaving(true);
    setSaveError(false);

    try {
      const response = await fetch('/api/media/generate/image/feedback', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchGroupId: batch.batchGroupId,
          verdicts,
          ...(noneGoodOpen && noneGoodReason.trim()
            ? { noneGoodReason: noneGoodReason.trim() }
            : {}),
        }),
      });

      if (response.ok) {
        setSaved(true);
        onSaved?.();
      } else {
        setSaveError(true);
      }
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  const saveLabel = saving
    ? 'Saving…'
    : saveError
      ? "Couldn't save — tap to retry"
      : saved
        ? 'Saved — Synthex is learning'
        : 'Save feedback';

  return (
    <div
      className={cn(
        'rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3',
        className
      )}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {batch.images.map(image => (
          <VariantCell
            key={image.generationId}
            image={image}
            verdict={verdictMap[image.generationId]}
            disabled={saving}
            onTapImage={() => handleTapImage(image.generationId)}
            onToggleReject={() => handleToggleReject(image.generationId)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleNoneGood}
          disabled={saving || successfulImages.length === 0}
          className="text-sm text-white/50 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          None are good
        </button>

        <Button
          type="button"
          onClick={handleSave}
          disabled={verdicts.length === 0 || saving}
          className={cn(
            'rounded-xl font-medium',
            saveError
              ? 'bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30'
              : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {saveLabel}
        </Button>
      </div>

      {noneGoodOpen && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={noneGoodReason}
            onChange={e => setNoneGoodReason(e.target.value)}
            disabled={saving}
            placeholder="What was wrong? (optional)"
            maxLength={500}
            className={cn(
              'flex-1 rounded-lg px-3 py-2 text-sm',
              'bg-white/5 border border-white/10 text-white placeholder:text-gray-500',
              'focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          />
          <button
            type="button"
            onClick={() => setNoneGoodOpen(false)}
            disabled={saving}
            aria-label="Dismiss"
            className={cn(
              'min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full',
              'text-white/50 hover:text-white transition-colors disabled:opacity-50'
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// VARIANT CELL
// ============================================================================

function VariantCell({
  image,
  verdict,
  disabled,
  onTapImage,
  onToggleReject,
}: {
  image: BatchImage;
  verdict?: VerdictState;
  disabled: boolean;
  onTapImage: () => void;
  onToggleReject: () => void;
}) {
  if (!image.success) {
    return (
      <div
        className={cn(
          'relative aspect-square rounded-xl overflow-hidden',
          'bg-white/5 border border-white/10',
          'flex items-center justify-center'
        )}
      >
        <div className="flex flex-col items-center gap-2 text-center p-4">
          <div className="p-2 rounded-full bg-red-500/20 border border-red-500/30">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <p className="text-sm text-red-300">
            {image.error || 'Failed to generate'}
          </p>
        </div>
      </div>
    );
  }

  const src =
    image.imageUrl ??
    (image.mediaAssetId ? mediaAssetImageSrc(image.mediaAssetId) : undefined);
  const isRanked = verdict?.state === 'ranked';
  const isRejected = verdict?.state === 'rejected';

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={
        isRanked
          ? `Ranked ${verdict.rank}. Tap to clear rank.`
          : isRejected
            ? 'Marked unusable. Tap to rank this image.'
            : 'Tap to rank this image.'
      }
      onClick={() => {
        if (!disabled) onTapImage();
      }}
      onKeyDown={e => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onTapImage();
        }
      }}
      className={cn(
        'relative aspect-square rounded-xl overflow-hidden cursor-pointer',
        'bg-white/5 border transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50',
        isRejected
          ? 'border-red-500/50 opacity-50'
          : isRanked
            ? 'border-orange-500/50'
            : 'border-white/10',
        disabled && 'pointer-events-none opacity-60'
      )}
    >
      {src ? (
        <img
          src={src}
          alt="Generated variant"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-slate-900">
          <ImageIcon className="h-12 w-12 text-white/40" />
        </div>
      )}

      {isRanked && (
        <div
          className={cn(
            'absolute top-2 left-2 h-7 w-7 rounded-full',
            'bg-orange-500 text-white text-sm font-semibold',
            'flex items-center justify-center shadow'
          )}
        >
          {verdict.rank}
        </div>
      )}

      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          if (!disabled) onToggleReject();
        }}
        disabled={disabled}
        aria-label={isRejected ? 'Unmark as unusable' : 'Mark as unusable'}
        className={cn(
          'absolute top-2 right-2 min-h-[44px] min-w-[44px] rounded-full',
          'flex items-center justify-center transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          isRejected
            ? 'bg-red-500 text-white'
            : 'bg-black/60 text-white/70 hover:bg-black/80 hover:text-white'
        )}
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
