'use client';

// SYN-527: Brand IQ Score Card
// Locked state by default. Unlocks when first_win_detected = true.
// Animated reveal on unlock (0.6s CSS transition).

import { useState, useEffect } from 'react';

export interface BrandIQData {
  voiceConsistencyScore: number;  // 0-100
  topAttributes: string[];        // e.g. ['educational', 'conversational', 'visual']
  bestPostingWindow: string;      // e.g. 'Tue-Thu 7-9am AEDT'
  audienceResonanceScore: number; // 0-100
  nextSteps: string[];            // 3 AI-generated actionable steps
}

interface BrandIQCardProps {
  firstWinDetected: boolean;
  brandIQData?: BrandIQData | null;
  isLoadingNextSteps?: boolean;
}

export default function BrandIQCard({
  firstWinDetected,
  brandIQData,
  isLoadingNextSteps = false,
}: BrandIQCardProps) {
  const [revealed, setRevealed] = useState(false);

  // Trigger reveal animation on first win unlock
  useEffect(() => {
    if (firstWinDetected) {
      // Small delay to let component mount before animating
      const t = setTimeout(() => setRevealed(true), 100);
      return () => clearTimeout(t);
    }
  }, [firstWinDetected]);

  return (
    <section
      aria-label="Brand IQ Score Card"
      className="relative overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-800/40 p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-white">Brand IQ</h2>
          <p className="text-xs text-slate-400 mt-0.5">Content intelligence profile</p>
        </div>
        {firstWinDetected && (
          <span className="flex items-center gap-1.5 rounded-full bg-orange-400/15 px-2.5 py-1 text-xs font-medium text-orange-400">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400" aria-hidden="true" />
            Active
          </span>
        )}
      </div>

      {/* Locked state */}
      {!firstWinDetected && (
        <div className="relative">
          {/* Blurred preview */}
          <div className="blur-sm pointer-events-none select-none" aria-hidden="true">
            <LockedPreview />
          </div>

          {/* Lock overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-700 mb-3">
              <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-white">Unlock after your first win</p>
            <p className="text-xs text-slate-400 mt-1 text-center max-w-[200px]">
              Keep posting — your Brand IQ activates when a post outperforms your average.
            </p>
          </div>
        </div>
      )}

      {/* Unlocked state */}
      {firstWinDetected && brandIQData && (
        <div
          style={{
            opacity: revealed ? 1 : 0,
            transform: revealed ? 'translateY(0)' : 'translateY(12px)',
            transition: 'opacity 0.6s ease, transform 0.6s ease',
          }}
        >
          {/* Score ring row */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <ScoreRing
              label="Voice Consistency"
              score={brandIQData.voiceConsistencyScore}
              color="#FF791D"
            />
            <ScoreRing
              label="Audience Resonance"
              score={brandIQData.audienceResonanceScore}
              color="#22C55E"
            />
          </div>

          {/* Top attributes */}
          <div className="mb-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Top content attributes</p>
            <div className="flex flex-wrap gap-2">
              {brandIQData.topAttributes.map(attr => (
                <span
                  key={attr}
                  className="rounded-full bg-slate-700/60 px-3 py-1 text-xs font-medium text-slate-300"
                >
                  {attr}
                </span>
              ))}
            </div>
          </div>

          {/* Best posting window */}
          <div className="mb-6 rounded-lg bg-slate-700/30 px-4 py-3">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Best posting window</p>
            <p className="text-sm font-semibold text-white">{brandIQData.bestPostingWindow}</p>
          </div>

          {/* Next steps */}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Next steps</p>
            {isLoadingNextSteps ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-4 rounded bg-slate-700/50 animate-pulse" style={{ width: `${70 + i * 8}%` }} />
                ))}
              </div>
            ) : (
              <ol className="space-y-2">
                {brandIQData.nextSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-orange-400/20 text-xs font-bold text-orange-400">
                      {i + 1}
                    </span>
                    <p className="text-sm text-slate-300 leading-relaxed">{step}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}

      {/* Unlocked but data still loading */}
      {firstWinDetected && !brandIQData && (
        <div className="space-y-3">
          {[80, 60, 90, 70].map((w, i) => (
            <div key={i} className="h-4 rounded bg-slate-700/50 animate-pulse" style={{ width: `${w}%` }} />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function ScoreRing({ label, score, color }: { label: string; score: number; color: string }) {
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="72" height="72" viewBox="0 0 72 72" aria-label={`${label}: ${score} out of 100`}>
        <circle cx="36" cy="36" r={radius} fill="none" stroke="#334155" strokeWidth="6" />
        <circle
          cx="36" cy="36" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
        <text x="36" y="40" textAnchor="middle" className="text-sm font-bold" fill="white" fontSize="14" fontWeight="700">
          {score}
        </text>
      </svg>
      <p className="text-xs text-slate-400 text-center leading-tight">{label}</p>
    </div>
  );
}

function LockedPreview() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="h-20 rounded-lg bg-slate-700/40" />
        <div className="h-20 rounded-lg bg-slate-700/40" />
      </div>
      <div className="h-6 w-2/3 rounded bg-slate-700/40" />
      <div className="h-6 w-1/2 rounded bg-slate-700/40" />
      <div className="h-16 rounded-lg bg-slate-700/40" />
    </div>
  );
}
