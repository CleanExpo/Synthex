import Link from 'next/link';
import { ArrowRight } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { SectionFloatingGradients } from './floating-gradients';
import { HeroProductMock } from './hero-product-mock';

export function HeroSection() {
  return (
    <section
      className="relative min-h-[calc(100svh-4rem)] overflow-hidden pt-28"
      style={{ background: 'var(--sx-gradient-hero)' }}
      aria-labelledby="hero-heading"
    >
      <SectionFloatingGradients variant="hero" dense />

      {/* Dot + line pattern overlay */}
      <div className="landing-hero-dot-grid absolute inset-0" aria-hidden />
      <div
        className="landing-hero-line-grid absolute inset-0 opacity-60"
        aria-hidden
      />

      {/* Top vignette */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-sx-bg-primary/80 to-transparent"
        aria-hidden
      />

      <div className="relative mx-auto grid max-w-container gap-10 px-5 pb-20 pt-10 lg:min-h-[calc(100svh-5rem)] lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-14 lg:pt-16">
        {/* Copy column */}
        <div className="relative z-10">
          <div className="landing-hero-enter landing-hero-enter-delay-1 mb-6 inline-flex items-center gap-2.5 rounded-full border border-sx-accent/30 bg-gradient-to-r from-sx-accent/[0.12] to-sx-intelligence/[0.08] px-4 py-2 text-xs uppercase tracking-[0.22em] text-sx-accent backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sx-accent opacity-40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-sx-accent" />
            </span>
            Free Nexus Marketing Opportunity Map
          </div>

          <h1
            id="hero-heading"
            className="landing-hero-enter landing-hero-enter-delay-2 max-w-4xl text-4xl font-semibold leading-[1.04] tracking-[-0.03em] text-sx-text-primary sm:text-5xl md:text-6xl lg:text-[4.25rem]"
          >
            See where your next growth move is{' '}
            <span className="landing-gradient-text">hiding</span>.
          </h1>

          <p className="landing-hero-enter landing-hero-enter-delay-3 mt-6 max-w-xl text-base leading-7 text-sx-text-secondary md:text-lg md:leading-8">
            Paste your website, social links and rough context. The Marketing
            Extender turns them into{' '}
            <span className="font-medium text-sx-text-primary">
              three evidence-backed growth directions
            </span>
            , the assumptions behind them and one clear next move.
          </p>

          <div className="landing-hero-enter landing-hero-enter-delay-4 mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              variant="premium-primary"
              size="xl"
              className="shadow-[0_0_32px_rgba(255,122,24,0.15)] transition-shadow duration-[220ms] hover:shadow-[0_0_40px_rgba(255,122,24,0.22)]"
            >
              <Link href="/opportunity-map">
                Build my free map
                <ArrowRight className="h-4 w-4 transition-transform duration-[160ms] group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button asChild variant="glass-secondary" size="xl">
              <Link href="/features">See how Nexus delivers</Link>
            </Button>
          </div>

          <div className="landing-hero-enter landing-hero-enter-delay-5 mt-10 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/[0.06] pt-8">
            {['No login', 'No auto-publish', 'Evidence visible'].map(item => (
              <span
                key={item}
                className="flex items-center gap-2 text-xs font-medium text-sx-text-muted"
              >
                <span className="h-1 w-1 rounded-full bg-sx-accent/80" />
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* Product mock column */}
        <div className="landing-hero-enter landing-hero-enter-delay-5 relative z-10 w-full lg:pl-2">
          <div
            className="pointer-events-none absolute -inset-8 rounded-[32px] bg-[radial-gradient(ellipse_at_center,rgba(255,122,24,0.1)_0%,transparent_70%)]"
            aria-hidden
          />
          <div className="landing-mock-glow-ring pointer-events-none absolute -inset-[1px] rounded-[22px] bg-gradient-to-br from-sx-accent/40 via-sx-intelligence/10 to-sx-accent/20 opacity-70" />
          <HeroProductMock />
        </div>
      </div>
    </section>
  );
}
