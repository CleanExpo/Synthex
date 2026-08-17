import Link from 'next/link';
import { ArrowRight } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { SectionAtmosphere } from './section-atmosphere';
import { SectionFloatingGradients } from './floating-gradients';
import { SectionReveal } from './section-reveal';

export function FinalCta() {
  return (
    <section
      className="relative overflow-hidden py-28 md:py-36"
      style={{ background: 'var(--sx-gradient-hero)' }}
      aria-labelledby="final-cta-heading"
    >
      <SectionAtmosphere variant="cta" scanlines />
      <SectionFloatingGradients variant="cta" />

      <SectionReveal className="relative mx-auto max-w-3xl px-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sx-accent">
          Next move
        </p>
        <h2
          id="final-cta-heading"
          className="mt-4 text-3xl font-semibold tracking-tight text-sx-text-primary text-balance md:text-6xl"
        >
          Start with what your evidence can{' '}
          <span className="landing-gradient-text">actually support</span>.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-base leading-8 text-sx-text-secondary">
          Build the free map first. If the opportunity is real, the Synthex
          strategy team can use the same context to plan the work with you.
        </p>
        <div className="mt-10">
          <Button
            asChild
            variant="premium-primary"
            size="xl"
            className="shadow-[0_0_48px_rgba(255,122,24,0.28)]"
          >
            <Link href="/opportunity-map">
              Build my free map
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </SectionReveal>
    </section>
  );
}
