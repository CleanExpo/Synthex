'use client';

/**
 * /dashboard/eeat
 *
 * E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) score dashboard.
 * Wired to /api/dashboard/eeat via SWR.
 */

import useSWR from 'swr';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface EEATFactor {
  label: string;
  score: number;      // 0–100
  maxScore: number;
  status: 'good' | 'fair' | 'poor';
  tips: string[];
}

interface EEATData {
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  experience: EEATFactor;
  expertise: EEATFactor;
  authoritativeness: EEATFactor;
  trustworthiness: EEATFactor;
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    action: string;
    impact: string;
  }>;
  lastUpdated: string;
}

async function fetcher(url: string): Promise<EEATData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load E-E-A-T data (${res.status})`);
  return res.json();
}

const STATUS_ICON = {
  good: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  fair: <AlertTriangle className="h-4 w-4 text-amber-400" />,
  poor: <XCircle className="h-4 w-4 text-red-400" />,
};

const STATUS_BAR = {
  good: 'bg-emerald-500',
  fair: 'bg-amber-500',
  poor: 'bg-red-500',
};

const PRIORITY_BADGE = {
  high: 'text-red-400 border-red-400/30 bg-red-400/10',
  medium: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
  low: 'text-white/40 border-white/20 bg-white/5',
};

const GRADE_COLOR: Record<EEATData['grade'], string> = {
  A: 'text-emerald-400',
  B: 'text-amber-400',
  C: 'text-orange-400',
  D: 'text-red-400',
  F: 'text-red-600',
};

function EEATFactorCard({ factor }: { factor: EEATFactor }) {
  const pct = (factor.score / factor.maxScore) * 100;
  return (
    <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {STATUS_ICON[factor.status]}
          <h3 className="text-sm font-medium text-white">{factor.label}</h3>
        </div>
        <span className="text-sm font-semibold text-white">
          {factor.score}/{factor.maxScore}
        </span>
      </div>
      <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full ${STATUS_BAR[factor.status]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {factor.tips.length > 0 && (
        <ul className="space-y-1">
          {factor.tips.slice(0, 2).map((tip, i) => (
            <li key={i} className="text-xs text-white/40 flex gap-1.5">
              <span className="text-amber-500/60 mt-0.5 flex-shrink-0">•</span>
              {tip}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function EeatPage() {
  const { data, error, isLoading } = useSWR<EEATData>('/api/dashboard/eeat', fetcher, {
    refreshInterval: 3_600_000, // 1 hour
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="border-b border-white/[0.06] pb-6">
          <div className="h-4 w-32 bg-white/[0.05] rounded-sm mb-3" />
          <div className="h-8 w-48 bg-white/[0.05] rounded-sm" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4 space-y-3">
              <div className="h-4 w-32 bg-white/[0.05] rounded-sm" />
              <div className="h-2 w-full bg-white/[0.05] rounded-full" />
              <div className="h-3 w-5/6 bg-white/[0.05] rounded-sm" />
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
        <AlertDescription>Failed to load E-E-A-T data. {error.message}</AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8">
      <div className="border-b border-white/[0.06] pb-6">
        <p className="text-xs uppercase tracking-widest text-white/40 mb-2">SEO</p>
        <h1 className="text-2xl font-semibold text-white">E-E-A-T Score</h1>
        <p className="text-xs text-white/30 mt-1">
          Last updated {new Date(data.lastUpdated).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Overall score */}
      <div className="border-[0.5px] border-amber-500/20 bg-amber-500/5 rounded-sm p-6 flex items-center gap-8">
        <div className="text-center">
          <p className={`text-6xl font-bold ${GRADE_COLOR[data.grade]}`}>{data.grade}</p>
          <p className="text-xs text-white/30 mt-1">Grade</p>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-white/60">Overall E-E-A-T Score</p>
            <p className="text-2xl font-semibold text-white">{data.overallScore}/100</p>
          </div>
          <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full"
              style={{ width: `${data.overallScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* Factor cards */}
      <div className="grid grid-cols-2 gap-4">
        <EEATFactorCard factor={data.experience} />
        <EEATFactorCard factor={data.expertise} />
        <EEATFactorCard factor={data.authoritativeness} />
        <EEATFactorCard factor={data.trustworthiness} />
      </div>

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <div className="border-[0.5px] border-white/[0.06] rounded-sm overflow-hidden">
          <div className="border-b border-white/[0.06] p-4">
            <h2 className="text-sm font-medium text-white">Recommended Actions</h2>
          </div>
          {data.recommendations.map((rec, i) => (
            <div key={i} className="border-b border-white/[0.04] p-4 flex gap-4 hover:bg-white/[0.01] transition-colors">
              <span className={`text-[10px] font-medium px-1.5 py-0.5 border rounded-sm flex-shrink-0 self-start ${PRIORITY_BADGE[rec.priority]}`}>
                {rec.priority}
              </span>
              <div>
                <p className="text-sm text-white/80">{rec.action}</p>
                <p className="text-xs text-white/30 mt-0.5">{rec.impact}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
