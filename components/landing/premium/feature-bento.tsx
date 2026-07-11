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
      className="bg-sx-bg-primary py-32"
      aria-labelledby="platform-features-heading"
    >
      <div className="mx-auto max-w-content px-5">
        <div className="mb-14 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sx-accent">
            Platform
          </p>
          <h2
            id="platform-features-heading"
            className="mt-3 text-3xl font-semibold tracking-tight text-sx-text-primary md:text-5xl"
          >
            One AI marketing workspace for the full content operations stack
          </h2>
          <p className="mt-5 text-base leading-8 text-sx-text-secondary">
            Campaign planning software, SEO planning, brand governance and
            collaborative marketing — without the dashboard maze.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {features.map(feature => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className={`group rounded-card border border-white/[0.08] bg-sx-bg-elevated p-6 transition-all duration-[160ms] ease-premium hover:-translate-y-0.5 hover:border-white/[0.14] ${feature.span}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <Icon className="h-6 w-6 text-sx-accent" />
                  <StatusPill variant={feature.status} size="sm" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-sx-text-primary">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-sx-text-muted">
                  {feature.copy}
                </p>
                <div className="mt-6 h-24 rounded-[14px] border border-white/[0.06] bg-sx-bg-panel p-3">
                  <div className="space-y-2">
                    <div className="h-2 w-3/4 rounded bg-white/[0.06]" />
                    <div className="h-2 w-1/2 rounded bg-white/[0.04]" />
                    <div className="mt-3 flex gap-2">
                      <div className="h-6 w-16 rounded bg-sx-accent/10" />
                      <div className="h-6 w-20 rounded bg-white/[0.04]" />
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-10 flex items-center gap-2 text-sm text-sx-text-muted">
          <Shield className="h-4 w-4" />
          Every module shares the same approval spine — no silent auto-publish.
        </div>
      </div>
    </section>
  );
}
