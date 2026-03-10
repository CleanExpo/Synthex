'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DesignQualityScore, DesignIssue } from '@/lib/authority/design-audit/types';

interface DesignAuditCardProps {
  score: DesignQualityScore;
  issues: DesignIssue[];
}

function getBarColor(value: number, max: number): string {
  const pct = value / max;
  if (pct >= 0.8) return 'bg-emerald-500';
  if (pct >= 0.5) return 'bg-amber-500';
  return 'bg-red-500';
}

const SEVERITY_COLORS: Record<string, string> = {
  error: 'text-red-400',
  warning: 'text-amber-400',
  info: 'text-blue-400',
};

export function DesignAuditCard({ score, issues }: DesignAuditCardProps) {
  const dimensions = [
    { label: 'Heading Hierarchy', value: score.headingHierarchy, max: 15 },
    { label: 'Mobile Readiness', value: score.mobileReadiness, max: 15 },
    { label: 'Above-Fold Clarity', value: score.aboveFoldClarity, max: 15 },
    { label: 'Information Density', value: score.informationDensity, max: 15 },
    { label: 'Performance', value: score.performance, max: 15 },
    { label: 'Media Optimisation', value: score.mediaOptimisation, max: 10 },
  ];

  return (
    <Card className="bg-white/5 border-violet-500/10 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-white text-sm font-medium flex items-center justify-between">
          Design Quality
          <span className="text-2xl font-bold text-violet-400">{score.total}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {dimensions.map(dim => (
          <div key={dim.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">{dim.label}</span>
              <span className="text-slate-300">{dim.value}/{dim.max}</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getBarColor(dim.value, dim.max)}`}
                style={{ width: `${(dim.value / dim.max) * 100}%` }}
              />
            </div>
          </div>
        ))}

        {issues.filter(i => i.category !== 'performance' && i.category !== 'citation').length > 0 && (
          <div className="mt-4 space-y-1.5 border-t border-white/10 pt-3">
            {issues
              .filter(i => i.category !== 'performance' && i.category !== 'citation')
              .slice(0, 3)
              .map((issue, idx) => (
                <p key={idx} className={`text-xs ${SEVERITY_COLORS[issue.type] ?? 'text-slate-400'}`}>
                  {issue.message}
                </p>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
