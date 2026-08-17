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
import { SectionAtmosphere } from './section-atmosphere';
import { SectionReveal } from './section-reveal';

const features = [
  {
    icon: Layers,
    title: 'Campaign planning',
    copy: 'Voice-to-plan cards with audience, offer, risks and next decision.',
    status: 'draft' as const,
    featured: true,
  },
  {
    icon: Search,
    title: 'SEO intelligence',
    copy: 'Keywords, SERP and competitor signal linked to evidence refs.',
    status: 'verified' as const,
  },
  {
    icon: Globe,
    title: 'GBP management',
    copy: 'Posts, reviews and local insights in one governed workspace.',
    status: 'staged' as const,
  },
  {
    icon: Video,
    title: 'Video generation',
    copy: 'Storyboards and Gen Media briefs through approval gates.',
    status: 'awaiting_approval' as const,
  },
  {
    icon: CheckCircle2,
    title: 'Approval workflows',
    copy: 'Human review before publish, spend or public claims.',
    status: 'awaiting_approval' as const,
  },
  {
    icon: Building2,
    title: 'Multi-brand management',
    copy: "Org-scoped workspaces — never serve another brand's data.",
    status: 'grounded' as const,
  },
  {
    icon: Users,
    title: 'Agency workspace',
    copy: 'Client lanes, council packets and white-label outputs.',
    status: 'approved' as const,
  },
  {
    icon: BarChart3,
    title: 'Performance reporting',
    copy: 'Campaign outcomes as signal for the next planning cycle.',
    status: 'published' as const,
  },
];

export function FeatureBento() {
  const featured = features[0];
  const rest = features.slice(1);
  const FeaturedIcon = featured.icon;

  return (
    <section
      className="relative overflow-hidden bg-sx-bg-primary py-24 md:py-32"
      aria-labelledby="platform-features-heading"
    >
      <SectionAtmosphere variant="ink" noise />
      <div className="relative z-10 mx-auto max-w-content px-5">
        <SectionReveal>
          <div className="mb-14 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sx-accent">
              Platform
            </p>
            <h2
              id="platform-features-heading"
              className="mt-3 text-3xl font-semibold tracking-tight text-sx-text-primary md:text-5xl"
            >
              The workspace after the map is decided
            </h2>
          </div>
        </SectionReveal>

        <div className="grid gap-4 lg:grid-cols-12">
          <article className="relative overflow-hidden rounded-card border border-sx-accent/25 bg-gradient-to-br from-sx-opportunity-surface to-sx-bg-elevated p-7 lg:col-span-5 lg:min-h-[28rem]">
            <StatusPill variant={featured.status} size="sm" />
            <FeaturedIcon className="mt-8 h-8 w-8 text-sx-accent" />
            <h3 className="mt-5 text-2xl font-semibold text-sx-text-primary">
              {featured.title}
            </h3>
            <p className="mt-3 text-sm leading-7 text-sx-text-secondary">
              {featured.copy}
            </p>
            <div className="mt-10 space-y-3" aria-hidden>
              {['Audience', 'Offer', 'Risks'].map((label, index) => (
                <div
                  key={label}
                  className="flex items-center justify-between border-t border-white/[0.06] pt-3 text-sm"
                >
                  <span className="text-sx-text-muted">{label}</span>
                  <span className="font-mono text-sx-accent">
                    {90 - index * 12}%
                  </span>
                </div>
              ))}
            </div>
          </article>

          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
            {rest.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <SectionReveal key={feature.title} delay={index * 40}>
                  <article className="h-full rounded-card border border-white/[0.08] bg-sx-bg-elevated/80 p-5">
                    <div className="flex items-center justify-between">
                      <Icon className="h-5 w-5 text-[var(--sx-evidence)]" />
                      <StatusPill variant={feature.status} size="sm" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-sx-text-primary">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-sx-text-muted">
                      {feature.copy}
                    </p>
                  </article>
                </SectionReveal>
              );
            })}
          </div>
        </div>

        <p className="mt-10 flex items-center gap-2 text-sm text-sx-text-muted">
          <Shield className="h-4 w-4 text-sx-accent" />
          Every module shares the same approval spine.
        </p>
      </div>
    </section>
  );
}
