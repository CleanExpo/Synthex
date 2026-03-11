'use client';

/**
 * Brand Builder — Knowledge Panel Status Component (Phase 91)
 *
 * Shows Google Knowledge Graph entity confidence %, KGMID,
 * entity types, and explanation of what's needed to get a KG entry.
 *
 * @module components/brand/KnowledgePanelStatus
 */

import { Info, Loader2 } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { KGCheckResult } from '@/lib/brand/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KnowledgePanelStatusProps {
  result: KGCheckResult | null;
  loading?: boolean;
  onCheck: () => void;
  hasApiKey: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function confidenceColour(confidence: number): string {
  if (confidence >= 0.7) return 'text-green-400';
  if (confidence >= 0.4) return 'text-amber-400';
  return 'text-red-400';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KnowledgePanelStatus({ result, loading, onCheck, hasApiKey }: KnowledgePanelStatusProps) {
  const confidencePercent = result
    ? Math.round(result.confidence * 100)
    : null;

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Knowledge Panel Status</h3>
        <button
          onClick={onCheck}
          disabled={loading || !hasApiKey}
          title={!hasApiKey ? 'GOOGLE_KG_API_KEY not configured' : undefined}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg transition-colors',
            hasApiKey
              ? 'bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-300 disabled:opacity-50'
              : 'bg-gray-500/10 border border-gray-500/20 text-gray-500 cursor-not-allowed'
          )}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          {hasApiKey ? 'Check Knowledge Graph' : 'API key not configured'}
        </button>
      </div>

      {/* No API Key state */}
      {!hasApiKey && (
        <div className="bg-gray-500/10 border border-gray-500/20 rounded-lg p-4">
          <p className="text-xs text-gray-400 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-500" />
            Set <code className="font-mono text-gray-300">GOOGLE_KG_API_KEY</code> in your environment variables to enable Knowledge Graph checks. Free tier: 100 requests/day.
          </p>
        </div>
      )}

      {/* Empty State */}
      {hasApiKey && !result && !loading && (
        <div className="py-6 text-center">
          <Info className="w-7 h-7 text-gray-500 mx-auto mb-2" />
          <p className="text-xs text-gray-400">Click "Check Knowledge Graph" to look up your entity in Google's Knowledge Graph.</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="py-6 text-center">
          <Loader2 className="w-7 h-7 text-gray-500 mx-auto mb-2 animate-spin" />
          <p className="text-xs text-gray-400">Querying Google Knowledge Graph…</p>
        </div>
      )}

      {result && !loading && (
        <>
          {/* Confidence Score */}
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className={cn('text-5xl font-bold tabular-nums', result.found ? confidenceColour(result.confidence) : 'text-gray-500')}>
                {result.found ? `${confidencePercent}%` : '—'}
              </div>
              <p className="text-xs text-gray-500 mt-1">KG Confidence</p>
            </div>
            <div className="flex-1 space-y-1">
              {result.kgmid && (
                <div className="text-xs">
                  <span className="text-gray-500">KGMID: </span>
                  <code className="font-mono text-purple-300">{result.kgmid}</code>
                </div>
              )}
              {result.name && (
                <div className="text-xs">
                  <span className="text-gray-500">Name: </span>
                  <span className="text-gray-200">{result.name}</span>
                </div>
              )}
              {result.description && (
                <p className="text-xs text-gray-400 line-clamp-2">{result.description}</p>
              )}
            </div>
          </div>

          {/* Entity Types */}
          {result.types.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {result.types.map((type, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-full"
                >
                  {type.replace('schema:', '')}
                </span>
              ))}
            </div>
          )}

          {/* Not Found explanation */}
          {!result.found && (
            <div className="bg-gray-500/10 border border-gray-500/20 rounded-lg p-4 space-y-2">
              <p className="text-xs font-medium text-gray-300">Not found in Knowledge Graph</p>
              <p className="text-xs text-gray-400">
                To be eligible for a Knowledge Panel, your entity typically needs:
              </p>
              <ul className="space-y-1 text-xs text-gray-400">
                <li className="flex items-start gap-2"><span className="text-gray-500">→</span>A Wikidata entry with 3+ properties</li>
                <li className="flex items-start gap-2"><span className="text-gray-500">→</span>95%+ NAP consistency across sameAs platforms</li>
                <li className="flex items-start gap-2"><span className="text-gray-500">→</span>Multiple external citations from authoritative sources</li>
                <li className="flex items-start gap-2"><span className="text-gray-500">→</span>Consistent brand presence across Google-indexed properties</li>
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
