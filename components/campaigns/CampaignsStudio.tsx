'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Megaphone,
  Plus,
  Loader2,
  AlertCircle,
  X,
  Search,
  Grid,
  List,
  Copy,
  Archive,
  Pause,
} from '@/components/icons';
import { PageHeader } from '@/components/dashboard/page-header';
import { useBrandProfile } from '@/hooks/use-brand-profile';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { PublishConfirmModal } from '@/components/content';
import { fetchWithCSRF } from '@/lib/csrf';
import { humanizeAiError } from '@/lib/dashboard/humanize-error';
import { customerPostStatus } from '@/lib/dashboard/post-status';
import {
  parseCampaignCards,
  serializeCampaignCards,
  type CampaignCard,
} from '@/lib/dashboard/campaign-cards';
import {
  campaignHealth,
  matchesCampaignQuery,
} from '@/lib/dashboard/campaign-health';
import { CAMPAIGN_TEMPLATES } from '@/lib/dashboard/campaign-templates';
import { toast } from 'sonner';
import { FIRST_WEEK_GUIDANCE } from '@/lib/dashboard/first-week-guidance';
import {
  clampLaunchWeekCount,
  fillDraftsFromGeneration,
  LAUNCH_WEEK_MAX,
  LAUNCH_WEEK_MIN,
} from '@/lib/dashboard/launch-week';
import {
  campaignBriefReady,
  campaignBriefTopic,
  EMPTY_CAMPAIGN_BRIEF,
  type CampaignBrief,
} from '@/lib/dashboard/campaign-brief';

interface CampaignPostSummary {
  id: string;
  content?: string | null;
  status: string;
  platform: string;
}

interface Campaign {
  id: string;
  name: string;
  description?: string | null;
  platform: string;
  content?: unknown;
  status: string;
  createdAt?: string;
  posts?: CampaignPostSummary[];
  settings?: {
    startsAt?: string;
    endsAt?: string;
    targetAudience?: string;
  };
}

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'twitter', label: 'Twitter / X' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'threads', label: 'Threads' },
] as const;

type DraftCard = { text: string; platform: string };

function platformLabel(p: string): string {
  if (p === 'multi') return 'Mixed channels';
  return PLATFORMS.find(x => x.id === p)?.label ?? p;
}

function windowLabel(campaign: Campaign): string {
  const start = campaign.settings?.startsAt;
  const end = campaign.settings?.endsAt;
  if (!start && !end) return 'Dates open';
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
    });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  return `Until ${fmt(end!)}`;
}

