'use client';

/**
 * Generative Video Panel
 *
 * Staff screen for the fal generative video engine. Submits to the existing
 * POST /api/video/generate (mode:'generative'), reads the form options and
 * quota from GET /api/video/cards, and polls GET /api/video/[id] for each job
 * until it renders or fails. Every refusal the route can return is shown as
 * that refusal; nothing here reports success the server did not report.
 */

import React, { useEffect, useId, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Clock,
  Loader2,
  Sparkles,
} from '@/components/icons';

/** Poll every 5s, at most 60 times (5 minutes, the route's own fal poll-through window). */
export const POLL_INTERVAL_MS = 5000;
export const MAX_POLLS = 60;

const MODEL_TIERS = ['draft', 'standard', 'premium'] as const;
const ASPECT_RATIOS = ['9:16', '1:1', '16:9'] as const;
// Limits mirror GenerativeVideoSchema in app/api/video/generate/route.ts.
const DURATION_MIN = 4;
const DURATION_MAX = 10;
const VARIANTS_MAX = 8;
const PROMPT_MIN = 3;
const PROMPT_MAX = 1000;

interface MethodCardOption {
  id: string;
  name: string;
  description: string;
  requiresImage: boolean;
}

interface QuotaSnapshot {
  spentUsd: number;
  monthlyBudgetUsd: number;
  spentTodayUsd: number;
  dailyBudgetUsd: number;
  warning: boolean;
}

interface CardsResponse {
  methodCards?: MethodCardOption[];
  quota?: QuotaSnapshot | null;
}

interface SubmittedJob {
  id: string;
  model: string;
  estimatedCostUsd: number;
}

type CardsState =
  | { kind: 'loading' }
  | { kind: 'failed'; message: string }
  | { kind: 'ready'; cards: MethodCardOption[]; quota: QuotaSnapshot | null };

const usd = (n: number) => `US$${n.toFixed(2)}`;

const inputClass =
  'w-full rounded-sm border-[0.5px] border-white/[0.1] bg-white/[0.02] px-3 py-2 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60';
const labelClass =
  'block text-xs uppercase tracking-[0.15em] text-white/50 mb-1.5';

/** Map a non-OK generate response to the message staff should see. */
export function describeSubmitFailure(status: number, body: unknown): string {
  const b = (body ?? {}) as {
    error?: unknown;
    details?: Array<{ path?: unknown[]; message?: string }>;
    cap?: unknown;
    upgradeRequired?: unknown;
    blocked?: unknown;
  };
  const serverError = typeof b.error === 'string' ? b.error : '';

  if (status === 403) {
    if (/VIDEO_STUDIO_ENABLED/.test(serverError)) {
      return 'Video studio is not switched on for this environment. Nothing was queued.';
    }
    return `Not allowed: ${serverError || 'request refused (HTTP 403)'}`;
  }
  if (status === 402) {
    if (b.upgradeRequired) {
      return `This account's plan does not include video generation. ${serverError}`.trim();
    }
    return `Video budget reached — nothing was queued. ${serverError}`.trim();
  }
  if (status === 422 && b.blocked) {
    return `Blocked: ${serverError || 'no owned reference images for this subject'}. Add owned reference photos for this subject, then try again.`;
  }
  if (status === 400) {
    if (Array.isArray(b.details) && b.details.length > 0) {
      const lines = b.details.map(d =>
        [(d.path ?? []).join('.'), d.message].filter(Boolean).join(': ')
      );
      return `Check the form: ${lines.join('; ')}`;
    }
    return `Check the form: ${serverError || 'invalid request'}`;
  }
  if (status === 401) {
    return 'Your session has expired. Sign in again.';
  }
  if (status === 429) {
    return 'Too many requests. Wait a moment, then try again.';
  }
  return `Video submit failed (HTTP ${status}) — nothing was queued.${serverError ? ` ${serverError}` : ''}`;
}

