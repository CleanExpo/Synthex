'use client';

/**
 * Content Quality Gate Dashboard
 *
 * Two tabs:
 * 1. Quality Audit — paste content, run humanness audit, see results
 * 2. Audit History — view previously saved audits
 *
 * @module app/dashboard/quality/page
 */

import { useState, useCallback, useRef , Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Shield, AlertCircle } from '@/components/icons';
import { HumannessScoreCard } from '@/components/quality/HumannessScoreCard';
import { SlopScanResults } from '@/components/voice/SlopScanResults';
import { cn } from '@/lib/utils';
import type { HumannessResult } from '@/lib/quality/humanness-scorer';
import type { ScoreResult } from '@/lib/ai/content-scorer';

// ---------------------------------------------------------------------------
// SWR fetcher (credentials: include per project standard)
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditResponse {
  humanness: HumannessResult;
  contentScore: ScoreResult;
  auditId?: string;
}

interface HistoryAudit {
  id: string;
  humanessScore: number;
  slopDensity: number;
  passRate: boolean;
  slopMatchCount: number;
  createdAt: string;
  contentText: string;
}

interface AuditHistoryResponse {
  audits: HistoryAudit[];
}

// ---------------------------------------------------------------------------
// Word counter helper
// ---------------------------------------------------------------------------

function wordCount(text: string): number {
  return (text.match(/\b\w+\b/g) ?? []).length;
}

// ---------------------------------------------------------------------------
// Grade colour for history rows
// ---------------------------------------------------------------------------

