'use client';

/**
 * CharacterCounter Component
 *
 * Real-time character count indicator with colour-coded feedback
 * (green / amber / red) and progress bar.
 */

interface CharacterCounterProps {
  /** Current character count */
  current: number;
  /** Maximum characters allowed by the platform */
  max: number;
  /** Show "Over by X characters" warning when exceeded (default true) */
  showWarning?: boolean;
}

export function CharacterCounter({
  current,
  max,
  showWarning = true,
}: CharacterCounterProps) {
  const ratio = max > 0 ? current / max : 0;
  const isOver = current > max;
  const isWarning = ratio >= 0.8 && !isOver;

  // Colour classes based on ratio
  const colourClass = isOver
    ? 'text-red-400'
    : isWarning
      ? 'text-amber-400'
      : 'text-green-400';

  const barColourClass = isOver
    ? 'bg-red-400'
    : isWarning
      ? 'bg-amber-400'
      : 'bg-green-400';

  // Clamp bar width to 100% for display
  const barWidth = Math.min(ratio * 100, 100);

  return (
    <div className="space-y-1.5">
      {/* Progress bar */}
      <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColourClass}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>

      {/* Count text */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium tabular-nums ${colourClass}`}>
          {current.toLocaleString()} / {max.toLocaleString()}
        </span>

        {showWarning && isOver && (
          <span className="text-xs text-red-400 font-medium">
            Over by {(current - max).toLocaleString()} characters
          </span>
        )}
      </div>
    </div>
  );
}
