'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { fetchWithCSRF } from '@/lib/csrf';
import type { PendingContent } from './types';

interface Props {
  item: PendingContent;
  onAction?: () => void;
}

const PLATFORM_COLOURS: Record<string, string> = {
  instagram: 'border-pink-500/30 text-pink-400',
  twitter: 'border-sky-500/30 text-sky-400',
  linkedin: 'border-blue-500/30 text-blue-400',
  facebook: 'border-indigo-500/30 text-indigo-400',
  tiktok: 'border-purple-500/30 text-purple-400',
  youtube: 'border-red-500/30 text-red-400',
};

export function PendingContentCard({ item, onAction }: Props) {
  const [isActing, setIsActing] = useState(false);

  const handleApprove = async () => {
    setIsActing(true);
    try {
      await fetchWithCSRF(`/api/content-drafts/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'scheduled' }),
      });
      onAction?.();
    } finally {
      setIsActing(false);
    }
  };

  const handleReject = async () => {
    setIsActing(true);
    try {
      await fetchWithCSRF(`/api/content-drafts/${item.id}`, {
        method: 'DELETE',
      });
      onAction?.();
    } finally {
      setIsActing(false);
    }
  };

  const platformColour =
    PLATFORM_COLOURS[item.platform] ?? 'border-white/10 text-white/50';
  const scoreColour =
    item.score == null
      ? ''
      : item.score >= 80
        ? 'text-emerald-400'
        : item.score >= 65
          ? 'text-orange-400'
          : 'text-red-400';

  return (
    <div className="group flex items-center gap-3 border-b border-white/[0.04] px-2 py-2.5 transition-colors last:border-0 hover:bg-white/[0.02]">
      {/* Platform marker — colour-coded dot */}
      <span
        title={item.platform}
        className={cn(
          'h-1.5 w-1.5 shrink-0 rounded-full bg-current',
          platformColour
        )}
      />

      {/* Preview + meta — one line each, keeps the row scannable */}
      <div className="min-w-0 flex-1">
        <p
          title={item.content}
          className="truncate text-sm leading-snug text-white/70"
        >
          {item.content}
        </p>
        <div className="mt-0.5 flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/35">
          <span className={cn('shrink-0', platformColour)}>
            {item.platform}
          </span>
          {item.theme && <span className="truncate">{item.theme}</span>}
        </div>
      </div>

      {/* Score — decision signal, kept beside the actions */}
      {item.score != null && (
        <span className={cn('shrink-0 font-mono text-xs', scoreColour)}>
          {item.score}
        </span>
      )}

      {/* Actions — compact, always reachable, emphasised on hover/focus */}
      <div className="flex shrink-0 items-center gap-1 opacity-80 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          onClick={handleApprove}
          disabled={isActing}
          aria-label={`Approve ${item.platform} post`}
          className="rounded-sm border-[0.5px] border-emerald-500/20 bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/30 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={handleReject}
          disabled={isActing}
          aria-label={`Reject ${item.platform} post`}
          title="Reject"
          className="rounded-sm border-[0.5px] border-white/[0.06] px-2 py-1 text-xs text-white/40 transition-colors hover:border-red-500/20 hover:text-red-400 disabled:opacity-50"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
