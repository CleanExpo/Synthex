'use client';

// SYN-513: Authority Score display component
// Shows the 0-100 E.E.A.T. composite score with breakdown bars

import type { AuthorityScoreRecord } from '@/lib/clients/getClientBySlug';

interface AuthorityScoreCardProps {
  score: AuthorityScoreRecord | null;
  previousScore?: number | null;
}

const BREAKDOWN_LABELS: Record<string, { label: string; maxPts: number }> = {
  gbp_completeness:  { label: 'Google Business Profile', maxPts: 25 },
  review_velocity:   { label: 'Review Velocity',          maxPts: 20 },
  content_freshness: { label: 'Content Freshness',        maxPts: 20 },
  backlink_signals:  { label: 'Backlink Signals',         maxPts: 15 },
  schema_coverage:   { label: 'Schema Coverage',          maxPts: 10 },
  social_proof:      { label: 'Social Proof',             maxPts: 10 },
};

export default function AuthorityScoreCard({ score, previousScore }: AuthorityScoreCardProps) {
  const delta = score && previousScore != null ? score.score - previousScore : null;

  return (
    <section aria-label="Authority Score" className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-white">Authority Score</h2>
          <p className="text-xs text-slate-400 mt-0.5">E.E.A.T. composite — updated daily</p>
        </div>

        {score ? (
          <div className="flex flex-col items-end">
            <span className="text-5xl font-black text-white tabular-nums">{score.score}</span>
            {delta !== null && (
              <span className={`text-xs font-medium mt-1 ${delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {delta >= 0 ? '+' : ''}{delta} vs last week
              </span>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-end">
            <span className="text-5xl font-black text-slate-600">—</span>
            <span className="text-xs text-slate-500 mt-1">Calculating...</span>
          </div>
        )}
      </div>

      {/* E.E.A.T. breakdown bars */}
      <div className="space-y-3">
        {Object.entries(BREAKDOWN_LABELS).map(([key, { label, maxPts }]) => {
          const pts = score?.eeat_breakdown?.[key as keyof typeof score.eeat_breakdown] ?? 0;
          const pct = Math.min(100, (pts / maxPts) * 100);
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-400">{label}</span>
                <span className="text-xs font-mono text-slate-300">{pts}/{maxPts}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-700/60">
                <div
                  className="h-full rounded-full bg-orange-400 transition-all duration-700"
                  style={{ width: `${pct}%` }}
                  role="progressbar"
                  aria-valuenow={pts}
                  aria-valuemin={0}
                  aria-valuemax={maxPts}
                  aria-label={label}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
