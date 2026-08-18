'use client';

import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import Link from 'next/link';

import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Circle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Wand2,
} from '@/components/icons';
import {
  CAMPAIGN_STUDIO_CHANNELS,
  CAMPAIGN_STUDIO_TONES,
  type CampaignStudioChannel,
  type CampaignStudioCopyVariant,
  type CampaignStudioResponse,
} from '@/lib/types/campaign-concept-studio';

type FormState = {
  campaignBrief: string;
  targetAudience: string;
  productDetails: string;
  tone: (typeof CAMPAIGN_STUDIO_TONES)[number];
  channels: CampaignStudioChannel[];
};

interface ApiErrorResponse {
  error?: string;
  details?: Record<string, string[]>;
}

const CHANNEL_LABELS: Record<CampaignStudioChannel, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  twitter: 'X (Twitter)',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  threads: 'Threads',
  pinterest: 'Pinterest',
  email: 'Email',
};

const TONE_LABELS: Record<(typeof CAMPAIGN_STUDIO_TONES)[number], string> = {
  professional: 'Professional',
  confident: 'Confident',
  friendly: 'Friendly',
  playful: 'Playful',
  urgent: 'Urgent',
  luxury: 'Luxury',
  minimal: 'Minimal',
};

const DEFAULT_FORM: FormState = {
  campaignBrief: '',
  targetAudience: '',
  productDetails: '',
  tone: 'professional',
  channels: ['instagram', 'linkedin'],
};

