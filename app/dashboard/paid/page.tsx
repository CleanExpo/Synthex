'use client';

import { useState } from 'react';
import useSWR from 'swr';

interface AdSnapshot {
  id: string;
  dateStart: string;
  dateEnd: string;
  impressions: number | null;
  clicks: number | null;
  spend: string | null;
  conversions: string | null;
  revenue: string | null;
  roas: string | null;
  ctr: string | null;
  cpc: string | null;
  campaignId: string | null;
  campaignName: string | null;
}

interface AdAccount {
  id: string;
  platform: string;
  name: string;
  currencyCode: string;
  snapshots: AdSnapshot[];
}

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

const PLATFORM_LABELS: Record<string, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
};

function fmt(n: string | number | null, prefix = ''): string {
  if (n == null) return '—';
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return '—';
  return `${prefix}${num.toLocaleString('en-AU', { maximumFractionDigits: 2 })}`;
}

function AccountCard({ account }: { account: AdAccount }) {
  const totals = account.snapshots.reduce(
    (acc, s) => ({
      impressions: acc.impressions + (s.impressions ?? 0),
      clicks: acc.clicks + (s.clicks ?? 0),
      spend: acc.spend + parseFloat(s.spend ?? '0'),
      conversions: acc.conversions + parseFloat(s.conversions ?? '0'),
      revenue: acc.revenue + parseFloat(s.revenue ?? '0'),
    }),
    { impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0 }
  );

  const roas =
    totals.spend > 0 ? (totals.revenue / totals.spend).toFixed(2) : null;

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            {PLATFORM_LABELS[account.platform] ?? account.platform}
          </p>
          <h3 className="font-semibold text-foreground">{account.name}</h3>
        </div>
        <span className="text-xs bg-muted px-2 py-1 rounded-full">
          {account.currencyCode}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 pt-2">
        <Stat label="Impressions" value={fmt(totals.impressions)} />
        <Stat label="Clicks" value={fmt(totals.clicks)} />
        <Stat label="Spend" value={fmt(totals.spend, '$')} />
        <Stat label="Conversions" value={fmt(totals.conversions)} />
        <Stat label="Revenue" value={fmt(totals.revenue, '$')} />
        <Stat label="ROAS" value={roas ? `${roas}x` : '—'} />
      </div>

      {account.snapshots.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No data for this period. Connect your ad account to start syncing.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default function PaidAdsPage() {
  const [days, setDays] = useState(30);
  const [platform, setPlatform] = useState<string>('');

  const params = new URLSearchParams({ days: String(days) });
  if (platform) params.set('platform', platform);

  const { data, error, isLoading } = useSWR<{ accounts: AdAccount[] }>(
    `/api/paid-ads?${params}`,
    fetcher
  );

  const accounts = data?.accounts ?? [];

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Paid Advertising</h1>
          <p className="text-muted-foreground text-sm">
            Performance across Google Ads and Meta Ads accounts
          </p>
        </div>

        <div className="flex gap-2">
          <select
            className="text-sm border rounded-md px-3 py-1.5 bg-background"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            <option value="">All platforms</option>
            <option value="google_ads">Google Ads</option>
            <option value="meta_ads">Meta Ads</option>
          </select>

          <select
            className="text-sm border rounded-md px-3 py-1.5 bg-background"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-48 rounded-xl border border-border bg-muted animate-pulse"
            />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive">
            Failed to load ad performance data. Check your connections.
          </p>
        </div>
      )}

      {!isLoading && !error && accounts.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-12 text-center space-y-3">
          <p className="font-medium">No ad accounts connected</p>
          <p className="text-sm text-muted-foreground">
            Connect a Google Ads or Meta Ads account to see paid performance
            alongside your organic metrics.
          </p>
        </div>
      )}

      {accounts.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {accounts.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>
      )}
    </div>
  );
}
