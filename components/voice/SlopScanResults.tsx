'use client';

import { cn } from '@/lib/utils';
import { CheckCircle, AlertTriangle, AlertCircle } from '@/components/icons';
import type { SlopScanResult, SlopCategory, SlopMatch } from '@/lib/voice/types';

interface SlopScanResultsProps {
  result: SlopScanResult;
  className?: string;
}

// ---------------------------------------------------------------------------
// Category display labels
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<SlopCategory, string> = {
  transition: 'Transition Phrases',
  filler: 'Filler Phrases',
  'overused-word': 'Overused Words',
  'structural-pattern': 'Structural Patterns',
  hedge: 'Hedging Language',
};

const CATEGORY_ORDER: SlopCategory[] = [
  'overused-word',
  'transition',
  'structural-pattern',
  'filler',
  'hedge',
];

// ---------------------------------------------------------------------------
// Severity styling
// ---------------------------------------------------------------------------

function severityStyles(severity: 'error' | 'warning') {
  if (severity === 'error') {
    return {
      chip: 'bg-red-500/20 text-red-300 border-red-500/30',
      dot: 'bg-red-400',
    };
  }
  return {
    chip: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    dot: 'bg-amber-400',
  };
}

// ---------------------------------------------------------------------------
// Overall severity badge
// ---------------------------------------------------------------------------

function OverallBadge({ severity }: { severity: SlopScanResult['overallSeverity'] }) {
  if (severity === 'clean') {
    return (
      <span className="inline-flex items-centre gap-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full text-xs font-medium">
        <CheckCircle className="w-3.5 h-3.5" />
        Clean
      </span>
    );
  }
  if (severity === 'warning') {
    return (
      <span className="inline-flex items-centre gap-1.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-full text-xs font-medium">
        <AlertTriangle className="w-3.5 h-3.5" />
        Warning
      </span>
    );
  }
  return (
    <span className="inline-flex items-centre gap-1.5 bg-red-500/20 text-red-400 border border-red-500/30 px-2.5 py-1 rounded-full text-xs font-medium">
      <AlertCircle className="w-3.5 h-3.5" />
      Error
    </span>
  );
}

// ---------------------------------------------------------------------------
// Single match row
// ---------------------------------------------------------------------------

function MatchRow({ match }: { match: SlopMatch }) {
  const styles = severityStyles(match.severity);
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <span className={cn('mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0', styles.dot)} />
      <div className="flex-1 min-w-0">
        <span className={cn('inline text-xs font-mono px-1.5 py-0.5 rounded border', styles.chip)}>
          &ldquo;{match.phrase}&rdquo;
        </span>
        {match.suggestion && (
          <span className="ml-2 text-xs text-slate-500">→ {match.suggestion}</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SlopScanResults
// ---------------------------------------------------------------------------

export function SlopScanResults({ result, className }: SlopScanResultsProps) {
  // Group matches by category
  const grouped = result.matches.reduce<Partial<Record<SlopCategory, SlopMatch[]>>>(
    (acc, match) => {
      if (!acc[match.category]) acc[match.category] = [];
      acc[match.category]!.push(match);
      return acc;
    },
    {}
  );

  const densityColour =
    result.slopDensity === 0
      ? 'text-emerald-400'
      : result.slopDensity < 1
        ? 'text-amber-400'
        : 'text-red-400';

  return (
    <div className={cn('bg-white/5 border border-white/10 backdrop-blur-sm rounded-xl p-4 space-y-4', className)}>
      {/* Header bar */}
      <div className="flex items-centre justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-base font-semibold text-white">Slop Scan</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {result.wordCount.toLocaleString()} words analysed
          </p>
        </div>
        <OverallBadge severity={result.overallSeverity} />
      </div>

      {/* Stats row */}
      <div className="flex items-centre gap-4 flex-wrap">
        <div className="flex items-baseline gap-1">
          <span className={cn('text-xl font-bold', densityColour)}>
            {result.slopDensity.toFixed(2)}
          </span>
          <span className="text-xs text-slate-500">matches / 100 words</span>
        </div>
        {result.errorCount > 0 && (
          <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">
            {result.errorCount} error{result.errorCount !== 1 ? 's' : ''}
          </span>
        )}
        {result.warningCount > 0 && (
          <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
            {result.warningCount} warning{result.warningCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Clean state */}
      {result.overallSeverity === 'clean' && (
        <div className="flex items-centre gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
          <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <p className="text-sm text-emerald-300">No AI tell-phrases detected. Writing reads as authentically human.</p>
        </div>
      )}

      {/* Grouped match list */}
      {result.totalMatches > 0 && (
        <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
          {CATEGORY_ORDER.filter((cat) => grouped[cat] && grouped[cat]!.length > 0).map((cat) => (
            <div key={cat}>
              <div className="flex items-centre gap-2 mb-1">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  {CATEGORY_LABELS[cat]}
                </span>
                <span className="text-xs text-slate-600">({grouped[cat]!.length})</span>
              </div>
              <div className="space-y-0.5 border-l border-white/5 pl-3">
                {grouped[cat]!.map((match, i) => (
                  <MatchRow key={`${match.phrase}-${i}`} match={match} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <p className="text-xs text-slate-600 pt-1 border-t border-white/5">
        Powered by SLOP_PATTERNS_V1 · {CATEGORY_ORDER.length} categories · {result.totalMatches} total match{result.totalMatches !== 1 ? 'es' : ''}
      </p>
    </div>
  );
}