export default function CampaignConceptStudioPage() {
  const [formState, setFormState] = useState<FormState>(DEFAULT_FORM);
  const [result, setResult] = useState<CampaignStudioResponse | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'done'>(
    'idle'
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [detailErrors, setDetailErrors] = useState<Record<
    string,
    string[]
  > | null>(null);

  const canSubmit =
    formState.campaignBrief.trim().length >= 12 &&
    formState.targetAudience.trim().length >= 6 &&
    formState.productDetails.trim().length >= 12 &&
    formState.channels.length > 0;

  const checklistCount = useMemo(() => {
    if (!result) return 0;
    return result.launchChecklist.length;
  }, [result]);

  const toggleChannel = (channel: CampaignStudioChannel) => {
    setFormState(prev => {
      if (prev.channels.includes(channel)) {
        return {
          ...prev,
          channels: prev.channels.filter(item => item !== channel),
        };
      }

      return {
        ...prev,
        channels: [...prev.channels, channel],
      };
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) {
      setErrorMessage(
        'Fill out all required fields and select at least one channel.'
      );
      return;
    }

    setStatus('loading');
    setErrorMessage('');
    setDetailErrors(null);

    try {
      const response = await fetch('/api/campaign-concept-studio/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formState),
      });

      const data = (await response.json()) as {
        success?: boolean;
        payload?: CampaignStudioResponse;
      } & ApiErrorResponse;

      if (!response.ok || data.success === false) {
        const details = data.details ? JSON.stringify(data.details) : undefined;
        setErrorMessage(
          data.error ||
            `Request failed with status ${response.status}${details ? `: ${details}` : ''}`
        );
        setDetailErrors(data.details ?? null);
        setStatus('error');
        return;
      }

      if (!data.payload) {
        setErrorMessage('API returned an invalid payload.');
        setStatus('error');
        return;
      }

      setResult(data.payload);
      setStatus('done');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'A network error prevented the generation request.';
      setErrorMessage(message);
      setStatus('error');
    }
  };

  const resetStudio = () => {
    setResult(null);
    setErrorMessage('');
    setDetailErrors(null);
    setStatus('idle');
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-white/55 uppercase tracking-[0.2em]">
            Dashboard
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Campaign Concept Studio
          </h1>
          <p className="mt-2 text-sm text-white/65">
            Generate a concise concept, three headline/body variants, launch
            checklist, and visual prompts + images in one production-ready pass.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-lg border border-white/12 px-3 py-2 text-xs font-semibold text-white/80 hover:border-white/25 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to dashboard
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-white/60"
                htmlFor="campaignBrief"
              >
                Campaign brief
              </label>
              <textarea
                id="campaignBrief"
                className="w-full min-h-28 rounded-xl bg-black/20 border border-white/15 px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-indigo-400/80 focus:ring-2 focus:ring-indigo-400/25"
                value={formState.campaignBrief}
                placeholder="E.g. Launch a premium productivity workspace for remote teams."
                onChange={event =>
                  setFormState(prev => ({
                    ...prev,
                    campaignBrief: event.target.value,
                  }))
                }
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label
                  className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-white/60"
                  htmlFor="targetAudience"
                >
                  Target audience
                </label>
                <input
                  id="targetAudience"
                  className="w-full rounded-xl bg-black/20 border border-white/15 px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-indigo-400/80 focus:ring-2 focus:ring-indigo-400/25"
                  value={formState.targetAudience}
                  placeholder="E.g. Founders, marketers, remote teams"
                  onChange={event =>
                    setFormState(prev => ({
                      ...prev,
                      targetAudience: event.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label
                  className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-white/60"
                  htmlFor="tone"
                >
                  Tone
                </label>
                <select
                  id="tone"
                  className="w-full rounded-xl bg-black/20 border border-white/15 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400/80 focus:ring-2 focus:ring-indigo-400/25"
                  value={formState.tone}
                  onChange={event =>
                    setFormState(prev => ({
                      ...prev,
                      tone: event.target.value as FormState['tone'],
                    }))
                  }
                >
                  {CAMPAIGN_STUDIO_TONES.map(tone => (
                    <option value={tone} key={tone}>
                      {TONE_LABELS[tone]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-white/60"
                htmlFor="productDetails"
              >
                Product details
              </label>
              <textarea
                id="productDetails"
                className="w-full min-h-28 rounded-xl bg-black/20 border border-white/15 px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-indigo-400/80 focus:ring-2 focus:ring-indigo-400/25"
                value={formState.productDetails}
                placeholder="What the product is, what problem it solves, and what makes it unique."
                onChange={event =>
                  setFormState(prev => ({
                    ...prev,
                    productDetails: event.target.value,
                  }))
                }
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/60">
                Desired channels
              </p>
              <div className="flex flex-wrap gap-2">
                {CAMPAIGN_STUDIO_CHANNELS.map(channel => {
                  const isSelected = formState.channels.includes(channel);
                  return (
                    <button
                      type="button"
                      key={channel}
                      onClick={() => toggleChannel(channel)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        isSelected
                          ? 'border-indigo-300/80 bg-indigo-500/20 text-indigo-100'
                          : 'border-white/15 bg-black/15 text-white/70 hover:border-white/30 hover:text-white'
                      }`}
                    >
                      {CHANNEL_LABELS[channel]}
                    </button>
                  );
                })}
              </div>
            </div>

            {errorMessage && status === 'error' ? (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">
                <div className="mb-1 font-semibold">Generation failed</div>
                <div>{errorMessage}</div>
                {detailErrors ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-red-100/90">
                    {Object.entries(detailErrors).map(([field, messages]) => (
                      <li key={field}>
                        <span className="font-semibold">{field}</span>:{' '}
                        {messages.join(', ')}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={!canSubmit || status === 'loading'}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-500/90 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === 'loading' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                {status === 'loading' ? 'Generating...' : 'Generate concept'}
              </button>

              <button
                type="button"
                onClick={resetStudio}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white/90 hover:border-white/40"
              >
                <RefreshCw className="h-4 w-4" />
                Reset
              </button>
            </div>
          </form>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white/90">
                Studio Output
              </p>
              {status === 'loading' ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs text-indigo-200">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Building output
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/70">
                  <Circle className="h-3 w-3" />
                  Idle
                </span>
              )}
            </div>

            {result ? (
              <>
                <h2 className="text-sm font-semibold text-white">Concept</h2>
                <p className="mt-2 text-sm text-white/80">
                  {result.concept.concept}
                </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-white/55">
                      Positioning
                    </p>
                    <p className="mt-2 text-sm text-white/80">
                      {result.concept.positioning}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-white/55">
                      Value proposition
                    </p>
                    <p className="mt-2 text-sm text-white/80">
                      {result.concept.valueProposition}
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="text-sm font-semibold text-white">
                    Headline + body variants
                  </p>
                  <div className="mt-3 space-y-3">
                    {result.copyVariants.map(
                      (copy: CampaignStudioCopyVariant, index) => (
                        <div
                          key={`${copy.headline}-${index}`}
                          className="rounded-xl border border-white/10 bg-black/20 p-3"
                        >
                          <p className="text-sm font-semibold text-indigo-200">
                            Variant {index + 1}
                          </p>
                          <p className="mt-1 text-base font-semibold text-white">
                            {copy.headline}
                          </p>
                          <p className="mt-2 text-sm text-white/80">
                            {copy.body}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </div>

                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">
                      Launch checklist
                    </p>
                    <span className="text-xs text-white/55">
                      {checklistCount} items
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {result.launchChecklist.map((item, index) => (
                      <li
                        key={`${item}-${index}`}
                        className="flex items-start gap-2 text-sm text-white/85"
                      >
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">
                      Images by channel
                    </p>
                    <span className="text-xs text-white/55">
                      {
                        result.imagePrompts.filter(
                          item => item.status === 'ready'
                        ).length
                      }
                      /{result.imagePrompts.length} generated
                    </span>
                  </div>

                  <div className="space-y-3">
                    {result.imagePrompts.map(entry => (
                      <div
                        key={entry.channel}
                        className="rounded-xl border border-white/10 bg-black/20 p-3"
                      >
                        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-white/55">
                          <Camera className="h-4 w-4 text-indigo-200" />
                          {
                            CHANNEL_LABELS[
                              entry.channel as CampaignStudioChannel
                            ]
                          }
                        </div>

                        <p className="text-xs text-white/65 mb-2 leading-relaxed">
                          {entry.prompt}
                        </p>

                        {entry.status === 'ready' && entry.imageUrl ? (
                          <img
                            src={entry.imageUrl}
                            alt={`Campaign visual for ${CHANNEL_LABELS[entry.channel as CampaignStudioChannel]}`}
                            className="mb-2 h-44 w-full rounded-lg border border-white/12 object-cover"
                          />
                        ) : (
                          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-white/70">
                            <div className="mb-1 font-semibold text-red-200">
                              Image failed
                            </div>
                            <div>
                              {entry.error ??
                                'No image returned by image model.'}
                            </div>
                          </div>
                        )}

                        {entry.providerImageModel ? (
                          <div className="text-[11px] text-white/45">
                            Model: {entry.providerImageModel}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm text-white/75">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-300" />
                  <span className="font-semibold">No output yet</span>
                </div>
                <p className="mt-2 text-sm text-white/65">
                  Complete the form and click <strong>Generate concept</strong>{' '}
                  to see your campaign concept, copy variants, launch checklist,
                  and image outputs.
                </p>
              </div>
            )}

            {result?.usage ? (
              <div className="mt-4 rounded-lg border border-white/10 p-3 text-xs text-white/55">
                <p className="font-semibold text-white/65">Usage</p>
                <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                  <span>Text model: {result.model.textModel}</span>
                  <span>Image model: {result.model.imageModel}</span>
                  {result.usage?.inputTokens != null ? (
                    <span>Input tokens: {result.usage.inputTokens}</span>
                  ) : null}
                  {result.usage?.outputTokens != null ? (
                    <span>Output tokens: {result.usage.outputTokens}</span>
                  ) : null}
                  {result.usage?.totalTokens != null ? (
                    <span>Total tokens: {result.usage.totalTokens}</span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/10 bg-amber-400/10 p-4 text-xs text-amber-100">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <p>
                This feature runs OpenAI calls in the server route only. Your
                browser never stores API secrets and never calls OpenAI
                directly.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
