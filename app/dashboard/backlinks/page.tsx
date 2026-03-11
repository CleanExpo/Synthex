'use client';

/**
 * Link Prospector Dashboard (Phase 95)
 *
 * 3 tabs:
 *  - Prospects — discover + list backlink opportunities
 *  - Outreach  — email template editor + outreach tracking
 *  - Analysis  — history of past analysis runs
 *
 * URL: /dashboard/backlinks?tab=prospects|outreach|analysis
 *
 * @module app/dashboard/backlinks/page
 */

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link as LinkIcon, Search, TrendingUp, Mail, BarChart3 } from '@/components/icons';
import { BacklinkProspectCard }       from '@/components/backlinks/BacklinkProspectCard';
import { OpportunityMatrix }          from '@/components/backlinks/OpportunityMatrix';
import { OutreachPanel }              from '@/components/backlinks/OutreachPanel';
import { BacklinkAnalysisSummary }    from '@/components/backlinks/BacklinkAnalysisSummary';
import { useUser }                    from '@/hooks/use-user';
import type { MatrixFilter }          from '@/lib/backlinks/types';
import type { ProspectCardData }      from '@/components/backlinks/BacklinkProspectCard';
import type { AnalysisSummaryData }   from '@/components/backlinks/BacklinkAnalysisSummary';

// ─── Types ────────────────────────────────────────────────────────────────────

type BacklinksTab = 'prospects' | 'outreach' | 'analysis';
const VALID_TABS: BacklinksTab[] = ['prospects', 'outreach', 'analysis'];

