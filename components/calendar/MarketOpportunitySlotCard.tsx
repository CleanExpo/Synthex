'use client';

/**
 * MarketOpportunitySlotCard — components/calendar/MarketOpportunitySlotCard.tsx
 *
 * Renders a single market opportunity slot injected by the Predictive Seasonal
 * Engine (SYN-547/549). Visually distinct from standard AI slots:
 *   - Amber/orange accent (bg + border)
 *   - "Market Opportunity" badge
 *   - Tooltip: why this slot was auto-added
 *   - "Not relevant" dismiss button (calls /api/calendar/seasonal-dismiss)
 *
 * @task SYN-549
 */

import React, { useState } from 'react';
import { CheckCircle, XCircle, Clock, Sparkles } from '@/components/icons';
import {
  InstagramIcon,
  FacebookIcon,
  LinkedInIcon,
  TwitterXIcon,
  TikTokIcon,
  YouTubeIcon,
  PinterestIcon,
  RedditIcon,
  ThreadsIcon,
} from '@/components/icons/platform-icons';
import type { CalendarPlatform } from '@/lib/calendar/types';
import type { SlotWithMeta } from './AICalendarSlotCard';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MarketOpportunitySlotCardProps {
  slot: SlotWithMeta;
  calendarId: string;
  shadowMode: boolean;
  onApprove: (slotId: string, selectedCaption: number) => Promise<void>;
  onReject: (slotId: string) => Promise<void>;
  onCaptionSelect: (slotId: string, captionIndex: number) => Promise<void>;
  onDismiss: (signalId: string) => Promise<void>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PLATFORM_ICONS: Record<
  CalendarPlatform,
  React.FC<{ className?: string }>
> = {
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  linkedin: LinkedInIcon,
  twitter: TwitterXIcon,
  tiktok: TikTokIcon,
  youtube: YouTubeIcon,
  pinterest: PinterestIcon,
  reddit: RedditIcon,
  threads: ThreadsIcon,
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Australia/Sydney',
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MarketOpportunitySlotCard({
  slot,
  shadowMode,
  onApprove,
  onReject,
  onCaptionSelect,
  onDismiss,
}: MarketOpportunitySlotCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const selectedIdx = slot.selectedCaption ?? 0;
  const selectedCaption = slot.captions[selectedIdx] ?? slot.captions[0] ?? '';
  const previewText =
    selectedCaption.length > 80
      ? `${selectedCaption.slice(0, 80)}…`
      : selectedCaption;

  const isApproved = slot.status === 'approved';
  const isRejected = slot.status === 'rejected';
  const isPending = !isApproved && !isRejected;

  async function handleApprove() {
    setSaving(true);
    try {
      await onApprove(slot.id, selectedIdx);
    } finally {
      setSaving(false);
    }
  }

  async function handleReject() {
    setSaving(true);
    try {
      await onReject(slot.id);
    } finally {
      setSaving(false);
    }
  }

  async function handleCaptionSelect(idx: number) {
    if (idx === selectedIdx) return;
    setSaving(true);
    try {
      await onCaptionSelect(slot.id, idx);
    } finally {
      setSaving(false);
    }
  }

  async function handleDismiss() {
    if (!slot.signalId) return;
    setSaving(true);
    try {
      await onDismiss(slot.signalId);
      setDismissed(true);
    } finally {
      setSaving(false);
    }
  }

  // Hide after dismiss
  if (dismissed) return null;

  return (
    <div
      className={`
        rounded-xl border p-4 transition-all duration-200
        ${
          isApproved
            ? 'bg-emerald-500/5 border-emerald-500/20'
            : isRejected
              ? 'bg-red-500/5 border-red-500/15 opacity-60'
              : 'bg-amber-500/5 border-amber-500/25 hover:border-amber-500/40'
        }
      `}
    >
      {/* Market Opportunity badge */}
      <div className="flex items-center gap-1.5 mb-3">
        <Sparkles className="h-3 w-3 text-amber-400" />
        <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
          Market Opportunity
        </span>
        {slot.opportunityLabel && (
          <span className="text-[10px] text-amber-600 truncate">
            · {slot.opportunityLabel}
          </span>
        )}
      </div>

      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="shrink-0 w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            {(() => {
              const Icon = PLATFORM_ICONS[slot.platform];
              return Icon ? <Icon className="w-4 h-4" /> : null;
            })()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white capitalize">
              {slot.platform}
            </p>
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
              <Clock className="h-3 w-3" />
              {DAY_LABELS[slot.dayOfWeek]} · {formatTime(slot.scheduledAt)}
            </p>
          </div>
        </div>

        {/* Status icons */}
        <div className="flex items-center gap-2 shrink-0">
          {isApproved && (
            <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
          )}
          {isRejected && <XCircle className="h-4 w-4 text-red-400 shrink-0" />}
        </div>
      </div>

      {/* Tooltip / explainer */}
      <p className="text-xs text-amber-600/80 leading-relaxed mb-3 italic">
        Synthex identified an upcoming opportunity for your industry — this slot
        was added automatically.
      </p>

      {/* Caption preview */}
      <p className="text-sm text-gray-300 leading-relaxed mb-3">
        {expanded ? selectedCaption : previewText}
        {selectedCaption.length > 80 && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="ml-1 text-xs text-amber-400 hover:text-amber-300 underline-offset-2 hover:underline"
          >
            {expanded ? 'less' : 'more'}
          </button>
        )}
      </p>

      {/* Caption variant selector */}
      {slot.captions.length > 1 && (
        <div className="flex items-center gap-1.5 mb-3">
          {slot.captions.slice(0, 3).map((caption, idx) => (
            <button
              key={idx}
              onClick={() => handleCaptionSelect(idx)}
              disabled={saving}
              title={caption.slice(0, 60)}
              className={`
                px-2.5 py-1 rounded-full text-xs font-medium transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
                ${
                  idx === selectedIdx
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-white/5 text-gray-500 border border-white/5 hover:bg-white/8 hover:text-gray-400'
                }
              `}
            >
              {String.fromCharCode(65 + idx)}
            </button>
          ))}
        </div>
      )}

      {/* Action buttons */}
      {shadowMode && isPending && (
        <div className="flex items-center gap-2 mt-2 pt-3 border-t border-amber-500/10">
          <button
            onClick={handleApprove}
            disabled={saving}
            className="
              flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg
              bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium
              hover:bg-emerald-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Approve
          </button>
          <button
            onClick={handleReject}
            disabled={saving}
            className="
              flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg
              bg-red-500/8 border border-red-500/15 text-red-400 text-xs font-medium
              hover:bg-red-500/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            <XCircle className="h-3.5 w-3.5" />
            Reject
          </button>
        </div>
      )}

      {/* Dismiss — always visible on pending slots */}
      {isPending && slot.signalId && (
        <div className="mt-2 pt-2 border-t border-white/5">
          <button
            onClick={handleDismiss}
            disabled={saving}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors disabled:opacity-50"
          >
            Not relevant — don&apos;t show again
          </button>
        </div>
      )}

      {!shadowMode && isPending && (
        <p className="text-xs text-gray-600 mt-1">
          Will publish automatically at scheduled time
        </p>
      )}
    </div>
  );
}
