'use client';

/**
 * /dashboard/geo
 *
 * Geographic audience distribution dashboard.
 * Wired to /api/dashboard/geo via SWR.
 */

import useSWR from 'swr';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Globe, MapPin } from 'lucide-react';

interface GeoRegion {
  country: string;
  countryCode: string;
  city?: string;
  sessions: number;
  users: number;
  pageviews: number;
  avgSessionDuration: number; // seconds
  bounceRate: number;
  percentOfTotal: number;
}

interface GeoData {
  totalCountries: number;
  totalCities: number;
  topRegions: GeoRegion[];
  continentBreakdown: Array<{
    continent: string;
    percentOfTotal: number;
    users: number;
  }>;
}

async function fetcher(url: string): Promise<GeoData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load geo data (${res.status})`);
  return res.json();
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export default function GeoPage() {
  const { data, error, isLoading } = useSWR<GeoData>('/api/dashboard/geo', fetcher, {
    refreshInterval: 300_000, // 5 min
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="border-b border-white/[0.06] pb-6">
          <div className="h-4 w-32 bg-white/[0.05] rounded-sm mb-3" />
          <div className="h-8 w-48 bg-white/[0.05] rounded-sm" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
              <div className="h-4 w-24 bg-white/[0.05] rounded-sm mb-2" />
              <div className="h-8 w-16 bg-white/[0.05] rounded-sm" />
            </div>
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="border-b border-white/[0.06] p-4 flex items-center justify-between">
            <div className="h-4 w-40 bg-white/[0.05] rounded-sm" />
            <div className="h-4 w-20 bg-white/[0.05] rounded-sm" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="border-red-500/30 bg-red-500/10">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load geographic data. {error.message}</AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8">
      <div className="border-b border-white/[0.06] pb-6">
        <p className="text-xs uppercase tracking-widest text-white/40 mb-2">Analytics</p>
        <h1 className="text-2xl font-semibold text-white">Geographic Distribution</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4 flex items-center gap-3">
          <Globe className="h-5 w-5 text-amber-400/60" />
          <div>
            <p className="text-xs text-white/40">Countries Reached</p>
            <p className="text-2xl font-semibold text-white">{data.totalCountries}</p>
          </div>
        </div>
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4 flex items-center gap-3">
          <MapPin className="h-5 w-5 text-amber-400/60" />
          <div>
            <p className="text-xs text-white/40">Cities Reached</p>
            <p className="text-2xl font-semibold text-white">{data.totalCities.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Continent breakdown */}
      {data.continentBreakdown.length > 0 && (
        <div className="border-[0.5px] border-white/[0.06] rounded-sm overflow-hidden">
          <div className="border-b border-white/[0.06] p-4">
            <h2 className="text-sm font-medium text-white">By Continent</h2>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {data.continentBreakdown.map((c, i) => (
              <div key={i} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-white/80">{c.continent}</p>
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-white/40">{c.users.toLocaleString()} users</p>
                    <p className="text-sm font-medium text-amber-400">{c.percentOfTotal.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500/70 rounded-full"
                    style={{ width: `${c.percentOfTotal}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top regions table */}
      <div className="border-[0.5px] border-white/[0.06] rounded-sm overflow-hidden">
        <div className="border-b border-white/[0.06] p-4 grid grid-cols-5 gap-4">
          <p className="text-xs text-white/40 uppercase tracking-wider col-span-2">Location</p>
          <p className="text-xs text-white/40 uppercase tracking-wider">Sessions</p>
          <p className="text-xs text-white/40 uppercase tracking-wider">Avg Duration</p>
          <p className="text-xs text-white/40 uppercase tracking-wider">Share</p>
        </div>
        {data.topRegions.map((region, i) => (
          <div key={i} className="border-b border-white/[0.04] p-4 grid grid-cols-5 gap-4 hover:bg-white/[0.01] transition-colors">
            <div className="col-span-2 flex items-center gap-2">
              <span className="text-base">{/* flag emoji via countryCode */}
                {String.fromCodePoint(
                  ...[...region.countryCode.toUpperCase()].map(
                    (c) => 0x1f1e6 + c.charCodeAt(0) - 65
                  )
                )}
              </span>
              <div>
                <p className="text-sm text-white">{region.country}</p>
                {region.city && (
                  <p className="text-xs text-white/30">{region.city}</p>
                )}
              </div>
            </div>
            <p className="text-sm text-white/60 self-center">{region.sessions.toLocaleString()}</p>
            <p className="text-sm text-white/60 self-center">{formatDuration(region.avgSessionDuration)}</p>
            <div className="self-center">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 bg-white/[0.05] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500/50 rounded-full"
                    style={{ width: `${region.percentOfTotal}%` }}
                  />
                </div>
                <p className="text-xs text-white/40 w-10 text-right">{region.percentOfTotal.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