export function GenerativeVideoPanel() {
  const ids = useId();
  const [cardsState, setCardsState] = useState<CardsState>({ kind: 'loading' });
  const [methodCardId, setMethodCardId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [modelTier, setModelTier] =
    useState<(typeof MODEL_TIERS)[number]>('draft');
  const [aspectRatio, setAspectRatio] =
    useState<(typeof ASPECT_RATIOS)[number]>('9:16');
  const [durationSeconds, setDurationSeconds] = useState(5);
  const [variants, setVariants] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<SubmittedJob[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/video/cards');
        if (!res.ok) {
          throw new Error(
            `Could not load the method cards (HTTP ${res.status})`
          );
        }
        const data = (await res.json()) as CardsResponse;
        const cards = Array.isArray(data.methodCards) ? data.methodCards : [];
        if (cards.length === 0) {
          throw new Error('Could not load the method cards (none returned)');
        }
        if (cancelled) return;
        setCardsState({ kind: 'ready', cards, quota: data.quota ?? null });
        setMethodCardId(cards[0].id);
      } catch (err) {
        if (cancelled) return;
        setCardsState({
          kind: 'failed',
          message:
            err instanceof Error
              ? err.message
              : 'Could not load the method cards',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedCard =
    cardsState.kind === 'ready'
      ? cardsState.cards.find(c => c.id === methodCardId)
      : undefined;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    const payload: Record<string, unknown> = {
      mode: 'generative',
      methodCardId,
      prompt: prompt.trim(),
      modelTier,
      aspectRatio,
      durationSeconds,
      variants,
    };
    if (selectedCard?.requiresImage && imageUrl.trim()) {
      payload.imageUrl = imageUrl.trim();
    }
    try {
      const res = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => null)) as {
        data?: { jobs?: SubmittedJob[] };
      } | null;
      if (!res.ok) {
        setSubmitError(describeSubmitFailure(res.status, body));
        return;
      }
      const newJobs = body?.data?.jobs;
      if (!Array.isArray(newJobs) || newJobs.length === 0) {
        setSubmitError(
          'The server accepted the request but no jobs were returned. Nothing is rendering.'
        );
        return;
      }
      setJobs(prev => [...newJobs, ...prev]);
    } catch {
      setSubmitError('Could not reach the server. Nothing was queued.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-labelledby={`${ids}-heading`}
      className="p-5 rounded-sm border-[0.5px] border-white/[0.06] bg-white/[0.02] space-y-5"
    >
      <div>
        <h2
          id={`${ids}-heading`}
          className="text-sm uppercase tracking-[0.2em] text-white/40 flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4 text-orange-400" />
          Generate video
        </h2>
        <p className="mt-1.5 text-sm text-white/40">
          Generative clips from a method card. Finished videos are stored in the
          generated-videos bucket.
        </p>
      </div>

      {cardsState.kind === 'loading' && (
        <p className="text-sm text-white/40 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading method cards…
        </p>
      )}

      {cardsState.kind === 'failed' && (
        <div
          role="alert"
          className="p-4 rounded-sm border-[0.5px] border-red-500/20 bg-red-500/[0.05] text-sm text-red-400"
        >
          {cardsState.message}. The generate form is unavailable until this
          loads.
        </div>
      )}

      {cardsState.kind === 'ready' && (
        <form onSubmit={onSubmit} className="space-y-4">
          {cardsState.quota && (
            <p
              className={`text-xs ${cardsState.quota.warning ? 'text-orange-400' : 'text-white/50'}`}
            >
              Video spend: {usd(cardsState.quota.spentUsd)} of{' '}
              {usd(cardsState.quota.monthlyBudgetUsd)} this month,{' '}
              {usd(cardsState.quota.spentTodayUsd)} of{' '}
              {usd(cardsState.quota.dailyBudgetUsd)} today.
              {cardsState.quota.warning && ' Over 80% of a budget.'} Each
              variant is a separate paid job; the estimate per job appears after
              submit.
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor={`${ids}-card`} className={labelClass}>
                Method card
              </label>
              <select
                id={`${ids}-card`}
                className={inputClass}
                value={methodCardId}
                onChange={e => setMethodCardId(e.target.value)}
              >
                {cardsState.cards.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {selectedCard && (
                <p className="mt-1 text-xs text-white/40">
                  {selectedCard.description}
                </p>
              )}
            </div>

            {selectedCard?.requiresImage && (
              <div>
                <label htmlFor={`${ids}-image`} className={labelClass}>
                  Image URL
                </label>
                <input
                  id={`${ids}-image`}
                  type="url"
                  required
                  className={inputClass}
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  aria-describedby={`${ids}-image-help`}
                />
                <p
                  id={`${ids}-image-help`}
                  className="mt-1 text-xs text-white/40"
                >
                  This card animates a supplied image.
                </p>
              </div>
            )}
          </div>

          <div>
            <label htmlFor={`${ids}-prompt`} className={labelClass}>
              Prompt (subject)
            </label>
            <textarea
              id={`${ids}-prompt`}
              required
              minLength={PROMPT_MIN}
              maxLength={PROMPT_MAX}
              rows={3}
              className={inputClass}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label htmlFor={`${ids}-tier`} className={labelClass}>
                Model tier
              </label>
              <select
                id={`${ids}-tier`}
                className={inputClass}
                value={modelTier}
                onChange={e =>
                  setModelTier(e.target.value as (typeof MODEL_TIERS)[number])
                }
              >
                {MODEL_TIERS.map(t => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${ids}-aspect`} className={labelClass}>
                Aspect ratio
              </label>
              <select
                id={`${ids}-aspect`}
                className={inputClass}
                value={aspectRatio}
                onChange={e =>
                  setAspectRatio(
                    e.target.value as (typeof ASPECT_RATIOS)[number]
                  )
                }
              >
                {ASPECT_RATIOS.map(a => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${ids}-duration`} className={labelClass}>
                Duration (seconds)
              </label>
              <input
                id={`${ids}-duration`}
                type="number"
                min={DURATION_MIN}
                max={DURATION_MAX}
                step={1}
                className={inputClass}
                value={durationSeconds}
                onChange={e =>
                  setDurationSeconds(Math.trunc(Number(e.target.value)))
                }
              />
            </div>
            <div>
              <label htmlFor={`${ids}-variants`} className={labelClass}>
                Variants
              </label>
              <input
                id={`${ids}-variants`}
                type="number"
                min={1}
                max={VARIANTS_MAX}
                step={1}
                className={inputClass}
                value={variants}
                onChange={e => setVariants(Math.trunc(Number(e.target.value)))}
              />
            </div>
          </div>

          {submitError && (
            <div
              role="alert"
              className="p-4 rounded-sm border-[0.5px] border-red-500/20 bg-red-500/[0.05] flex items-start gap-3"
            >
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{submitError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-sm bg-orange-500/20 border-[0.5px] border-orange-500/30 text-orange-400 hover:bg-orange-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Submitting…
              </>
            ) : (
              'Generate video'
            )}
          </button>
        </form>
      )}

      {jobs.length > 0 && (
        <ul
          role="status"
          aria-live="polite"
          aria-label="Submitted video jobs"
          className="space-y-3"
        >
          {jobs.map(job => (
            <GenerativeJobRow key={job.id} job={job} />
          ))}
        </ul>
      )}
    </section>
  );
}

type JobView =
  | { kind: 'rendering' }
  | { kind: 'rendered'; videoUrl: string | null }
  | { kind: 'failed'; reason: string }
  | { kind: 'timed-out'; lastCheckError: string | null };

/** One submitted job, polled until a terminal state, the cap, or unmount. */
function GenerativeJobRow({ job }: { job: SubmittedJob }) {
  const [view, setView] = useState<JobView>({ kind: 'rendering' });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let polls = 0;
    let lastCheckError: string | null = null;

    const poll = async () => {
      polls += 1;
      try {
        const res = await fetch(`/api/video/${encodeURIComponent(job.id)}`);
        if (cancelled) return;
        if (res.status === 404) {
          setView({ kind: 'failed', reason: 'Video record not found.' });
          return;
        }
        if (res.ok) {
          const body = (await res.json().catch(() => null)) as {
            data?: {
              status?: string;
              videoUrl?: string | null;
              errorMessage?: string | null;
            };
          } | null;
          if (cancelled) return;
          const row = body?.data;
          if (row?.status === 'rendered') {
            setView({ kind: 'rendered', videoUrl: row.videoUrl ?? null });
            return;
          }
          if (row?.status === 'failed') {
            setView({
              kind: 'failed',
              reason:
                row.errorMessage || 'The render failed (no reason recorded).',
            });
            return;
          }
          lastCheckError = null;
        } else {
          lastCheckError = `status check failed (HTTP ${res.status})`;
        }
      } catch {
        if (cancelled) return;
        lastCheckError = 'status check could not reach the server';
      }
      if (polls >= MAX_POLLS) {
        setView({ kind: 'timed-out', lastCheckError });
        return;
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    timer = setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [job.id]);

  return (
    <li className="p-4 rounded-sm border-[0.5px] border-white/[0.06] bg-white/[0.01]">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-white font-medium">Job {job.id}</span>
        <span className="text-xs text-white/40">
          {job.model} · estimated {usd(job.estimatedCostUsd)}
        </span>
      </div>
      <div className="mt-2 text-sm">
        {view.kind === 'rendering' && (
          <p className="flex items-center gap-2 text-white/50">
            <Loader2 className="w-4 h-4 animate-spin" /> Rendering…
          </p>
        )}
        {view.kind === 'timed-out' && (
          <p className="flex items-center gap-2 text-orange-400">
            <Clock className="w-4 h-4" /> Still rendering — check back later.
            {view.lastCheckError && ` Last ${view.lastCheckError}.`}
          </p>
        )}
        {view.kind === 'failed' && (
          <p className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-4 h-4" /> Failed: {view.reason}
          </p>
        )}
        {view.kind === 'rendered' &&
          (view.videoUrl ? (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-emerald-400">
                <Check className="w-4 h-4" /> Rendered
              </p>
              <video
                controls
                preload="metadata"
                src={view.videoUrl}
                aria-label={`Generated video ${job.id}`}
                className="w-full max-w-md rounded-sm border-[0.5px] border-white/[0.06]"
              />
            </div>
          ) : (
            <p className="flex items-center gap-2 text-orange-400">
              <AlertTriangle className="w-4 h-4" /> Marked rendered, but no
              video URL was stored.
            </p>
          ))}
      </div>
    </li>
  );
}
