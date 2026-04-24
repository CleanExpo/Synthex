'use client';

/**
 * /dashboard/advisor — AI Marketing Advisor Brief
 *
 * Displays the latest delivered advisor brief with:
 *   1. Results This Month — dollar attribution (hero metric, largest type)
 *   2. Your 3 Actions This Week — with Mark Done buttons
 *   3. Competitor Pulse — if data available
 *   4. AI Search Visibility — GEO teaser if data available
 *
 * @task SYN-595
 */

import useSWR from 'swr';
import { useState, useEffect, useRef } from 'react';
import { ADVISOR_ENABLED } from '@/lib/constants/onboarding';
import { fireAdvisorEvent } from '@/lib/analytics/advisor-events';
import { GeoScoreMiniWidget } from '@/components/geo/GeoScoreMiniWidget';
import { AskSynthexPanel } from '@/components/ask-synthex/AskSynthexPanel';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdvisorAction {
  rank: number;
  title: string;
  rationale: string;
  effort: 'low' | 'medium' | 'high';
  expectedImpact: string;
  actionUrl?: string;
  completed_at?: string;
}

interface AdvisorBrief {
  id: string;
  weekStart: string;
  dollarAttribution: string;
  actions: AdvisorAction[];
  competitorMicroInsight: string | null;
  geoTeaserText: string | null;
  status: string;
}

// ── SWR fetcher ───────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

// ── Sub-components ────────────────────────────────────────────────────────────

const EFFORT_STYLES = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800',
};
const EFFORT_LABELS = {
  low: 'Quick win',
  medium: 'Medium effort',
  high: 'High impact',
};

