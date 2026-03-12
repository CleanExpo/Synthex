'use client';

/**
 * E-E-A-T Builder Dashboard (Phase 90)
 *
 * Three tabs: Score | Assets | History
 *
 * @module app/dashboard/eeat/page
 */

import { useState, useCallback , Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Award, AlertCircle } from '@/components/icons';
import { EEATAuditScoreCard } from '@/components/eeat/EEATAuditScoreCard';
import { EEATAssetPanel } from '@/components/eeat/EEATAssetPanel';
import { cn } from '@/lib/utils';
import type { EEATAuditResult, EEATAssetPlan } from '@/lib/eeat/audit-types';

// ---------------------------------------------------------------------------
// SWR fetcher
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditApiResponse {
  audit: EEATAuditResult;
  assets?: EEATAssetPlan;
  auditId?: string;
}

interface HistoryRecord {
  id: string;
  overallScore: number;
  experienceScore: number;
  expertiseScore: number;
  authorityScore: number;
  trustScore: number;
  contentText: string;
  contentUrl: string | null;
  createdAt: string;
  auditResult: EEATAuditResult;
}

interface HistoryResponse {
  audits: HistoryRecord[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wordCount(text: string): number {
  return (text.match(/\b\w+\b/g) ?? []).length;
}

function gradeFromScore(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function gradeColour(grade: string): string {
  switch (grade) {
    case 'A': return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';
    case 'B': return 'text-cyan-400 bg-cyan-500/20 border-cyan-500/30';
    case 'C': return 'text-amber-400 bg-amber-500/20 border-amber-500/30';
    case 'D': return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
    case 'F': return 'text-red-400 bg-red-500/20 border-red-500/30';
    default:  return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
  }
}

// ---------------------------------------------------------------------------
// TabButton
// ---------------------------------------------------------------------------

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-4 py-2 text-sm font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
        active ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5',
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Score Tab
// ---------------------------------------------------------------------------

function ScoreTab({
  onAuditComplete,
}: {
  onAuditComplete: (audit: EEATAuditResult, assets?: EEATAssetPlan) => void;
}) {
  const [text, setText] = useState('');
  const [generateAssets, setGenerateAssets] = useState(true);
  const [result, setResult] = useState<AuditApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const words = wordCount(text);

  const runAudit = useCallback(async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/eeat/v2/audit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, save: false, generateAssets }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Error ${res.status}`);
      }

      const data = (await res.json()) as AuditApiResponse;
      setResult(data);
      onAuditComplete(data.audit, data.assets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run audit');
    } finally {
      setLoading(false);
    }
  }, [text, generateAssets, onAuditComplete]);

  return (
    <div className="space-y-5">
      {/* Textarea */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="eeat-content" className="text-sm font-medium text-slate-300">
            Content to Audit
          </label>
          <span className={cn('text-xs tabular-nums', words > 0 ? 'text-slate-400' : 'text-slate-600')}>
            {words.toLocaleString()} {words === 1 ? 'word' : 'words'}
          </span>
        </div>
        <textarea
          id="eeat-content"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your content here to run an E-E-A-T audit across Experience, Expertise, Authority, and Trust..."
          rows={8}
          className="w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-600 text-sm px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-y"
        />
      </div>

      {/* Options */}
      <div className="flex items-center gap-3">
        <input
          id="generate-assets"
          type="checkbox"
          checked={generateAssets}
          onChange={(e) => setGenerateAssets(e.target.checked)}
          className="w-4 h-4 accent-amber-500"
        />
        <label htmlFor="generate-assets" className="text-sm text-slate-300">
          Generate asset plan (templates to fix gaps)
        </label>
      </div>

      {/* Run button */}
      <button
        type="button"
        onClick={runAudit}
        disabled={loading || !text.trim()}
        className={cn(
          'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
          loading || !text.trim()
            ? 'bg-white/5 text-slate-500 cursor-not-allowed'
            : 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer',
        )}
      >
        <Award className="w-4 h-4" />
        {loading ? 'Running Audit\u2026' : 'Run E-E-A-T Audit'}
      </button>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <span className="text-sm text-red-300">{error}</span>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="pt-2">
          <EEATAuditScoreCard result={result.audit} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assets Tab
// ---------------------------------------------------------------------------

function AssetsTab({
  auditResult,
  assetPlan,
}: {
  auditResult: EEATAuditResult | null;
  assetPlan: EEATAssetPlan | null;
}) {
  if (!auditResult || !assetPlan) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
        <Award className="w-10 h-10 text-slate-600" />
        <p className="text-slate-400 text-sm font-medium">No asset plan yet</p>
        <p className="text-slate-600 text-xs">
          Run an audit with &ldquo;Generate asset plan&rdquo; ticked to see templates here.
        </p>
      </div>
    );
  }

  return <EEATAssetPanel plan={assetPlan} currentScore={auditResult.overallScore} />;
}

// ---------------------------------------------------------------------------
// History Tab
// ---------------------------------------------------------------------------

function HistoryTab() {
  const { data, isLoading, error } = useSWR<HistoryResponse>(
    '/api/eeat/v2/audit',
    fetchJson,
    { revalidateOnFocus: false },
  );
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
        Loading audit history\u2026
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
        <span className="text-sm text-red-300">Failed to load audit history.</span>
      </div>
    );
  }

  const audits = data?.audits ?? [];

  if (audits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
        <Award className="w-10 h-10 text-slate-600" />
        <p className="text-slate-400 text-sm font-medium">No saved audits yet</p>
        <p className="text-slate-600 text-xs">
          Run an audit and tick &ldquo;Save to history&rdquo; to see results here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {audits.map((record) => {
        const grade = gradeFromScore(record.overallScore);
        const isOpen = expanded === record.id;
        const date = new Date(record.createdAt).toLocaleDateString('en-AU', {
          day: '2-digit', month: 'short', year: 'numeric',
        });

        return (
          <div key={record.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : record.id)}
              className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <span className={cn(
                'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border',
                gradeColour(grade),
              )}>
                {grade}
              </span>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {record.contentText.slice(0, 80)}{record.contentText.length > 80 ? '\u2026' : ''}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {date} \u00b7 Score {Math.round(record.overallScore)}
                </p>
              </div>

              <span className={cn(
                'flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border',
                gradeColour(grade),
              )}>
                {Math.round(record.overallScore)}/100
              </span>
            </button>

            {isOpen && (
              <div className="border-t border-white/10 px-4 pb-4 pt-3">
                <EEATAuditScoreCard result={record.auditResult} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function EEATBuilderPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawTab = searchParams.get('tab');
  const activeTab: 'score' | 'assets' | 'history' =
    rawTab === 'assets' ? 'assets' : rawTab === 'history' ? 'history' : 'score';

  const setTab = (tab: string) => {
    router.push(tab === 'score' ? '/dashboard/eeat' : `/dashboard/eeat?tab=${tab}`);
  };

  const [auditResult, setAuditResult] = useState<EEATAuditResult | null>(null);
  const [assetPlan, setAssetPlan] = useState<EEATAssetPlan | null>(null);

  const handleAuditComplete = useCallback((audit: EEATAuditResult, assets?: EEATAssetPlan) => {
    setAuditResult(audit);
    setAssetPlan(assets ?? null);
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 flex-shrink-0">
          <Award className="w-6 h-6 text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">E-E-A-T Builder</h1>
          <p className="text-sm text-slate-400 mt-1">
            Score content across Experience, Expertise, Authority, and Trust \u2014 then generate templates to fix gaps.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1 w-fit">
        <TabButton active={activeTab === 'score'} onClick={() => setTab('score')}>
          Score
        </TabButton>
        <TabButton active={activeTab === 'assets'} onClick={() => setTab('assets')}>
          Assets
        </TabButton>
        <TabButton active={activeTab === 'history'} onClick={() => setTab('history')}>
          History
        </TabButton>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'score' && <ScoreTab onAuditComplete={handleAuditComplete} />}
        {activeTab === 'assets' && <AssetsTab auditResult={auditResult} assetPlan={assetPlan} />}
        {activeTab === 'history' && <HistoryTab />}
      </div>
    </div>
  );
}

export default function EEATBuilderPage() {
  return (
    <Suspense>
      <EEATBuilderPageContent />
    </Suspense>
  );
}
