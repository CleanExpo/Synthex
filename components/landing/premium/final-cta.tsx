import Link from 'next/link';
import { ArrowRight } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { SectionFloatingGradients } from './floating-gradients';
import { SectionReveal } from './section-reveal';

export function FinalCta() {
  return (
    <section
      className="relative overflow-hidden py-32"
      style={{ background: 'var(--sx-gradient-hero)' }}
      aria-labelledby="final-cta-heading"
    >
      <SectionFloatingGradients variant="cta" />
      <div
        className="landing-hero-dot-grid absolute inset-0 opacity-40"
        aria-hidden
      />

      <SectionReveal className="relative mx-auto max-w-2xl px-5 text-center">
        <h2
          id="final-cta-heading"
          className="text-3xl font-semibold tracking-tight text-sx-text-primary md:text-5xl"
        >
          Start with what your evidence can{' '}
          <span className="landing-gradient-text">actually support</span>.
        </h2>
        <p className="mt-5 text-base leading-8 text-sx-text-secondary">
          Build the free map first. If the opportunity is real, Nexus can turn
          the same context into an evidence-backed marketing system.
        </p>
        <div className="mt-9">
          <Button
            asChild
            variant="premium-primary"
            size="xl"
            className="shadow-[0_0_36px_rgba(255,122,24,0.18)]"
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
