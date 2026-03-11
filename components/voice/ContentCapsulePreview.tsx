'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { ContentCapsuleResult } from '@/lib/voice/types';

interface ContentCapsulePreviewProps {
  result: ContentCapsuleResult;
  originalText: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Extractability score label and colour
// ---------------------------------------------------------------------------

function extractabilityLabel(score: number): { label: string; colour: string; ring: string } {
  // score is 0–1, we display as 0–100
  const pct = Math.round(score * 100);
  if (pct >= 80) return { label: 'Excellent', colour: 'text-emerald-400', ring: 'border-emerald-500/50' };
  if (pct >= 60) return { label: 'Good', colour: 'text-cyan-400', ring: 'border-cyan-500/50' };
  if (pct >= 40) return { label: 'Fair', colour: 'text-amber-400', ring: 'border-amber-500/50' };
  return { label: 'Poor', colour: 'text-red-400', ring: 'border-red-500/50' };
}

// ---------------------------------------------------------------------------
// ContentCapsulePreview
// ---------------------------------------------------------------------------

export function ContentCapsulePreview({ result, originalText, className }: ContentCapsulePreviewProps) {
  const [view, setView] = useState<'original' | 'capsule'>('capsule');

  const scorePct = Math.round(result.extractability * 100);
  const { label: scoreLabel, colour: scoreColour, ring: scoreRing } = extractabilityLabel(result.extractability);

  return (
    <div className={cn('bg-white/5 border border-white/10 backdrop-blur-sm rounded-xl p-4 space-y-4', className)}>
      {/* Header */}
      <div>
        <h3 className="text-base font-semibold text-white">Content Capsule</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          {result.wordCount.toLocaleString()} words · Created {new Date(result.createdAt).toLocaleDateString('en-AU')}
        </p>
      </div>

      {/* Extractability Score */}
      <div className="flex items-centre gap-4">
        <div className={cn(
          'w-16 h-16 rounded-full border-2 flex flex-col items-centre justify-centre flex-shrink-0',
          scoreRing
        )}>
          <span className={cn('text-xl font-bold leading-none', scoreColour)}>{scorePct}</span>
          <span className="text-xs text-slate-500 leading-none mt-0.5">/ 100</span>
        </div>
        <div>
          <p className={cn('text-sm font-semibold', scoreColour)}>{scoreLabel} extractability</p>
          <p className="text-xs text-slate-500 mt-0.5">
            How likely AI systems are to cite and re-use this content
          </p>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex rounded-lg bg-white/5 p-0.5 gap-0.5">
        {(['capsule', 'original'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              'flex-1 text-sm py-1.5 rounded-md transition-colors font-medium',
              view === v
                ? 'bg-cyan-500/20 text-cyan-300'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            {v === 'capsule' ? 'Capsule Format' : 'Original'}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="min-h-[120px]">
        {view === 'original' ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">
              {originalText.split(/\s+/).length.toLocaleString()} words
            </p>
            <div className="bg-white/3 rounded-lg p-3 max-h-64 overflow-y-auto">
              <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                {originalText}
              </pre>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Core claim */}
            <div className="space-y-1">
              <span className="text-xs font-medium text-cyan-400 uppercase tracking-wider">Core Claim</span>
              <p className="text-sm text-white leading-relaxed bg-white/3 rounded-lg p-3 border border-cyan-500/10">
                {result.coreClaim}
              </p>
            </div>

            {/* Supporting points */}
            {result.supportingPoints.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Supporting Points</span>
                <ul className="space-y-1.5">
                  {result.supportingPoints.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-500/10 text-cyan-400 text-xs flex items-centre justify-centre mt-0.5 font-medium">
                        {i + 1}
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Key terms */}
            {result.keyTerms.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Key Terms</span>
                <div className="flex flex-wrap gap-1.5">
                  {result.keyTerms.map((term) => (
                    <span
                      key={term}
                      className="text-xs bg-white/5 border border-white/10 text-slate-300 px-2 py-0.5 rounded-full"
                    >
                      {term}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
