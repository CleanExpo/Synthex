import { cn } from '@/lib/utils';

type OrbTone = 'accent' | 'intelligence' | 'blend';

interface FloatingOrbProps {
  tone: OrbTone;
  size: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  delay?: number;
  duration?: number;
  alt?: boolean;
  strong?: boolean;
}

const sizeMap = {
  sm: 'h-56 w-56',
  md: 'h-80 w-80',
  lg: 'h-[28rem] w-[28rem]',
  xl: 'h-[36rem] w-[36rem]',
  '2xl': 'h-[44rem] w-[44rem]',
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
  strong = false,
}: FloatingOrbProps) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute rounded-full blur-3xl',
        sizeMap[size],
        toneMap[tone],
        strong && 'landing-orb-strong blur-[80px]',
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

type FloatObjectVariant = 'ring' | 'diamond' | 'beam' | 'grid';

interface FloatingObjectProps {
  variant: FloatObjectVariant;
  tone?: OrbTone;
  className?: string;
  delay?: number;
  duration?: number;
  alt?: boolean;
}

export function FloatingObject({
  variant,
  tone = 'accent',
  className,
  delay = 0,
  duration = 12,
  alt = false,
}: FloatingObjectProps) {
  const toneBorder =
    tone === 'accent'
      ? 'border-sx-accent/45'
      : tone === 'intelligence'
        ? 'border-sx-intelligence/45'
        : 'border-sx-info/35';

  const toneBg =
    tone === 'accent'
      ? 'from-sx-accent/25 to-sx-accent/5'
      : tone === 'intelligence'
        ? 'from-sx-intelligence/25 to-sx-info/5'
        : 'from-sx-accent/15 to-sx-intelligence/15';

  const base = cn(
    'pointer-events-none absolute',
    variant === 'ring'
      ? 'landing-float-ring'
      : alt
        ? 'landing-float-object-alt'
        : 'landing-float-object',
    className
  );

  const style = {
    animationDelay: `${delay}s`,
    ['--float-duration' as string]: `${duration}s`,
  };

  if (variant === 'ring') {
    return (
      <div
        className={cn(base, 'rounded-full border-2', toneBorder)}
        style={style}
        aria-hidden
      />
    );
  }

  if (variant === 'diamond') {
    return (
      <div
        className={cn(
          base,
          'rotate-45 rounded-xl border bg-gradient-to-br',
          toneBorder,
          toneBg
        )}
        style={style}
        aria-hidden
      />
    );
  }

  if (variant === 'beam') {
    return (
      <div
        className={cn(
          base,
          'rounded-full bg-gradient-to-b opacity-60',
          tone === 'accent'
            ? 'from-sx-accent/35 via-sx-accent/10 to-transparent'
            : 'from-sx-intelligence/35 via-sx-intelligence/10 to-transparent'
        )}
        style={style}
        aria-hidden
      />
    );
  }

  return (
    <div
      className={cn(
        base,
        'rounded-lg border border-white/[0.08] bg-white/[0.02] landing-hero-line-grid opacity-50'
      )}
      style={style}
      aria-hidden
    />
  );
}

interface SectionFloatingGradientsProps {
  variant?: 'hero' | 'mid' | 'lower' | 'cta';
  className?: string;
  dense?: boolean;
}

