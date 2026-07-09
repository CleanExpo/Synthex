'use client';

/**
 * CampaignGenerator — Phase-8 campaign dashboard (SYN-381, Task 36).
 *
 * A multi-step form that creates a campaign against the real
 * `POST /api/campaigns` schema: { name, platform, content, settings } where
 * settings = { hashtags?, mentions?, scheduledAt?, targetAudience? }.
 *
 * Steps:
 *   1. Basics   — name + platform
 *   2. Content  — content body + audience + hashtags
 *   3. Generate — a progress indicator while the POST is in flight, then the
 *                 created campaign is handed back via onCreated.
 *
 * The component never fakes success — a 4xx/5xx (e.g. validation, 402 tier gate,
 * 403 no-org) surfaces the returned error verbatim.
 */
import { useState } from 'react';
import {
  Megaphone,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from '@/components/icons';

/** Platforms accepted by the campaigns API POST schema. */
export const CAMPAIGN_PLATFORMS = [
  'twitter',
  'linkedin',
  'instagram',
  'facebook',
  'tiktok',
  'threads',
  'multi',
] as const;

export type CampaignPlatform = (typeof CAMPAIGN_PLATFORMS)[number];

export interface CreatedCampaign {
  id: string;
  name: string;
  platform: string;
  content?: string | null;
  status: string;
}

export interface CampaignGeneratorProps {
  /** Notified with the created campaign on success. */
  onCreated?: (campaign: CreatedCampaign) => void;
  /** Optional seed values (e.g. from the Brand Scanner). */
  initialName?: string;
  initialContent?: string;
}

type GenState =
  | { phase: 'form' }
  | { phase: 'generating' }
  | { phase: 'done'; campaign: CreatedCampaign }
  | { phase: 'error'; message: string };

const STEPS = ['Basics', 'Content', 'Generate'] as const;

export function CampaignGenerator({
  onCreated,
  initialName = '',
  initialContent = '',
}: CampaignGeneratorProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initialName);
  const [platform, setPlatform] = useState<CampaignPlatform>('multi');
  const [content, setContent] = useState(initialContent);
  const [targetAudience, setTargetAudience] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [state, setState] = useState<GenState>({ phase: 'form' });

  const canAdvanceBasics = name.trim().length > 0;
  const generating = state.phase === 'generating';

  async function submit() {
    setState({ phase: 'generating' });
    const parsedHashtags = hashtags
      .split(/[\s,]+/)
      .map(h => h.replace(/^#/, '').trim())
      .filter(Boolean);
    const settings: Record<string, unknown> = {};
    if (parsedHashtags.length > 0) settings.hashtags = parsedHashtags;
    if (targetAudience.trim()) settings.targetAudience = targetAudience.trim();

    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          platform,
          content: content.trim() || undefined,
          settings: Object.keys(settings).length ? settings : undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          body.error ?? `Could not create campaign (${res.status})`
        );
      }
      const data = (await res.json()) as { campaign: CreatedCampaign };
      setState({ phase: 'done', campaign: data.campaign });
      onCreated?.(data.campaign);
    } catch (err) {
      setState({
        phase: 'error',
        message:
          err instanceof Error ? err.message : 'Could not create campaign.',
      });
    }
  }

  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.01] backdrop-blur-sm p-6">
      <div className="flex items-center gap-2">
        <Megaphone className="w-5 h-5 text-orange-400" />
        <h2 className="text-sm font-semibold text-white tracking-wide">
          New Campaign
        </h2>
      </div>

      {/* Step indicator */}
      <ol className="mt-4 flex items-center gap-2" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span
              aria-current={i === step ? 'step' : undefined}
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                i <= step
                  ? 'bg-orange-500 text-white'
                  : 'bg-white/[0.06] text-white/40'
              }`}
            >
              {i + 1}
            </span>
            <span
              className={`text-xs ${i <= step ? 'text-white' : 'text-white/40'}`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <span className="h-px w-6 bg-white/10" aria-hidden="true" />
            )}
          </li>
        ))}
      </ol>

      <div className="mt-6">
        {/* Step 1: Basics */}
        {state.phase === 'form' && step === 0 && (
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs text-white/60">Campaign name</span>
              <input
                aria-label="Campaign name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Spring launch"
                className="mt-1 w-full rounded-sm border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-orange-400/40"
              />
            </label>
            <label className="block">
              <span className="text-xs text-white/60">Platform</span>
              <select
                aria-label="Platform"
                value={platform}
                onChange={e => setPlatform(e.target.value as CampaignPlatform)}
                className="mt-1 w-full rounded-sm border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-orange-400/40"
              >
                {CAMPAIGN_PLATFORMS.map(p => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex justify-end">
              <button
                type="button"
                disabled={!canAdvanceBasics}
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 rounded-sm bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-400 disabled:opacity-50"
              >
                Next <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Content */}
        {state.phase === 'form' && step === 1 && (
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs text-white/60">Content</span>
              <textarea
                aria-label="Content"
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={4}
                placeholder="What is this campaign about?"
                className="mt-1 w-full rounded-sm border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-orange-400/40"
              />
            </label>
            <label className="block">
              <span className="text-xs text-white/60">Target audience</span>
              <input
                aria-label="Target audience"
                value={targetAudience}
                onChange={e => setTargetAudience(e.target.value)}
                placeholder="e.g. small business owners"
                className="mt-1 w-full rounded-sm border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-orange-400/40"
              />
            </label>
            <label className="block">
              <span className="text-xs text-white/60">
                Hashtags (space or comma separated)
              </span>
              <input
                aria-label="Hashtags"
                value={hashtags}
                onChange={e => setHashtags(e.target.value)}
                placeholder="#launch #spring"
                className="mt-1 w-full rounded-sm border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-orange-400/40"
              />
            </label>
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="rounded-sm border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/[0.04]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1.5 rounded-sm bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-400"
              >
                Review <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review + Generate */}
        {state.phase === 'form' && step === 2 && (
          <div className="space-y-4">
            <dl className="space-y-2 rounded-lg border border-white/[0.06] bg-black/20 p-4 text-sm">
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-white/50">Name</dt>
                <dd className="text-white">{name}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-white/50">Platform</dt>
                <dd className="text-white">{platform}</dd>
              </div>
              {content.trim() && (
                <div className="flex gap-2">
                  <dt className="w-28 shrink-0 text-white/50">Content</dt>
                  <dd className="text-white/80 whitespace-pre-wrap">
                    {content}
                  </dd>
                </div>
              )}
            </dl>
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-sm border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/[0.04]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={submit}
                className="inline-flex items-center gap-1.5 rounded-sm bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-400"
              >
                Generate campaign
              </button>
            </div>
          </div>
        )}

        {/* Generating progress */}
        {generating && (
          <div
            role="status"
            className="flex flex-col items-center gap-3 py-8 text-center"
          >
            <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
            <p className="text-sm text-white/70">Generating your campaign…</p>
            <div className="h-1 w-48 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-orange-500" />
            </div>
          </div>
        )}

        {/* Done */}
        {state.phase === 'done' && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            <p className="text-sm text-white">
              Campaign{' '}
              <span className="font-medium">{state.campaign.name}</span> created
              as a {state.campaign.status}.
            </p>
          </div>
        )}

        {/* Error */}
        {state.phase === 'error' && (
          <div role="alert" className="flex flex-col gap-3 py-4">
            <div className="flex items-start gap-2 rounded-lg border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{state.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setState({ phase: 'form' })}
              className="self-start rounded-sm border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/[0.04]"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
