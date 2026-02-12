'use client';

/**
 * Score Gauge Component
 * Circular score visualization for SEO health
 */

interface ScoreGaugeProps {
  score: number;
}

function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-400';
  if (score >= 70) return 'text-yellow-400';
  if (score >= 50) return 'text-orange-400';
  return 'text-red-400';
}

function getScoreBgGradient(score: number): string {
  if (score >= 90) return 'from-green-500/20 to-green-600/20';
  if (score >= 70) return 'from-yellow-500/20 to-yellow-600/20';
  if (score >= 50) return 'from-orange-500/20 to-orange-600/20';
  return 'from-red-500/20 to-red-600/20';
}

export function ScoreGauge({ score }: ScoreGaugeProps) {
  return (
    <div className={`relative w-32 h-32 rounded-full bg-gradient-to-br ${getScoreBgGradient(score)} flex items-center justify-center`}>
      <div className="absolute inset-2 rounded-full bg-[#0f172a]" />
      <span className={`relative text-4xl font-bold ${getScoreColor(score)}`}>
        {score}
      </span>
    </div>
  );
}

export { getScoreColor, getScoreBgGradient };
