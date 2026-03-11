'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation } from '@/hooks/use-api';
import { PageHeader } from '@/components/dashboard/page-header';
import { DashboardEmptyState } from '@/components/dashboard/empty-state';
import { VoiceFingerprintCard } from '@/components/voice/VoiceFingerprintCard';
import { SlopScanResults } from '@/components/voice/SlopScanResults';
import { ContentCapsulePreview } from '@/components/voice/ContentCapsulePreview';
import { Mic, FileText, Search, Copy, Check } from '@/components/icons';
import type { FingerprintResult, SlopScanResult, ContentCapsuleResult, WritingContextResult } from '@/lib/voice/types';

// ---------------------------------------------------------------------------
// API response shapes
// ---------------------------------------------------------------------------

interface AnalyzeApiResponse {
  fingerprint: FingerprintResult;
  slopScan: SlopScanResult;
  writingContext?: WritingContextResult;
  clarityScore: number;
  analysedAt: string;
}

interface CapsuleApiResponse extends ContentCapsuleResult {
  capsuleId?: string;
}

interface SlopScanApiResponse extends SlopScanResult {}

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------

type TabId = 'fingerprint' | 'capsule' | 'slop';

const TABS: Array<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'fingerprint', label: 'Fingerprint', icon: Mic },
  { id: 'capsule', label: 'Content Capsule', icon: FileText },
  { id: 'slop', label: 'Slop Scan', icon: Search },
];

// ---------------------------------------------------------------------------
// Word counter helper
// ---------------------------------------------------------------------------

function countWords(text: string): number {
  return (text.match(/\b\w+\b/g) ?? []).length;
}

// ---------------------------------------------------------------------------
// Fetch helpers (POST, credentials: include — no raw fetch in render)
// ---------------------------------------------------------------------------

async function postVoiceAnalyze(text: string): Promise<AnalyzeApiResponse> {
  const res = await fetch('/api/voice/analyze', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Failed to analyse voice');
  }
  return res.json();
}

async function postVoiceCapsule(text: string): Promise<CapsuleApiResponse> {
  const res = await fetch('/api/voice/capsule', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Failed to format capsule');
  }
  return res.json();
}

