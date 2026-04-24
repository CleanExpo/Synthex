'use client';

/**
 * AICalendarSection — components/calendar/AICalendarSection.tsx
 *
 * Renders the full AI-generated weekly content calendar for an org.
 * Features:
 *   - Shadow/Live mode toggle (stored per-org, persisted via /api/calendar/mode)
 *   - Week grid: 7 AI-generated slots, one per day
 *   - Per-slot: platform, time, caption A/B/C selector, approve/reject
 *   - Cold-start state when fewer than 3 digests exist
 *   - Loading + error states
 *
 * Data is fetched from GET /api/calendar/current-week.
 * Mutations go to PATCH /api/calendar/slots/[slotId] and PUT /api/calendar/mode.
 *
 * @task SYN-522
 */

import useSWR from 'swr';
import { toast } from 'sonner';
import { ShadowLiveToggle } from './ShadowLiveToggle';
import { AICalendarSlotCard, SlotWithMeta } from './AICalendarSlotCard';
import { MarketOpportunitySlotCard } from './MarketOpportunitySlotCard';
import { Loader2, CalendarDays, Info } from '@/components/icons';
import type { ContentCalendarData } from '@/lib/calendar/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CurrentWeekResponse {
  calendar: {
    id: string;
    weekStart: string;
    weekEnd: string;
    slots: ContentCalendarData;
    status: string;
    signalsVersion: string;
  } | null;
  calendarMode: 'shadow' | 'live';
}

// ── SWR fetcher — SYN-732: guard res.ok so a 500 response doesn't render as data
const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    throw new Error(`Calendar fetch failed (${res.status})`);
  }
  return res.json();
};

// ── Component ─────────────────────────────────────────────────────────────────

