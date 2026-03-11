'use client';

import { Brain, TrendingUp, Sparkles } from '@/components/icons';

type LearningState = 'cold' | 'learning' | 'optimised';

interface LearningIndicatorProps {
  totalObservations: number;
  bestTarget: number | null;
  className?: string;
}

function getLearningState(
  totalObservations: number,
  bestTarget: number | null,
): LearningState {
  if (totalObservations === 0) return 'cold';
  if (totalObservations >= 10 && bestTarget !== null) return 'optimised';
  return 'learning';
}

/**
 * Small inline badge communicating the AI learning state for a BO space.
 *
 * States:
 * - cold (0 obs): "No data yet" — gray
 * - learning (1–9 obs): "AI is learning — N observations" — amber
 * - optimised (10+ obs with bestTarget): "Optimised" — emerald
 */
export function LearningIndicator({
  totalObservations,
  bestTarget,
  className = '',
}: LearningIndicatorProps) {
  const state = getLearningState(totalObservations, bestTarget);

  if (state === 'cold') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400 text-xs font-medium ${className}`}
      >
        <Brain className="h-3 w-3" />
        No data yet
      </span>
    );
  }

  if (state === 'learning') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium ${className}`}
      >
        <TrendingUp className="h-3 w-3" />
        AI is learning — {totalObservations} observation{totalObservations !== 1 ? 's' : ''}
      </span>
    );
  }

  // optimised
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium ${className}`}
    >
      <Sparkles className="h-3 w-3" />
      Optimised
    </span>
  );
}

export default LearningIndicator;