/** Section-scoped floating gradient orbs + geometric objects */
export function SectionFloatingGradients({
  variant = 'mid',
  className,
  dense = false,
}: SectionFloatingGradientsProps) {
  const configs: Record<
    SectionFloatingGradientsProps['variant'],
    { orbs: FloatingOrbProps[]; objects: FloatingObjectProps[] }
  > = {
    hero: {
      orbs: [
        {
          tone: 'accent',
          size: '2xl',
          className: '-left-[22%] -top-[8%]',
          delay: 0,
          duration: 16,
          strong: true,
        },
        {
          tone: 'intelligence',
          size: 'xl',
          className: '-right-[14%] top-[10%]',
          delay: 2,
          duration: 18,
          alt: true,
          strong: true,
        },
        {
          tone: 'blend',
          size: 'lg',
          className: 'left-[30%] bottom-[5%]',
          delay: 4,
          duration: 20,
        },
        {
          tone: 'accent',
          size: 'md',
          className: 'right-[20%] bottom-[25%]',
          delay: 1,
          duration: 14,
          alt: true,
        },
      ],
      objects: [
        {
          variant: 'ring',
          tone: 'accent',
          className: 'right-[8%] top-[22%] h-24 w-24',
          delay: 0,
          duration: 14,
        },
        {
          variant: 'ring',
          tone: 'intelligence',
          className: 'left-[6%] top-[45%] h-32 w-32',
          delay: 2,
          duration: 18,
          alt: true,
        },
        {
          variant: 'diamond',
          tone: 'blend',
          className: 'left-[55%] top-[12%] h-14 w-14',
          delay: 1,
          duration: 11,
        },
        {
          variant: 'beam',
          tone: 'accent',
          className: 'left-[12%] top-[18%] h-40 w-2',
          delay: 3,
          duration: 15,
          alt: true,
        },
        {
          variant: 'beam',
          tone: 'intelligence',
          className: 'right-[18%] bottom-[30%] h-32 w-1.5',
          delay: 0.5,
          duration: 13,
        },
        {
          variant: 'grid',
          className: 'right-[30%] top-[55%] h-20 w-20 opacity-40',
          delay: 2.5,
          duration: 20,
          alt: true,
        },
      ],
    },
    mid: {
      orbs: [
        {
          tone: 'intelligence',
          size: 'xl',
          className: '-right-[10%] -top-[5%]',
          delay: 1,
          duration: 17,
          alt: true,
          strong: true,
        },
        {
          tone: 'accent',
          size: 'lg',
          className: '-left-[8%] bottom-[5%]',
          delay: 3,
          duration: 19,
          strong: true,
        },
        {
          tone: 'blend',
          size: 'md',
          className: 'left-[45%] top-[40%]',
          delay: 0,
          duration: 15,
          alt: true,
        },
      ],
      objects: [
        {
          variant: 'ring',
          tone: 'intelligence',
          className: 'left-[4%] top-[20%] h-20 w-20',
          delay: 1,
          duration: 16,
        },
        {
          variant: 'diamond',
          tone: 'accent',
          className: 'right-[10%] bottom-[25%] h-12 w-12',
          delay: 2,
          duration: 12,
          alt: true,
        },
        {
          variant: 'beam',
          tone: 'blend',
          className: 'right-[5%] top-[15%] h-28 w-2',
          delay: 0,
          duration: 14,
        },
      ],
    },
    lower: {
      orbs: [
        {
          tone: 'blend',
          size: 'xl',
          className: '-left-[5%] top-[5%]',
          delay: 0,
          duration: 15,
          strong: true,
        },
        {
          tone: 'intelligence',
          size: 'lg',
          className: '-right-[8%] bottom-[10%]',
          delay: 2.5,
          duration: 18,
          alt: true,
        },
        {
          tone: 'accent',
          size: 'md',
          className: 'left-[50%] top-[50%]',
          delay: 1,
          duration: 16,
        },
      ],
      objects: [
        {
          variant: 'ring',
          tone: 'blend',
          className: 'right-[12%] top-[18%] h-28 w-28',
          delay: 0.5,
          duration: 17,
        },
        {
          variant: 'diamond',
          tone: 'intelligence',
          className: 'left-[8%] bottom-[20%] h-16 w-16',
          delay: 2,
          duration: 13,
          alt: true,
        },
        {
          variant: 'grid',
          className: 'left-[40%] top-[10%] h-16 w-16',
          delay: 1.5,
          duration: 19,
        },
      ],
    },
    cta: {
      orbs: [
        {
          tone: 'accent',
          size: '2xl',
          className: 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
          delay: 0,
          duration: 14,
          strong: true,
        },
        {
          tone: 'intelligence',
          size: 'lg',
          className: '-left-[5%] top-[10%]',
          delay: 2,
          duration: 16,
          alt: true,
          strong: true,
        },
        {
          tone: 'blend',
          size: 'md',
          className: '-right-[5%] bottom-[15%]',
          delay: 1,
          duration: 18,
        },
      ],
      objects: [
        {
          variant: 'ring',
          tone: 'accent',
          className: 'left-[10%] top-[25%] h-32 w-32',
          delay: 1,
          duration: 15,
        },
        {
          variant: 'ring',
          tone: 'intelligence',
          className: 'right-[8%] top-[20%] h-20 w-20',
          delay: 3,
          duration: 17,
          alt: true,
        },
        {
          variant: 'beam',
          tone: 'accent',
          className: 'left-1/2 top-[8%] h-36 w-2 -translate-x-1/2',
          delay: 0,
          duration: 12,
        },
      ],
    },
  };

  const { orbs, objects } = configs[variant ?? 'mid'];

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden',
        className
      )}
      aria-hidden
    >
      <div
        className={cn(
          'landing-gradient-mesh absolute inset-0',
          dense ? 'opacity-100' : 'opacity-80'
        )}
      />
      {orbs.map((orb, i) => (
        <FloatingOrb key={`orb-${i}`} {...orb} />
      ))}
      {objects.map((obj, i) => (
        <FloatingObject key={`obj-${i}`} {...obj} />
      ))}
      {dense &&
        orbs
          .slice(0, 2)
          .map((orb, i) => (
            <FloatingOrb
              key={`orb-extra-${i}`}
              {...orb}
              className={cn(orb.className, 'opacity-70 scale-90')}
              delay={(orb.delay ?? 0) + 1.5}
            />
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
      <div className="landing-gradient-mesh absolute inset-0 opacity-90" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,var(--sx-bg-primary)_0%,var(--sx-bg-secondary)_25%,var(--sx-bg-primary)_50%,var(--sx-bg-secondary)_75%,var(--sx-bg-primary)_100%)] opacity-90" />

      {/* Large floating orbs */}
      <FloatingOrb
        tone="accent"
        size="2xl"
        className="-left-[18%] -top-[12%]"
        delay={0}
        duration={22}
        strong
      />
      <FloatingOrb
        tone="intelligence"
        size="xl"
        className="-right-[12%] top-[8%]"
        delay={3}
        duration={20}
        alt
        strong
      />
      <FloatingOrb
        tone="blend"
        size="lg"
        className="left-[30%] top-[22%]"
        delay={6}
        duration={18}
      />
      <FloatingOrb
        tone="intelligence"
        size="xl"
        className="-left-[10%] top-[42%]"
        delay={2}
        duration={24}
        alt
        strong
      />
      <FloatingOrb
        tone="accent"
        size="lg"
        className="right-[5%] top-[50%]"
        delay={5}
        duration={19}
        strong
      />
      <FloatingOrb
        tone="blend"
        size="2xl"
        className="left-[15%] top-[68%]"
        delay={1}
        duration={21}
        alt
      />
      <FloatingOrb
        tone="accent"
        size="xl"
        className="-right-[14%] top-[78%]"
        delay={4}
        duration={17}
        strong
      />
      <FloatingOrb
        tone="intelligence"
        size="md"
        className="right-[25%] top-[32%]"
        delay={7}
        duration={16}
        alt
      />

      {/* Floating geometric objects */}
      <FloatingObject
        variant="ring"
        tone="accent"
        className="left-[8%] top-[15%] h-36 w-36"
        delay={0}
        duration={16}
      />
      <FloatingObject
        variant="ring"
        tone="intelligence"
        className="right-[6%] top-[28%] h-44 w-44"
        delay={2}
        duration={20}
        alt
      />
      <FloatingObject
        variant="ring"
        tone="blend"
        className="left-[55%] top-[58%] h-28 w-28"
        delay={4}
        duration={18}
      />
      <FloatingObject
        variant="diamond"
        tone="accent"
        className="right-[22%] top-[62%] h-20 w-20"
        delay={1}
        duration={14}
        alt
      />
      <FloatingObject
        variant="diamond"
        tone="intelligence"
        className="left-[18%] top-[72%] h-14 w-14"
        delay={3}
        duration={12}
      />
      <FloatingObject
        variant="beam"
        tone="accent"
        className="left-[3%] top-[38%] h-52 w-2"
        delay={0.5}
        duration={15}
      />
      <FloatingObject
        variant="beam"
        tone="intelligence"
        className="right-[3%] top-[48%] h-44 w-2"
        delay={2.5}
        duration={17}
        alt
      />
      <FloatingObject
        variant="grid"
        className="left-[42%] top-[12%] h-24 w-24"
        delay={1.5}
        duration={22}
      />
      <FloatingObject
        variant="grid"
        className="right-[35%] top-[85%] h-20 w-20"
        delay={3.5}
        duration={19}
        alt
      />

      {/* Visible gradient bands */}
      <div className="absolute inset-x-0 top-[18%] h-40 bg-gradient-to-b from-sx-accent/[0.08] to-transparent blur-2xl" />
      <div className="absolute inset-x-0 top-[45%] h-48 bg-gradient-to-b from-sx-intelligence/[0.07] to-transparent blur-3xl" />
      <div className="absolute inset-x-0 top-[72%] h-40 bg-gradient-to-b from-sx-accent/[0.06] to-transparent blur-2xl" />
      <div className="absolute inset-x-0 top-[30%] h-px bg-gradient-to-r from-transparent via-sx-accent/40 to-transparent" />
      <div className="absolute inset-x-0 top-[58%] h-px bg-gradient-to-r from-transparent via-sx-intelligence/35 to-transparent" />
      <div className="absolute inset-x-0 top-[85%] h-px bg-gradient-to-r from-transparent via-sx-accent/30 to-transparent" />
    </div>
  );
}
