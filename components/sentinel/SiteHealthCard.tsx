'use client';

/**
 * Site Health Card Component
 *
 * Displays current site health status:
 * - Health score (0-100) with colour-coded gauge
 * - GSC metric row: Avg Position | Clicks | Impressions | Crawl Errors
 * - CWV mini-display: LCP/INP/CLS with pass/fail dots
 * - Last checked timestamp + "Check Now" button
 */

import { useState } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

interface CoreWebVitals {
  lcp: number | null;
  inp: number | null;
  cls: number | null;
  fid: number | null;
}

interface HealthSnapshot {
  avgPosition: number;
  totalClicks: number;
  totalImpressions: number;
  coverageErrors: number;
  coverageWarnings: number;
  coreWebVitals: CoreWebVitals;
  snapshotDate: string;
}

interface SiteHealthCardProps {
  siteUrl: string | null;
  healthScore: number | null;
  lastChecked: string | null;
  snapshot: HealthSnapshot | null;
  onCheckNow: () => Promise<void>;
}

function HealthGauge({ score }: { score: number }) {
  const getColour = (s: number) => {
    if (s >= 80) return { ring: 'text-emerald-400', bg: 'bg-emerald-400/20', label: 'Excellent' };
    if (s >= 60) return { ring: 'text-green-400', bg: 'bg-green-400/20', label: 'Good' };
    if (s >= 40) return { ring: 'text-amber-400', bg: 'bg-amber-400/20', label: 'Fair' };
    return { ring: 'text-red-400', bg: 'bg-red-400/20', label: 'Poor' };
  };
  const { ring, label } = getColour(score);

  return (
    <div className="flex flex-col items-center">
      <div className={`text-5xl font-bold tabular-nums ${ring}`}>{score}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  );
}

type CWVStatus = 'pass' | 'needs-improvement' | 'fail' | 'unknown';

function cwvStatus(metric: 'lcp' | 'inp' | 'cls', value: number | null): CWVStatus {
  if (value === null) return 'unknown';
  if (metric === 'lcp') {
    return value <= 2.5 ? 'pass' : value <= 4.0 ? 'needs-improvement' : 'fail';
  }
  if (metric === 'inp') {
    return value <= 200 ? 'pass' : value <= 500 ? 'needs-improvement' : 'fail';
  }
  // cls
  return value <= 0.1 ? 'pass' : value <= 0.25 ? 'needs-improvement' : 'fail';
}

function CWVDot({ status }: { status: CWVStatus }) {
  const colours: Record<CWVStatus, string> = {
    pass: 'bg-emerald-400',
    'needs-improvement': 'bg-amber-400',
    fail: 'bg-red-400',
    unknown: 'bg-gray-600',
  };
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${colours[status]}`} />;
}

function CWVRow({ cwv }: { cwv: CoreWebVitals }) {
  const lcpStatus = cwvStatus('lcp', cwv.lcp);
  const inpStatus = cwvStatus('inp', cwv.inp);
  const clsStatus = cwvStatus('cls', cwv.cls);

  const fmtLcp = cwv.lcp !== null ? `${cwv.lcp.toFixed(1)}s` : '—';
  const fmtInp = cwv.inp !== null ? `${cwv.inp}ms` : '—';
  const fmtCls = cwv.cls !== null ? cwv.cls.toFixed(2) : '—';

  return (
    <div className="flex items-center gap-4 text-sm">
      {[
        { label: 'LCP', value: fmtLcp, status: lcpStatus },
        { label: 'INP', value: fmtInp, status: inpStatus },
        { label: 'CLS', value: fmtCls, status: clsStatus },
      ].map(({ label, value, status }) => (
        <div key={label} className="flex items-center gap-1.5">
          <CWVDot status={status} />
          <span className="text-gray-400">{label}</span>
          <span className="text-white font-mono text-xs">{value}</span>
        </div>
      ))}
    </div>
  );
}

function MetricPill({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-2 rounded-lg bg-white/5">
      <span className={`text-lg font-bold tabular-nums ${highlight ? 'text-red-400' : 'text-white'}`}>
        {value}
      </span>
      <span className="text-xs text-gray-400 mt-0.5">{label}</span>
    </div>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SiteHealthCard({
  siteUrl,
  healthScore,
  lastChecked,
  snapshot,
  onCheckNow,
}: SiteHealthCardProps) {
  const [checking, setChecking] = useState(false);

  const handleCheckNow = async () => {
    setChecking(true);
    try {
      await onCheckNow();
    } finally {
      setChecking(false);
    }
  };

  if (!siteUrl) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
        <p className="text-gray-400 text-sm">
          No site URL configured. Add your website URL in{' '}
          <a href="/dashboard/settings" className="text-cyan-400 underline">
            profile settings
          </a>{' '}
          to enable site health monitoring.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-semibold text-white">Site Health</h3>
          <p className="text-xs text-gray-400 mt-0.5 font-mono">{siteUrl}</p>
        </div>
        <button
          onClick={handleCheckNow}
          disabled={checking}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
        >
          <ArrowPathIcon className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
          {checking ? 'Checking...' : 'Check Now'}
        </button>
      </div>

      {/* Score + metrics */}
      <div className="flex flex-col sm:flex-row gap-6 items-start">
        {/* Health gauge */}
        <div className="flex-shrink-0">
          {healthScore !== null ? (
            <HealthGauge score={healthScore} />
          ) : (
            <div className="text-gray-500 text-sm">No data yet</div>
          )}
          <div className="text-xs text-gray-500 mt-2 text-center">Health Score</div>
        </div>

        {/* Metric pills */}
        {snapshot && (
          <div className="flex-1">
            <div className="flex flex-wrap gap-2 mb-4">
              <MetricPill
                label="Avg Position"
                value={snapshot.avgPosition > 0 ? snapshot.avgPosition.toFixed(1) : '—'}
              />
              <MetricPill
                label="Clicks (28d)"
                value={snapshot.totalClicks.toLocaleString()}
              />
              <MetricPill
                label="Impressions"
                value={snapshot.totalImpressions.toLocaleString()}
              />
              <MetricPill
                label="Crawl Errors"
                value={String(snapshot.coverageErrors)}
                highlight={snapshot.coverageErrors > 10}
              />
            </div>

            {/* CWV */}
            <CWVRow cwv={snapshot.coreWebVitals} />
          </div>
        )}

        {!snapshot && (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
            Click "Check Now" to run your first health check.
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-white/10 text-xs text-gray-500">
        Last checked: {formatDate(lastChecked)}
      </div>
    </div>
  );
}
