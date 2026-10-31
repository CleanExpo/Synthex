'use client';

/**
 * Portfolio calendar: every Unite Group brand's draft marketing slots for the
 * next 4 weeks on one page (10 short-form videos a week, Margot presenting).
 * Owner-only; data from /api/admin/portfolio-calendar.
 *
 * Read-and-set-up only. Approving, publishing and live mode stay where they
 * already live (approvals, calendar live-mode activation).
 */

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface PortfolioBrand {
  orgSlug: string;
  label: string;
  colour: string;
  videosPerWeek: number;
  heldReason: string | null;
  live: boolean;
}

interface PortfolioSlot {
  id: string;
  orgSlug: string | null;
  title: string;
  status: string;
  platforms: string[];
  scheduledFor: string;
  scheduledLocal: string | null;
  weekStart: string | null;
  slotKind: 'shortform_video' | 'channel_post' | null;
  approvalState: string | null;
  videoStatus: string | null;
  mediaUrl: string | null;
}

interface PortfolioResponse {
  weeks: string[];
  brands: PortfolioBrand[];
  slots: PortfolioSlot[];
  verify: { ok: boolean; checks: Array<{ label: string; pass: boolean }> };
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as PortfolioResponse;
};

const dayFormat = new Intl.DateTimeFormat('en-AU', {
  timeZone: 'Australia/Sydney',
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
});
const timeFormat = new Intl.DateTimeFormat('en-AU', {
  timeZone: 'Australia/Sydney',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function weekLabel(weekStart: string) {
  const [y, m, d] = weekStart.split('-');
  return `Week of ${d}/${m}/${y}`;
}

export default function PortfolioCalendarPage() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/admin/portfolio-calendar',
    fetcher
  );
  const [week, setWeek] = useState<string | null>(null);
  const [busy, setBusy] = useState<'preview' | 'apply' | null>(null);
  const [runLog, setRunLog] = useState<string[] | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const activeWeek = week ?? data?.weeks[0] ?? null;
  const brandBySlug = useMemo(
    () => new Map((data?.brands ?? []).map(b => [b.orgSlug, b])),
    [data?.brands]
  );
  const weekSlots = useMemo(
    () => (data?.slots ?? []).filter(s => s.weekStart === activeWeek),
    [data?.slots, activeWeek]
  );
  const byDay = useMemo(() => {
    const groups = new Map<string, PortfolioSlot[]>();
    for (const slot of weekSlots) {
      const key = dayFormat.format(new Date(slot.scheduledFor));
      groups.set(key, [...(groups.get(key) ?? []), slot]);
    }
    return [...groups.entries()];
  }, [weekSlots]);

  async function run(action: 'preview' | 'apply') {
    if (
      action === 'apply' &&
      !window.confirm(
        'Create the brand setup and draft calendar? Every slot is a draft. Nothing is posted and live mode stays off.'
      )
    ) {
      return;
    }
    setBusy(action);
    setRunError(null);
    try {
      const res = await fetch('/api/admin/portfolio-calendar', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const body = await res.json();
      if (!res.ok)
        throw new Error(
          body.message ?? body.error ?? `Request failed (${res.status})`
        );
      setRunLog(body.manifest?.log ?? []);
      await mutate();
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-8 w-56 bg-orange-500/10 rounded animate-pulse" />
        <div className="h-24 border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm animate-pulse" />
        <div className="h-96 border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md bg-surface-base/80 border border-orange-500/10">
          <CardContent className="p-8 text-center space-y-2">
            <h1 className="text-lg font-semibold text-white">
              Portfolio calendar unavailable
            </h1>
            <p className="text-sm text-slate-400">
              {error?.message ?? 'No data returned.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const videoCount = weekSlots.filter(
    s => s.slotKind === 'shortform_video'
  ).length;
  const failing = data.verify.checks.filter(c => !c.pass);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            Portfolio calendar
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Draft marketing slots for every Unite Group brand over the next four
            weeks. Nothing posts until you approve it and turn publishing on.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={busy !== null}
            onClick={() => run('preview')}
          >
            {busy === 'preview' ? 'Checking...' : 'Preview changes'}
          </Button>
          <Button disabled={busy !== null} onClick={() => run('apply')}>
            {busy === 'apply'
              ? 'Setting up...'
              : data.slots.length
                ? 'Add missing drafts'
                : 'Set up calendar'}
          </Button>
        </div>
      </header>

      <section
        aria-label="Setup checks"
        className={`rounded-sm border-[0.5px] p-4 text-sm ${
          data.verify.ok
            ? 'border-emerald-500/30 bg-emerald-500/[0.04] text-emerald-300'
            : 'border-amber-500/30 bg-amber-500/[0.04] text-amber-200'
        }`}
      >
        {data.verify.ok ? (
          <p>
            All {data.verify.checks.length} setup checks pass. Every brand is in
            shadow mode.
          </p>
        ) : (
          <>
            <p className="font-medium">
              {failing.length} of {data.verify.checks.length} setup checks not
              met yet
            </p>
            <ul className="mt-2 space-y-1 text-amber-100/80">
              {failing.slice(0, 8).map(c => (
                <li key={c.label}>{c.label}</li>
              ))}
              {failing.length > 8 && <li>and {failing.length - 8} more</li>}
            </ul>
          </>
        )}
      </section>

      {(runLog || runError) && (
        <section
          aria-label="Last run"
          className="rounded-sm border-[0.5px] border-white/[0.06] p-4"
        >
          {runError ? (
            <p className="text-sm text-red-300">{runError}</p>
          ) : (
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs text-slate-400">
              {runLog?.length ? runLog.join('\n') : 'No changes.'}
            </pre>
          )}
        </section>
      )}

      <section
        aria-label="Brands"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7"
      >
        {data.brands.map(b => (
          <div
            key={b.orgSlug}
            className="rounded-sm border-[0.5px] border-white/[0.06] bg-white/[0.01] p-3"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: b.colour }}
              />
              <span className="truncate text-sm font-medium text-white">
                {b.label}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {b.heldReason
                ? `Held: ${b.heldReason}`
                : `${b.videosPerWeek} video${b.videosPerWeek === 1 ? '' : 's'} a week`}
            </p>
          </div>
        ))}
      </section>

      <nav aria-label="Weeks" className="flex gap-2 overflow-x-auto pb-1">
        {data.weeks.map(w => (
          <button
            key={w}
            type="button"
            onClick={() => setWeek(w)}
            aria-pressed={w === activeWeek}
            className={`shrink-0 rounded-sm border-[0.5px] px-3 py-1.5 text-sm transition-colors ${
              w === activeWeek
                ? 'border-orange-500/60 bg-orange-500/10 text-orange-200'
                : 'border-white/[0.08] text-slate-400 hover:text-white'
            }`}
          >
            {weekLabel(w)}
          </button>
        ))}
      </nav>

      {activeWeek && (
        <p className="text-sm text-slate-400">
          {videoCount} short-form video slot{videoCount === 1 ? '' : 's'} and{' '}
          {weekSlots.length - videoCount} channel post
          {weekSlots.length - videoCount === 1 ? '' : 's'} this week.
        </p>
      )}

      {weekSlots.length === 0 ? (
        <Card className="bg-surface-base/80 border border-white/[0.06]">
          <CardContent className="p-8 text-center text-sm text-slate-400">
            No drafts yet for this week. Use Set up calendar to create them.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {byDay.map(([day, slots]) => (
            <section key={day} aria-label={day}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {day}
              </h2>
              <ul className="divide-y divide-white/[0.05] rounded-sm border-[0.5px] border-white/[0.06]">
                {slots.map(slot => {
                  const brand = slot.orgSlug
                    ? brandBySlug.get(slot.orgSlug)
                    : undefined;
                  return (
                    <li
                      key={slot.id}
                      className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4"
                    >
                      <div className="flex items-center gap-3 sm:w-48 sm:shrink-0">
                        <span className="w-12 text-sm tabular-nums text-slate-300">
                          {timeFormat.format(new Date(slot.scheduledFor))}
                        </span>
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full bg-slate-500"
                          style={
                            brand
                              ? { backgroundColor: brand.colour }
                              : undefined
                          }
                        />
                        <span className="truncate text-sm font-medium text-white">
                          {brand?.label ?? slot.orgSlug}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-200">
                          {slot.title.replace(
                            /^(Short-form video|Post): [^,]+, /,
                            ''
                          )}
                        </p>
                        <p className="text-xs text-slate-500">
                          {slot.slotKind === 'shortform_video'
                            ? 'Short-form video'
                            : 'Post'}{' '}
                          on {slot.platforms.join(', ')}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5 sm:justify-end">
                        <span className="rounded-sm border-[0.5px] border-white/[0.1] px-2 py-0.5 text-xs text-slate-300">
                          {slot.status === 'draft'
                            ? 'Draft, pending approval'
                            : slot.status}
                        </span>
                        {slot.slotKind === 'shortform_video' &&
                          (slot.mediaUrl ? (
                            <a
                              href={slot.mediaUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-sm border-[0.5px] border-emerald-500/40 px-2 py-0.5 text-xs text-emerald-300 hover:bg-emerald-500/10"
                            >
                              Watch video
                            </a>
                          ) : (
                            <span className="rounded-sm border-[0.5px] border-amber-500/30 px-2 py-0.5 text-xs text-amber-200/80">
                              Awaiting video
                            </span>
                          ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
