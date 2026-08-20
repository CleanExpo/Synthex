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
import { useEffect, useState } from 'react';
import {
  Megaphone,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building,
} from '@/components/icons';
import Link from 'next/link';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';

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

function normalizeHashtag(raw: string): string {
  return raw.replace(/^#/, '').trim();
}

export function CampaignGenerator({
  onCreated,
  initialName = '',
  initialContent = '',
}: CampaignGeneratorProps) {
  const { businesses, activeOrganizationId, isOwner, switchBusiness, refetch } =
    useActiveBusiness();

  const [step, setStep] = useState(0);
  const [name, setName] = useState(initialName);
  const [platform, setPlatform] = useState<CampaignPlatform>('multi');
  const [content, setContent] = useState(initialContent);
  const [targetAudience, setTargetAudience] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [state, setState] = useState<GenState>({ phase: 'form' });

  const [brandOrgId, setBrandOrgId] = useState<string | null>(null);
  const [newBrandName, setNewBrandName] = useState('');
  const [addingBrand, setAddingBrand] = useState(false);

  useEffect(() => {
    if (!isOwner) return;
    setBrandOrgId(activeOrganizationId);
  }, [isOwner, activeOrganizationId]);

  const canAdvanceBasics = name.trim().length > 0;
  const generating = state.phase === 'generating';

  async function submit() {
    setState({ phase: 'generating' });
    const parsedHashtags = hashtags
      .split(/[\s,]+/)
      .map(normalizeHashtag)
      .filter(Boolean);

    const promptTopic = content.trim() || name.trim();

    // AI generator supports a smaller platform set. Map unsupported options
    // to a safe fallback while keeping the original platform for the
    // campaign record.
    const generationPlatform =
      platform === 'multi' || platform === 'threads' ? 'twitter' : platform;

    let generatedContent: string;
    let finalHashtags: string[] = parsedHashtags;

    try {
      const aiRes = await fetch('/api/ai/generate-content', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: 'post',
          platform: generationPlatform,
          topic: promptTopic,
          tone: 'professional',
          targetAudience: targetAudience.trim() || undefined,
          length: 'medium',
          includeEmojis: true,
          includeHashtags: true,
          includeCTA: false,
        }),
      });

      if (!aiRes.ok) {
        const errorData = (await aiRes.json().catch(() => ({}))) as {
          code?: string;
          message?: string;
          error?: string;
          settingsUrl?: string;
        };

        if (
          errorData.code === 'API_KEY_REQUIRED' ||
          errorData.code === 'API_KEY_NOT_CONFIGURED'
        ) {
          setState({
            phase: 'error',
            message:
              'AI API key required. Connect one in Settings → AI Credentials, then try again.',
          });
          return;
        }

        throw new Error(
          errorData.message ||
            errorData.error ||
            `AI generation failed (${aiRes.status})`
        );
      }

      const aiData = (await aiRes.json()) as {
        success?: boolean;
        data?: { content?: string; hashtags?: string[] };
        error?: string;
        message?: string;
      };

      const aiContent = aiData.data?.content;
      if (!aiContent) throw new Error('AI returned no content.');

      generatedContent = aiContent;
      const aiHashtags = (aiData.data?.hashtags ?? [])
        .map(normalizeHashtag)
        .filter(Boolean);

      finalHashtags = Array.from(new Set([...parsedHashtags, ...aiHashtags]));
    } catch (err) {
      setState({
        phase: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Failed to generate campaign content.',
      });
      return;
    }

    const settings: Record<string, unknown> = {};
    if (finalHashtags.length > 0) settings.hashtags = finalHashtags;
    if (targetAudience.trim()) settings.targetAudience = targetAudience.trim();

    try {
      if (isOwner && brandOrgId && brandOrgId !== activeOrganizationId) {
        await switchBusiness(brandOrgId);
        await refetch();
      }

      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          platform,
          content: generatedContent,
          settings: Object.keys(settings).length ? settings : undefined,
          ...(brandOrgId ? { organizationId: brandOrgId } : {}),
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

  async function addNewBrand() {
    if (!isOwner) return;
    const trimmed = newBrandName.trim();
    if (!trimmed) return;

    setAddingBrand(true);
    try {
      const res = await fetch('/api/businesses', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        throw new Error(
          body.message ?? body.error ?? `Failed to add brand (${res.status})`
        );
      }

      const data = (await res.json()) as {
        business?: { organizationId?: string };
      };
      const nextId = data.business?.organizationId;
      if (!nextId) throw new Error('Brand created but no organizationId returned.');

      await switchBusiness(nextId);
      await refetch();
      setBrandOrgId(nextId);
      setNewBrandName('');
    } catch (err) {
      setState({
        phase: 'error',
        message: err instanceof Error ? err.message : 'Failed to add brand.',
      });
    } finally {
      setAddingBrand(false);
    }
  }

  return (
    <div className="border-[0.5px] border-white/6 bg-white/1.5 rounded-sm p-5">
      <div className="mb-4">
        <p className="text-[9px] uppercase tracking-[0.22em] text-white/30 mb-0.5">Step 2</p>
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-orange-400" />
          <h3 className="text-sm font-medium text-white/80">Campaign builder</h3>
        </div>
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
                  : 'bg-white/6 text-white/40'
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
            {/* Brands field: select existing business + type new */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-orange-400" />
                <span className="text-xs text-white/60">Brand (business)</span>
              </div>

              {isOwner ? (
                <div className="space-y-2">
                  <select
                    aria-label="Brand select"
                    value={brandOrgId ?? ''}
                    onChange={e => setBrandOrgId(e.target.value || null)}
                    className="w-full rounded-sm border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-orange-400/40"
                  >
                    <option value="">Select a business…</option>
                    {businesses.map(b => (
                      <option key={b.organizationId} value={b.organizationId}>
                        {b.displayName || b.organizationName}
                      </option>
                    ))}
                  </select>

                  <div className="flex gap-2">
                    <input
                      aria-label="New brand name"
                      value={newBrandName}
                      onChange={e => setNewBrandName(e.target.value)}
                      placeholder="Or type a new business name"
                      className="flex-1 rounded-sm border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-orange-400/40"
                      disabled={addingBrand}
                    />
                    <button
                      type="button"
                      disabled={addingBrand || !newBrandName.trim()}
                      onClick={() => void addNewBrand()}
                      className="rounded-sm bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-400 disabled:opacity-50"
                    >
                      {addingBrand ? 'Adding…' : 'Add'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-sm border border-white/6 bg-white/1 px-3 py-2">
                  <p className="text-xs text-white/55">
                    Brand selection is available for multi-business owners.
                  </p>
                  <p className="text-[11px] text-white/35 mt-1">
                    Your campaign will use your workspace default.
                  </p>
                </div>
              )}
            </div>

            {/* Scheduling is incoming — intentionally disabled */}
            <div className="rounded-sm border border-white/6 bg-white/1 px-3 py-3">
              <p className="text-xs text-white/60 uppercase tracking-wide">
                Scheduling
              </p>
              <p className="text-sm text-white/35 mt-1">
                Scheduling is coming soon. Campaigns are created as drafts and can be published from Assets.
              </p>
            </div>

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
              <span className="text-xs text-white/60">
                Campaign brief (AI will generate final copy)
              </span>
              <textarea
                aria-label="Content"
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={4}
                placeholder="A short brief: what you’re promoting + the tone you want."
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
                className="rounded-sm border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/4"
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
            <dl className="space-y-2 rounded-lg border border-white/6 bg-black/20 p-4 text-sm">
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-white/50">Name</dt>
                <dd className="text-white">{name}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-white/50">Platform</dt>
                <dd className="text-white">{platform}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-white/50">Brand</dt>
                <dd className="text-white">
                  {isOwner ? (
                    businesses.find(b => b.organizationId === brandOrgId)
                      ?.displayName ||
                    businesses.find(b => b.organizationId === brandOrgId)
                      ?.organizationName ||
                    (brandOrgId ? brandOrgId : '—')
                  ) : (
                    'Workspace default'
                  )}
                </dd>
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

            <div className="rounded-sm border border-white/6 bg-white/1 px-3 py-3 text-xs text-white/45">
              AI will generate the campaign content when you click{' '}
              <span className="text-white/70">Generate campaign</span>. If you haven’t connected an AI API key yet, connect it in{' '}
              <Link
                href="/dashboard/settings?tab=ai-credentials"
                className="text-orange-400 hover:text-orange-300"
              >
                Settings → AI Credentials
              </Link>
              .
            </div>
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-sm border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/4"
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
            <div className="h-1 w-48 overflow-hidden rounded-full bg-white/6">
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
              className="self-start rounded-sm border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/4"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
