import Link from 'next/link';
import { SectionAtmosphere } from './section-atmosphere';
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
      className="relative overflow-hidden bg-sx-bg-panel py-24 md:py-32"
      aria-labelledby="social-proof-heading"
    >
      <SectionAtmosphere variant="ember" noise />
      <div className="relative mx-auto max-w-container px-5">
        <SectionReveal>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sx-accent">
            How pilots run
          </p>
          <h2
            id="social-proof-heading"
            className="mt-4 max-w-4xl text-3xl font-semibold leading-[1.12] tracking-tight text-sx-text-primary md:text-6xl"
          >
            We do not invent customer quotes.
            <span className="block text-sx-text-muted">
              We publish the operating rules.
            </span>
          </h2>
        </SectionReveal>

        <div className="mt-16 grid gap-10 border-t border-white/[0.08] pt-12 md:grid-cols-3">
          {operatingRules.map((item, index) => (
            <article key={item.title}>
              <p className="font-mono text-[11px] text-sx-accent">
                Rule {String(index + 1).padStart(2, '0')}
              </p>
              <h3 className="mt-3 text-lg font-semibold text-sx-text-primary">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-sx-text-secondary">
                {item.copy}
              </p>
            </article>
          ))}
        </div>

        <p className="mt-12 text-sm text-sx-text-muted">
          Want the security detail?{' '}
          <Link
            href="/security"
            className="font-medium text-sx-text-primary underline-offset-4 hover:underline"
          >
            Read the controls
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
