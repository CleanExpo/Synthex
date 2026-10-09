'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/page-header';
import { GetStartedChecklist } from '@/components/dashboard/get-started-checklist';
import { WelcomeCard } from '@/components/dashboard/WelcomeCard';
import type { DashboardStats } from '@/components/dashboard/types';
import { DashboardAtmosphere, DashboardPanel } from './DashboardAtmosphere';
import { useMemo } from 'react';
import { useBrandProfile } from '@/hooks/use-brand-profile';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { FIRST_WEEK_GUIDANCE } from '@/lib/dashboard/first-week-guidance';
import { pickNeedsYouItems } from '@/lib/dashboard/needs-you';
import useSWR from 'swr';

interface DashboardThisWeekHomeProps {
  stats: DashboardStats | null;
}

function HomeCard({
  eyebrow,
  title,
  body,
  href,
  cta,
  warn,
}: {
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  warn?: boolean;
}) {
  return (
    <DashboardPanel className="flex flex-col justify-between min-h-44">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-white/35">
          {eyebrow}
        </p>
        <h2 className="text-lg font-light text-white tracking-tight">
          {title}
        </h2>
        <p
          className={
            warn
              ? 'text-sm text-amber-200/80 leading-relaxed'
              : 'text-sm text-white/45 leading-relaxed'
          }
        >
          {body}
        </p>
      </div>
      <Link
        href={href}
        className="mt-5 inline-flex w-fit text-sm text-orange-400/90 hover:text-orange-400 transition-colors"
      >
        {cta}
      </Link>
    </DashboardPanel>
  );
}

/** One home for new and returning users — connect, write, this week, results. */
export function DashboardThisWeekHome({ stats }: DashboardThisWeekHomeProps) {
  const { activeOrganizationId } = useActiveBusiness();
  const { profile } = useBrandProfile(activeOrganizationId);

  const businessLabel = profile?.name?.trim() || null;
  const connected = stats?.connectedPlatforms ?? 0;
  const scheduled = stats?.scheduledPosts ?? 0;
  const posted = stats?.totalPosts ?? 0;
  const isFirstWeek = posted === 0 && scheduled === 0;

  const needsYouKey = useMemo(() => {
    if (!activeOrganizationId) return null;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 14);
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() + 14);
    return `/api/content/calendar?organizationId=${encodeURIComponent(
      activeOrganizationId
    )}&startDate=${encodeURIComponent(start.toISOString())}&endDate=${encodeURIComponent(
      end.toISOString()
    )}`;
  }, [activeOrganizationId]);

  const { data: calendarPayload } = useSWR(needsYouKey, async (url: string) => {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) return { posts: [] as Array<Record<string, unknown>> };
    const body = (await res.json()) as {
      calendar?: { posts?: Array<Record<string, unknown>> };
    };
    return { posts: body.calendar?.posts ?? [] };
  });

  const needsYou = pickNeedsYouItems(
    (calendarPayload?.posts ?? []).map(post => ({
      id: String(post.id ?? ''),
      title: typeof post.title === 'string' ? post.title : null,
      content: typeof post.content === 'string' ? post.content : null,
      status: typeof post.status === 'string' ? post.status : null,
      approvalStatus:
        typeof post.approvalStatus === 'string' ? post.approvalStatus : null,
    }))
  );

  return (
    <DashboardAtmosphere className="w-full max-w-none space-y-8 pt-2">
      <PageHeader
        className="w-full"
        eyebrow="This week"
        title={
          businessLabel
            ? `${businessLabel} — your week`
            : 'Your week in Synthex'
        }
        description={
          isFirstWeek
            ? FIRST_WEEK_GUIDANCE.home.empty
            : 'Write, check what is booked, and see what already went out. You stay in control of every post.'
        }
        actions={
          <Link
            href="/dashboard/content"
            className="inline-flex items-center bg-orange-500 hover:bg-orange-400 text-black font-medium text-sm py-2.5 px-5 rounded-sm transition-colors"
          >
            {posted === 0 ? 'Write your first post' : 'Write a post'}
          </Link>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <HomeCard
          eyebrow="Connect"
          title={
            connected === 0 ? 'No accounts ready' : `${connected} ready to post`
          }
          body={
            connected === 0
              ? 'No channel is ready. Connect one — Ready looks like a green check. You can still write drafts.'
              : 'Ready accounts can go live. Review any that expired. Drafting never requires a connection.'
          }
          href="/dashboard/platforms"
          cta={connected === 0 ? 'Connect an account' : 'Review platforms'}
          warn={connected === 0}
        />
        <HomeCard
          eyebrow="Write"
          title="Draft this week’s post"
          body="Type what happened. We suggest words. You edit. Nothing is public until you schedule or post."
          href="/dashboard/content"
          cta="Open Content"
        />
        <HomeCard
          eyebrow="This week"
          title={
            scheduled === 0 ? 'Nothing booked yet' : `${scheduled} scheduled`
          }
          body={
            scheduled === 0
              ? 'Schedule from a draft when you are happy with it. You will see it on the calendar.'
              : 'These go out at the times you picked — only if posting is set to live.'
          }
          href="/dashboard/calendar"
          cta="Open Calendar"
        />
        <HomeCard
          eyebrow="How it did"
          title={posted === 0 ? 'No posts yet' : `${posted} posts so far`}
          body={
            posted === 0
              ? FIRST_WEEK_GUIDANCE.analytics.empty
              : 'See reach and what to try next after posts have gone out.'
          }
          href="/dashboard/analytics"
          cta="Open Analytics"
        />
      </div>

      {needsYou.length > 0 && (
        <div className="rounded-sm border-[0.5px] border-amber-400/25 bg-amber-500/10 px-4 py-3">
          <p className="text-sm font-medium text-amber-100">Needs you</p>
          <p className="mt-1 text-xs text-amber-100/70">
            These did not go out, or they are waiting for you. Fix them on
            Calendar — nothing new sends from here.
          </p>
          <ul className="mt-2 space-y-1.5">
            {needsYou.map(item => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-sm text-white/70 truncate">
                  {item.label}
                </span>
                <span className="shrink-0 text-xs text-white/40">
                  {item.reason === 'failed' ? 'Failed' : 'Waiting'}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/dashboard/calendar"
            className="mt-2 inline-block text-xs text-orange-400/90 hover:text-orange-400"
          >
            Fix on Calendar
          </Link>
        </div>
      )}

      <WelcomeCard
        connectedPlatforms={connected}
        totalPosts={posted}
        scheduledPosts={scheduled}
      />

      {isFirstWeek && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-12 min-w-0">
            <GetStartedChecklist />
          </div>
        </div>
      )}
    </DashboardAtmosphere>
  );
}
