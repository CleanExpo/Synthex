'use client';

import type { TacticScore } from '@/lib/geo/types';

interface TacticScoreCardProps {
  score: TacticScore;
  onImprove: (tactic: string) => void;
  /** true while the AI rewrite is in progress for this tactic */
  improving?: boolean;
}

function statusColours(status: 'green' | 'amber' | 'red') {
  if (status === 'green') {
    return {
      border: 'border-green-500/30',
      text: 'text-green-400',
      bg: 'bg-green-500',
    };
  }
  if (status === 'amber') {
    return {
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      bg: 'bg-amber-500',
    };
  }
  return {
    border: 'border-red-500/30',
    text: 'text-red-400',
    bg: 'bg-red-500',
  };
}

export function TacticScoreCard({ score, onImprove, improving = false }: TacticScoreCardProps) {
  const colours = statusColours(score.status);
  const showImprove = score.status !== 'green';
  const showSuggestions = score.status !== 'green' && score.suggestions.length > 0;

  return (
    <div
      className={`rounded-lg border p-3 bg-white/5 ${colours.border} transition-colors`}
    >
      {/* Header row */}
      <div className="flex items-centre justify-between gap-2">
        <div className="flex items-centre gap-1.5 min-w-0">
          {/* Status dot */}
          <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${colours.bg}`} />
          <span className="text-sm font-medium text-slate-200 truncate">{score.label}</span>
        </div>
        <span className={`text-sm font-bold flex-shrink-0 ${colours.text}`}>
          {score.score}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colours.bg}`}
          style={{ width: `${Math.max(2, score.score)}%` }}
        />
      </div>

      {/* Explanation */}
      <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">{score.explanation}</p>

      {/* Suggestions (amber/red only) */}
      {showSuggestions && (
        <ul className="mt-1.5 space-y-0.5">
          {score.suggestions.map((suggestion, i) => (
            <li key={i} className="text-xs text-slate-500 flex gap-1.5">
              <span className="flex-shrink-0 text-slate-600">•</span>
              <span>{suggestion}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Improve button (amber/red only) */}
      {showImprove && (
        <button
          onClick={() => onImprove(score.tactic)}
          disabled={improving}
          className="mt-2 text-xs text-cyan-400 hover:text-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-centre gap-1 transition-colors"
        >
          {improving ? (
            <>
              <svg
                className="h-3 w-3 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Improving...
            </>
          ) : (
            <>Improve ↗</>
          )}
        </button>
      )}
    </div>
  );
}