export function CampaignsStudio() {
  const { activeOrganizationId } = useActiveBusiness();
  const { profile } = useBrandProfile(activeOrganizationId);
  const hasBrand = Boolean(profile?.name?.trim());

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [launchWeek, setLaunchWeek] = useState(false);
  const [brief, setBrief] = useState<CampaignBrief>(EMPTY_CAMPAIGN_BRIEF);
  const [showPosts, setShowPosts] = useState(false);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [channels, setChannels] = useState<string[]>(['instagram']);
  const [drafts, setDrafts] = useState<DraftCard[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [filling, setFilling] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [skippedKeys, setSkippedKeys] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState<'newest' | 'name' | 'progress'>('newest');
  const [board, setBoard] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [scheduleCard, setScheduleCard] = useState<{
    text: string;
    platform: string;
    campaignId: string;
  } | null>(null);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/campaigns', { credentials: 'include' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          body.error ?? `Failed to load campaigns (${res.status})`
        );
      }
      const data = (await res.json()) as { campaigns?: Campaign[] };
      setCampaigns(data.campaigns ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load campaigns.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  const emptyComposer = !campaignBriefReady(brief);

  function openComposer(templateId: string) {
    const template =
      CAMPAIGN_TEMPLATES.find(t => t.id === templateId) ??
      CAMPAIGN_TEMPLATES[0];
    setLaunchWeek(Boolean(template.launchWeek));
    setBrief({
      ...EMPTY_CAMPAIGN_BRIEF,
      name: template.name,
      job: template.job,
    });
    setShowPosts(false);
    setDrafts([]);
    setComposerOpen(true);
  }

  function patchBrief<K extends keyof CampaignBrief>(
    key: K,
    value: CampaignBrief[K]
  ) {
    setBrief(prev => ({ ...prev, [key]: value }));
  }

  async function fillCards() {
    if (emptyComposer) {
      toast.error(
        'Fill the brief first — job, who it is for, the offer, and the ask.'
      );
      return;
    }
    const slotCount = drafts.length > 0 ? drafts.length : launchWeek ? 5 : 4;
    if (drafts.length === 0) {
      const rotation = channels.length ? channels : [platform];
      setDrafts(
        Array.from({ length: slotCount }, (_, i) => ({
          text: '',
          platform: rotation[i % rotation.length] ?? platform,
        }))
      );
    }
    setShowPosts(true);
    setFilling(true);
    try {
      const topic = campaignBriefTopic(brief);
      const res = await fetch('/api/ai/generate-content', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: 'post',
          platform: platform === 'threads' ? 'twitter' : platform,
          topic,
          tone: 'casual',
          length: 'medium',
          includeEmojis: false,
          includeHashtags: true,
          includeCTA: true,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        toast.error(humanizeAiError(body.error || body.message, res.status));
        return;
      }
      const data = (await res.json()) as {
        content?: string;
        variations?: string[];
        data?: { content?: string; variations?: string[] };
      };
      const primary =
        data.content || data.data?.content || data.variations?.[0] || '';
      const second =
        data.variations?.[1] || data.data?.variations?.[1] || primary;
      if (!primary.trim()) {
        toast.error('We could not fill the cards. Try writing them yourself.');
        return;
      }
      const extras = [
        second,
        ...(data.variations ?? data.data?.variations ?? []),
      ];
      const lines = fillDraftsFromGeneration(slotCount, primary, extras);
      const rotation = channels.length ? channels : [platform];
      setDrafts(prev => {
        const base =
          prev.length === slotCount
            ? prev
            : Array.from({ length: slotCount }, (_, i) => ({
                text: '',
                platform: rotation[i % rotation.length] ?? platform,
              }));
        return base.map((card, i) => ({ ...card, text: lines[i] ?? '' }));
      });
      const filled = lines.filter(Boolean).length;
      if (filled < slotCount) {
        toast.message(
          `Filled ${filled} of ${drafts.length} cards. Write the rest — Save will not send them.`
        );
      }
    } catch (err) {
      toast.error(
        humanizeAiError(err instanceof Error ? err.message : undefined)
      );
    } finally {
      setFilling(false);
    }
  }

  async function createCampaign() {
    if (!campaignBriefReady(brief)) {
      const missing = [
        !brief.name.trim() && 'internal name',
        !brief.job.trim() && 'job of this run',
        !brief.audience.trim() && 'who it is for',
        !brief.offer.trim() && 'what they get',
        !brief.cta.trim() && 'what they should do',
      ].filter(Boolean);
      const message = `Still need: ${missing.join(', ')}.`;
      setSaveError(message);
      toast.error(message);
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      const cards: CampaignCard[] = drafts
        .map((card, i) => ({
          key: String(i + 1),
          text: card.text.trim(),
          platform: card.platform,
        }))
        .filter(c => c.text.length > 0);
      const channelList = channels.length > 0 ? channels : [platform];
      const mixed =
        channelList.length > 1 || new Set(cards.map(c => c.platform)).size > 1;
      const res = await fetchWithCSRF('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name: brief.name.trim(),
          description: brief.job.trim().slice(0, 1000),
          organizationId: activeOrganizationId || undefined,
          platform: mixed
            ? 'multi'
            : (cards[0]?.platform ?? channelList[0] ?? 'instagram'),
          content: serializeCampaignCards(cards),
          settings: {
            ...(startsAt ? { startsAt } : {}),
            ...(endsAt ? { endsAt } : {}),
            targetAudience: brief.audience.trim(),
            job: brief.job.trim(),
            offer: brief.offer.trim(),
            proof: brief.proof.trim(),
            cta: brief.cta.trim(),
            place: brief.place.trim(),
            avoid: brief.avoid.trim(),
            channels: channelList,
          },
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        details?: Record<string, string[] | undefined>;
        campaign?: Campaign;
      };
      if (!res.ok) {
        const detail = body.details
          ? Object.entries(body.details)
              .flatMap(([key, value]) =>
                (value ?? []).map(item => `${key}: ${item}`)
              )
              .join(' ')
          : '';
        throw new Error(
          [body.error ?? `Could not create campaign (${res.status})`, detail]
            .filter(Boolean)
            .join(' ')
        );
      }
      if (body.campaign) {
        setCampaigns(prev => [
          body.campaign as Campaign,
          ...prev.filter(c => c.id !== body.campaign?.id),
        ]);
        setOpenId(body.campaign.id);
      }
      toast.success(
        cards.length === 0
          ? 'Campaign saved. Draft posts from the brief when you want — nothing was sent.'
          : 'Campaign saved. Schedule each post when you are happy.'
      );
      setComposerOpen(false);
      setLaunchWeek(false);
      setBrief(EMPTY_CAMPAIGN_BRIEF);
      setShowPosts(false);
      setDrafts([]);
      setStartsAt('');
      setEndsAt('');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not save the campaign.';
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function putCampaign(body: Record<string, unknown>) {
    const res = await fetch('/api/campaigns', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? 'Could not update campaign');
    }
  }

  async function saveOpenCards(campaign: Campaign) {
    const cards = parseCampaignCards(campaign)
      .filter(c => !skippedKeys[`${campaign.id}:${c.key}`] && !c.skipped)
      .map(card => ({
        ...card,
        text: edits[`${campaign.id}:${card.key}`] ?? card.text,
      }));
    try {
      await putCampaign({
        id: campaign.id,
        content: serializeCampaignCards(cards),
      });
      toast.success('Cards saved. Nothing was posted.');
      await loadCampaigns();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save cards.');
    }
  }

  async function duplicateCampaign(campaign: Campaign) {
    const cards = parseCampaignCards(campaign);
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: `${campaign.name} (copy)`,
          platform:
            campaign.platform === 'multi' ? 'instagram' : campaign.platform,
          content: serializeCampaignCards(cards),
          settings: campaign.settings ?? {},
        }),
      });
      if (!res.ok) throw new Error('Could not duplicate');
      toast.success('Copy created. Edit it before you schedule.');
      await loadCampaigns();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not duplicate.');
    }
  }

  async function setStatus(id: string, status: string) {
    try {
      await putCampaign({ id, status });
      toast.success(
        status === 'archived'
          ? 'Archived. It stays off the board until you show archives.'
          : 'Status updated. Posts still need you to schedule them.'
      );
      await loadCampaigns();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update.');
    }
  }

  async function removeCampaign(id: string) {
    if (
      !window.confirm('Delete this campaign? Booked posts stay on Calendar.')
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/campaigns?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Could not delete');
      toast.success('Campaign removed.');
      if (openId === id) setOpenId(null);
      await loadCampaigns();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete.');
    }
  }

  const visible = useMemo(() => {
    const rows = campaigns.filter(c => {
      if (!showArchived && c.status === 'archived') return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      return matchesCampaignQuery(c.name, query);
    });
    return rows.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'progress') {
        const ha = campaignHealth(parseCampaignCards(a)).bookedPercent;
        const hb = campaignHealth(parseCampaignCards(b)).bookedPercent;
        return hb - ha;
      }
      return (
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime()
      );
    });
  }, [campaigns, query, sort, statusFilter, showArchived]);

  const studioStats = useMemo(() => {
    const live = campaigns.filter(c => c.status !== 'archived');
    const healths = live.map(c => campaignHealth(parseCampaignCards(c)));
    return {
      runs: live.length,
      cards: healths.reduce((n, h) => n + h.total, 0),
      booked: healths.reduce((n, h) => n + h.scheduled + h.posted, 0),
    };
  }, [campaigns]);

  const selected = useMemo(
    () => campaigns.find(c => c.id === openId) ?? null,
    [campaigns, openId]
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Studio"
        title="Campaigns"
        description={`${FIRST_WEEK_GUIDANCE.campaigns.what} ${FIRST_WEEK_GUIDANCE.campaigns.why}`}
        actions={
          <button
            type="button"
            onClick={() =>
              composerOpen ? setComposerOpen(false) : openComposer('walk-in')
            }
            className="inline-flex items-center gap-1.5 h-10 px-4 text-sm font-medium rounded-md bg-orange-500 hover:bg-orange-400 text-slate-950"
          >
            {composerOpen ? (
              <>
                <X className="h-4 w-4" /> Close studio
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> New campaign
              </>
            )}
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatTile label="Live runs" value={studioStats.runs} />
        <StatTile label="Cards in play" value={studioStats.cards} />
        <StatTile label="Booked or posted" value={studioStats.booked} />
      </div>

      {!composerOpen && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {CAMPAIGN_TEMPLATES.map(template => (
            <button
              key={template.id}
              type="button"
              onClick={() => openComposer(template.id)}
              className="text-left rounded-lg border border-white/10 bg-white/5 backdrop-blur-md p-4 hover:border-orange-400/30 hover:bg-white/8 transition-colors"
            >
              <p className="text-xs uppercase tracking-[0.18em] text-white/35">
                {template.label}
              </p>
              <p className="mt-2 text-sm text-white/70 leading-relaxed">
                {template.blurb}
              </p>
            </button>
          ))}
        </div>
      )}

      {composerOpen && (
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-6 space-y-5 shadow-[0_8px_32px_rgba(0,0,0,0.37)]">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-white/35">
                Brief
              </p>
              <h2 className="mt-1 text-xl font-light tracking-tight text-white">
                What this campaign has to do
              </h2>
            </div>
            <p className="text-xs text-white/40 max-w-sm text-right">
              Answer the job first. Posts are drafted from this — Save still
              sends nothing.
            </p>
          </div>
          {!hasBrand && (
            <p className="text-xs text-white/45">
              Brand DNA is thin. The brief below is what keeps the copy honest.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Internal name"
              value={brief.name}
              onChange={v => patchBrief('name', v)}
              placeholder="Spring counter"
            />
            <Field
              label="Job of this run"
              value={brief.job}
              onChange={v => patchBrief('job', v)}
              placeholder="Get parents in after school pickup"
            />
            <Field
              label="Who it is for"
              value={brief.audience}
              onChange={v => patchBrief('audience', v)}
              placeholder="Parents on the walk home from the school"
            />
            <Field
              label="What they get"
              value={brief.offer}
              onChange={v => patchBrief('offer', v)}
              placeholder="Free babycino with any coffee after 3"
            />
            <Field
              label="Why believe you"
              value={brief.proof}
              onChange={v => patchBrief('proof', v)}
              placeholder="We bake one sheet of croissants and stop"
            />
            <Field
              label="What they should do"
              value={brief.cta}
              onChange={v => patchBrief('cta', v)}
              placeholder="Come in and say pickup"
            />
            <Field
              label="Where"
              value={brief.place}
              onChange={v => patchBrief('place', v)}
              placeholder="Counter on High Street, not delivery"
            />
            <Field
              label="Do not say"
              value={brief.avoid}
              onChange={v => patchBrief('avoid', v)}
              placeholder="No limited time only, no influencer talk"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1">
              <span className="text-xs text-white/50">Starts</span>
              <input
                type="date"
                value={startsAt}
                onChange={e => setStartsAt(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-white/5 border border-white/10 text-sm text-white"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-white/50">Ends</span>
              <input
                type="date"
                value={endsAt}
                onChange={e => setEndsAt(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-white/5 border border-white/10 text-sm text-white"
              />
            </label>
            <div className="space-y-1">
              <span className="text-xs text-white/50">Channels</span>
              <div className="flex flex-wrap gap-2 pt-1">
                {PLATFORMS.map(p => {
                  const on = channels.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setChannels(prev => {
                          const next = on
                            ? prev.filter(id => id !== p.id)
                            : [...prev, p.id];
                          return next.length ? next : [p.id];
                        });
                        setPlatform(p.id);
                      }}
                      className={`h-8 px-2.5 rounded-md text-xs border ${
                        on
                          ? 'border-orange-400/40 bg-orange-500/15 text-orange-200'
                          : 'border-white/10 text-white/50'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          {showPosts && (
            <>
              {launchWeek && (
                <label className="flex items-center gap-2 text-xs text-white/50">
                  How many posts
                  <select
                    value={Math.max(drafts.length, LAUNCH_WEEK_MIN)}
                    onChange={e => {
                      const next = clampLaunchWeekCount(Number(e.target.value));
                      setDrafts(prev =>
                        Array.from(
                          { length: next },
                          (_, i) =>
                            prev[i] ?? {
                              text: '',
                              platform:
                                channels[i % channels.length] ?? platform,
                            }
                        )
                      );
                    }}
                    className="h-8 px-2 rounded-md bg-white/5 border border-white/10 text-sm text-white"
                  >
                    {Array.from(
                      { length: LAUNCH_WEEK_MAX - LAUNCH_WEEK_MIN + 1 },
                      (_, i) => LAUNCH_WEEK_MIN + i
                    ).map(n => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="grid gap-3 lg:grid-cols-2">
                {drafts.map((card, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-white/10 bg-slate-950/40 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-white/50">
                        Caption {i + 1}
                      </span>
                      <select
                        value={card.platform}
                        onChange={e =>
                          setDrafts(prev =>
                            prev.map((d, idx) =>
                              idx === i ? { ...d, platform: e.target.value } : d
                            )
                          )
                        }
                        className="h-8 px-2 rounded-md bg-white/5 border border-white/10 text-xs text-white"
                      >
                        {PLATFORMS.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      value={card.text}
                      onChange={e =>
                        setDrafts(prev =>
                          prev.map((d, idx) =>
                            idx === i ? { ...d, text: e.target.value } : d
                          )
                        )
                      }
                      rows={5}
                      className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-sm text-white"
                    />
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void fillCards()}
              disabled={filling || emptyComposer}
              className="h-10 px-3 text-sm rounded-md border border-white/10 text-white/70 hover:bg-white/5 disabled:opacity-40"
            >
              {filling
                ? 'Drafting from the brief…'
                : 'Draft posts from this brief'}
            </button>
            {saveError && (
              <p role="alert" className="w-full text-sm text-rose-200">
                {saveError}
              </p>
            )}
            <button
              type="button"
              onClick={() => void createCampaign()}
              disabled={saving}
              className="h-10 px-4 text-sm rounded-md bg-orange-500 hover:bg-orange-400 text-slate-950 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save campaign'}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Find a run"
            className="w-full h-10 pl-9 pr-3 rounded-md bg-white/5 border border-white/10 text-sm text-white"
          />
        </label>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-10 px-3 rounded-md bg-white/5 border border-white/10 text-sm text-white"
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
        </select>
        <select
          value={sort}
          onChange={e =>
            setSort(e.target.value as 'newest' | 'name' | 'progress')
          }
          className="h-10 px-3 rounded-md bg-white/5 border border-white/10 text-sm text-white"
        >
          <option value="newest">Newest</option>
          <option value="name">Name</option>
          <option value="progress">Most booked</option>
        </select>
        <button
          type="button"
          onClick={() => setShowArchived(v => !v)}
          className="h-10 px-3 text-xs rounded-md border border-white/10 text-white/55 hover:text-white"
        >
          {showArchived ? 'Hide archives' : 'Show archives'}
        </button>
        <div className="flex rounded-md border border-white/10 p-0.5">
          <button
            type="button"
            onClick={() => setBoard(true)}
            className={`p-2 rounded ${board ? 'bg-orange-500/15 text-orange-400' : 'text-white/40'}`}
            aria-label="Board"
          >
            <Grid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setBoard(false)}
            className={`p-2 rounded ${!board ? 'bg-orange-500/15 text-orange-400' : 'text-white/40'}`}
            aria-label="List"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div
          role="status"
          className="flex items-center gap-2 text-sm text-white/45 py-12"
        >
          <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
          Loading campaigns…
        </div>
      ) : error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-rose-400/25 bg-rose-500/10 p-4 text-sm text-rose-100"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-2">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void loadCampaigns()}
              className="rounded-md border border-white/10 px-3 py-1 text-xs text-white/70 hover:bg-white/5"
            >
              Retry
            </button>
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-14 text-center">
          <Megaphone className="mx-auto h-8 w-8 text-white/20" />
          <h3 className="mt-4 text-lg font-light text-white">
            {campaigns.length === 0 ? 'No campaigns yet' : 'Nothing matches'}
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/40">
            {campaigns.length === 0
              ? FIRST_WEEK_GUIDANCE.campaigns.empty
              : 'Clear the search or show archives.'}
          </p>
        </div>
      ) : (
        <ul
          className={
            board ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : 'space-y-3'
          }
        >
          {visible.map(campaign => {
            const cards = parseCampaignCards(campaign).filter(
              c => !skippedKeys[`${campaign.id}:${c.key}`] && !c.skipped
            );
            const health = campaignHealth(cards);
            const open = openId === campaign.id;
            return (
              <li
                key={campaign.id}
                className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden"
              >
                <div className="p-5">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : campaign.id)}
                    className="w-full text-left"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-white/35">
                          {platformLabel(campaign.platform)} ·{' '}
                          {windowLabel(campaign)}
                        </p>
                        <h3 className="mt-1 text-xl font-light tracking-tight text-white">
                          {campaign.name}
                        </h3>
                        {campaign.description && (
                          <p className="mt-1 text-sm text-white/40">
                            {campaign.description}
                          </p>
                        )}
                      </div>
                      <span className="text-xs capitalize rounded-full border border-white/10 px-2.5 py-1 text-white/55">
                        {campaign.status}
                      </span>
                    </div>
                    <div className="mt-4">
                      <div className="flex justify-between text-xs text-white/40 mb-1.5">
                        <span>
                          {health.bookedPercent}% booked · {health.total} cards
                        </span>
                        <span>
                          {health.failed > 0
                            ? `${health.failed} failed`
                            : `${health.draft} still drafts`}
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-orange-500"
                          style={{ width: `${health.bookedPercent}%` }}
                        />
                      </div>
                    </div>
                  </button>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void duplicateCampaign(campaign)}
                      className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-white"
                    >
                      <Copy className="h-3.5 w-3.5" /> Duplicate
                    </button>
                    <button
                      type="button"
                      onClick={() => void setStatus(campaign.id, 'paused')}
                      className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-white"
                    >
                      <Pause className="h-3.5 w-3.5" /> Pause
                    </button>
                    <button
                      type="button"
                      onClick={() => void setStatus(campaign.id, 'archived')}
                      className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-white"
                    >
                      <Archive className="h-3.5 w-3.5" /> Archive
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeCampaign(campaign.id)}
                      className="text-xs text-rose-300/80 hover:text-rose-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {open && (
                  <div className="border-t border-white/10 px-5 py-4 space-y-3 bg-slate-950/30">
                    {cards.length === 0 ? (
                      <p className="text-sm text-white/40">
                        No posts in this campaign yet.{' '}
                        {FIRST_WEEK_GUIDANCE.campaigns.empty}
                      </p>
                    ) : (
                      cards.map(card => {
                        const editKey = `${campaign.id}:${card.key}`;
                        const text = edits[editKey] ?? card.text;
                        return (
                          <div
                            key={card.key}
                            className="rounded-lg border border-white/10 p-3 space-y-2"
                          >
                            <span className="text-xs text-white/40">
                              {platformLabel(card.platform)}
                              {card.status
                                ? ` · ${customerPostStatus(card.status)}`
                                : ' · Draft'}
                            </span>
                            <textarea
                              value={text}
                              onChange={e =>
                                setEdits(prev => ({
                                  ...prev,
                                  [editKey]: e.target.value,
                                }))
                              }
                              rows={4}
                              className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-sm text-white"
                            />
                            <div className="flex flex-wrap gap-3">
                              <button
                                type="button"
                                onClick={() =>
                                  setScheduleCard({
                                    text,
                                    platform:
                                      card.platform === 'multi'
                                        ? 'instagram'
                                        : card.platform,
                                    campaignId: campaign.id,
                                  })
                                }
                                className="text-sm text-orange-400 hover:text-orange-300"
                              >
                                Schedule
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setSkippedKeys(prev => ({
                                    ...prev,
                                    [editKey]: true,
                                  }))
                                }
                                className="text-sm text-white/40 hover:text-white/70"
                              >
                                Don&apos;t use
                              </button>
                              <Link
                                href="/dashboard/content"
                                className="text-sm text-white/40 hover:text-white/70"
                              >
                                Edit in Content
                              </Link>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <button
                      type="button"
                      onClick={() => void saveOpenCards(campaign)}
                      className="h-9 px-3 text-sm rounded-md border border-white/10 text-white/70 hover:bg-white/5"
                    >
                      Save card edits
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {selected && <p className="sr-only">Open campaign {selected.name}</p>}

      <PublishConfirmModal
        open={Boolean(scheduleCard)}
        onOpenChange={open => {
          if (!open) setScheduleCard(null);
        }}
        content={scheduleCard?.text ?? ''}
        platform={scheduleCard?.platform ?? 'instagram'}
        onConfirm={async options => {
          if (!scheduleCard) return;
          const response = await fetchWithCSRF('/api/scheduler/posts', {
            method: 'POST',
            body: JSON.stringify({
              content: scheduleCard.text,
              platform: options.platform,
              scheduledAt: options.scheduledAt,
              campaignId: scheduleCard.campaignId,
            }),
          });
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
              (errorData as { message?: string; error?: string }).message ||
                (errorData as { error?: string }).error ||
                'Could not schedule'
            );
          }
          toast.success('Booked. Find it on Calendar.');
          setScheduleCard(null);
          await loadCampaigns();
        }}
      />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-white/50">{label}</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 px-3 rounded-md bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25"
      />
    </label>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-md px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-white/35">
        {label}
      </p>
      <p className="mt-1 text-2xl font-light tabular-nums text-white">
        {value}
      </p>
    </div>
  );
}
