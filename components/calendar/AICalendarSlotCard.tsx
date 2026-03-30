'use client';

/**
 * AICalendarSlotCard — components/calendar/AICalendarSlotCard.tsx
 *
 * Displays a single AI-generated content calendar slot with:
 *   - Platform icon + scheduled time
 *   - Content type badge
 *   - Caption A / B / C variant selector
 *   - Hashtag count pill
 *   - Approve / Reject actions (shadow mode only)
 *
 * @task SYN-522
 */

import React, { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Hash,
  ChevronDown,
  Clock,
} from '@/components/icons';
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
import type { CalendarSlot, CalendarPlatform } from '@/lib/calendar/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SlotWithMeta extends CalendarSlot {
  /** Status set by reviewer — only present after the slot has been actioned */
  status?: 'approved' | 'rejected';
  /** Index of the selected caption variant (0=A, 1=B, 2=C) */
  selectedCaption?: number;
}

export interface AICalendarSlotCardProps {
  slot: SlotWithMeta;
  calendarId: string;
  shadowMode: boolean;
  onApprove: (slotId: string, selectedCaption: number) => Promise<void>;
  onReject: (slotId: string) => Promise<void>;
  onCaptionSelect: (slotId: string, captionIndex: number) => Promise<void>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// ── Platform icon map ─────────────────────────────────────────────────────────

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

// ── Content type label/colour maps ────────────────────────────────────────────

const CONTENT_TYPE_LABELS: Record<string, string> = {
  educational: 'Educational',
  promotional: 'Promo',
  engagement: 'Engagement',
  'behind-the-scenes': 'BTS',
  testimonial: 'Testimonial',
  trending: 'Trending',
};

const CONTENT_TYPE_COLOURS: Record<string, string> = {
  educational: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  promotional: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  engagement: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'behind-the-scenes': 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  testimonial: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  trending: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
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

export function AICalendarSlotCard({
  slot,
  shadowMode,
  onApprove,
  onReject,
  onCaptionSelect,
}: AICalendarSlotCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedIdx = slot.selectedCaption ?? 0;
  const selectedCaption = slot.captions[selectedIdx] ?? slot.captions[0] ?? '';
  const previewText =
    selectedCaption.length > 80
      ? `${selectedCaption.slice(0, 80)}…`
      : selectedCaption;

  const isApproved = slot.status === 'approved';
  const isRejected = slot.status === 'rejected';
  const isPending = !isApproved && !isRejected;

  const typeColour =
    CONTENT_TYPE_COLOURS[slot.contentType] ??
    'bg-gray-500/10 text-gray-400 border-gray-500/20';

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

  return (
    <div
      className={`
        rounded-xl border p-4 transition-all duration-200
        ${
          isApproved
            ? 'bg-emerald-500/5 border-emerald-500/20'
            : isRejected
              ? 'bg-red-500/5 border-red-500/15 opacity-60'
              : 'bg-[#0d0d14] border-white/8 hover:border-white/12'
        }
      `}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        {/* Left: platform + day/time */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="shrink-0 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
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

        {/* Right: content type badge + status */}
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${typeColour}`}
          >
            {CONTENT_TYPE_LABELS[slot.contentType] ?? slot.contentType}
          </span>
          {isApproved && (
            <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
          )}
          {isRejected && <XCircle className="h-4 w-4 text-red-400 shrink-0" />}
        </div>
      </div>

      {/* Caption preview */}
      <p className="text-sm text-gray-300 leading-relaxed mb-3">
        {expanded ? selectedCaption : previewText}
        {selectedCaption.length > 80 && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="ml-1 text-xs text-cyan-400 hover:text-cyan-300 underline-offset-2 hover:underline"
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
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-white/5 text-gray-500 border border-white/5 hover:bg-white/8 hover:text-gray-400'
                }
              `}
            >
              {String.fromCharCode(65 + idx)} {/* A, B, C */}
            </button>
          ))}
          <button
            onClick={() => setExpanded(v => !v)}
            className="ml-auto text-gray-600 hover:text-gray-400 transition-colors"
            title="Expand"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      )}

      {/* Hashtag pill */}
      {slot.hashtags.length > 0 && (
        <div className="flex items-center gap-1.5 mb-3">
          <Hash className="h-3 w-3 text-gray-600" />
          <span className="text-xs text-gray-600">
            {slot.hashtags.length} hashtag
            {slot.hashtags.length !== 1 ? 's' : ''}
          </span>
          <span className="text-xs text-gray-700 truncate">
            {slot.hashtags.slice(0, 3).join(' ')}
            {slot.hashtags.length > 3 && ` +${slot.hashtags.length - 3}`}
          </span>
        </div>
      )}

      {/* Action buttons — only in shadow mode for pending slots */}
      {shadowMode && isPending && (
        <div className="flex items-center gap-2 mt-2 pt-3 border-t border-white/5">
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

      {/* Live mode indicator */}
      {!shadowMode && isPending && (
        <p className="text-xs text-gray-600 mt-2 pt-2 border-t border-white/5">
          Will publish automatically at scheduled time
        </p>
      )}
    </div>
  );
}
