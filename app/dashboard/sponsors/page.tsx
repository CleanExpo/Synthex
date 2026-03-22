'use client';

/**
 * /dashboard/sponsors
 *
 * Sponsorship opportunities, active deals, and revenue tracking.
 * Wired to /api/dashboard/sponsors via SWR.
 */

import useSWR from 'swr';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Building2, DollarSign, Calendar, ExternalLink } from 'lucide-react';

interface SponsorDeal {
  id: string;
  companyName: string;
  logoUrl?: string;
  dealValue: number;
  currency: string;
  status: 'active' | 'pending' | 'completed' | 'negotiating';
  startDate: string;
  endDate?: string;
  platform: string;
  deliverables: string[];
  contactEmail?: string;
}

interface SponsorsData {
  totalRevenue: number;
  activeDeals: number;
  pendingDeals: number;
  avgDealValue: number;
  deals: SponsorDeal[];
  opportunities: Array<{
    id: string;
    companyName: string;
    estimatedValue: number;
    matchScore: number;
    industry: string;
  }>;
}

async function fetcher(url: string): Promise<SponsorsData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load sponsors data (${res.status})`);
  return res.json();
}

const STATUS_STYLES: Record<SponsorDeal['status'], string> = {
  active: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
  pending: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
  completed: 'text-white/40 border-white/20 bg-white/5',
  negotiating: 'text-blue-400 border-blue-400/30 bg-blue-400/10',
};

export default function SponsorsPage() {
  const { data, error, isLoading } = useSWR<SponsorsData>(
    '/api/dashboard/sponsors',
    fetcher,
    { refreshInterval: 60_000 }
  );

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="border-b border-white/[0.06] pb-6">
          <div className="h-4 w-32 bg-white/[0.05] rounded-sm mb-3" />
          <div className="h-8 w-48 bg-white/[0.05] rounded-sm" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
              <div className="h-4 w-20 bg-white/[0.05] rounded-sm mb-2" />
              <div className="h-8 w-24 bg-white/[0.05] rounded-sm" />
            </div>
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
            <div className="h-5 w-40 bg-white/[0.05] rounded-sm mb-3" />
            <div className="h-4 w-full bg-white/[0.05] rounded-sm" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="border-red-500/30 bg-red-500/10">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load sponsors data. {error.message}</AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8">
      <div className="border-b border-white/[0.06] pb-6">
        <p className="text-xs uppercase tracking-widest text-white/40 mb-2">Monetisation</p>
        <h1 className="text-2xl font-semibold text-white">Sponsorships</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-3.5 w-3.5 text-amber-400/60" />
            <p className="text-xs text-white/40">Total Revenue</p>
          </div>
          <p className="text-xl font-semibold text-amber-400">
            ${data.totalRevenue.toLocaleString()}
          </p>
        </div>
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-3.5 w-3.5 text-emerald-400/60" />
            <p className="text-xs text-white/40">Active Deals</p>
          </div>
          <p className="text-xl font-semibold text-white">{data.activeDeals}</p>
        </div>
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-3.5 w-3.5 text-white/30" />
            <p className="text-xs text-white/40">Pending</p>
          </div>
          <p className="text-xl font-semibold text-white">{data.pendingDeals}</p>
        </div>
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-3.5 w-3.5 text-white/30" />
            <p className="text-xs text-white/40">Avg Deal Value</p>
          </div>
          <p className="text-xl font-semibold text-white">${data.avgDealValue.toLocaleString()}</p>
        </div>
      </div>

      {/* Active deals */}
      <div>
        <h2 className="text-sm font-medium text-white mb-4">Active & Pending Deals</h2>
        <div className="space-y-3">
          {data.deals.filter((d) => d.status !== 'completed').map((deal) => (
            <div key={deal.id} className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4 hover:border-amber-500/20 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-medium text-white">{deal.companyName}</h3>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_STYLES[deal.status]}`}>
                      {deal.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-white/30">
                    {deal.platform} · {new Date(deal.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    {deal.endDate && ` → ${new Date(deal.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
                  </p>
                  {deal.deliverables.length > 0 && (
                    <p className="text-xs text-white/25 mt-1">{deal.deliverables.join(' · ')}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <p className="text-sm font-semibold text-amber-400">
                    ${deal.dealValue.toLocaleString()} {deal.currency}
                  </p>
                  {deal.contactEmail && (
                    <a
                      href={`mailto:${deal.contactEmail}`}
                      className="text-xs text-white/25 hover:text-white/50 flex items-center gap-1 justify-end mt-1"
                    >
                      <ExternalLink className="h-3 w-3" /> Contact
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
          {data.deals.filter((d) => d.status !== 'completed').length === 0 && (
            <div className="border-[0.5px] border-white/[0.06] rounded-sm p-8 text-center">
              <p className="text-sm text-white/30">No active deals at this time.</p>
            </div>
          )}
        </div>
      </div>

      {/* Opportunities */}
      {data.opportunities.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-white mb-4">Suggested Opportunities</h2>
          <div className="space-y-2">
            {data.opportunities.map((opp) => (
              <div key={opp.id} className="border-[0.5px] border-white/[0.04] rounded-sm p-4 flex items-center justify-between hover:border-white/[0.08] transition-colors">
                <div>
                  <p className="text-sm text-white/80">{opp.companyName}</p>
                  <p className="text-xs text-white/30">{opp.industry}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-white/40">Est. Value</p>
                    <p className="text-sm font-medium text-white/70">${opp.estimatedValue.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/40">Match</p>
                    <p className={`text-sm font-medium ${opp.matchScore >= 80 ? 'text-emerald-400' : opp.matchScore >= 60 ? 'text-amber-400' : 'text-white/40'}`}>
                      {opp.matchScore}%
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
