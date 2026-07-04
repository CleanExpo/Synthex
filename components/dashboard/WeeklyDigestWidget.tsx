'use client';

/**
 * WeeklyDigestWidget — SYN-495
 *
 * Surfaces the client's latest AI Weekly Performance Digest on the dashboard —
 * the same digest that is delivered by email each Monday (app/api/cron/weekly-digest).
 * Reads the newest `ai_weekly_digests` row via the existing, plan-gated route
 * GET /api/ai/pm/digest (user-scoped; AIWeeklyDigest is keyed by user, not org).
 *
 * States:
 *   1. Loading   — skeleton
 *   2. Empty     — no digest generated yet (first arrives Monday)
 *   3. Populated — summary + performance highlights + top action item
 *
 * The presentational component (WeeklyDigestCard) is pure so it can be unit
 * tested without SWR; the exported WeeklyDigestWidget wires the data fetch.
 */

import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Calendar,
  Mail,
  TrendingUp,
  TrendingDown,
  Minus,
  Lightbulb,
  ListTodo,
} from '@/components/icons';
import { cn } from '@/lib/utils';

// ── Types (mirror the /api/ai/pm/digest select) ───────────────────────────────

export interface DigestHighlight {
  metric: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'flat' | string;
}

export interface DigestActionItem {
  title: string;
  description: string;
  priority: string;
  actionUrl?: string;
}

export interface DigestOpportunity {
  title: string;
  description: string;
  potentialImpact: string;
}

export interface WeeklyDigest {
  id: string;
  weekStart: string;
  weekEnd: string;
  summary: string;
  highlights: DigestHighlight[];
  actionItems: DigestActionItem[];
  opportunities: DigestOpportunity[];
  createdAt: string;
}

interface DigestResponse {
  success: boolean;
  digest: WeeklyDigest | null;
}

// ── Fetcher ────────────────────────────────────────────────────────────────────

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => r.json());

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatWeekRange(startISO: string, endISO: string): string {
  const start = new Date(startISO);
  const end = new Date(endISO);
  // en-AU short form: 30 Jun – 6 Jul
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${start.toLocaleDateString('en-AU', opts)} – ${end.toLocaleDateString('en-AU', opts)}`;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up')
    return <TrendingUp className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />;
  if (trend === 'down')
    return <TrendingDown className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />;
  return <Minus className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />;
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function WeeklyDigestSkeleton() {
  return (
    <Card variant="glass">
      <CardContent className="p-5 space-y-4 animate-pulse">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm bg-white/[0.04]" />
          <div className="h-3.5 w-40 bg-white/[0.04] rounded-sm" />
        </div>
        <div className="h-3 w-full bg-white/[0.03] rounded-sm" />
        <div className="h-3 w-4/5 bg-white/[0.03] rounded-sm" />
        <div className="space-y-2 pt-1">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-6 bg-white/[0.03] rounded-sm" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────────────

function NoDigestState() {
  return (
    <Card variant="glass">
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2 text-white/80 text-sm font-medium">
          <Calendar className="w-4 h-4 text-violet-400" />
          Weekly Performance Digest
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="w-9 h-9 rounded-sm bg-violet-500/[0.06] border border-violet-500/20 flex items-center justify-center">
            <Mail className="w-4 h-4 text-violet-400/60" />
          </div>
          <div>
            <p className="text-sm text-white/60 mb-1">No digest yet</p>
            <p className="text-xs text-white/35 leading-relaxed max-w-[240px]">
              Your first weekly performance digest will appear here — and land in
              your inbox — on Monday morning.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Presentational card (pure) ──────────────────────────────────────────────────

export function WeeklyDigestCard({ digest }: { digest: WeeklyDigest }) {
  const highlights = (digest.highlights ?? []).slice(0, 3);
  const topAction = (digest.actionItems ?? [])[0];
  const topOpportunity = (digest.opportunities ?? [])[0];

  return (
    <Card variant="glass">
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center justify-between text-white/80 text-sm font-medium">
          <span className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-violet-400" />
            Weekly Performance Digest
          </span>
          <span className="text-[11px] text-violet-300/70 font-normal">
            {formatWeekRange(digest.weekStart, digest.weekEnd)}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Executive summary */}
        <p className="text-xs text-white/60 leading-relaxed">{digest.summary}</p>

        {/* Performance highlights */}
        {highlights.length > 0 && (
          <div>
            <p className="text-[11px] text-white/40 uppercase tracking-widest mb-2">
              Performance highlights
            </p>
            <div>
              {highlights.map((h, i) => (
                <div
                  key={`${h.metric}-${i}`}
                  className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0"
                >
                  <span className="text-xs text-white/70">{h.metric}</span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-white/90">
                      {h.value}
                    </span>
                    <TrendIcon trend={h.trend} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top action item */}
        {topAction && (
          <div className="flex items-start gap-2.5 p-3 bg-violet-500/[0.05] border border-violet-500/20 rounded-sm">
            <ListTodo className="w-3.5 h-3.5 text-violet-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-white/80">{topAction.title}</p>
              <p className="text-xs text-white/50 leading-relaxed mt-0.5">
                {topAction.description}
              </p>
            </div>
          </div>
        )}

        {/* Top opportunity */}
        {topOpportunity && (
          <div className="flex items-start gap-2.5 p-3 bg-emerald-500/[0.05] border border-emerald-500/20 rounded-sm">
            <Lightbulb className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-white/80">
                {topOpportunity.title}
              </p>
              <p className="text-xs text-white/50 leading-relaxed mt-0.5">
                {topOpportunity.description}
              </p>
            </div>
          </div>
        )}

        {/* Footer — ties the widget to the emailed digest */}
        <div
          className={cn(
            'flex items-center gap-1.5 pt-0.5 border-t border-white/[0.04]'
          )}
        >
          <Mail className="w-3 h-3 text-white/25" />
          <span className="text-[11px] text-white/25">
            Delivered to your inbox every Monday
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Container (data fetch) ──────────────────────────────────────────────────────

export function WeeklyDigestWidget() {
  const { data, isLoading } = useSWR<DigestResponse>(
    '/api/ai/pm/digest',
    fetchJson,
    { refreshInterval: 300_000, dedupingInterval: 120_000 }
  );

  if (isLoading) return <WeeklyDigestSkeleton />;

  // No data, plan-gated, or error → graceful empty state
  if (!data?.success || !data.digest) return <NoDigestState />;

  return <WeeklyDigestCard digest={data.digest} />;
}
