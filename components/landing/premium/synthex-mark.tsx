import { cn } from '@/lib/utils';

interface SynthexMarkProps {
  className?: string;
  /** Unique SVG paint ids so header and footer can sit on the same page. */
  uid?: string;
}

/**
 * Evidence-field mark: a grounded constellation on an ember plate.
 * One teal node is the verified signal; the rest are the working graph.
 */
export function SynthexMark({ className, uid = 'nav' }: SynthexMarkProps) {
  const plate = `${uid}-plate`;
  const sheen = `${uid}-sheen`;
  const node = `${uid}-node`;

  return (
    <svg
      viewBox="0 0 40 40"
      className={cn('h-9 w-9', className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id={plate} x1="6" y1="2" x2="36" y2="38">
          <stop offset="0%" stopColor="var(--sx-accent-hover)" />
          <stop offset="55%" stopColor="var(--sx-accent)" />
          <stop offset="100%" stopColor="var(--sx-warning)" />
        </linearGradient>
        <linearGradient id={sheen} x1="8" y1="4" x2="28" y2="22">
          <stop
            offset="0%"
            stopColor="var(--sx-text-primary)"
            stopOpacity="0.38"
          />
          <stop offset="100%" stopColor="var(--sx-accent)" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={node} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--sx-evidence-bright)" />
          <stop offset="100%" stopColor="var(--sx-evidence)" />
        </radialGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#${plate})`} />
      <rect
        x="0.6"
        y="0.6"
        width="38.8"
        height="38.8"
        rx="10.4"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="1.2"
      />
      <rect width="40" height="40" rx="11" fill={`url(#${sheen})`} />
      <path
        d="M9.5 27.5 L15.2 13.8 L22.6 22.2 L30.4 11.5"
        stroke="rgba(255,255,255,0.72)"
        strokeWidth="1.35"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M15.2 13.8 L21.2 9.6 L30.4 11.5"
        stroke="rgba(255,255,255,0.38)"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <circle cx="9.5" cy="27.5" r="2.15" fill={`url(#${node})`} />
      <circle cx="15.2" cy="13.8" r="2.35" fill="white" />
      <circle cx="22.6" cy="22.2" r="1.7" fill="rgba(255,255,255,0.78)" />
      <circle
        cx="21.2"
        cy="9.6"
        r="1.45"
        fill="var(--sx-text-primary)"
        fillOpacity="0.72"
      />
      <circle cx="30.4" cy="11.5" r="2.55" fill="white" />
    </svg>
  );
}

export function SynthexWordmark({
  className,
  markId = 'nav',
  compact = false,
}: {
  className?: string;
  markId?: string;
  compact?: boolean;
}) {
  return (
    <span className={cn('flex items-center gap-3', className)}>
      <span className="relative grid place-items-center">
        <span
          className="pointer-events-none absolute inset-[-4px] rounded-[14px] bg-sx-accent/35 blur-md"
          aria-hidden
        />
        <SynthexMark uid={markId} />
      </span>
      <span
        className={cn(
          'font-semibold uppercase tracking-[0.28em] text-sx-text-primary',
          compact ? 'text-xs' : 'text-sm'
        )}
      >
        Synthex
      </span>
    </span>
  );
}