// ─── SWR fetcher ──────────────────────────────────────────────────────────────

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => {
    if (!r.ok) throw new Error('Fetch failed');
    return r.json();
  });

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-xs font-medium text-slate-300 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function BacklinksPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { user }     = useUser();

  // Tab state (URL-driven)
  const rawTab  = searchParams.get('tab') ?? 'prospects';
  const activeTab: BacklinksTab = VALID_TABS.includes(rawTab as BacklinksTab)
    ? (rawTab as BacklinksTab)
    : 'prospects';

  function setTab(tab: BacklinksTab) {
    router.push(`/dashboard/backlinks?tab=${tab}`);
  }

  // ── Prospects tab state ──
  const [topic,      setTopic]      = useState('');
  const [userDomain, setUserDomain] = useState('');
  const [compDomains, setCompDomains] = useState('');
  const [analyzing,  setAnalyzing]  = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [matrixFilter, setMatrixFilter] = useState<MatrixFilter | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter,   setTypeFilter]   = useState<string>('');
  const [prospectPage, setProspectPage] = useState(0);

  // ── Outreach tab state ──
  const [selectedProspectId, setSelectedProspectId] = useState<string | null>(null);

  // ── Fetch prospects ──
  const orgId = user?.organizationId ?? 'default';
  const prospectsKey = `/api/backlinks/prospects?orgId=${encodeURIComponent(orgId)}&limit=20&offset=${prospectPage * 20}${statusFilter ? `&status=${statusFilter}` : ''}${typeFilter ? `&opportunityType=${typeFilter}` : ''}`;
  const { data: prospectsData, isLoading: prospectsLoading } = useSWR<{
    prospects: ProspectCardData[];
    total: number;
  }>(prospectsKey, fetchJson);

  // ── Fetch analyses ──
  const analysisKey = `/api/backlinks/analysis?orgId=${encodeURIComponent(orgId)}&limit=20`;
  const { data: analysisData, isLoading: analysisLoading } = useSWR<{
    analyses: AnalysisSummaryData[];
    total: number;
  }>(analysisKey, fetchJson);

  // Filter prospects by matrix filter
  const allProspects: ProspectCardData[] = prospectsData?.prospects ?? [];
  const filteredProspects = matrixFilter
    ? allProspects.filter(p => {
        const da = p.domainAuthority ?? 0;
        const tier = da >= 70 ? 'high' : da >= 40 ? 'medium' : 'low';
        return (
          (!matrixFilter.opportunityType || p.opportunityType === matrixFilter.opportunityType) &&
          (!matrixFilter.tier || tier === matrixFilter.tier)
        );
      })
    : allProspects;

  const selectedProspect = allProspects.find(p => p.id === selectedProspectId) ?? null;
  const contactedProspects = allProspects.filter(p => p.status === 'contacted' || p.pitchSent);

  // ─── Stats ─────────────────────────────────────────────────────────────────

  const totalProspects = prospectsData?.total ?? 0;
  const publishedCount = allProspects.filter(p => p.status === 'published').length;
  const highValueCount = allProspects.filter(p => (p.domainAuthority ?? 0) >= 40).length;
  const contactedCount = allProspects.filter(p => p.status === 'contacted').length;

  // ─── Handlers ──────────────────────────────────────────────────────────────

  async function handleAnalyze() {
    if (!topic.trim()) {
      setAnalyzeError('Please enter a topic to search for.');
      return;
    }
    setAnalyzing(true);
    setAnalyzeError(null);

    try {
      const competitorDomains = compDomains
        .split(',')
        .map(d => d.trim())
        .filter(Boolean)
        .slice(0, 5);

      const res = await fetch('/api/backlinks/analyze', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          topic: topic.trim(),
          userDomain: userDomain.trim() || 'example.com',
          competitorDomains,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAnalyzeError(data.error ?? 'Analysis failed — please try again');
        return;
      }

      // Refresh SWR caches
      await mutate(prospectsKey);
      await mutate(analysisKey);
    } catch {
      setAnalyzeError('Network error — please check your connection and try again');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleMarkPublished(prospectId: string) {
    try {
      await fetch('/api/backlinks/outreach', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospectId, orgId }),
      });
      // Manually patch status
      await mutate(prospectsKey);
    } catch {
      // Silently fail — user can try again
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/20 border border-blue-500/30">
            <LinkIcon className="h-5 w-5 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Link Prospector</h1>
        </div>
        <p className="text-sm text-slate-400 ml-12">
          AI-powered backlink opportunity finder with outreach templates
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Prospects"  value={totalProspects} />
        <StatCard label="High Value (DA 40+)" value={highValueCount} sub="domain authority ≥ 40" />
        <StatCard label="Outreach Sent"    value={contactedCount} />
        <StatCard label="Published Links"  value={publishedCount} />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={v => setTab(v as BacklinksTab)}>
        <TabsList className="mb-6 bg-white/5 border border-white/10">
          <TabsTrigger value="prospects" className="flex items-center gap-1.5 data-[state=active]:bg-white/10">
            <Search className="h-3.5 w-3.5" />
            Prospects
          </TabsTrigger>
          <TabsTrigger value="outreach" className="flex items-center gap-1.5 data-[state=active]:bg-white/10">
            <Mail className="h-3.5 w-3.5" />
            Outreach
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-1.5 data-[state=active]:bg-white/10">
            <BarChart3 className="h-3.5 w-3.5" />
            Analysis
          </TabsTrigger>
        </TabsList>

        {/* ── Prospects tab ─────────────────────────────────────────────── */}
        <TabsContent value="prospects" className="space-y-5">
          {/* Analysis form */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-sm font-semibold text-white mb-3">Find Link Opportunities</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Topic / Keyword *</label>
                <input
                  type="text"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="e.g. marketing automation"
                  className="w-full rounded-lg bg-white/8 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-600"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Your domain</label>
                <input
                  type="text"
                  value={userDomain}
                  onChange={e => setUserDomain(e.target.value)}
                  placeholder="yoursite.com.au"
                  className="w-full rounded-lg bg-white/8 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-600"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Competitor domains (comma-separated)</label>
                <input
                  type="text"
                  value={compDomains}
                  onChange={e => setCompDomains(e.target.value)}
                  placeholder="competitor1.com, competitor2.com"
                  className="w-full rounded-lg bg-white/8 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-600"
                />
              </div>
            </div>
            {analyzeError && (
              <p className="mb-3 text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded-lg px-3 py-2">
                {analyzeError}
              </p>
            )}
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <TrendingUp className="h-4 w-4" />
              {analyzing ? 'Analysing… (this may take 15–30s)' : 'Find Opportunities'}
            </button>
          </div>

          {/* Filters */}
          {totalProspects > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setProspectPage(0); }}
                className="rounded-lg bg-white/8 border border-white/10 text-sm text-slate-300 px-3 py-1.5 focus:outline-none"
              >
                <option value="">All statuses</option>
                <option value="identified">Identified</option>
                <option value="contacted">Contacted</option>
                <option value="published">Published</option>
                <option value="rejected">Rejected</option>
              </select>
              <select
                value={typeFilter}
                onChange={e => { setTypeFilter(e.target.value); setProspectPage(0); }}
                className="rounded-lg bg-white/8 border border-white/10 text-sm text-slate-300 px-3 py-1.5 focus:outline-none"
              >
                <option value="">All types</option>
                <option value="resource-page">Resource Page</option>
                <option value="guest-post">Guest Post</option>
                <option value="broken-link">Broken Link</option>
                <option value="competitor-link">Competitor Link</option>
                <option value="journalist-mention">Journalist Mention</option>
              </select>
              {matrixFilter && (
                <button
                  onClick={() => setMatrixFilter(null)}
                  className="text-xs text-slate-400 hover:text-slate-200 underline"
                >
                  Clear matrix filter
                </button>
              )}
            </div>
          )}

          {/* Matrix */}
          {allProspects.length > 0 && (
            <OpportunityMatrix
              prospects={allProspects}
              onFilterChange={setMatrixFilter}
              activeFilter={matrixFilter}
            />
          )}

          {/* Prospect grid */}
          {prospectsLoading ? (
            <div className="text-center text-slate-500 py-10">Loading prospects…</div>
          ) : filteredProspects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 py-14 text-center">
              <LinkIcon className="mx-auto h-10 w-10 text-slate-600 mb-3" />
              <p className="text-slate-400 text-sm font-medium">No prospects yet</p>
              <p className="text-slate-600 text-xs mt-1">
                Enter a topic above and click "Find Opportunities" to start discovering link targets.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {filteredProspects.map(prospect => (
                  <BacklinkProspectCard
                    key={prospect.id}
                    prospect={prospect}
                    onOutreach={id => {
                      setSelectedProspectId(id);
                      setTab('outreach');
                    }}
                    onMarkPublished={handleMarkPublished}
                  />
                ))}
              </div>

              {/* Pagination */}
              {(prospectsData?.total ?? 0) > 20 && (
                <div className="flex items-center justify-between pt-2">
                  <button
                    disabled={prospectPage === 0}
                    onClick={() => setProspectPage(p => p - 1)}
                    className="px-3 py-1.5 text-xs rounded-lg bg-white/8 border border-white/10 text-slate-300 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-slate-500">
                    Page {prospectPage + 1} of {Math.ceil((prospectsData?.total ?? 0) / 20)}
                  </span>
                  <button
                    disabled={(prospectPage + 1) * 20 >= (prospectsData?.total ?? 0)}
                    onClick={() => setProspectPage(p => p + 1)}
                    className="px-3 py-1.5 text-xs rounded-lg bg-white/8 border border-white/10 text-slate-300 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ── Outreach tab ──────────────────────────────────────────────── */}
        <TabsContent value="outreach" className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Prospect selector */}
            <div>
              <label className="block text-xs text-slate-400 mb-2">Select a prospect</label>
              <select
                value={selectedProspectId ?? ''}
                onChange={e => setSelectedProspectId(e.target.value || null)}
                className="w-full rounded-lg bg-white/8 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 mb-4"
              >
                <option value="" className="bg-slate-900">— choose prospect —</option>
                {allProspects.map(p => (
                  <option key={p.id} value={p.id} className="bg-slate-900">
                    {p.targetDomain} ({p.opportunityType}) — DA {p.domainAuthority ?? '?'}
                  </option>
                ))}
              </select>

              <OutreachPanel
                prospect={selectedProspect}
                brandName={user?.name ?? 'Your Brand'}
                brandWebsiteUrl={''}
                onClose={() => setSelectedProspectId(null)}
                onOutreachSaved={() => mutate(prospectsKey)}
              />
            </div>

            {/* Outreach history */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">
                Outreach History
                {contactedProspects.length > 0 && (
                  <span className="ml-2 text-xs text-slate-500">({contactedProspects.length})</span>
                )}
              </h3>
              {contactedProspects.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 py-10 text-center">
                  <Mail className="mx-auto h-8 w-8 text-slate-600 mb-2" />
                  <p className="text-slate-500 text-sm">No outreach recorded yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {contactedProspects.map(p => (
                    <div
                      key={p.id}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-sm font-medium text-white">{p.targetDomain}</div>
                        <div className="text-xs text-slate-500">
                          {p.opportunityType} ·{' '}
                          {p.contactedAt
                            ? `Contacted ${new Date(p.contactedAt).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}`
                            : 'Pitch sent'}
                        </div>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-900/60 text-blue-300">
                        {p.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Analysis tab ──────────────────────────────────────────────── */}
        <TabsContent value="analysis" className="space-y-4">
          {analysisLoading ? (
            <div className="text-center text-slate-500 py-10">Loading analyses…</div>
          ) : (analysisData?.analyses ?? []).length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 py-14 text-center">
              <BarChart3 className="mx-auto h-10 w-10 text-slate-600 mb-3" />
              <p className="text-slate-400 text-sm font-medium">No analyses run yet</p>
              <p className="text-slate-600 text-xs mt-1">
                Go to the Prospects tab and run your first opportunity analysis.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {(analysisData?.analyses ?? []).map(analysis => (
                <BacklinkAnalysisSummary
                  key={analysis.id}
                  analysis={analysis}
                  onViewProspects={() => setTab('prospects')}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
