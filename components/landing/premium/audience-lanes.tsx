import Link from 'next/link';
import { ArrowRight } from '@/components/icons';
import { SectionReveal } from './section-reveal';

const lanes = [
  {
    audience: 'For operators',
    title: 'One next move, not a content calendar dump',
    copy: 'Paste the website. Get three ranked directions, the gaps still unknown, and a brief you can take into a planning session.',
    href: '/opportunity-map',
    cta: 'Build the map',
  },
  {
    audience: 'For in-house teams',
    title: 'Approval before anything public',
    copy: 'Campaign cards, evidence refs and a named reviewer sit in one workspace. Spend and publishing stay blocked until that gate is clear.',
    href: '/features',
    cta: 'See the workflow',
  },
  {
    audience: 'For agencies',
    title: 'Client lanes without mixed context',
    copy: 'Each brand stays org-scoped. Council packets, comments and version history stay with the client they belong to.',
    href: '/security',
    cta: 'Read the controls',
  },
];

export function AudienceLanes() {
  return (
    <section
      className="relative overflow-hidden bg-sx-bg-primary py-24 md:py-32"
      aria-labelledby="audience-lanes-heading"
    >
      <div className="relative mx-auto max-w-content px-5">
        <SectionReveal>
          <div className="mb-12 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sx-accent">
              Who it is for
            </p>
            <h2
              id="audience-lanes-heading"
              className="mt-3 text-3xl font-semibold tracking-tight text-sx-text-primary md:text-5xl"
            >
              Same spine. Different starting point.
            </h2>
          </div>
        </SectionReveal>

        <div className="grid gap-px overflow-hidden rounded-card border border-white/[0.08] bg-white/[0.06] md:grid-cols-3">
          {lanes.map((lane, index) => (
            <SectionReveal key={lane.audience} delay={index * 50}>
              <article className="flex h-full flex-col bg-sx-bg-elevated p-6 md:p-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sx-accent">
                  {lane.audience}
                </p>
                <h3 className="mt-4 text-xl font-semibold tracking-tight text-sx-text-primary">
                  {lane.title}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-7 text-sx-text-secondary">
                  {lane.copy}
                </p>
                <Link
                  href={lane.href}
                  className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-sx-text-primary transition-colors hover:text-sx-accent"
                >
                  {lane.cta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            </SectionReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