function ActionCard({
  action,
  index,
  onMarkDone,
  isMarkingDone,
}: {
  action: AdvisorAction;
  index: number;
  onMarkDone: (index: number) => void;
  isMarkingDone: boolean;
}) {
  const isDone = Boolean(action.completed_at);

  return (
    <div
      className={`flex gap-3 p-4 rounded-lg border transition-colors ${
        isDone
          ? 'bg-gray-50 border-gray-200 opacity-60'
          : 'bg-white border-gray-200'
      }`}
    >
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center">
        <span className="text-xs font-bold text-white">{action.rank}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`font-semibold text-sm ${isDone ? 'line-through text-gray-400' : 'text-gray-900'}`}
        >
          {action.title}
        </p>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
          {action.rationale}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded uppercase tracking-wide ${
              EFFORT_STYLES[action.effort] ?? EFFORT_STYLES.medium
            }`}
          >
            {EFFORT_LABELS[action.effort] ?? action.effort}
          </span>
          <span className="text-xs text-sky-600 font-medium">
            {action.expectedImpact}
          </span>
        </div>
      </div>
      {!isDone && (
        <button
          onClick={() => onMarkDone(index)}
          disabled={isMarkingDone}
          className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-md bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50 transition-colors self-start mt-0.5"
        >
          Done
        </button>
      )}
      {isDone && (
        <span className="flex-shrink-0 text-xs text-green-600 font-semibold self-start mt-1">
          ✓
        </span>
      )}
    </div>
  );
}

function ColdStartCard() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mb-4">
        <span className="text-2xl">📊</span>
      </div>
      <h3 className="font-semibold text-gray-900 mb-2">
        Your first brief is being prepared
      </h3>
      <p className="text-sm text-gray-500 max-w-xs">
        Synthex will deliver your personalised weekly advisor brief every Monday
        morning once your account has activity data.
      </p>
    </div>
  );
}

// ── Feedback prompt ───────────────────────────────────────────────────────────

type FeedbackResponse = 'useful' | 'not_useful' | 'skipped';

function FeedbackPrompt({
  weekStart,
  onSubmit,
}: {
  weekStart: string;
  onSubmit: (response: FeedbackResponse) => void;
}) {
  const [submitted, setSubmitted] = useState<FeedbackResponse | null>(null);

  async function handle(response: FeedbackResponse) {
    // SYN-732: previously a `.catch(() => {})` swallowed feedback-save
    // failures — the user saw "Thanks" whether or not the POST succeeded.
    // Now the submitted state flips only after a confirmed 2xx response,
    // and failures log to the console for ops visibility. The telemetry
    // event still fires regardless so we can correlate submissions with
    // persistence failures.
    try {
      const res = await fetch('/api/advisor/feedback', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart, response }),
      });
      if (!res.ok) {
        throw new Error(`Feedback save failed (${res.status})`);
      }
      setSubmitted(response);
      onSubmit(response);
    } catch (err) {
      console.error('[advisor/feedback] save failed', err);
    }
    fireAdvisorEvent('advisor_feedback_submitted', {
      week_start: weekStart,
      response,
    });
  }

  if (submitted) {
    return (
      <p className="text-sm text-center text-gray-500 py-2">
        {submitted === 'useful'
          ? 'Glad it helped! 👍'
          : 'Thanks for the feedback.'}
      </p>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 pt-4 border-t border-gray-100">
      <p className="text-sm text-gray-500">Was this week's brief useful?</p>
      <div className="flex gap-2">
        {(['useful', 'not_useful', 'skipped'] as FeedbackResponse[]).map(r => (
          <button
            key={r}
            onClick={() => handle(r)}
            className="text-xs px-3 py-1.5 rounded-md border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-colors font-medium text-gray-600"
          >
            {r === 'useful' ? 'Yes' : r === 'not_useful' ? 'No' : 'Skip'}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdvisorPage() {
  const [isMarkingDone, setIsMarkingDone] = useState(false);
  const [feedbackDismissed, setFeedbackDismissed] = useState(false);
  const openTracked = useRef(false);

  const { isOwner, activeOrganizationId } = useActiveBusiness();

  const { data, error, isLoading, mutate } = useSWR<{
    brief: AdvisorBrief | null;
  }>(ADVISOR_ENABLED ? '/api/advisor/brief' : null, fetchJson);

  const { data: geoData } = useSWR<{ score: number | null }>(
    ADVISOR_ENABLED ? '/api/dashboard/geo-score' : null,
    fetchJson,
    { revalidateOnFocus: false, refreshInterval: 86_400_000 }
  );
  const geoScore = geoData?.score ?? null;

  // Fire advisor_opened_dashboard once when brief loads
  const brief = data?.brief ?? null;
  useEffect(() => {
    if (brief && !openTracked.current) {
      openTracked.current = true;
      fireAdvisorEvent('advisor_opened_dashboard', {
        week_start: brief.weekStart.split('T')[0],
      });
    }
  }, [brief]);

  if (!ADVISOR_ENABLED) return null;

  const weekLabel = brief
    ? new Date(brief.weekStart).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  async function handleMarkDone(actionIndex: number) {
    if (!brief) return;
    setIsMarkingDone(true);
    try {
      const res = await fetch('/api/advisor/brief', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionIndex }),
      });
      if (res.ok) {
        const action = brief.actions[actionIndex];
        if (action) {
          fireAdvisorEvent('advisor_action_completed', {
            week_start: brief.weekStart.split('T')[0],
            action_rank: action.rank,
            action_title: action.title,
          });
        }
        await mutate();
      }
    } finally {
      setIsMarkingDone(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Advisor</h1>
        {weekLabel && (
          <p className="text-sm text-gray-500 mt-1">Week of {weekLabel}</p>
        )}
      </div>

      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="h-24 rounded-lg bg-gray-100 animate-pulse"
            />
          ))}
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">
            Unable to load your advisor brief. Please refresh.
          </p>
        </div>
      )}

      {!isLoading && !error && !brief && <ColdStartCard />}

      {!isLoading && !error && brief && (
        <>
          {/* Section 1: Results This Month — HERO METRIC */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
              Results This Month
            </p>
            <p className="text-5xl font-extrabold text-gray-900 leading-none tracking-tight">
              {brief.dollarAttribution}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              estimated from your Synthex activity this week
            </p>
          </div>

          {/* Section 2: Your 3 Actions This Week */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Your 3 Actions This Week
            </p>
            <div className="space-y-3">
              {(brief.actions ?? [])
                .sort((a, b) => a.rank - b.rank)
                .map((action, i) => (
                  <ActionCard
                    key={action.rank}
                    action={action}
                    index={i}
                    onMarkDone={handleMarkDone}
                    isMarkingDone={isMarkingDone}
                  />
                ))}
            </div>
            {!feedbackDismissed && (
              <FeedbackPrompt
                weekStart={brief.weekStart.split('T')[0]}
                onSubmit={() =>
                  setTimeout(() => setFeedbackDismissed(true), 2000)
                }
              />
            )}
          </div>

          {/* Section 3: Competitor Pulse (conditional) */}
          {brief.competitorMicroInsight && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                Competitor Pulse
              </p>
              <p className="text-sm text-gray-700 leading-relaxed">
                {brief.competitorMicroInsight}
              </p>
            </div>
          )}

          {/* Section 4: AI Search Visibility / GEO teaser (conditional) — SYN-657 */}
          {brief.geoTeaserText && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">
                Your AI Search Visibility
              </p>
              <p className="text-sm text-white/70 leading-relaxed mb-3">
                {brief.geoTeaserText}
              </p>
              <GeoScoreMiniWidget score={geoScore} />
            </div>
          )}
        </>
      )}

      {/* Section 5: Ask Synthex — SYN-682 */}
      <AskSynthexPanel isOwner={isOwner} clientId={activeOrganizationId} />
    </div>
  );
}
