'use client';

import { useMode } from '@/components/providers/mode-provider';

/**
 * Persistent mode indicator pill — top-right of dashboard header.
 * Shows "PRO MODE" in amber for Pro/Agency plan users.
 * Renders null in Simple Mode or while loading.
 * Non-interactive — informational only.
 */
export function ProModePill() {
  const { mode, isLoading } = useMode();

  if (isLoading || mode !== 'pro') return null;

  return (
    <span
      aria-label="Pro Mode active"
      className="inline-flex items-center rounded-full border border-[rgba(245,158,11,0.4)] bg-[rgba(245,158,11,0.1)] px-2.5 py-0.5 text-[10px] font-semibold tracking-widest text-[#f59e0b] select-none"
    >
      PRO MODE
    </span>
  );
}
