'use client';

/**
 * CitationScoreGauge — Phase 99
 *
 * Displays the unified "Citation Readiness Score" (0–100) computed from
 * weighted sub-scores across GEO, Quality, E-E-A-T, Authority, and Prompt
 * Intelligence dimensions.
 *
 * Weights:
 *   GEO × 0.25  |  Quality × 0.20  |  E-E-A-T × 0.20  |
 *   Authority × 0.15  |  Prompt coverage × 0.20
 */

interface CitationScoreGaugeProps {
  geoScore: number;
  qualityScore: number;
  eeatScore: number;
  authorityScore: number;
  promptCoverage: number; // 0-100
  loading?: boolean;
}

function gradeFor(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function colourFor(score: number): {
  ring: string;
  text: string;
  bg: string;
} {
  if (score >= 80)
    return { ring: '#10b981', text: 'text-emerald-400', bg: 'bg-emerald-500/10' };
  if (score >= 60)
    return { ring: '#06b6d4', text: 'text-cyan-400', bg: 'bg-cyan-500/10' };
  if (score >= 40)
    return { ring: '#f59e0b', text: 'text-amber-400', bg: 'bg-amber-500/10' };
  return { ring: '#ef4444', text: 'text-red-400', bg: 'bg-red-500/10' };
}

// SVG circle gauge constants
const RADIUS = 72;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CitationScoreGauge({
  geoScore,
  qualityScore,
  eeatScore,
  authorityScore,
  promptCoverage,
  loading = false,
}: CitationScoreGaugeProps) {
  const overall = Math.round(
    geoScore * 0.25 +
      qualityScore * 0.20 +
      eeatScore * 0.20 +
      authorityScore * 0.15 +
      promptCoverage * 0.20
  );

  const grade = gradeFor(overall);
  const { ring, text, bg } = colourFor(overall);

  // Stroke offset: full circle = no fill; 0 = completely filled
  const dashOffset = CIRCUMFERENCE * (1 - overall / 100);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 p-6">
        <div className="w-48 h-48 rounded-full bg-white/5 animate-pulse" />
        <div className="flex flex-wrap gap-2 justify-center">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-6 w-20 rounded-full bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const subScores = [
    { label: 'GEO', value: geoScore },
    { label: 'Quality', value: qualityScore },
    { label: 'E-E-A-T', value: eeatScore },
    { label: 'Authority', value: authorityScore },
    { label: 'Prompts', value: promptCoverage },
  ];

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {/* SVG Gauge */}
      <div className="relative">
        <svg
          width="192"
          height="192"
          viewBox="0 0 192 192"
          aria-label={`Citation Readiness Score: ${overall} out of 100`}
        >
          {/* Background track */}
          <circle
            cx="96"
            cy="96"
            r={RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="12"
          />
          {/* Score arc */}
          <circle
            cx="96"
            cy="96"
            r={RADIUS}
            fill="none"
            stroke={ring}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 96 96)"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>

        {/* Centre text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-4xl font-black ${text}`}>{overall}</span>
          <span className="text-gray-400 text-xs font-semibold tracking-widest uppercase">
            /100
          </span>
          <span className={`text-lg font-bold mt-1 px-2 py-0.5 rounded ${bg} ${text}`}>
            {grade}
          </span>
        </div>
      </div>

      {/* Label */}
      <p className="text-xs text-gray-400 font-medium tracking-wide text-center">
        Citation Readiness Score
      </p>

      {/* Sub-score pills */}
      <div className="flex flex-wrap gap-2 justify-center max-w-xs">
        {subScores.map(({ label, value }) => {
          const { text: t, bg: b } = colourFor(value);
          return (
            <span
              key={label}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${b} ${t}`}
            >
              {label}
              <span className="font-bold">{value}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
