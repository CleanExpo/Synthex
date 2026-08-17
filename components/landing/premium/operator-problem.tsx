import Link from 'next/link';
import { ArrowRight } from '@/components/icons';
import { Button } from '@/components/ui/button';
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
      <div className="relative mx-auto max-w-content px-5">
        <SectionReveal>
          <div className="mb-12 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sx-accent">
              The operator problem
            </p>
            <h2
              id="operator-problem-heading"
              className="mt-3 text-3xl font-semibold tracking-tight text-sx-text-primary md:text-5xl"
            >
              Most marketing tools help you produce. Few help you decide.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-8 text-sx-text-secondary">
              Synthex starts with what your public evidence can support. The
              free map is the first decision. The command center is how the team
              executes after that decision is clear.
            </p>
          </div>
        </SectionReveal>

        <div className="grid gap-4 md:grid-cols-3">
          {problems.map((item, index) => (
            <SectionReveal key={item.title} delay={index * 60}>
              <article className="h-full border-l-2 border-sx-accent/40 bg-sx-bg-elevated/80 px-5 py-6">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-sx-text-muted">
                  {String(index + 1).padStart(2, '0')}
                </p>
                <h3 className="mt-3 text-lg font-semibold text-sx-text-primary">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-sx-text-secondary">
                  {item.copy}
                </p>
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
