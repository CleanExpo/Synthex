'use client';

/**
 * /welcome — Collaborator context screen (first login only)
 *
 * Shown to invited collaborators on their first visit after accepting an invite.
 * Displays: business context, Brand IQ score, latest Monthly Story summary,
 * and upcoming 7 days of scheduled content.
 *
 * Subsequent logins skip this page and go directly to the dashboard.
 *
 * @task SYN-598
 */

import useSWR from 'swr';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { fireTeamEvent } from '@/lib/analytics/team-events';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

interface UpcomingPost {
  id: string;
  platform: string;
  scheduledAt: string;
  status: string;
}

interface CollaboratorContext {
  isFirstVisit: boolean;
  shouldFireWeeklyActive: boolean;
  organizationName: string;
  ownerName: string;
  brandIq: number | null;
  latestStory: {
    monthYear: string;
    storyText: string;
    totalReach: number;
    postsPublished: number;
  } | null;
  upcomingPosts: UpcomingPost[];
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  twitter: 'X (Twitter)',
  tiktok: 'TikTok',
  youtube: 'YouTube',
};

function BrandIqExplainer({ score }: { score: number }) {
  const level =
    score >= 70 ? 'strong' : score >= 40 ? 'building' : 'early stage';
  const colour =
    score >= 70
      ? 'text-emerald-400'
      : score >= 40
        ? 'text-amber-400'
        : 'text-gray-400';

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
        Brand IQ Score
      </p>
      <p className={`text-4xl font-extrabold ${colour} mb-1`}>{score}<span className="text-lg text-gray-500">/100</span></p>
      <p className="text-sm text-gray-400">
        {`${score >= 70 ? 'Their' : 'Their'} marketing authority is ${level} — this score measures GBP completeness, review velocity, content freshness, and AI citation signals.`}
      </p>
    </div>
  );
}

export default function WelcomePage() {
  const router = useRouter();
  const eventFired = useRef(false);

  const { data, error, isLoading } = useSWR<CollaboratorContext>(
    '/api/collaborator/context',
    fetchJson
  );

  // If not first visit, skip to dashboard
  useEffect(() => {
    if (data && !data.isFirstVisit) {
      router.replace('/dashboard');
    }
  }, [data, router]);

  // Fire team_viewer_first_login once (on first visit only)
  useEffect(() => {
    if (data?.isFirstVisit && !eventFired.current) {
      eventFired.current = true;
      fireTeamEvent('team_viewer_first_login' as never);
    }
  }, [data]);

  // Fire team_viewer_weekly_active when server signals deduplication window has elapsed
  useEffect(() => {
    if (data?.shouldFireWeeklyActive) {
      fireTeamEvent('team_viewer_weekly_active' as never);
    }
  }, [data?.shouldFireWeeklyActive]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <p className="text-red-400 text-sm">Unable to load your dashboard. Please try again.</p>
      </div>
    );
  }

  const { organizationName, ownerName, brandIq, latestStory, upcomingPosts } = data;

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">
            {ownerName} invited you to view {organizationName}'s marketing on Synthex
          </h1>
          <p className="text-sm text-gray-400 mt-2">
            Here's a snapshot of where things stand. You have read access to the full dashboard.
          </p>
        </div>

        {/* Brand IQ */}
        {brandIq !== null && <BrandIqExplainer score={brandIq} />}

        {/* Latest Monthly Story */}
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Last Monthly Story
          </p>
          {latestStory ? (
            <>
              <p className="text-sm text-gray-300 leading-relaxed line-clamp-4">
                {latestStory.storyText}
              </p>
              <div className="flex gap-4 mt-3">
                <span className="text-xs text-gray-500">
                  {latestStory.postsPublished} posts · {latestStory.totalReach.toLocaleString('en-AU')} reach
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">
              First story generating at end of month — check back soon.
            </p>
          )}
        </div>

        {/* Upcoming 7 days */}
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Scheduled This Week
          </p>
          {upcomingPosts.length > 0 ? (
            <div className="space-y-2">
              {upcomingPosts.map(post => (
                <div
                  key={post.id}
                  className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0"
                >
                  <div>
                    <p className="text-sm text-white font-medium">
                      {PLATFORM_LABELS[post.platform] ?? post.platform}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(post.scheduledAt).toLocaleDateString('en-AU', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-400 capitalize">
                    {post.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No posts scheduled for the next 7 days.</p>
          )}
        </div>

        {/* CTA to dashboard */}
        <div className="pt-2">
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full bg-white text-gray-900 font-semibold py-3 rounded-lg text-sm hover:bg-gray-100 transition-colors"
          >
            Go to dashboard →
          </button>
        </div>

      </div>
    </div>
  );
}
