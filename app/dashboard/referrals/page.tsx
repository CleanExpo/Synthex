'use client';

/**
 * Referral Program Dashboard (Phase 5B — SYN-430)
 *
 * Displays the user's referral code, share links, stats, and progress
 * towards the next reward milestone.
 *
 * URL: /dashboard/referrals
 */

import { useState } from 'react';
import useSWR from 'swr';
import { Gift, Users, TrendingUp, Award, Loader2 } from '@/components/icons';
import { fetchJson } from '@/lib/fetcher';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReferralEntry {
  id: string;
  code: string;
  refereeEmail: string;
  status: string;
  referrerRewarded: boolean;
  rewardType: string | null;
  rewardAmount: number | null;
  createdAt: string;
  signedUpAt: string | null;
  convertedAt: string | null;
}

interface ReferralStats {
  totalSent: number;
  signedUp: number;
  converted: number;
  rewardsEarned: number;
}

interface ReferralData {
  success: boolean;
  referralCode: string;
  referralLink: string;
  referrals: ReferralEntry[];
  stats: ReferralStats;
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 flex items-start gap-4">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
        <Icon className="w-5 h-5 text-orange-400" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
        <p className="text-xs font-medium text-slate-300 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-white/5 ${className ?? ''}`} />
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-20 w-full" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReferralsPage() {
  const { data, error, isLoading, mutate } = useSWR<ReferralData>(
    '/api/referrals',
    fetchJson,
    { revalidateOnFocus: false }
  );