async function postSlopScan(text: string): Promise<SlopScanApiResponse> {
  const res = await fetch('/api/voice/slop-scan', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Failed to scan for slop');
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function VoiceDashboardClient() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabId | null) ?? 'fingerprint';

  const [activeTab, setActiveTab] = useState<TabId>(
    TABS.some(t => t.id === initialTab) ? initialTab : 'fingerprint'
  );

  // Fingerprint tab state
  const [fingerprintText, setFingerprintText] = useState('');
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeApiResponse | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Capsule tab state
  const [capsuleText, setCapsuleText] = useState('');
  const [capsuleResult, setCapsuleResult] = useState<CapsuleApiResponse | null>(null);
  const [capsuleError, setCapsuleError] = useState<string | null>(null);

  // Slop Scan tab state
  const [slopText, setSlopText] = useState('');
  const [slopResult, setSlopResult] = useState<SlopScanApiResponse | null>(null);
  const [slopError, setSlopError] = useState<string | null>(null);

  // Mutations
  const analyzeMutation = useMutation<AnalyzeApiResponse, string>(postVoiceAnalyze, {
    onSuccess: (data) => {
      setAnalyzeResult(data);
      setAnalyzeError(null);
    },
    onError: (err) => {
      setAnalyzeError(err.message);
    },
  });

  const capsuleMutation = useMutation<CapsuleApiResponse, string>(postVoiceCapsule, {
    onSuccess: (data) => {
      setCapsuleResult(data);
      setCapsuleError(null);
    },
    onError: (err) => {
      setCapsuleError(err.message);
    },
  });

  const slopMutation = useMutation<SlopScanApiResponse, string>(postSlopScan, {
    onSuccess: (data) => {
      setSlopResult(data);
      setSlopError(null);
    },
    onError: (err) => {
      setSlopError(err.message);
    },
  });

  // Sync tab from URL query param changes
  useEffect(() => {
    const tab = searchParams.get('tab') as TabId | null;
    if (tab && TABS.some(t => t.id === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const fingerprintWordCount = countWords(fingerprintText);
  const isReadyToAnalyse = fingerprintWordCount >= 200;

  const handleCopyContext = useCallback(() => {
    if (!analyzeResult?.writingContext) return;
    const ctx = analyzeResult.writingContext;
    const prompt = [
      `Audience: ${ctx.audience}`,
      `Goal: ${ctx.goal}`,
      `Tone signals: ${ctx.toneSignals.join(', ')}`,
      `Formality: ${Math.round(ctx.formalityScore * 100)}%`,
    ].join('\n');
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [analyzeResult]);

  // Shared spinner
  const Spinner = () => (
    <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Voice Engine"
        description="Fingerprint your writing style, eliminate AI slop, format content for AI citation"
      />

      {/* Tab bar */}
      <div className="flex rounded-xl bg-white/5 border border-white/10 p-1 gap-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={[
              'flex-1 flex items-centre justify-centre gap-2 text-sm py-2 rounded-lg transition-colors font-medium',
              activeTab === id
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5',
            ].join(' ')}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* ─── Fingerprint Tab ─────────────────────────────────────────────── */}
      {activeTab === 'fingerprint' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: textarea */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-300 block">
              Sample Text
            </label>
            <textarea
              value={fingerprintText}
              onChange={(e) => setFingerprintText(e.target.value)}
              placeholder="Paste at least 200 words of your writing here to generate your voice fingerprint…"
              className="w-full h-64 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
            />
            {/* Word counter */}
            <div className="flex items-centre justify-between text-xs">
              <span className={isReadyToAnalyse ? 'text-emerald-400' : 'text-amber-400'}>
                {fingerprintWordCount} words{' '}
                {isReadyToAnalyse ? '— ready to analyse' : '— minimum 200 required'}
              </span>
            </div>

            {analyzeError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {analyzeError}
              </p>
            )}

            <button
              onClick={() => analyzeMutation.mutate(fingerprintText)}
              disabled={!isReadyToAnalyse || analyzeMutation.isLoading}
              className="w-full flex items-centre justify-centre gap-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {analyzeMutation.isLoading ? (
                <>
                  <Spinner />
                  Analysing…
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  Analyse Voice
                </>
              )}
            </button>
          </div>

          {/* Right: results */}
          <div className="space-y-4">
            {analyzeResult?.fingerprint.valid ? (
              <>
                <VoiceFingerprintCard fingerprint={analyzeResult.fingerprint.fingerprint} />

                {/* Writing Context copy block */}
                {analyzeResult.writingContext && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                    <div className="flex items-centre justify-between">
                      <h4 className="text-sm font-semibold text-white">Writing Context</h4>
                      <button
                        onClick={handleCopyContext}
                        className="flex items-centre gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy Writing Context
                          </>
                        )}
                      </button>
                    </div>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="text-slate-500">Audience</dt>
                        <dd className="text-slate-200 capitalize">{analyzeResult.writingContext.audience}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Goal</dt>
                        <dd className="text-slate-200 capitalize">{analyzeResult.writingContext.goal}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Tone</dt>
                        <dd className="text-slate-200">{analyzeResult.writingContext.toneSignals.join(', ')}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Formality</dt>
                        <dd className="text-slate-200">{Math.round(analyzeResult.writingContext.formalityScore * 100)}%</dd>
                      </div>
                    </dl>
                    {analyzeResult.clarityScore !== undefined && (
                      <div className="border-t border-white/5 pt-2 flex items-centre gap-2">
                        <span className="text-xs text-slate-500">Voice Clarity Score</span>
                        <span className={[
                          'text-sm font-bold',
                          analyzeResult.clarityScore >= 70 ? 'text-emerald-400' : analyzeResult.clarityScore >= 40 ? 'text-amber-400' : 'text-red-400',
                        ].join(' ')}>
                          {analyzeResult.clarityScore}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : analyzeResult?.fingerprint.valid === false ? (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <p className="text-sm text-red-400">{analyzeResult.fingerprint.error}</p>
              </div>
            ) : (
              <DashboardEmptyState
                icon={Mic}
                title="No fingerprint yet"
                description="Paste 200+ words of your writing and click Analyse Voice to generate your stylometric fingerprint."
              />
            )}
          </div>
        </div>
      )}

      {/* ─── Content Capsule Tab ─────────────────────────────────────────── */}
      {activeTab === 'capsule' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: textarea */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-300 block">
              Content to Format
            </label>
            <textarea
              value={capsuleText}
              onChange={(e) => setCapsuleText(e.target.value)}
              placeholder="Paste your article or blog post here. Use ## headings for best results…"
              className="w-full h-64 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
            />
            <div className="text-xs text-slate-500">
              {countWords(capsuleText).toLocaleString()} words
            </div>

            {capsuleError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {capsuleError}
              </p>
            )}

            <button
              onClick={() => capsuleMutation.mutate(capsuleText)}
              disabled={capsuleText.trim().length < 10 || capsuleMutation.isLoading}
              className="w-full flex items-centre justify-centre gap-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {capsuleMutation.isLoading ? (
                <>
                  <Spinner />
                  Formatting…
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Format as Capsule
                </>
              )}
            </button>
          </div>

          {/* Right: results */}
          <div>
            {capsuleResult ? (
              <ContentCapsulePreview result={capsuleResult} originalText={capsuleText} />
            ) : (
              <DashboardEmptyState
                icon={FileText}
                title="No capsule yet"
                description="Paste your article and click Format as Capsule to generate an AI-extractable content capsule."
              />
            )}
          </div>
        </div>
      )}

      {/* ─── Slop Scan Tab ───────────────────────────────────────────────── */}
      {activeTab === 'slop' && (
        <div className="space-y-4">
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-300 block">
              Content to Scan
            </label>
            <textarea
              value={slopText}
              onChange={(e) => setSlopText(e.target.value)}
              placeholder="Paste your content here to scan for AI tell-phrases…"
              className="w-full h-48 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
            />
            <div className="text-xs text-slate-500">
              {countWords(slopText).toLocaleString()} words
            </div>

            {slopError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {slopError}
              </p>
            )}

            <button
              onClick={() => slopMutation.mutate(slopText)}
              disabled={slopText.trim().length < 10 || slopMutation.isLoading}
              className="flex items-centre gap-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {slopMutation.isLoading ? (
                <>
                  <Spinner />
                  Scanning…
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Scan for AI Slop
                </>
              )}
            </button>
          </div>

          {slopResult ? (
            <SlopScanResults result={slopResult} />
          ) : (
            <DashboardEmptyState
              icon={Search}
              title="No scan results yet"
              description="Paste content and click Scan for AI Slop to detect AI tell-phrases and overused language."
            />
          )}
        </div>
      )}
    </div>
  );
}
