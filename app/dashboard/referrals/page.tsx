'use client';

/**
 * /dashboard/referrals
 *
 * Referral program dashboard — tracks referred users, earnings, and link performance.
 * Wired to /api/dashboard/referrals via SWR.
 */

import useSWR from 'swr';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Copy, Users, DollarSign, TrendingUp, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ReferralUser {
  id: string;
  email: string;
  joinedAt: string;
  status: 'pending' | 'active' | 'converted';
  earnings: number;
}

interface ReferralsData {
  referralCode: string;
  referralUrl: string;
  stats: {
    totalReferred: number;
    activeUsers: number;
    totalEarnings: number;
    pendingEarnings: number;
    conversionRate: number;
  };
  referrals: ReferralUser[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetcher
// ─────────────────────────────────────────────────────────────────────────────

async function fetcher(url: string): Promise<ReferralsData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load referrals (${res.status})`);
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<ReferralUser['status'], string> = {
  pending: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10',
  active: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
  converted: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
};

export default function ReferralsPage() {
  const { data, error, isLoading } = useSWR<ReferralsData>(
    '/api/dashboard/referrals',
    fetcher,
    { refreshInterval: 30_000 }
  );
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!data?.referralUrl) return;
    navigator.clipboard.writeText(data.referralUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="border-b border-white/[0.06] pb-6">
          <div className="h-4 w-32 bg-white/[0.05] rounded-sm mb-3" />
          <div className="h-8 w-48 bg-white/[0.05] rounded-sm" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
              <div className="h-4 w-20 bg-white/[0.05] rounded-sm mb-2" />
              <div className="h-6 w-24 bg-white/[0.05] rounded-sm" />
            </div>
          ))}
        </div>
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border-b border-white/[0.06] p-4">
              <div className="h-4 w-40 bg-white/[0.05] rounded-sm mb-2" />
              <div className="h-3 w-32 bg-white/[0.05] rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="border-red-500/30 bg-red-500/10">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load referrals. {error.message}</AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-white/[0.06] pb-6">
        <p className="text-xs uppercase tracking-widest text-white/40 mb-2">Growth</p>
        <h1 className="text-2xl font-semibold text-white">Referral Program</h1>
      </div>

      {/* Referral link */}
      <div className="border-[0.5px] border-amber-500/20 bg-amber-500/5 rounded-sm p-4">
        <p className="text-xs text-amber-400/70 mb-2 uppercase tracking-wider">Your referral link</p>
        <div className="flex items-center gap-3">
          <code className="flex-1 text-sm text-white/80 bg-white/[0.04] rounded-sm px-3 py-2 truncate font-mono">
            {data.referralUrl}
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 flex-shrink-0"
          >
            {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span className="ml-2">{copied ? 'Copied!' : 'Copy'}</span>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-white/30" />
            <p className="text-xs text-white/40">Total Referred</p>
          </div>
          <p className="text-2xl font-semibold text-white">{data.stats.totalReferred}</p>
        </div>
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-emerald-400/50" />
            <p className="text-xs text-white/40">Active Users</p>
          </div>
          <p className="text-2xl font-semibold text-emerald-400">{data.stats.activeUsers}</p>
        </div>
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-amber-400/50" />
            <p className="text-xs text-white/40">Total Earnings</p>
          </div>
          <p className="text-2xl font-semibold text-amber-400">
            ${data.stats.totalEarnings.toFixed(2)}
          </p>
        </div>
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-white/30" />
            <p className="text-xs text-white/40">Conversion Rate</p>
          </div>
          <p className="text-2xl font-semibold text-white">
            {data.stats.conversionRate.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Referral table */}
      <div className="border-[0.5px] border-white/[0.06] rounded-sm overflow-hidden">
        <div className="border-b border-white/[0.06] p-4">
          <h2 className="text-sm font-medium text-white">Referred Users</h2>
        </div>
        {data.referrals.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-white/30">No referrals yet. Share your link to get started.</p>
          </div>
        ) : (
          data.referrals.map((ref) => (
            <div key={ref.id} className="border-b border-white/[0.04] p-4 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
              <div>
                <p className="text-sm text-white/80">{ref.email}</p>
                <p className="text-xs text-white/30 mt-0.5">
                  Joined {new Date(ref.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {ref.earnings > 0 && (
                  <span className="text-sm text-amber-400">${ref.earnings.toFixed(2)}</span>
                )}
                <Badge
                  variant="outline"
                  className={`text-[10px] px-2 py-0 ${STATUS_STYLES[ref.status]}`}
                >
                  {ref.status}
                </Badge>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
