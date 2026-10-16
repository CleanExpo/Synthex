'use client';

/**
 * Motion graphics (Claude-Motion-style) — plan panel for Brand Video Studio.
 *
 * Writes a brief, gets back a fact-checked, brand-styled Remotion plan and a
 * Claude Motion hand-off brief. Nothing renders or spends here; rendering is
 * the motion-studio operator step and a human approves before export.
 */

import { useState } from 'react';
import { Loader2, Video } from '@/components/icons';
import {
  MOTION_PLACEMENTS,
  type MotionKind,
  type MotionPlacement,
} from '@/lib/motion/brief';

const KINDS: { key: MotionKind; label: string; hint: string }[] = [
  {
    key: 'stat',
    label: 'Big number',
    hint: 'Line 1: the number · Line 2: what it measures · Line 3: context',
  },
  {
    key: 'comparison',
    label: 'Old way vs new way',
    hint: 'Line 1: old way · Line 2: new way',
  },
  {
    key: 'case-study',
    label: 'Case study',
    hint: 'Lines: challenge · solution · result · (optional) metric',
  },
  { key: 'how-to', label: 'How-to steps', hint: 'One step per line (max 5)' },
  { key: 'list', label: 'List', hint: 'One item per line (max 5)' },
  { key: 'explainer', label: 'Explainer', hint: 'One scene per line (max 8)' },
];

export function toContent(kind: MotionKind, text: string) {
  const l = text
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
  switch (kind) {
    case 'stat':
      return { kind, stat: l[0] ?? '', label: l[1] ?? '', context: l[2] ?? '' };
    case 'comparison':
      return { kind, oldWay: l[0] ?? '', newWay: l[1] ?? '' };
    case 'case-study':
      return {
        kind,
        challenge: l[0] ?? '',
        solution: l[1] ?? '',
        result: l[2] ?? '',
        ...(l[3] ? { metric: l[3] } : {}),
      };
    case 'how-to':
      return { kind, steps: l.map(step => ({ step })) };
    case 'list':
      return { kind, items: l };
    case 'explainer':
      return { kind, scenes: l.map(t => ({ text: t })) };
  }
}

interface PlanResponse {
  plan?: {
    compositionId: string;
    durationInFrames: number;
    fps: number;
    onScreen: string[];
    factCheck: { checked: string[] };
  };
  claudeMotionBrief?: string;
  warnings?: string[];
  issues?: string[];
  state?: string;
  error?: string;
}

const field =
  'w-full px-3 py-2 bg-gray-900/50 border-[0.5px] border-white/10 rounded-sm text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/40';

export function MotionPanel({ brand }: { brand: string }) {
  const [kind, setKind] = useState<MotionKind>('stat');
  const [placement, setPlacement] = useState<MotionPlacement>('youtube');
  const [durationSeconds, setDuration] = useState(20);
  const [audience, setAudience] = useState('');
  const [cta, setCta] = useState('');
  const [source, setSource] = useState('');
  const [points, setPoints] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PlanResponse | null>(null);

  async function handlePlan() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/brand-video/motion-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand,
          placement,
          durationSeconds,
          audience,
          cta,
          source,
          content: toContent(kind, points),
        }),
      });
      const payload: PlanResponse = await res
        .json()
        .catch(() => ({ error: `Request failed (${res.status})` }));
      setResult(
        res.ok
          ? payload
          : {
              ...payload,
              error: payload.error ?? `Request failed (${res.status})`,
            }
      );
    } catch {
      setResult({
        error: 'Could not reach the planner. Nothing was rendered.',
      });
    } finally {
      setBusy(false);
    }
  }

  const hint = KINDS.find(k => k.key === kind)?.hint;

  return (
    <section
      aria-label="Motion graphics"
      className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-6 space-y-5"
    >
      <div>
        <h2 className="text-sm font-light text-white">
          Motion graphics (Claude Motion style)
        </h2>
        <p className="text-xs text-white/50 mt-1">
          Built as code from your own words, numbers and real photos. No
          generated footage or people. Every number must appear in your source.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="space-y-1.5 text-xs text-white/50">
          Type
          <select
            aria-label="Motion type"
            value={kind}
            onChange={e => setKind(e.target.value as MotionKind)}
            className={field}
          >
            {KINDS.map(k => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-xs text-white/50">
          Where it plays
          <select
            aria-label="Placement"
            value={placement}
            onChange={e => setPlacement(e.target.value as MotionPlacement)}
            className={field}
          >
            {(Object.keys(MOTION_PLACEMENTS) as MotionPlacement[]).map(p => (
              <option key={p} value={p}>
                {MOTION_PLACEMENTS[p].label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-xs text-white/50">
          Length (seconds)
          <input
            aria-label="Length in seconds"
            type="number"
            min={6}
            max={60}
            value={durationSeconds}
            onChange={e => setDuration(Number(e.target.value) || 20)}
            className={field}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <input
          aria-label="Audience"
          value={audience}
          onChange={e => setAudience(e.target.value)}
          placeholder="Who will watch it?"
          className={field}
        />
        <input
          aria-label="Call to action"
          value={cta}
          onChange={e => setCta(e.target.value)}
          placeholder="Call to action"
          className={field}
        />
      </div>

      <textarea
        aria-label="Source"
        value={source}
        onChange={e => setSource(e.target.value)}
        rows={4}
        placeholder="Paste the source: your report, job notes, announcement or numbers. This is the only place facts can come from."
        className={field}
      />
      <textarea
        aria-label="Key points"
        value={points}
        onChange={e => setPoints(e.target.value)}
        rows={4}
        placeholder={hint}
        className={field}
      />

      <button
        onClick={handlePlan}
        disabled={busy || !brand.trim()}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold tracking-wide rounded-sm transition-colors disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Video className="h-3.5 w-3.5" />
        )}
        {busy ? 'Planning…' : 'Plan motion video'}
      </button>
      {!brand.trim() && (
        <p className="text-xs text-white/40">Enter the brand above first.</p>
      )}

      {result?.error && (
        <div role="alert" className="text-xs text-red-400 space-y-1">
          <p>
            {result.state === 'UNSUPPORTED'
              ? 'Blocked: a number is not in your source.'
              : result.error}
          </p>
          {result.issues?.map(i => (
            <p key={i}>{i}</p>
          ))}
        </div>
      )}

      {result?.plan && (
        <div className="space-y-3 text-xs text-white/70">
          <p>
            Plan ready:{' '}
            <span className="text-white">{result.plan.compositionId}</span>,{' '}
            {Math.round(result.plan.durationInFrames / result.plan.fps)}s. Facts
            checked:{' '}
            {result.plan.factCheck.checked.length === 0
              ? 'no figures on screen'
              : result.plan.factCheck.checked.join(', ')}
            .
          </p>
          {result.warnings?.map(w => (
            <p key={w} className="text-amber-300">
              {w}
            </p>
          ))}
          <label className="block space-y-1.5 text-white/50">
            Claude Motion brief (Team/Enterprise claude.ai — paste into a chat)
            <textarea
              aria-label="Claude Motion brief"
              readOnly
              value={result.claudeMotionBrief}
              rows={8}
              className={field}
            />
          </label>
          <p className="text-white/40">
            Not rendered yet. Next: render with the motion-studio skill, check
            one still per second, then approve before export.
          </p>
        </div>
      )}
    </section>
  );
}
