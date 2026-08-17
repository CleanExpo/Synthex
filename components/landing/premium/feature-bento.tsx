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

const featured = {
  icon: Layers,
  title: 'Campaign planning',
  copy: 'Voice-to-plan cards with audience, offer, risks and next decision.',
  status: 'draft' as const,
};

const modules = [
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
  const FeaturedIcon = featured.icon;

  return (
    <section
      className="relative overflow-hidden bg-sx-bg-primary py-24 md:py-32"
      aria-labelledby="platform-features-heading"
    >
      <SectionAtmosphere variant="ink" noise />
      <div className="relative z-10 mx-auto w-full max-w-7xl px-5">
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

        <article className="relative mb-4 overflow-hidden rounded-2xl border border-sx-accent/30 bg-gradient-to-br from-sx-opportunity-surface to-sx-bg-elevated p-7 md:p-10">
          <StatusPill variant={featured.status} size="sm" />
          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,16rem)] lg:items-end">
            <div className="min-w-0">
              <FeaturedIcon className="h-8 w-8 text-sx-accent" />
              <h3 className="mt-5 text-2xl font-semibold text-sx-text-primary">
                {featured.title}
              </h3>
              <p className="mt-3 max-w-xl text-sm leading-7 text-sx-text-secondary">
                {featured.copy}
              </p>
            </div>
            <div className="min-w-0 space-y-3" aria-hidden>
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
          </div>
        </article>

        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map(feature => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className="flex min-h-[13rem] min-w-0 flex-col rounded-2xl border border-white/[0.08] bg-sx-bg-elevated p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <Icon className="h-5 w-5 shrink-0 text-[var(--sx-evidence)]" />
                  <StatusPill variant={feature.status} size="sm" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-sx-text-primary">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-sx-text-muted">
                  {feature.copy}
                </p>
              </article>
            );
          })}
        </div>

        <p className="mt-10 flex items-center gap-2 text-sm text-sx-text-muted">
          <Shield className="h-4 w-4 text-sx-accent" />
          Every module shares the same approval spine.
        </p>
      </div>
    </section>
  );
}