function gradeFromScore(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function historyGradeColour(passes: boolean): string {
  return passes
    ? 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30'
    : 'text-red-400 bg-red-500/20 border-red-500/30';
}

// ---------------------------------------------------------------------------
// Sub-components
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
        'px-4 py-2 text-sm font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500',
        active
          ? 'bg-white/10 text-white'
          : 'text-gray-400 hover:text-white hover:bg-white/5'
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Audit Tab
// ---------------------------------------------------------------------------

function AuditTab() {
  const [text, setText] = useState('');
  const [threshold, setThreshold] = useState(60);
  const [result, setResult] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const words = wordCount(text);

  const runAudit = useCallback(async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/quality/audit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, save: false }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Error ${res.status}`);
      }

      const data = await res.json() as AuditResponse;
      // Apply the custom threshold to the result
      const adjusted: AuditResponse = {
        ...data,
        humanness: {
          ...data.humanness,
          passThreshold: threshold,
          passes: data.humanness.score >= threshold,
        },
      };
      setResult(adjusted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run audit');
    } finally {
      setLoading(false);
    }
  }, [text, threshold]);

  return (
    <div className="space-y-5">
      {/* Textarea */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="quality-content" className="text-sm font-medium text-slate-300">
            Content to Audit
          </label>
          <span className={cn('text-xs tabular-nums', words > 0 ? 'text-slate-400' : 'text-slate-600')}>
            {words.toLocaleString()} {words === 1 ? 'word' : 'words'}
          </span>
        </div>
        <textarea
          id="quality-content"
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your content here to check for AI tell-phrases and run a humanness audit..."
          rows={8}
          className="w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-600 text-sm px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-y"
        />
      </div>

      {/* Threshold slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="threshold-slider" className="text-sm font-medium text-slate-300">
            Pass Threshold
          </label>
          <span className="text-sm font-semibold text-cyan-400 tabular-nums">{threshold}</span>
        </div>
        <input
          id="threshold-slider"
          type="range"
          min={40}
          max={80}
          step={5}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className="w-full accent-cyan-500"
          aria-label="Pass threshold"
        />
        <div className="flex justify-between text-xs text-slate-600">
          <span>40 (lenient)</span>
          <span>60 (default)</span>
          <span>80 (strict)</span>
        </div>
      </div>

      {/* Run button */}
      <button
        type="button"
        onClick={runAudit}
        disabled={loading || !text.trim()}
        className={cn(
          'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500',
          loading || !text.trim()
            ? 'bg-white/5 text-slate-500 cursor-not-allowed'
            : 'bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer'
        )}
      >
        <Shield className="w-4 h-4" />
        {loading ? 'Running Audit…' : 'Run Quality Audit'}
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
        <div className="space-y-4 pt-2">
          <HumannessScoreCard result={result.humanness} />
          <SlopScanResults result={result.humanness.slopScan} />

          {/* Writing Quality dimension from content scorer */}
          {result.contentScore?.dimensions?.writingQuality && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Writing Quality Dimension Score
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white">
                  {result.contentScore.dimensions.writingQuality.score}
                </span>
                <span className="text-sm text-slate-500">/ 100</span>
              </div>
              {result.contentScore.dimensions.writingQuality.issues.length > 0 && (
                <ul className="space-y-1">
                  {result.contentScore.dimensions.writingQuality.issues.map((issue, i) => (
                    <li key={i} className="text-xs text-slate-400">• {issue}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// History Tab
// ---------------------------------------------------------------------------

function HistoryTab() {
  const { data, isLoading, error } = useSWR<AuditHistoryResponse>(
    '/api/quality/audit',
    fetchJson,
    { revalidateOnFocus: false }
  );
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
        Loading audit history…
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
        <Shield className="w-10 h-10 text-slate-600" />
        <p className="text-slate-400 text-sm font-medium">No saved audits yet</p>
        <p className="text-slate-600 text-xs">
          Run a quality audit and tick &ldquo;Save to history&rdquo; to see results here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {audits.map((audit) => {
        const grade = gradeFromScore(audit.humanessScore);
        const isOpen = expanded === audit.id;
        const date = new Date(audit.createdAt).toLocaleDateString('en-AU', {
          day: '2-digit', month: 'short', year: 'numeric',
        });

        return (
          <div key={audit.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : audit.id)}
              className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              {/* Grade badge */}
              <span className={cn(
                'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border',
                historyGradeColour(audit.passRate)
              )}>
                {grade}
              </span>

              {/* Meta */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {audit.contentText.slice(0, 80)}{audit.contentText.length > 80 ? '…' : ''}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {date} · Score {Math.round(audit.humanessScore)} · {audit.slopMatchCount} slop match{audit.slopMatchCount !== 1 ? 'es' : ''}
                </p>
              </div>

              {/* Pass indicator */}
              <span className={cn(
                'flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border',
                historyGradeColour(audit.passRate)
              )}>
                {audit.passRate ? 'Pass' : 'Fail'}
              </span>
            </button>

            {/* Expanded text */}
            {isOpen && (
              <div className="px-4 pb-4 border-t border-white/10 pt-3">
                <p className="text-sm text-slate-300 whitespace-pre-wrap break-words">
                  {audit.contentText}
                </p>
                <div className="flex gap-4 mt-3 text-xs text-slate-500">
                  <span>Slop density: {audit.slopDensity.toFixed(2)}/100 words</span>
                </div>
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

function QualityDashboardPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') === 'history' ? 'history' : 'audit';

  const setTab = (tab: string) => {
    router.push(tab === 'history' ? '/dashboard/quality?tab=history' : '/dashboard/quality');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex-shrink-0">
          <Shield className="w-6 h-6 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Content Quality Gate</h1>
          <p className="text-sm text-slate-400 mt-1">
            Detect AI tell-phrases and score content humanness before publishing.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1 w-fit">
        <TabButton active={activeTab === 'audit'} onClick={() => setTab('audit')}>
          Quality Audit
        </TabButton>
        <TabButton active={activeTab === 'history'} onClick={() => setTab('history')}>
          Audit History
        </TabButton>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'audit' && <AuditTab />}
        {activeTab === 'history' && <HistoryTab />}
      </div>
    </div>
  );
}

export default function QualityDashboardPage() {
  return (
    <Suspense>
      <QualityDashboardPageContent />
    </Suspense>
  );
}
