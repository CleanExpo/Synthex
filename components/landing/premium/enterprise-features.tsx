import {
  FileText,
  GitBranch,
  Clock,
  Lock,
  Search,
  Shield,
  Users,
} from '@/components/icons';
import { SectionFloatingGradients } from './floating-gradients';

const enterpriseFeatures = [
  {
    icon: Search,
    title: 'Evidence-backed',
    copy: 'Every strategy claim links to a source ref — no orphan recommendations.',
  },
  {
    icon: Lock,
    title: 'Approval gate',
    copy: 'Publish, spend and public claims blocked until a human approves.',
  },
  {
    icon: FileText,
    title: 'Research traceability',
    copy: 'Council packets and research bundles stored with version history.',
  },
  {
    icon: Shield,
    title: 'Brand governance',
    copy: 'Voice, compliance and licensing gates enforced per workspace.',
  },
  {
    icon: Users,
    title: 'Team permissions',
    copy: 'Role-based access with org-scoped data — never cross-brand leakage.',
  },
  {
    icon: Clock,
    title: 'Audit trail',
    copy: 'Who approved what, when — full accountability for enterprise teams.',
  },
  {
    icon: GitBranch,
    title: 'Version history',
    copy: 'Diff prior campaign plans and creative assets before sign-off.',
  },
];

export function EnterpriseFeatures() {
  return (
    <section
      className="relative overflow-hidden bg-sx-bg-secondary py-32"
      aria-labelledby="enterprise-heading"
    >
      <SectionFloatingGradients variant="lower" />
      <div className="relative mx-auto max-w-content px-5">
        <div className="mb-14 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sx-accent">
            Enterprise marketing software
          </p>
          <h2
            id="enterprise-heading"
            className="mt-3 text-3xl font-semibold tracking-tight text-sx-text-primary md:text-5xl"
          >
            Marketing governance built for teams that cannot afford mistakes
          </h2>
          <p className="mt-5 text-base leading-8 text-sx-text-secondary">
            Campaign approval workflow, brand governance platform and
            collaborative marketing — designed for agencies and in-house teams
            running controlled pilots.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {enterpriseFeatures.map(feature => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className="rounded-card border border-white/[0.08] bg-sx-bg-elevated p-6"
              >
                <Icon className="h-6 w-6 text-sx-text-secondary" />
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
      </div>
    </section>
  );
}
