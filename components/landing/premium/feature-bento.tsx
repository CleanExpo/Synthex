'use client';

import {
  BarChart3,
  Building2,
  CheckCircle2,
  Globe,
  Layers,
  Search,
  Shield,
  Users,
  Video,
} from '@/components/icons';
import { StatusPill } from '@/components/ui/status-pill';
import { SectionReveal } from './section-reveal';

const features = [
  {
    icon: Layers,
    title: 'Campaign planning',
    copy: 'Voice-to-plan cards with audience, offer, risks and next decision.',
    status: 'draft' as const,
    span: 'md:col-span-2',
  },
  {
    icon: Search,
    title: 'SEO intelligence',
    copy: 'Keywords, SERP and competitor signal linked to evidence refs.',
    status: 'verified' as const,
    span: '',
  },
  {
    icon: Globe,
    title: 'GBP management',
    copy: 'Posts, reviews and local insights in one governed workspace.',
    status: 'staged' as const,
    span: '',
  },
  {
    icon: Video,
    title: 'Video generation',
    copy: 'Storyboards and Gen Media briefs through approval gates.',
    status: 'awaiting_approval' as const,
    span: '',
  },
  {
    icon: CheckCircle2,
    title: 'Approval workflows',
    copy: 'Human review before publish, spend or public claims.',
    status: 'awaiting_approval' as const,
    span: 'md:col-span-2',
  },
  {
    icon: Building2,
    title: 'Multi-brand management',
    copy: "Org-scoped workspaces — never serve another brand's data.",
    status: 'grounded' as const,
    span: '',
  },
  {
    icon: Users,
    title: 'Agency workspace',
    copy: 'Client lanes, council packets and white-label outputs.',
    status: 'approved' as const,
    span: '',
  },
  {
    icon: BarChart3,
    title: 'Performance reporting',
    copy: 'Campaign outcomes as signal for the next planning cycle.',
    status: 'published' as const,
    span: 'md:col-span-2',
  },
];

export function FeatureBento() {
  return (
    <section
      className="relative overflow-hidden bg-sx-bg-primary py-32"
      aria-labelledby="platform-features-heading"
    >
      <div
        className="pointer-events-none absolute -left-[10%] bottom-0 h-[500px] w-[500px] bg-[radial-gradient(circle,rgba(255,122,24,0.05)_0%,transparent_65%)]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-content px-5">
        <SectionReveal>
          <div className="mb-14 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sx-accent">
              Platform
            </p>
            <h2
              id="platform-features-heading"
              className="mt-3 text-3xl font-semibold tracking-tight text-sx-text-primary md:text-5xl"
            >
              One AI marketing workspace for the full{' '}
              <span className="landing-gradient-text">content operations</span>{' '}
              stack
            </h2>
            <p className="mt-5 text-base leading-8 text-sx-text-secondary">
              Campaign planning software, SEO planning, brand governance and
              collaborative marketing — without the dashboard maze.
            </p>
          </div>
        </SectionReveal>

        <div className="grid gap-4 md:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <SectionReveal key={feature.title} delay={index * 50}>
                <article
                  className={`landing-bento-card group h-full rounded-card border border-white/[0.08] bg-sx-bg-elevated/90 p-6 backdrop-blur-sm ${feature.span}`}
                >
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-btn border border-sx-accent/20 bg-sx-accent/[0.08]">
                      <Icon className="h-5 w-5 text-sx-accent" />
                    </div>
                    <StatusPill variant={feature.status} size="sm" />
                  </div>
                  <h3 className="relative mt-5 text-lg font-semibold text-sx-text-primary">
                    {feature.title}
                  </h3>
                  <p className="relative mt-2 text-sm leading-6 text-sx-text-muted">
                    {feature.copy}
                  </p>
                  <div className="relative mt-6 overflow-hidden rounded-[14px] border border-white/[0.06] bg-gradient-to-br from-sx-bg-panel to-sx-bg-primary p-3">
                    <div className="space-y-2">
                      <div className="h-2 w-3/4 rounded bg-white/[0.06]" />
                      <div className="h-2 w-1/2 rounded bg-white/[0.04]" />
                      <div className="mt-3 flex gap-2">
                        <div className="h-6 w-16 rounded bg-sx-accent/15" />
                        <div className="h-6 w-20 rounded bg-white/[0.04]" />
                      </div>
                    </div>
                  </div>
                </article>
              </SectionReveal>
            );
          })}
        </div>

        <SectionReveal delay={200}>
          <div className="mt-10 flex items-center gap-2 text-sm text-sx-text-muted">
            <Shield className="h-4 w-4 text-sx-accent" />
            Every module shares the same approval spine — no silent
            auto-publish.
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
