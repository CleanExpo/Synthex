'use client';

/**
 * ShadowLiveToggle — components/calendar/ShadowLiveToggle.tsx
 *
 * Prominent toggle for switching between:
 *   - Shadow mode: AI generates posts, human reviews each one before publish
 *   - Live mode:   AI posts publish automatically at scheduled times
 *
 * Switching TO live shows a confirmation modal (safety gate).
 * Switching back to shadow is instant (always safe).
 *
 * @task SYN-522
 */

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Eye, Zap, Loader2 } from '@/components/icons';

export interface ShadowLiveToggleProps {
  mode: 'shadow' | 'live';
  onModeChange: (mode: 'shadow' | 'live') => Promise<void>;
  disabled?: boolean;
}

export function ShadowLiveToggle({
  mode,
  onModeChange,
  disabled = false,
}: ShadowLiveToggleProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const isLive = mode === 'live';

  async function handleToggle() {
    if (!isLive) {
      // Switching to Live — show confirmation modal first
      setConfirmOpen(true);
    } else {
      // Switching to Shadow — instant, no confirmation needed
      setSaving(true);
      try {
        await onModeChange('shadow');
      } finally {
        setSaving(false);
      }
    }
  }

  async function handleConfirmLive() {
    setConfirmOpen(false);
    setSaving(true);
    try {
      await onModeChange('live');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Toggle pill */}
      <button
        onClick={handleToggle}
        disabled={disabled || saving}
        aria-label={`Switch to ${isLive ? 'shadow' : 'live'} mode`}
        className={`
          relative flex items-center gap-3 rounded-full px-4 py-2
          border text-sm font-medium transition-all duration-200
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed
          ${
            isLive
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20 focus-visible:ring-emerald-500'
              : 'bg-gray-800/60 border-white/10 text-gray-400 hover:bg-gray-700/60 hover:text-gray-300 focus-visible:ring-gray-400'
          }
        `}
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isLive ? (
          <Zap className="h-4 w-4 fill-emerald-400/20" />
        ) : (
          <Eye className="h-4 w-4" />
        )}

        <span>
          {saving
            ? 'Saving…'
            : isLive
              ? 'Live — Auto-publish'
              : 'Shadow — Review first'}
        </span>

        {/* Mode indicator dot */}
        <span
          className={`h-2 w-2 rounded-full ${
            isLive ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'
          }`}
        />
      </button>

      {/* Confirmation modal — only shown when switching TO Live */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-[#0d0d14] border border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <Zap className="h-5 w-5 text-emerald-400" />
              Enable Auto-publish?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400 text-sm leading-relaxed">
              Posts will publish automatically at their scheduled times.
              <br />
              <br />
              You won&apos;t need to approve each post — the AI will handle it.
              <br />
              You can switch back to Shadow mode at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/10 text-gray-400 hover:bg-white/5">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmLive}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              Enable Live mode
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
