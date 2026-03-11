'use client';

import { useState, useCallback } from 'react';
import { TacticScoreCard } from '@/components/geo/TacticScoreCard';
import { GEOEditorPanel } from '@/components/geo/GEOEditorPanel';
import { RewriteModal } from '@/components/geo/RewriteModal';
import type { GEOTactic, TacticScoreResult } from '@/lib/geo/types';
import { TACTIC_LABELS } from '@/lib/geo/tactic-prompts';

interface RewriteModalState {
  open: boolean;
  tactic: GEOTactic | null;
  tacticLabel: string;
}

function compositeColour(score: number): string {
  if (score >= 70) return 'text-green-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
}

export default function GEOOptimiserPage() {
  const [tacticResult, setTacticResult] = useState<TacticScoreResult | null>(null);
  const [isScoring, setIsScoring] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [improvingTactic, setImprovingTactic] = useState<GEOTactic | null>(null);
  const [rewriteModal, setRewriteModal] = useState<RewriteModalState>({
    open: false,
    tactic: null,
    tacticLabel: '',
  });

  const handleImprove = useCallback((tactic: string) => {
    const geoTactic = tactic as GEOTactic;
    setImprovingTactic(geoTactic);
    setRewriteModal({
      open: true,
      tactic: geoTactic,
      tacticLabel: TACTIC_LABELS[geoTactic],
    });
  }, []);

  const handleRewriteAccept = useCallback((rewrittenContent: string) => {
    setEditorContent(rewrittenContent);
    setRewriteModal({ open: false, tactic: null, tacticLabel: '' });
    setImprovingTactic(null);
    // Score update is triggered automatically via the debounce in GEOEditorPanel
  }, []);

  const handleRewriteReject = useCallback(() => {
    setRewriteModal({ open: false, tactic: null, tacticLabel: '' });
    setImprovingTactic(null);
  }, []);

  const compositeScore = tacticResult ? Math.round(tacticResult.compositeGEOScore) : null;

  return (
    <main className="h-full p-6 overflow-hidden">
      {/* Page Header */}
      <div className="mb-4 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">GEO Optimiser</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Real-time scoring against 9 Princeton GEO tactics
          </p>
        </div>
        {compositeScore !== null && (
          <div className="text-centre flex-shrink-0">
            <div className={`text-3xl font-bold ${compositeColour(compositeScore)}`}>
              {compositeScore}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">Composite Score</div>
          </div>
        )}
      </div>

      {/* Main Grid: Scores | Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 h-[calc(100vh-200px)]">
        {/* Left panel: Tactic Scores */}
        <div className="overflow-y-auto space-y-2 pr-1">
          {tacticResult ? (
            tacticResult.tacticScores.map(score => (
              <TacticScoreCard
                key={score.tactic}
                score={score}
                onImprove={handleImprove}
                improving={improvingTactic === score.tactic}
              />
            ))
          ) : (
            <div className="text-slate-500 text-sm text-centre py-12 px-4">
              {isScoring ? (
                <span className="flex flex-col items-centre gap-2">
                  <svg className="h-5 w-5 animate-spin text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analysing content...
                </span>
              ) : (
                <span>Start typing in the editor to see your tactic scores</span>
              )}
            </div>
          )}
        </div>

        {/* Right panel: Editor */}
        <GEOEditorPanel
          onScoreUpdate={setTacticResult}
          onLoadingChange={setIsScoring}
          onContentChange={setEditorContent}
          value={editorContent}
        />
      </div>

      {/* Rewrite Modal */}
      <RewriteModal
        isOpen={rewriteModal.open}
        tactic={rewriteModal.tactic}
        tacticLabel={rewriteModal.tacticLabel}
        originalContent={editorContent}
        onAccept={handleRewriteAccept}
        onReject={handleRewriteReject}
      />
    </main>
  );
}
