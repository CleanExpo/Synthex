import Link from 'next/link';
import { ArrowRight } from '@/components/icons';
import { SectionAtmosphere } from './section-atmosphere';
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
      <SectionAtmosphere variant="evidence" />
      <div className="relative mx-auto max-w-container px-5">
        <SectionReveal>
          <div className="mb-14 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--sx-evidence-bright)]">
              Who it is for
            </p>
            <h2
              id="audience-lanes-heading"
              className="mt-3 text-3xl font-semibold tracking-tight text-sx-text-primary md:text-5xl"
            >
              Same spine.{' '}
              <span className="landing-gradient-text-evidence">
                Different starting point.
              </span>
            </h2>
          </div>
        </SectionReveal>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
          {lanes.map((lane, index) => (
            <SectionReveal key={lane.audience} delay={index * 60}>
              <article
                className={`flex h-full flex-col rounded-card border border-white/[0.08] bg-sx-bg-elevated/90 p-7 backdrop-blur-sm lg:transition-transform ${
                  index === 0
                    ? 'lg:min-h-[22rem] lg:-translate-y-3 lg:border-[var(--sx-evidence)]/30'
                    : index === 2
                      ? 'lg:translate-y-3'
                      : ''
                }`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sx-accent">
                  {lane.audience}
                </p>
                <h3 className="mt-5 text-2xl font-semibold tracking-tight text-sx-text-primary">
                  {lane.title}
                </h3>
                <p className="mt-4 flex-1 text-sm leading-7 text-sx-text-secondary">
                  {lane.copy}
                </p>
                <Link
                  href={lane.href}
                  className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-sx-text-primary transition-colors hover:text-sx-accent"
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
