'use client';

/**
 * GeoScoreRing — SYN-657
 *
 * SVG circular ring displaying a client GEO Score (0–100).
 * Colour bands:
 *   0–33   → red    (#EF4444) — "Low"
 *   34–66  → amber  (#F59E0B) — "Growing"
 *   67–100 → green  (#10B981) — "Strong"
 *
 * WCAG AA: colour is NOT the only differentiator — text label accompanies ring.
 */

const RADIUS = 60;
const STROKE_WIDTH = 10;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SIZE = (RADIUS + STROKE_WIDTH) * 2;

type ScoreBand = 'low' | 'growing' | 'strong';

function bandFor(score: number): ScoreBand {
  if (score <= 33) return 'low';
  if (score <= 66) return 'growing';
  return 'strong';
}

const BAND_COLOUR: Record<ScoreBand, string> = {
  low:     '#EF4444',
  growing: '#F59E0B',
  strong:  '#10B981',
};

const BAND_LABEL: Record<ScoreBand, string> = {
  low:     'Low',
  growing: 'Growing',
  strong:  'Strong',
};

interface GeoScoreRingProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_SCALE: Record<'sm' | 'md' | 'lg', number> = {
  sm: 0.6,
  md: 1.0,
  lg: 1.3,
};

export function GeoScoreRing({ score, size = 'md' }: GeoScoreRingProps) {
  const band    = bandFor(score);
  const colour  = BAND_COLOUR[band];
  const label   = BAND_LABEL[band];
  const scale   = SIZE_SCALE[size];
  const px      = Math.round(SIZE * scale);

  const filled = (score / 100) * CIRCUMFERENCE;
  const offset = CIRCUMFERENCE - filled;

  const cx = SIZE / 2;
  const cy = SIZE / 2;

  return (
    <div className="flex flex-col items-center gap-1" aria-label={`GEO Score: ${score} — ${label}`}>
      <svg
        width={px}
        height={px}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-hidden="true"
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Track ring */}
        <circle
          cx={cx}
          cy={cy}
          r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={STROKE_WIDTH}
        />
        {/* Score arc */}
        <circle
          cx={cx}
          cy={cy}
          r={RADIUS}
          fill="none"
          stroke={colour}
          strokeWidth={STROKE_WIDTH}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>

      {/* Score + label overlay — positioned in centre of SVG */}
      <div
        className="flex flex-col items-center"
        style={{ marginTop: `-${px * 0.75}px` }}
        aria-live="polite"
      >
        <span
          className="font-bold tabular-nums"
          style={{ fontSize: `${Math.round(px * 0.25)}px`, color: colour }}
        >
          {score}
        </span>
        <span
          className="font-medium uppercase tracking-wider"
          style={{
            fontSize:   `${Math.round(px * 0.1)}px`,
            color:      colour,
            opacity:    0.8,
            marginBottom: `${px * 0.75}px`,
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
