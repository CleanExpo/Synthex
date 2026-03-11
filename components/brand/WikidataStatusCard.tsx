'use client';

/**
 * Brand Builder — Wikidata Status Card Component (Phase 91)
 *
 * Shows Wikidata entity completeness with Q-ID, property checklist,
 * reference count, and recommendations.
 *
 * @module components/brand/WikidataStatusCard
 */

import { CheckCircle, XCircle, Info, Loader2 } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { WikidataCheckResult } from '@/lib/brand/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WikidataStatusCardProps {
  result: WikidataCheckResult | null;
  loading?: boolean;
  onCheck: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REQUIRED_PROPS = [
  { id: 'P31',  label: 'Instance-of (entity type)' },
  { id: 'P856', label: 'Official website URL' },
  { id: 'P571', label: 'Inception / founding date' },
];

const RECOMMENDED_PROPS = [
  { id: 'P159',  label: 'Headquarters location' },
  { id: 'P112',  label: 'Founder' },
  { id: 'P18',   label: 'Image / logo' },
  { id: 'P2671', label: 'Google Knowledge Graph ID' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColour(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
}

function referenceStrength(count: number): { label: string; className: string } {
  if (count >= 3) return { label: 'Strong',   className: 'text-green-400' };
  if (count >= 1) return { label: 'Moderate', className: 'text-amber-400' };
  return { label: 'Weak',   className: 'text-red-400' };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WikidataStatusCard({ result, loading, onCheck }: WikidataStatusCardProps) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Wikidata Status</h3>
        <button
          onClick={onCheck}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-xs bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          Check Wikidata
        </button>
      </div>

      {/* Empty State */}
      {!result && !loading && (
        <div className="py-6 text-center">
          <Info className="w-7 h-7 text-gray-500 mx-auto mb-2" />
          <p className="text-xs text-gray-400">Click "Check Wikidata" to look up your entity Q-ID and property completeness.</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="py-6 text-center">
          <Loader2 className="w-7 h-7 text-gray-500 mx-auto mb-2 animate-spin" />
          <p className="text-xs text-gray-400">Querying Wikidata…</p>
        </div>
      )}

      {result && !loading && (
        <>
          {/* Found / Not Found */}
          <div className={cn(
            'flex items-center gap-3 p-3 rounded-lg border',
            result.found
              ? 'bg-green-500/10 border-green-500/20'
              : 'bg-red-500/10 border-red-500/20'
          )}>
            {result.found ? (
              <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <div>
              <p className={cn('text-sm font-medium', result.found ? 'text-green-300' : 'text-red-300')}>
                {result.found ? `Found — ${result.qId}` : 'Not found on Wikidata'}
              </p>
              {result.entityLabel && (
                <p className="text-xs text-gray-400">{result.entityLabel}</p>
              )}
            </div>
            {result.found && (
              <span className={cn('ml-auto text-3xl font-bold tabular-nums', scoreColour(result.score))}>
                {result.score}
              </span>
            )}
          </div>

          {/* Properties Checklist */}
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">Required Properties</p>
              <div className="space-y-1.5">
                {REQUIRED_PROPS.map(prop => {
                  const present = result.presentProps.includes(prop.id);
                  return (
                    <div key={prop.id} className="flex items-center gap-2 text-xs">
                      {present ? (
                        <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      )}
                      <span className={present ? 'text-gray-300' : 'text-gray-500'}>
                        <span className="font-mono text-gray-500">{prop.id}</span> — {prop.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">Recommended Properties</p>
              <div className="space-y-1.5">
                {RECOMMENDED_PROPS.map(prop => {
                  const present = result.presentProps.includes(prop.id);
                  return (
                    <div key={prop.id} className="flex items-center gap-2 text-xs">
                      {present ? (
                        <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                      )}
                      <span className={present ? 'text-gray-300' : 'text-gray-500'}>
                        <span className="font-mono text-gray-500">{prop.id}</span> — {prop.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Reference Count */}
          {result.found && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">References:</span>
              <span className={referenceStrength(result.referenceCount).className}>
                {result.referenceCount} — {referenceStrength(result.referenceCount).label}
              </span>
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 space-y-1.5">
              {result.recommendations.map((rec, i) => (
                <p key={i} className="text-xs text-amber-200 flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">→</span>
                  {rec}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
