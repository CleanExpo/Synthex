import Link from 'next/link';
import { ArrowRight } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { SectionFloatingGradients } from './floating-gradients';
import { HeroProductMock } from './hero-product-mock';
import { SectionAtmosphere } from './section-atmosphere';

export function HeroSection() {
  return (
    <section
      className="relative min-h-[100svh] overflow-hidden pt-28"
      style={{ background: 'var(--sx-gradient-hero)' }}
      aria-labelledby="hero-heading"
    >
      <SectionAtmosphere variant="hero" scanlines noise />
      <SectionFloatingGradients variant="hero" dense />
      <div
        className="landing-hero-dot-grid absolute inset-0 opacity-70"
        aria-hidden
      />

      <div className="relative mx-auto grid max-w-container items-end gap-12 px-5 pb-16 pt-8 lg:min-h-[calc(100svh-5rem)] lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-8 lg:pb-20 lg:pt-10">
        <div className="relative z-10 lg:pb-8">
          <p className="landing-hero-enter landing-hero-enter-delay-1 mb-6 inline-flex items-center gap-3 rounded-full border border-sx-accent/25 bg-sx-accent/[0.08] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-sx-accent">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sx-accent opacity-40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-sx-accent" />
            </span>
            Free Opportunity Map
          </p>

          <h1
            id="hero-heading"
            className="landing-hero-enter landing-hero-enter-delay-2 max-w-[14ch] text-[2.75rem] font-semibold leading-[0.98] tracking-[-0.045em] text-sx-text-primary text-balance sm:text-6xl lg:text-[4.6rem]"
          >
            The next marketing move your evidence can{' '}
            <span className="landing-gradient-text">actually support</span>.
          </h1>

          <p className="landing-hero-enter landing-hero-enter-delay-3 mt-6 max-w-xl text-base leading-8 text-sx-text-secondary md:text-lg">
            Paste the website. Synthex returns three ranked growth directions,
            the sources used, and the gaps still unknown. The command center
            takes over only after that decision is clear.
          </p>

          <div className="landing-hero-enter landing-hero-enter-delay-4 mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              variant="premium-primary"
              size="xl"
              className="shadow-[0_0_40px_rgba(255,122,24,0.22)]"
            >
              <Link href="/opportunity-map">
                Build my free map
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Link
              href="#how-synthex-works"
              className="inline-flex min-h-11 items-center text-sm font-medium text-sx-text-secondary underline-offset-4 hover:text-sx-text-primary hover:underline"
            >
              See the command center
            </Link>
          </div>
        </div>

        <div className="landing-hero-enter landing-hero-enter-delay-5 relative z-10 lg:-mr-8 xl:-mr-16">
          <div
            className="pointer-events-none absolute -inset-10 rounded-[40px] bg-[radial-gradient(ellipse_at_center,rgba(255,122,24,0.16)_0%,rgba(65,214,195,0.08)_45%,transparent_70%)]"
            aria-hidden
          />
          <HeroProductMock />
        </div>
      </div>

      <div className="relative z-10 border-t border-white/[0.06] bg-black/20 backdrop-blur-md">
        <dl className="mx-auto grid max-w-container grid-cols-2 gap-px sm:grid-cols-4">
          {[
            ['No login', 'Public scan only'],
            ['No auto-publish', 'Named reviewer first'],
            ['Evidence visible', 'Sources stay attached'],
            ['Unknowns labelled', 'Nothing is invented'],
          ].map(([term, detail]) => (
            <div key={term} className="px-5 py-5">
              <dt className="text-sm font-semibold text-sx-text-primary">
                {term}
              </dt>
              <dd className="mt-1 text-xs text-sx-text-muted">{detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
