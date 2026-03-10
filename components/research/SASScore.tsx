'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Synthex Authority Score (SAS) Component
 *
 * Displays the proprietary rating methodology for research reports.
 * Part of the Authority Curator skill for Research Report Linkable Assets.
 *
 * Score Thresholds:
 * - 9.0-10.0: Exceptional (Gold badge)
 * - 8.0-8.9: Highly Reliable (Silver badge)
 * - 7.0-7.9: Reliable (Bronze badge)
 * - 6.0-6.9: Adequate (No badge)
 * - <6.0: Not Published (Reject)
 *
 * @module components/research/SASScore
 */

export interface ScoreFactor {
  /** Name of the scoring factor */
  name: string;
  /** Weight percentage (should sum to 100) */
  weight: number;
  /** Current score out of weight */
  score: number;
  /** Description of what this factor measures */
  description?: string;
}

export interface SASScoreProps {
  /** Total score out of 10 */
  totalScore: number;
  /** Individual scoring factors */
  factors: ScoreFactor[];
  /** Methodology version (e.g., "v1.0") */
  methodologyVersion?: string;
  /** Last calculated date in DD/MM/YYYY format */
  lastCalculated?: string;
  /** Additional className for styling */
  className?: string;
  /** Display size variant */
  size?: 'sm' | 'md' | 'lg';
}

const getBadgeInfo = (score: number): { label: string; color: string; bgColor: string } | null => {
  if (score >= 9.0) {
    return { label: 'Exceptional', color: 'text-amber-400', bgColor: 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border-amber-500/40' };
  }
  if (score >= 8.0) {
    return { label: 'Highly Reliable', color: 'text-gray-300', bgColor: 'bg-gradient-to-r from-gray-400/20 to-gray-500/20 border-gray-400/40' };
  }
  if (score >= 7.0) {
    return { label: 'Reliable', color: 'text-orange-400', bgColor: 'bg-gradient-to-r from-orange-600/20 to-orange-700/20 border-orange-500/40' };
  }
  return null; // No badge for scores below 7.0
};

const getScoreColor = (score: number, maxScore: number): string => {
  const percentage = (score / maxScore) * 100;
  if (percentage >= 90) return 'bg-emerald-500';
  if (percentage >= 75) return 'bg-cyan-500';
  if (percentage >= 60) return 'bg-amber-500';
  return 'bg-red-500';
};

export function SASScore({
  totalScore,
  factors,
  methodologyVersion = 'v1.0',
  lastCalculated,
  className,
  size = 'md',
}: SASScoreProps) {
  const badgeInfo = getBadgeInfo(totalScore);

  const sizeClasses = {
    sm: { circle: 'h-16 w-16', text: 'text-xl', label: 'text-xs' },
    md: { circle: 'h-24 w-24', text: 'text-3xl', label: 'text-sm' },
    lg: { circle: 'h-32 w-32', text: 'text-4xl', label: 'text-base' },
  };

  const circumference = 2 * Math.PI * 45; // radius of 45 for the SVG circle
  const progress = (totalScore / 10) * circumference;

  return (
    <Card variant="glass" className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-cyan-400 flex items-center justify-between">
          <span>Synthex Authority Score</span>
          <span className="text-xs text-gray-500 font-normal">{methodologyVersion}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Score Circle */}
        <div className="flex flex-col items-center">
          <div className={cn('relative', sizeClasses[size].circle)}>
            {/* Background circle */}
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                className="text-white/10"
              />
              {/* Progress circle */}
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="url(#scoreGradient)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - progress}
                className="transition-all duration-1000 ease-out"
              />
              <defs>
                <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#0891b2" />
                </linearGradient>
              </defs>
            </svg>
            {/* Score text */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={cn('font-bold text-white', sizeClasses[size].text)}>
                {totalScore.toFixed(1)}
              </span>
            </div>
          </div>

          {/* Badge */}
          {badgeInfo && (
            <div className={cn(
              'mt-4 px-4 py-1.5 rounded-full border',
              badgeInfo.bgColor
            )}>
              <span className={cn('text-sm font-medium', badgeInfo.color)}>
                {badgeInfo.label}
              </span>
            </div>
          )}

          {lastCalculated && (
            <p className="mt-2 text-xs text-gray-500">
              Last calculated: {lastCalculated}
            </p>
          )}
        </div>

        {/* Score Breakdown */}
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Score Breakdown
          </p>
          {factors.map((factor, index) => (
            <div key={index} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">
                  {factor.name}
                  <span className="ml-1 text-xs text-gray-500">({factor.weight}%)</span>
                </span>
                <span className="text-white font-medium">
                  {factor.score}/{factor.weight}
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    getScoreColor(factor.score, factor.weight)
                  )}
                  style={{ width: `${(factor.score / factor.weight) * 100}%` }}
                />
              </div>
              {factor.description && (
                <p className="text-xs text-gray-500">{factor.description}</p>
              )}
            </div>
          ))}
        </div>

        {/* Methodology Note */}
        <div className="border-t border-white/10 pt-4">
          <details className="group">
            <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-300 transition-colors">
              View scoring methodology
            </summary>
            <div className="mt-2 text-xs text-gray-500 space-y-1">
              <p><strong>Data Recency (20%):</strong> Data published within 12 months</p>
              <p><strong>Source Quality (25%):</strong> % from .gov/.edu sources</p>
              <p><strong>Sample Size (20%):</strong> Statistical significance</p>
              <p><strong>Verification (20%):</strong> Independent fact-checking</p>
              <p><strong>Actionability (15%):</strong> Practical recommendations</p>
            </div>
          </details>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact inline version of the SAS Score
 * For use in headers or summary sections
 */
export function SASScoreInline({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  const badgeInfo = getBadgeInfo(score);

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20">
        <span className="text-xs font-medium text-gray-400">SAS</span>
        <span className="text-sm font-bold text-cyan-400">{score.toFixed(1)}</span>
      </div>
      {badgeInfo && (
        <span className={cn('text-xs font-medium', badgeInfo.color)}>
          {badgeInfo.label}
        </span>
      )}
    </div>
  );
}

export default SASScore;
