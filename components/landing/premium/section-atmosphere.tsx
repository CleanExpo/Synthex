import { cn } from '@/lib/utils';

const variants = {
  hero: 'landing-gradient-mesh',
  ember: 'landing-mesh-ember',
  evidence: 'landing-mesh-evidence',
  cta: 'landing-mesh-cta',
  ink: '',
} as const;

export function PageAmbient() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      aria-hidden
    >
      <div className="landing-gradient-mesh absolute inset-0 opacity-80" />
      <div className="landing-mesh-ember absolute inset-0 opacity-40" />
    </div>
  );
}

export function SectionAtmosphere({
  variant,
  scanlines = false,
  noise = false,
  className,
}: {
  variant: keyof typeof variants;
  scanlines?: boolean;
  noise?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn('pointer-events-none absolute inset-0', className)}
      aria-hidden
    >
      {variants[variant] ? (
        <div className={cn('absolute inset-0', variants[variant])} />
      ) : null}
      {scanlines ? (
        <div className="landing-scanlines absolute inset-0" />
      ) : null}
      {noise ? (
        <div className="landing-noise absolute inset-0 mix-blend-overlay" />
      ) : null}
    </div>
  );
}
