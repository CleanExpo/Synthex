import { cn } from '@/lib/utils';

type OrbTone = 'accent' | 'intelligence' | 'blend';

interface FloatingOrbProps {
  tone: OrbTone;
  size: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  delay?: number;
  duration?: number;
  alt?: boolean;
}

const sizeMap = {
  sm: 'h-48 w-48',
  md: 'h-72 w-72',
  lg: 'h-96 w-96',
  xl: 'h-[32rem] w-[32rem]',
};

const toneMap: Record<OrbTone, string> = {
  accent: 'landing-orb-accent',
  intelligence: 'landing-orb-intelligence',
  blend: 'landing-orb-blend',
};

export function FloatingOrb({
  tone,
  size,
  className,
  delay = 0,
  duration = 14,
  alt = false,
}: FloatingOrbProps) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute rounded-full blur-3xl',
        sizeMap[size],
        toneMap[tone],
        alt ? 'landing-orb-float-alt' : 'landing-orb-float',
        className
      )}
      style={{
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
      }}
      aria-hidden
    />
  );
}

interface SectionFloatingGradientsProps {
  variant?: 'hero' | 'mid' | 'lower' | 'cta';
  className?: string;
}

/** Section-scoped floating gradient orbs */
export function SectionFloatingGradients({
  variant = 'mid',
  className,
}: SectionFloatingGradientsProps) {
  const configs: Record<
    SectionFloatingGradientsProps['variant'],
    FloatingOrbProps[]
  > = {
    hero: [
      {
        tone: 'accent',
        size: 'xl',
        className: '-left-[18%] top-[5%]',
        delay: 0,
        duration: 16,
      },
      {
        tone: 'intelligence',
        size: 'lg',
        className: '-right-[12%] top-[18%]',
        delay: 2,
        duration: 18,
        alt: true,
      },
      {
        tone: 'blend',
        size: 'md',
        className: 'left-[40%] bottom-[10%]',
        delay: 4,
        duration: 20,
      },
    ],
    mid: [
      {
        tone: 'intelligence',
        size: 'lg',
        className: '-right-[8%] top-[8%]',
        delay: 1,
        duration: 17,
        alt: true,
      },
      {
        tone: 'accent',
        size: 'md',
        className: '-left-[6%] bottom-[12%]',
        delay: 3,
        duration: 19,
      },
    ],
    lower: [
      {
        tone: 'blend',
        size: 'lg',
        className: 'left-[10%] top-[15%]',
        delay: 0,
        duration: 15,
      },
      {
        tone: 'intelligence',
        size: 'md',
        className: '-right-[5%] bottom-[20%]',
        delay: 2.5,
        duration: 18,
        alt: true,
      },
    ],
    cta: [
      {
        tone: 'accent',
        size: 'xl',
        className: 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
        delay: 0,
        duration: 14,
      },
      {
        tone: 'intelligence',
        size: 'md',
        className: 'left-[15%] top-[20%]',
        delay: 2,
        duration: 16,
        alt: true,
      },
    ],
  };

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden',
        className
      )}
      aria-hidden
    >
      {configs[variant ?? 'mid'].map((orb, i) => (
        <FloatingOrb key={i} {...orb} />
      ))}
    </div>
  );
}

/** Full-page fixed ambient gradient layer */
export function LandingPageAmbient() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      aria-hidden
    >
      {/* Base vertical gradient wash */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,var(--sx-bg-primary)_0%,var(--sx-bg-secondary)_35%,var(--sx-bg-primary)_70%,var(--sx-bg-secondary)_100%)]" />

      {/* Floating orbs — staggered across viewport height */}
      <FloatingOrb
        tone="accent"
        size="xl"
        className="-left-[15%] -top-[10%]"
        delay={0}
        duration={22}
      />
      <FloatingOrb
        tone="intelligence"
        size="lg"
        className="-right-[10%] top-[12%]"
        delay={3}
        duration={20}
        alt
      />
      <FloatingOrb
        tone="blend"
        size="md"
        className="left-[35%] top-[28%]"
        delay={6}
        duration={18}
      />
      <FloatingOrb
        tone="intelligence"
        size="lg"
        className="-left-[8%] top-[48%]"
        delay={2}
        duration={24}
        alt
      />
      <FloatingOrb
        tone="accent"
        size="md"
        className="right-[8%] top-[55%]"
        delay={5}
        duration={19}
      />
      <FloatingOrb
        tone="blend"
        size="xl"
        className="left-[20%] top-[72%]"
        delay={1}
        duration={21}
        alt
      />
      <FloatingOrb
        tone="accent"
        size="lg"
        className="-right-[12%] top-[82%]"
        delay={4}
        duration={17}
      />

      {/* Soft horizontal gradient bands */}
      <div className="absolute inset-x-0 top-[30%] h-px bg-gradient-to-r from-transparent via-sx-accent/20 to-transparent opacity-40" />
      <div className="absolute inset-x-0 top-[62%] h-px bg-gradient-to-r from-transparent via-sx-intelligence/15 to-transparent opacity-30" />
    </div>
  );
}
