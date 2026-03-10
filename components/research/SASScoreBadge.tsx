'use client';

import { Badge } from '@/components/ui/badge';
import { Award } from '@/components/icons';

export interface SASScoreBadgeProps {
  score: number | null;
  size?: 'sm' | 'md' | 'lg';
}

export function SASScoreBadge({ score, size = 'md' }: SASScoreBadgeProps) {
  if (score === null || score === undefined) {
    return <Badge className="bg-gray-500/20 text-gray-400">SAS: N/A</Badge>;
  }

  const color = score >= 7 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    : score >= 5 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    : 'bg-red-500/20 text-red-400 border-red-500/30';

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  return (
    <Badge className={`${color} ${sizeClasses[size]} flex items-center gap-1`}>
      <Award className="h-3 w-3" />
      SAS: {score.toFixed(1)}/10
    </Badge>
  );
}
