import Link from 'next/link';
import { CheckCircle2 } from '@/components/icons';
import { SectionReveal } from './section-reveal';

const operatingRules = [
  {
    title: 'Evidence before creative',
    copy: 'Strategy claims link to a source ref. If the source is missing, the gap is labelled — it is not filled with invented certainty.',
  },
  {
    title: 'A named reviewer before publish',
    copy: 'Drafts can be prepared in the workspace. Public posts, spend and client claims stay blocked until a human approves.',
  },
  {
    title: 'Pilot access, not a self-serve flood',
    copy: 'Synthex is Unite Group’s marketing command center, opened to controlled pilots. Capacity is limited on purpose.',
  },
];

export function SocialProof() {
  return (
    <section
      className="relative overflow-hidden border-y border-white/[0.04] bg-sx-bg-panel py-24 md:py-32"
      aria-labelledby="social-proof-heading"
    >
      <div className="relative mx-auto max-w-content px-5">
        <SectionReveal>
          <div className="mb-12 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sx-accent">
              How pilots run
            </p>
            <h2
              id="social-proof-heading"
              className="mt-3 text-3xl font-semibold tracking-tight text-sx-text-primary md:text-4xl"
            >
              We do not invent customer quotes. We publish the operating rules.
            </h2>
            <p className="mt-5 text-base leading-8 text-sx-text-secondary">
              If you need logos and star ratings, this is the wrong product. If
              you need a system that will not go live without you, start with
              the map.
            </p>
          </div>
        </SectionReveal>

        <div className="grid gap-4 md:grid-cols-3">
          {operatingRules.map((item, index) => (
            <SectionReveal key={item.title} delay={index * 50}>
              <article className="h-full rounded-card border border-white/[0.08] bg-sx-bg-elevated/90 p-6">
                <CheckCircle2 className="h-5 w-5 text-sx-success" />
                <h3 className="mt-4 text-lg font-semibold text-sx-text-primary">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-sx-text-secondary">
                  {item.copy}
                </p>
              </article>
            </SectionReveal>
          ))}
        </div>

        <SectionReveal delay={160}>
          <p className="mt-10 text-sm text-sx-text-muted">
            Want the security detail?{' '}
            <Link
              href="/security"
              className="font-medium text-sx-text-primary underline-offset-4 hover:underline"
            >
              Read the controls
            </Link>
            .
          </p>
        </SectionReveal>
      </div>
    </section>
  );
}
