import Link from 'next/link';
import { ArrowRight } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { SectionAtmosphere } from './section-atmosphere';
import { SectionReveal } from './section-reveal';

const problems = [
  {
    title: 'Ideas stay in chat threads',
    copy: 'A voice note, a meeting, a “we should post this” — then the context disappears before anyone can approve a plan.',
  },
  {
    title: 'AI drafts without sources',
    copy: 'Generic copy looks finished and still cannot answer where the claim came from, so the team will not sign it.',
  },
  {
    title: 'Publishing outruns judgement',
    copy: 'Tools make it easy to go live. Operators need the opposite: a named reviewer before spend, claims or a public post.',
  },
];

export function OperatorProblem() {
  return (
    <section
      className="relative overflow-hidden bg-sx-bg-secondary py-24 md:py-32"
      aria-labelledby="operator-problem-heading"
    >
      <SectionAtmosphere variant="ember" />
      <div className="relative mx-auto max-w-container px-5">
        <SectionReveal>
          <div className="mb-16 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sx-accent">
              The operator problem
            </p>
            <h2
              id="operator-problem-heading"
              className="mt-3 text-3xl font-semibold tracking-tight text-sx-text-primary text-balance md:text-5xl"
            >
              Most marketing tools help you produce. Few help you decide.
            </h2>
          </div>
        </SectionReveal>

        <div className="space-y-px overflow-hidden rounded-card border border-white/[0.08]">
          {problems.map((item, index) => (
            <SectionReveal key={item.title} delay={index * 70}>
              <article className="grid gap-6 bg-sx-bg-elevated/80 px-6 py-8 md:grid-cols-[7rem_1fr] md:px-10">
                <p className="font-mono text-5xl font-semibold leading-none tracking-tight text-sx-accent/35 md:text-6xl">
                  {String(index + 1).padStart(2, '0')}
                </p>
                <div>
                  <h3 className="text-xl font-semibold text-sx-text-primary">
                    {item.title}
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-sx-text-secondary">
                    {item.copy}
                  </p>
                </div>
              </article>
            </SectionReveal>
          ))}
        </div>

        <SectionReveal delay={180}>
          <div className="mt-10">
            <Button asChild variant="premium-primary" size="lg">
              <Link href="/opportunity-map">
                See what your evidence supports
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
