'use client';

/**
 * Campaigns — a named set of posts the user still approves and schedules.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Megaphone, Plus, Loader2, AlertCircle, X } from '@/components/icons';
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
import { toast } from 'sonner';

interface CampaignPostSummary {
  id: string;
  content?: string | null;
  status: string;
  platform: string;
}

interface Campaign {
  id: string;
  name: string;
  platform: string;
  content?: unknown;
  status: string;
  createdAt?: string;
  posts?: CampaignPostSummary[];
  settings?: { startsAt?: string; endsAt?: string };
}

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'twitter', label: 'Twitter / X' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'threads', label: 'Threads' },
] as const;

function platformLabel(p: string): string {
  return PLATFORMS.find(x => x.id === p)?.label ?? p;
}

export default function CampaignsPage() {
  const { activeOrganizationId } = useActiveBusiness();
  const { profile } = useBrandProfile(activeOrganizationId);
  const hasBrand = Boolean(profile?.name?.trim());

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [name, setName] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [cardOne, setCardOne] = useState('');
  const [cardTwo, setCardTwo] = useState('');
  const [skipTwo, setSkipTwo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filling, setFilling] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [skippedKeys, setSkippedKeys] = useState<Record<string, boolean>>({});
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

  const emptyComposer = !name.trim() || !cardOne.trim();

  async function fillCards() {
    setFilling(true);
    try {
      const topic = name.trim() || 'this week for our customers';
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
          includeCTA: false,
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
      setCardOne(primary);
      setCardTwo(second);
    } catch (err) {
      toast.error(
        humanizeAiError(err instanceof Error ? err.message : undefined)
      );
    } finally {
      setFilling(false);
    }
  }

  async function createCampaign() {
    if (emptyComposer) {
      toast.error('Name the campaign and write at least one post.');
      return;
    }
    setSaving(true);
    try {
      const cards: CampaignCard[] = [
        { key: '1', text: cardOne.trim(), platform },
      ];
      if (!skipTwo && cardTwo.trim()) {
        cards.push({ key: '2', text: cardTwo.trim(), platform });
      }
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          platform,
          content: serializeCampaignCards(cards),
          settings: {
            ...(startsAt ? { startsAt } : {}),
            ...(endsAt ? { endsAt } : {}),
          },
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          body.error ?? `Could not create campaign (${res.status})`
        );
      }
      toast.success('Campaign saved. Schedule each post when you are happy.');
      setComposerOpen(false);
      setName('');
      setCardOne('');
      setCardTwo('');
      setSkipTwo(false);
      setStartsAt('');
      setEndsAt('');
      await loadCampaigns();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  const selected = useMemo(
    () => campaigns.find(c => c.id === openId) ?? null,
    [campaigns, openId]
  );

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-white/30 mb-1">
            Marketing
          </p>
          <h1 className="text-3xl font-light text-white leading-none">
            Campaigns
          </h1>
          <p className="text-sm text-white/40 mt-1.5 max-w-lg">
            A campaign is a named set of posts with dates. You still edit and
            schedule each one — nothing goes out from this page on its own.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setComposerOpen(o => !o)}
          className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-medium rounded-sm bg-orange-500 hover:bg-orange-400 text-surface-dark transition-colors shrink-0"
        >
          {composerOpen ? (
            <>
              <X className="h-4 w-4" /> Close
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" /> New campaign
            </>
          )}
        </button>
      </div>

      {composerOpen && (
        <div className="space-y-4 border-[0.5px] border-white/8 bg-white/1 rounded-sm p-5">
          {!hasBrand && (
            <p className="text-xs text-white/45">
              We&apos;ll use your setup as it is. Finish Brand DNA in Settings
              if the voice feels generic.
            </p>
          )}
          <label className="block space-y-1">
            <span className="text-xs text-white/50">Name</span>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Opening week"
              className="w-full h-9 px-3 rounded-sm bg-white/3 border-[0.5px] border-white/10 text-sm text-white"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1">
              <span className="text-xs text-white/50">Starts (optional)</span>
              <input
                type="date"
                value={startsAt}
                onChange={e => setStartsAt(e.target.value)}
                className="w-full h-9 px-3 rounded-sm bg-white/3 border-[0.5px] border-white/10 text-sm text-white"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-white/50">Ends (optional)</span>
              <input
                type="date"
                value={endsAt}
                onChange={e => setEndsAt(e.target.value)}
                className="w-full h-9 px-3 rounded-sm bg-white/3 border-[0.5px] border-white/10 text-sm text-white"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-white/50">Platform</span>
              <select
                value={platform}
                onChange={e => setPlatform(e.target.value)}
                className="w-full h-9 px-3 rounded-sm bg-white/3 border-[0.5px] border-white/10 text-sm text-white"
              >
                {PLATFORMS.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs text-white/50">Post 1</span>
              <textarea
                value={cardOne}
                onChange={e => setCardOne(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 rounded-sm bg-white/3 border-[0.5px] border-white/10 text-sm text-white"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-white/50">Post 2</span>
              <textarea
                value={skipTwo ? '' : cardTwo}
                onChange={e => setCardTwo(e.target.value)}
                disabled={skipTwo}
                rows={5}
                className="w-full px-3 py-2 rounded-sm bg-white/3 border-[0.5px] border-white/10 text-sm text-white disabled:opacity-40"
              />
              <button
                type="button"
                onClick={() => setSkipTwo(s => !s)}
                className="text-xs text-white/40 hover:text-white/70"
              >
                {skipTwo ? 'Use a second post' : "Don't use post 2"}
              </button>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void fillCards()}
              disabled={filling}
              className="h-9 px-3 text-sm rounded-sm border-[0.5px] border-white/10 text-white/70 hover:bg-white/3"
            >
              {filling ? 'Filling cards…' : 'Fill cards with AI'}
            </button>
            <button
              type="button"
              onClick={() => void createCampaign()}
              disabled={saving || emptyComposer}
              className="h-9 px-4 text-sm rounded-sm bg-orange-500 hover:bg-orange-400 text-surface-dark disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save campaign'}
            </button>
          </div>
        </div>
      )}

      <section className="space-y-4">
        <p className="text-xs uppercase tracking-[0.22em] text-white/30">
          Your campaigns
        </p>

        {loading ? (
          <div
            role="status"
            className="flex items-center gap-2 text-sm text-white/45 py-8"
          >
            <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
            Loading campaigns…
          </div>
        ) : error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-sm border-[0.5px] border-red-400/25 bg-red-500/10 p-4 text-sm text-red-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-2">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => void loadCampaigns()}
                className="rounded-sm border-[0.5px] border-white/10 px-3 py-1 text-xs text-white/70 hover:bg-white/3"
              >
                Retry
              </button>
            </div>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="border-[0.5px] border-dashed border-white/8 bg-white/1 rounded-sm p-12 text-center">
            <Megaphone className="mx-auto h-8 w-8 text-white/15" />
            <h3 className="mt-4 text-sm font-medium text-white/75">
              No campaigns yet
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-xs text-white/40">
              Name a run of posts, write two cards, then schedule each one. You
              stay in control.
            </p>
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="mt-5 inline-flex items-center gap-1.5 rounded-sm bg-orange-500 px-4 py-2 text-sm font-medium text-surface-dark hover:bg-orange-400"
            >
              <Plus className="h-4 w-4" /> New campaign
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {campaigns.map(campaign => {
              const cards = parseCampaignCards(campaign).filter(
                c => !skippedKeys[`${campaign.id}:${c.key}`] && !c.skipped
              );
              const open = openId === campaign.id;
              return (
                <li
                  key={campaign.id}
                  className="border-[0.5px] border-white/6 bg-white/1.5 rounded-sm"
                >
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : campaign.id)}
                    className="w-full text-left px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-medium text-white/85">
                        {campaign.name}
                      </h3>
                      <span className="text-xs text-white/35">
                        {platformLabel(campaign.platform)} · {cards.length} post
                        {cards.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  </button>
                  {open && (
                    <div className="px-4 pb-4 space-y-3">
                      {cards.length === 0 ? (
                        <p className="text-xs text-white/40">
                          No posts in this campaign yet.
                        </p>
                      ) : (
                        cards.map(card => {
                          const editKey = `${campaign.id}:${card.key}`;
                          const text = edits[editKey] ?? card.text;
                          return (
                            <div
                              key={card.key}
                              className="border-[0.5px] border-white/8 rounded-sm p-3 space-y-2"
                            >
                              <div className="flex justify-between gap-2">
                                <span className="text-xs text-white/40">
                                  {platformLabel(card.platform)}
                                  {card.status
                                    ? ` · ${customerPostStatus(card.status)}`
                                    : ' · Draft'}
                                </span>
                              </div>
                              <textarea
                                value={text}
                                onChange={e =>
                                  setEdits(prev => ({
                                    ...prev,
                                    [editKey]: e.target.value,
                                  }))
                                }
                                rows={4}
                                className="w-full px-3 py-2 rounded-sm bg-white/3 border-[0.5px] border-white/10 text-sm text-white"
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
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

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