  const [copied, setCopied] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  const handleCopy = async () => {
    if (!data?.referralLink) return;
    try {
      await navigator.clipboard.writeText(data.referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    setInviteError('');
    setInviteSuccess('');
    try {
      const res = await fetch('/api/referrals', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail }),
      });
      const json = await res.json();
      if (!res.ok) {
        setInviteError(
          json.error || 'Failed to send invite. Please try again.'
        );
      } else {
        setInviteSuccess(`Invite sent to ${inviteEmail}!`);
        setInviteEmail('');
        mutate();
      }
    } catch {
      setInviteError('Network error. Please try again.');
    } finally {
      setInviting(false);
    }
  };

  // ── Render states ───────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <PageSkeleton />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-8 text-center space-y-4">
          <Gift className="w-10 h-10 text-slate-500 mx-auto" />
          <p className="text-slate-300 text-sm">
            Could not load referral data. Please try again.
          </p>
          <button
            onClick={() => mutate()}
            className="px-4 py-2 text-xs rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { referralCode, referralLink, stats } = data;
  const REWARD_THRESHOLD = 3;
  const progressCount = Math.min(stats.converted, REWARD_THRESHOLD);
  const progressPct = Math.round((progressCount / REWARD_THRESHOLD) * 100);

  const encodedLink = encodeURIComponent(referralLink);
  const encodedText = encodeURIComponent(
    `I use SYNTHEX for AI-powered marketing automation — it's been a game changer. Join with my link and get 500 bonus AI credits:`
  );
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedLink}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedLink}`;
  const emailUrl = `mailto:?subject=${encodeURIComponent('Join me on SYNTHEX')}&body=${encodeURIComponent(
    `Hi,\n\nI've been using SYNTHEX for AI-powered marketing automation and thought you'd find it useful.\n\nSign up with my referral link to get 500 bonus AI credits:\n${referralLink}\n\nCheers`
  )}`;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Gift className="w-7 h-7 text-orange-400" />
          Refer &amp; Earn
        </h1>
        <p className="text-slate-300 text-sm mt-1">
          Invite businesses to SYNTHEX — you both receive 500 bonus AI credits
          when they convert.
        </p>
      </div>

      {/* Referral link card */}
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 space-y-3">
        <p className="text-xs font-medium text-slate-300 uppercase tracking-wider">
          Your referral link
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 font-mono text-sm text-orange-300 bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 truncate">
            {referralLink}
          </div>
          <button
            onClick={handleCopy}
            className={`flex-shrink-0 px-4 py-2.5 rounded-lg text-xs font-medium border transition-all ${
              copied
                ? 'bg-green-500/20 border-green-500/30 text-green-400'
                : 'bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/20'
            }`}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Your code:{' '}
          <span className="font-mono text-slate-300">{referralCode}</span>
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={Users}
          label="Invited"
          value={stats.totalSent}
          sub="total referrals sent"
        />
        <StatCard
          icon={TrendingUp}
          label="Signed Up"
          value={stats.signedUp}
          sub="referrals who joined"
        />
        <StatCard
          icon={Award}
          label="Converted"
          value={stats.converted}
          sub="subscribed & rewarded"
        />
      </div>

      {/* Progress to next reward */}
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-white">
            Progress to next reward
          </p>
          <span className="text-xs text-slate-300 tabular-nums">
            {progressCount} / {REWARD_THRESHOLD} conversions
          </span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {stats.rewardsEarned > 0 && (
          <p className="text-xs text-orange-400">
            You&apos;ve earned{' '}
            <span className="font-semibold">
              {stats.rewardsEarned.toLocaleString()} AI credits
            </span>{' '}
            so far — keep going!
          </p>
        )}
        {stats.rewardsEarned === 0 && (
          <p className="text-xs text-slate-500">
            Refer {REWARD_THRESHOLD - progressCount} more business
            {REWARD_THRESHOLD - progressCount === 1 ? '' : 'es'} to unlock your
            first 500 AI credits.
          </p>
        )}
      </div>

      {/* Invite by email */}
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 space-y-3">
        <p className="text-sm font-medium text-white">Invite by email</p>
        <form onSubmit={handleInvite} className="flex items-center gap-2">
          <input
            type="email"
            placeholder="colleague@example.com"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            required
            className="flex-1 min-w-0 text-sm bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500/40 transition-colors"
          />
          <button
            type="submit"
            disabled={inviting}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {inviting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {inviting ? 'Sending…' : 'Send Invite'}
          </button>
        </form>
        {inviteError && <p className="text-xs text-red-400">{inviteError}</p>}
        {inviteSuccess && (
          <p className="text-xs text-green-400">{inviteSuccess}</p>
        )}
      </div>

      {/* Share buttons */}
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 space-y-3">
        <p className="text-sm font-medium text-white">Share via</p>
        <div className="flex flex-wrap gap-3">
          <a
            href={linkedInUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium bg-[#0A66C2]/20 border border-[#0A66C2]/30 text-[#70a8e2] hover:bg-[#0A66C2]/30 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M20.447 20.452H17.21v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.991V9h3.104v1.563h.045c.432-.82 1.487-1.684 3.061-1.684 3.271 0 3.874 2.153 3.874 4.953v6.62zM5.337 7.433a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6zm1.554 13.019H3.784V9h3.107v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            LinkedIn
          </a>
          <a
            href={twitterUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium bg-black/40 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.264 5.633L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
            </svg>
            Twitter / X
          </a>
          <a
            href={emailUrl}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            Email
          </a>
        </div>
      </div>

      {/* Referral history */}
      {data.referrals.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 space-y-3">
          <p className="text-sm font-medium text-white">Referral history</p>
          <div className="space-y-2">
            {data.referrals.map(r => (
              <div
                key={r.id}
                className="flex items-center justify-between py-2 border-b border-white/[0.05] last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">
                    {r.refereeEmail}
                  </p>
                  <p className="text-xs text-slate-500 font-mono">{r.code}</p>
                </div>
                <span
                  className={`flex-shrink-0 ml-4 text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    r.status === 'converted'
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : r.status === 'signed_up'
                        ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                        : r.status === 'clicked'
                          ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                          : 'bg-white/5 text-slate-500 border border-white/10'
                  }`}
                >
                  {r.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
