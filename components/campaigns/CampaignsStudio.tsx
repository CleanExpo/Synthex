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
  Copy,
  Archive,
  Pause,
} from '@/components/icons';
import { PageHeader } from '@/components/dashboard/page-header';
import { useBrandProfile } from '@/hooks/use-brand-profile';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { PublishConfirmModal } from '@/components/content';
import { fetchWithCSRF } from '@/lib/csrf';
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
import {
  daysInWindow,
  defaultDateWindow,
  extractGeneratedLines,
} from '@/lib/dashboard/campaign-generate';
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
  const [scenarioId, setScenarioId] = useState(CAMPAIGN_TEMPLATES[0].id);
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
  const [showArchived, setShowArchived] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
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

  function applyScenario(templateId: string) {
    const template =
      CAMPAIGN_TEMPLATES.find(t => t.id === templateId) ??
      CAMPAIGN_TEMPLATES[0];
    const window = defaultDateWindow(template.days);
    setScenarioId(template.id);
    setLaunchWeek(Boolean(template.launchWeek));
    setBrief({ ...template.brief });
    setStartsAt(window.startsAt);
    setEndsAt(window.endsAt);
    setShowPosts(false);
    setDrafts([]);
    setSaveError(null);
  }

  function openComposer(templateId: string) {
    applyScenario(templateId);
    setComposerOpen(true);
  }

  async function generateCaptions(count: number): Promise<string[]> {
    const topic = campaignBriefTopic(brief);
    const apiPlatform = platform === 'threads' ? 'twitter' : platform;
    const lines: string[] = [];
    const attempts = Math.min(3, Math.max(1, count));
    for (let i = 0; i < attempts && lines.length < count; i += 1) {
      const res = await fetchWithCSRF('/api/ai/generate-content', {
        method: 'POST',
        body: JSON.stringify({
          type: 'post',
          platform: apiPlatform === 'youtube' ? 'instagram' : apiPlatform,
          topic: `${topic}\nThis is caption ${i + 1} of ${count} for the dated run. Do not repeat an earlier caption.`,
          tone: 'casual',
          length: 'medium',
          includeEmojis: false,
          includeHashtags: true,
          includeCTA: true,
        }),
      });
      if (!res.ok) {
        break;
      }
      const data = await res.json();
      for (const line of extractGeneratedLines(data)) {
        if (!lines.includes(line)) lines.push(line);
      }
    }
    const scenario = CAMPAIGN_TEMPLATES.find(t => t.id === scenarioId);
    const fallback = scenario?.captions ?? [];
    return fillDraftsFromGeneration(count, lines[0] ?? fallback[0] ?? '', [
      ...lines.slice(1),
      ...fallback,
    ]).filter(Boolean);
  }

  function patchBrief<K extends keyof CampaignBrief>(
    key: K,
    value: CampaignBrief[K]
  ) {
    setBrief(prev => ({ ...prev, [key]: value }));
  }

  function slotCountForDates(): number {
    const fromDates = daysInWindow(startsAt, endsAt);
    if (fromDates > 0) return fromDates;
    const scenario = CAMPAIGN_TEMPLATES.find(t => t.id === scenarioId);
    return scenario?.days ?? 4;
  }

  function cardsFromLines(lines: string[]): DraftCard[] {
    const rotation = channels.length ? channels : [platform];
    return lines.map((text, i) => ({
      text,
      platform: rotation[i % rotation.length] ?? platform,
    }));
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
    setFilling(true);
    try {
      let readyDrafts = drafts.filter(d => d.text.trim());
      if (readyDrafts.length === 0) {
        const lines = await generateCaptions(slotCountForDates());
        readyDrafts = cardsFromLines(lines);
        setDrafts(readyDrafts);
        setShowPosts(true);
      }
      const cards: CampaignCard[] = readyDrafts
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
      const created: Campaign = {
        ...(body.campaign ?? {
          id: `pending-${Date.now()}`,
          name: brief.name.trim(),
          platform: mixed
            ? 'multi'
            : (cards[0]?.platform ?? channelList[0] ?? 'instagram'),
          status: 'draft',
        }),
        name: brief.name.trim(),
        description: brief.job.trim().slice(0, 1000),
        content: body.campaign?.content ?? serializeCampaignCards(cards),
        settings: {
          ...(startsAt ? { startsAt } : {}),
          ...(endsAt ? { endsAt } : {}),
          targetAudience: brief.audience.trim(),
        },
      };
      setCampaigns(prev => [created, ...prev.filter(c => c.id !== created.id)]);
      setOpenId(created.id);
      toast.success(
        'Campaign created. Captions are drafts for those dates — nothing was posted.'
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
      setFilling(false);
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
    () => visible.find(c => c.id === openId) ?? visible[0] ?? null,
    [visible, openId]
  );

  useEffect(() => {
    if (selected && selected.id !== openId) {
      setOpenId(selected.id);
    }
  }, [selected, openId]);

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
              Pick a scenario. Create campaign writes drafts for those dates.
              Nothing goes public.
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-white/50">Scenario</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CAMPAIGN_TEMPLATES.map(template => {
                const on = scenarioId === template.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyScenario(template.id)}
                    className={`text-left rounded-md border px-3 py-2.5 ${
                      on
                        ? 'border-orange-400/40 bg-orange-500/15'
                        : 'border-white/10 bg-white/3 hover:bg-white/6'
                    }`}
                  >
                    <p className="text-sm text-white">{template.label}</p>
                    <p className="mt-0.5 text-xs text-white/45">
                      {template.blurb}
                    </p>
                  </button>
                );
              })}
            </div>
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
            {saveError && (
              <p role="alert" className="w-full text-sm text-rose-200">
                {saveError}
              </p>
            )}
            <button
              type="button"
              onClick={() => void createCampaign()}
              disabled={saving || filling}
              className="h-10 px-4 text-sm rounded-md bg-orange-500 hover:bg-orange-400 text-slate-950 disabled:opacity-50"
            >
              {saving || filling
                ? 'Creating campaign and drafting captions…'
                : 'Create campaign'}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-50">
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
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(16rem,22rem)_1fr] gap-4 items-start">
          <ul className="space-y-2">
            {visible.map(campaign => {
              const cards = parseCampaignCards(campaign).filter(
                c => !skippedKeys[`${campaign.id}:${c.key}`] && !c.skipped
              );
              const health = campaignHealth(cards);
              const open = selected?.id === campaign.id;
              const preview = cards[0]?.text.replace(/\s+/g, ' ').slice(0, 96);
              return (
                <li key={campaign.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(campaign.id)}
                    className={`w-full text-left rounded-xl border p-4 transition-colors ${
                      open
                        ? 'border-orange-400/40 bg-orange-500/10'
                        : 'border-white/10 bg-white/5 hover:bg-white/8'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs uppercase tracking-[0.16em] text-white/35">
                        {platformLabel(campaign.platform)} ·{' '}
                        {windowLabel(campaign)}
                      </p>
                      <span className="text-xs capitalize text-white/45">
                        {campaign.status}
                      </span>
                    </div>
                    <h3 className="mt-1 text-lg font-light tracking-tight text-white">
                      {campaign.name}
                    </h3>
                    <p className="mt-1 text-sm text-white/50 line-clamp-2">
                      {preview || campaign.description || 'No captions yet'}
                    </p>
                    <p className="mt-2 text-xs text-white/35">
                      {health.total} posts · {health.bookedPercent}% booked
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
          {selected && (
            <article className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-6 space-y-5 min-h-96">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-white/35">
                    {platformLabel(selected.platform)} · {windowLabel(selected)}
                  </p>
                  <h2 className="mt-1 text-2xl font-light tracking-tight text-white">
                    {selected.name}
                  </h2>
                  {selected.description && (
                    <p className="mt-1 text-sm text-white/45">
                      {selected.description}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void duplicateCampaign(selected)}
                    className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-white"
                  >
                    <Copy className="h-3.5 w-3.5" /> Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => void setStatus(selected.id, 'paused')}
                    className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-white"
                  >
                    <Pause className="h-3.5 w-3.5" /> Pause
                  </button>
                  <button
                    type="button"
                    onClick={() => void setStatus(selected.id, 'archived')}
                    className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-white"
                  >
                    <Archive className="h-3.5 w-3.5" /> Archive
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeCampaign(selected.id)}
                    className="text-xs text-rose-300/80 hover:text-rose-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {(() => {
                const cards = parseCampaignCards(selected).filter(
                  c => !skippedKeys[`${selected.id}:${c.key}`] && !c.skipped
                );
                if (cards.length === 0) {
                  return (
                    <p className="text-sm text-white/40">
                      No posts in this campaign yet.{' '}
                      {FIRST_WEEK_GUIDANCE.campaigns.empty}
                    </p>
                  );
                }
                return (
                  <ol className="space-y-5">
                    {cards.map((card, index) => {
                      const editKey = `${selected.id}:${card.key}`;
                      const text = edits[editKey] ?? card.text;
                      const editing = editingKey === editKey;
                      return (
                        <li
                          key={card.key}
                          className="rounded-lg border border-white/10 bg-slate-950/30 p-4 space-y-3"
                        >
                          <p className="text-xs text-white/40">
                            Post {index + 1} · {platformLabel(card.platform)}
                            {card.status
                              ? ` · ${customerPostStatus(card.status)}`
                              : ' · Draft'}
                          </p>
                          {editing ? (
                            <textarea
                              value={text}
                              onChange={e =>
                                setEdits(prev => ({
                                  ...prev,
                                  [editKey]: e.target.value,
                                }))
                              }
                              rows={6}
                              className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-sm text-white"
                            />
                          ) : (
                            <FormattedCaption text={text} />
                          )}
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
                                  campaignId: selected.id,
                                })
                              }
                              className="text-sm text-orange-400 hover:text-orange-300"
                            >
                              Schedule
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setEditingKey(editing ? null : editKey)
                              }
                              className="text-sm text-white/40 hover:text-white/70"
                            >
                              {editing ? 'Done editing' : 'Edit'}
                            </button>
                            {editing && (
                              <button
                                type="button"
                                onClick={() => void saveOpenCards(selected)}
                                className="text-sm text-white/40 hover:text-white/70"
                              >
                                Save edits
                              </button>
                            )}
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
                              Open in Content
                            </Link>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                );
              })()}
            </article>
          )}
        </div>
      )}

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

function FormattedCaption({ text }: { text: string }) {
  const tokens = text.split(/(\s+)/);
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/85">
      {tokens.map((token, i) =>
        token.startsWith('#') ? (
          <span key={i} className="text-orange-300">
            {token}
          </span>
        ) : (
          token
        )
      )}
    </p>
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
