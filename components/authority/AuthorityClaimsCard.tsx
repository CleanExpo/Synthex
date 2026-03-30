'use client';

/**
 * AuthorityClaimsCard
 *
 * Displays the result of a claim-verification authority analysis:
 * overall score, claims found/verified/failed, and source type breakdown.
 *
 * Used by: app/dashboard/authority/page.tsx (claim analysis workflow)
 *
 * NOTE: This is distinct from AuthorityScoreCard (E.E.A.T. composite widget).
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AuthorityClaimsCardProps {
  score: number;
  claimsFound: number;
  claimsVerified: number;
  claimsFailed: number;
  sourceBreakdown: Record<string, number>;
}

function getTier(score: number) {
  if (score >= 80)
    return {
      label: 'Excellent',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    };
  if (score >= 60)
    return {
      label: 'Good',
      color: 'text-orange-400',
      bg: 'bg-orange-500/10 border-orange-500/20',
    };
  if (score >= 40)
    return {
      label: 'Fair',
      color: 'text-orange-400',
      bg: 'bg-orange-500/10 border-orange-500/20',
    };
  return {
    label: 'Needs Work',
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/20',
  };
}

const SOURCE_COLORS: Record<string, string> = {
  government: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  academic: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  industry: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  web: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

export function AuthorityClaimsCard({
  score,
  claimsFound,
  claimsVerified,
  claimsFailed,
  sourceBreakdown,
}: AuthorityClaimsCardProps) {
  const tier = getTier(score);

  return (
    <Card className="bg-white/5 border-orange-500/10 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-white text-sm font-medium">
          Authority Score
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-3 mb-4">
          <span className={`text-5xl font-bold ${tier.color}`}>
            {Math.round(score)}
          </span>
          <span className="text-slate-300 text-lg">/100</span>
          <span
            className={`ml-auto px-2 py-1 rounded border text-xs font-medium ${tier.bg} ${tier.color}`}
          >
            {tier.label}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center">
            <p className="text-lg font-semibold text-white">{claimsFound}</p>
            <p className="text-xs text-slate-300">Found</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-emerald-400">
              {claimsVerified}
            </p>
            <p className="text-xs text-slate-300">Verified</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-red-400">{claimsFailed}</p>
            <p className="text-xs text-slate-300">Failed</p>
          </div>
        </div>

        {Object.entries(sourceBreakdown).filter(([, count]) => count > 0)
          .length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(sourceBreakdown)
              .filter(([, count]) => count > 0)
              .map(([type, count]) => (
                <span
                  key={type}
                  className={`px-2 py-0.5 rounded border text-xs font-medium ${SOURCE_COLORS[type] ?? SOURCE_COLORS.web}`}
                >
                  {type}: {count}
                </span>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
