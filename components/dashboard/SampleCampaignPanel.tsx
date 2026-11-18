'use client';

/**
 * SYN-1217: shows the built-in sample campaign on Home while the workspace has
 * no posts of its own, so a new operator sees first campaign value without
 * connecting any social account.
 *
 * Read-only by design: no schedule, publish or save action exists here. The
 * operator can hide the sample; the choice is kept per organisation in this
 * browser and can be undone by clearing site data.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DashboardPanel } from './DashboardAtmosphere';
import {
  SAMPLE_CAMPAIGN,
  sampleCampaignDismissKey,
  shouldShowSampleCampaign,
} from '@/lib/onboarding/sample-campaign';

const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
};

function readDismissed(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

export function SampleCampaignPanel({
  organizationId,
  totalPosts,
  scheduledPosts,
}: {
  organizationId: string | null;
  totalPosts: number;
  scheduledPosts: number;
}) {
  const key = sampleCampaignDismissKey(organizationId);
  // The choice is stored with the key it was read for. Until this
  // organisation's choice is read (first load, or just after switching
  // organisation) the panel stays hidden, so a hidden sample never flashes.
  const [choice, setChoice] = useState<{
    key: string;
    dismissed: boolean;
  } | null>(null);
  const dismissed = choice?.key === key ? choice.dismissed : null;

  useEffect(() => {
    setChoice({ key, dismissed: readDismissed(key) });
  }, [key]);

  if (
    dismissed === null ||
    !shouldShowSampleCampaign({ totalPosts, scheduledPosts, dismissed })
  ) {
    return null;
  }

  const hide = () => {
    try {
      window.localStorage.setItem(key, 'true');
    } catch {
      // Storage blocked: still hide for this visit.
    }
    setChoice({ key, dismissed: true });
  };

  return (
    <DashboardPanel>
      <section
        aria-labelledby="sample-campaign-heading"
        data-sample="true"
        className="space-y-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <span className="inline-flex items-center rounded-sm border-[0.5px] border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium uppercase tracking-[0.18em] text-amber-200">
              Sample only, not posted anywhere
            </span>
            <h2
              id="sample-campaign-heading"
              className="text-lg font-light text-white tracking-tight"
            >
              {SAMPLE_CAMPAIGN.name}
            </h2>
            <p className="text-sm text-white/45 leading-relaxed">
              This is what a finished week looks like in Synthex. The business,{' '}
              {SAMPLE_CAMPAIGN.businessName}, and every post are invented. No
              account is needed to read it, and nothing here can be scheduled or
              sent.
            </p>
          </div>
          <button
            type="button"
            onClick={hide}
            className="shrink-0 text-xs text-white/50 hover:text-white/80 border-[0.5px] border-white/10 hover:border-white/20 rounded-sm px-3 py-1.5 transition-colors"
          >
            Hide sample
          </button>
        </div>

        <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-[0.18em] text-white/35">
              Goal
            </dt>
            <dd className="text-white/70 font-light">{SAMPLE_CAMPAIGN.goal}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.18em] text-white/35">
              Audience
            </dt>
            <dd className="text-white/70 font-light">
              {SAMPLE_CAMPAIGN.audience}
            </dd>
          </div>
        </dl>

        <ol className="space-y-2">
          {SAMPLE_CAMPAIGN.posts.map(p => (
            <li
              key={p.id}
              data-sample="true"
              className="rounded-sm border-[0.5px] border-dashed border-white/10 bg-white/2 px-3 py-2.5"
            >
              <p className="text-xs text-white/40">
                Day {p.day} · {PLATFORM_LABEL[p.platform] ?? p.platform}
              </p>
              <p className="text-sm text-white/80">{p.title}</p>
              <p className="text-sm text-white/50 font-light">{p.body}</p>
            </li>
          ))}
        </ol>

        <Link
          href="/dashboard/content"
          className="inline-flex w-fit text-sm text-orange-400/90 hover:text-orange-400 transition-colors"
        >
          Write your own first post
        </Link>
      </section>
    </DashboardPanel>
  );
}
