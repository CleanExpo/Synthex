import Link from 'next/link';
import { ArrowRight } from '@/components/icons';
import { Button } from '@/components/ui/button';

export function FinalCta() {
  return (
    <section
      className="relative overflow-hidden py-32"
      style={{ background: 'var(--sx-gradient-hero)' }}
      aria-labelledby="final-cta-heading"
    >
      <div className="relative mx-auto max-w-2xl px-5 text-center">
        <h2
          id="final-cta-heading"
          className="text-3xl font-semibold tracking-tight text-sx-text-primary md:text-5xl"
        >
          Start with the plan. Move to production when it is clear.
        </h2>
        <p className="mt-5 text-base leading-8 text-sx-text-secondary">
          Request pilot access to the AI marketing workspace built for
          evidence-backed campaign planning and approval-gated execution.
        </p>
        <div className="mt-9">
          <Button asChild variant="premium-primary" size="xl">
            <Link href="/contact">
              Request pilot access
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