export function AICalendarSection() {
  const { data, error, isLoading, mutate } = useSWR<CurrentWeekResponse>(
    '/api/calendar/current-week',
    fetcher,
    {
      refreshInterval: 60_000,
      dedupingInterval: 30_000,
    }
  );

  // ── Mode toggle ──────────────────────────────────────────────────────────────

  // SYN-732: previously fired-and-forgot with no res.ok check, no loading state,
  // no error toast. A 500 on the mode flip would silently leave the UI in the
  // wrong state without telling the user.
  async function handleModeChange(mode: 'shadow' | 'live') {
    try {
      const res = await fetch('/api/calendar/mode', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) {
        throw new Error(`Failed to change calendar mode (${res.status})`);
      }
      toast.success(`Calendar switched to ${mode} mode`);
      mutate();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Could not change calendar mode. Please try again.'
      );
    }
  }

  // ── Slot mutations ───────────────────────────────────────────────────────────

  // SYN-732: content approval / rejection is the highest-trust surface in the
  // product. A silent failure here meant the user saw their approval
  // "succeed" in the UI (via optimistic mutate) even when the server rejected
  // it. Now every failure is surfaced and the cache is not invalidated.
  async function patchSlot(
    slotId: string,
    patch: { status?: 'approved' | 'rejected'; selectedCaption?: number }
  ) {
    if (!data?.calendar) return;
    try {
      const res = await fetch(`/api/calendar/slots/${slotId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarId: data.calendar.id, ...patch }),
      });
      if (!res.ok) {
        throw new Error(`Slot update failed (${res.status})`);
      }
      mutate();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Could not update post. Please try again.'
      );
    }
  }

  async function handleApprove(slotId: string, selectedCaption: number) {
    await patchSlot(slotId, { status: 'approved', selectedCaption });
  }

  async function handleReject(slotId: string) {
    await patchSlot(slotId, { status: 'rejected' });
  }

  async function handleCaptionSelect(slotId: string, captionIndex: number) {
    await patchSlot(slotId, { selectedCaption: captionIndex });
  }

  // SYN-732: seasonal-signal dismiss — still fire-and-forget for UX
  // (MarketOpportunitySlotCard hides itself optimistically) but now surfaces
  // server errors instead of swallowing them.
  async function handleDismissSignal(signalId: string) {
    try {
      const res = await fetch('/api/calendar/seasonal-dismiss', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signalId }),
      });
      if (!res.ok) {
        throw new Error(`Dismiss failed (${res.status})`);
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Could not dismiss signal. It may reappear.'
      );
    }
  }

  // ── Render states ────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-[#0d0d14] border border-white/5 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-4 w-48 bg-gray-800 rounded animate-pulse" />
          <div className="ml-auto h-8 w-40 bg-gray-800 rounded-full animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="h-48 rounded-xl bg-gray-800/40 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-[#0d0d14] border border-white/5 p-6">
        <p className="text-sm text-red-400">
          Failed to load your AI calendar. Please refresh the page.
        </p>
      </div>
    );
  }

  const calendarMode = data?.calendarMode ?? 'shadow';
  const calendar = data?.calendar ?? null;
  const slots =
    (calendar?.slots as unknown as ContentCalendarData)?.slots ?? [];

  // Cold-start: no calendar generated yet
  if (!calendar || slots.length === 0) {
    return (
      <div className="rounded-2xl bg-[#0d0d14] border border-white/5 p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-cyan-400" />
              AI Weekly Calendar
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Auto-generated each Sunday evening
            </p>
          </div>
          <ShadowLiveToggle
            mode={calendarMode}
            onModeChange={handleModeChange}
          />
        </div>

        <div className="flex items-start gap-3 rounded-xl bg-white/3 border border-white/6 p-4">
          <Info className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-gray-400 font-medium mb-1">
              Calendar not yet generated
            </p>
            <p className="text-xs text-gray-600 leading-relaxed">
              Your AI calendar is generated each Sunday evening using insights
              from your weekly performance digests. You need at least 3
              completed digests to unlock this feature.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Format week range label
  const weekStartLabel = new Date(calendar.weekStart).toLocaleDateString(
    'en-AU',
    { day: 'numeric', month: 'short', timeZone: 'UTC' }
  );
  const weekEndLabel = new Date(calendar.weekEnd).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const approvedCount = slots.filter(
    (s: SlotWithMeta) => s.status === 'approved'
  ).length;
  const rejectedCount = slots.filter(
    (s: SlotWithMeta) => s.status === 'rejected'
  ).length;

  return (
    <div className="rounded-2xl bg-[#0d0d14] border border-white/5 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-cyan-400" />
            AI Weekly Calendar
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {weekStartLabel} – {weekEndLabel}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Progress pill */}
          {calendarMode === 'shadow' && (
            <span className="text-xs text-gray-500">
              {approvedCount}/{slots.length} approved
              {rejectedCount > 0 && ` · ${rejectedCount} rejected`}
            </span>
          )}
          <ShadowLiveToggle
            mode={calendarMode}
            onModeChange={handleModeChange}
          />
        </div>
      </div>

      {/* Slot grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {slots.map((slot: SlotWithMeta) =>
          slot.slotType === 'market_opportunity' ? (
            <MarketOpportunitySlotCard
              key={slot.id}
              slot={slot}
              calendarId={calendar.id}
              shadowMode={calendarMode === 'shadow'}
              onApprove={handleApprove}
              onReject={handleReject}
              onCaptionSelect={handleCaptionSelect}
              onDismiss={handleDismissSignal}
            />
          ) : (
            <AICalendarSlotCard
              key={slot.id}
              slot={slot}
              calendarId={calendar.id}
              shadowMode={calendarMode === 'shadow'}
              onApprove={handleApprove}
              onReject={handleReject}
              onCaptionSelect={handleCaptionSelect}
            />
          )
        )}
      </div>

      {/* Footer note */}
      <p className="text-xs text-gray-700 mt-4">
        Powered by Synthex AI · Signals from{' '}
        {(calendar.slots as unknown as ContentCalendarData).digestCount ?? 0}{' '}
        digest
        {(calendar.slots as unknown as ContentCalendarData).digestCount !== 1
          ? 's'
          : ''}
      </p>
    </div>
  );
}
