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

  return (
    <div className="border-[0.5px] border-white/[0.06] rounded-sm p-4 bg-white/[0.01]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-[10px] uppercase tracking-wider border-[0.5px] px-2 py-0.5 rounded-sm',
              platformColour
            )}
          >
            {item.platform}
          </span>
          {item.theme && (
            <span className="text-[10px] text-white/50 uppercase tracking-wider">
              {item.theme}
            </span>
          )}
        </div>
        {item.score != null && (
          <span
            className={cn(
              'text-xs font-mono',
              item.score >= 80
                ? 'text-emerald-400'
                : item.score >= 65
                  ? 'text-orange-400'
                  : 'text-red-400'
            )}
          >
            {item.score}/100
          </span>
        )}
      </div>

      {/* Content preview */}
      <p className="text-sm text-white/60 line-clamp-3 leading-relaxed mb-4">
        {item.content}
      </p>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleApprove}
          disabled={isActing}
          className="flex-1 py-1.5 text-xs font-medium bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-[0.5px] border-emerald-500/20 rounded-sm transition-colors disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={handleReject}
          disabled={isActing}
          className="px-3 py-1.5 text-xs text-white/50 hover:text-red-400 border-[0.5px] border-white/[0.06] hover:border-red-500/20 rounded-sm transition-colors disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
