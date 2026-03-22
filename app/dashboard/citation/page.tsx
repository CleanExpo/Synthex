'use client';

/**
 * /dashboard/citation
 *
 * Citation tracking — monitors where the user's content is cited or referenced across the web.
 * Wired to /api/dashboard/citation via SWR.
 */

import useSWR from 'swr';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Link2, ExternalLink, TrendingUp } from 'lucide-react';

interface CitationItem {
  id: string;
  sourceUrl: string;
  sourceDomain: string;
  sourceName: string;
  citedUrl: string;
  anchorText: string;
  domainAuthority: number;
  discoveredAt: string;
  type: 'backlink' | 'mention' | 'quote';
}

interface CitationData {
  totalCitations: number;
  newThisWeek: number;
  avgDomainAuthority: number;
  citations: CitationItem[];
  topDomains: Array<{ domain: string; count: number; avgDA: number }>;
}

async function fetcher(url: string): Promise<CitationData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load citation data (${res.status})`);
  return res.json();
}

const TYPE_BADGE: Record<CitationItem['type'], string> = {
  backlink: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  mention: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  quote: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
};

export default function CitationPage() {
  const { data, error, isLoading } = useSWR<CitationData>(
    '/api/dashboard/citation',
    fetcher,
    { refreshInterval: 3_600_000 }
  );

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
              <div className="h-8 w-16 bg-white/[0.05] rounded-sm" />
            </div>
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-b border-white/[0.06] p-4 space-y-2">
            <div className="h-4 w-64 bg-white/[0.05] rounded-sm" />
            <div className="h-3 w-40 bg-white/[0.05] rounded-sm" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="border-red-500/30 bg-red-500/10">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load citation data. {error.message}</AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8">
      <div className="border-b border-white/[0.06] pb-6">
        <p className="text-xs uppercase tracking-widest text-white/40 mb-2">Authority</p>
        <h1 className="text-2xl font-semibold text-white">Citations & Backlinks</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <Link2 className="h-3.5 w-3.5 text-amber-400/60" />
            <p className="text-xs text-white/40">Total Citations</p>
          </div>
          <p className="text-2xl font-semibold text-white">{data.totalCitations.toLocaleString()}</p>
        </div>
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400/60" />
            <p className="text-xs text-white/40">New This Week</p>
          </div>
          <p className="text-2xl font-semibold text-emerald-400">+{data.newThisWeek}</p>
        </div>
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs text-white/40">Avg Domain Authority</p>
          </div>
          <p className="text-2xl font-semibold text-amber-400">{data.avgDomainAuthority}</p>
        </div>
      </div>

      {/* Top domains */}
      {data.topDomains.length > 0 && (
        <div className="border-[0.5px] border-white/[0.06] rounded-sm overflow-hidden">
          <div className="border-b border-white/[0.06] p-4">
            <h2 className="text-sm font-medium text-white">Top Referring Domains</h2>
          </div>
          {data.topDomains.map((domain, i) => (
            <div key={i} className="border-b border-white/[0.04] p-4 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
              <p className="text-sm text-white/80">{domain.domain}</p>
              <div className="flex items-center gap-4">
                <span className="text-xs text-white/40">{domain.count} links</span>
                <span className="text-xs text-amber-400">DA {domain.avgDA}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent citations */}
      <div className="border-[0.5px] border-white/[0.06] rounded-sm overflow-hidden">
        <div className="border-b border-white/[0.06] p-4">
          <h2 className="text-sm font-medium text-white">Recent Citations</h2>
        </div>
        {data.citations.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-white/30">No citations found yet. Keep creating quality content!</p>
          </div>
        ) : (
          data.citations.map((cit) => (
            <div key={cit.id} className="border-b border-white/[0.04] p-4 hover:bg-white/[0.01] transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <a
                      href={cit.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-white/80 hover:text-amber-400 transition-colors truncate flex items-center gap-1"
                    >
                      {cit.sourceName || cit.sourceDomain}
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                    <span className={`text-[10px] px-1.5 py-0.5 border rounded-sm flex-shrink-0 ${TYPE_BADGE[cit.type]}`}>
                      {cit.type}
                    </span>
                  </div>
                  {cit.anchorText && (
                    <p className="text-xs text-white/30 italic truncate">"{cit.anchorText}"</p>
                  )}
                  <p className="text-[10px] text-white/20 mt-1">
                    {new Date(cit.discoveredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-white/40">DA</p>
                  <p className="text-sm font-medium text-amber-400">{cit.domainAuthority}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
