import Link from 'next/link';
import { ArrowRight } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { SectionReveal } from './section-reveal';

export function FinalCta() {
  return (
    <section
      className="relative overflow-hidden py-32"
      style={{ background: 'var(--sx-gradient-hero)' }}
      aria-labelledby="final-cta-heading"
    >
      <div
        className="landing-orb-accent pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        aria-hidden
      />
      <div
        className="landing-hero-dot-grid absolute inset-0 opacity-40"
        aria-hidden
      />

      <SectionReveal className="relative mx-auto max-w-2xl px-5 text-center">
        <h2
          id="final-cta-heading"
          className="text-3xl font-semibold tracking-tight text-sx-text-primary md:text-5xl"
        >
          Start with the plan. Move to production when it is{' '}
          <span className="landing-gradient-text">clear</span>.
        </h2>
        <p className="mt-5 text-base leading-8 text-sx-text-secondary">
          Request pilot access to the AI marketing workspace built for
          evidence-backed campaign planning and approval-gated execution.
        </p>
        <div className="mt-9">
          <Button
            asChild
            variant="premium-primary"
            size="xl"
            className="shadow-[0_0_36px_rgba(255,122,24,0.18)]"
          >
            <Link href="/contact">
              Request pilot access
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </SectionReveal>
    </section>
  );
}
