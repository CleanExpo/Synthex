import {
  Clock,
  FileText,
  GitBranch,
  Lock,
  Search,
  Shield,
  Users,
} from '@/components/icons';
import { SectionAtmosphere } from './section-atmosphere';

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
      className="relative overflow-hidden bg-sx-bg-secondary py-24 md:py-32"
      aria-labelledby="enterprise-heading"
    >
      <SectionAtmosphere variant="ink" scanlines />
      <div className="relative mx-auto grid max-w-container gap-14 px-5 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <div className="lg:sticky lg:top-28">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sx-accent">
            Governance
          </p>
          <h2
            id="enterprise-heading"
            className="mt-3 text-3xl font-semibold tracking-tight text-sx-text-primary md:text-5xl"
          >
            Built for teams that cannot afford a silent publish
          </h2>
          <p className="mt-5 text-base leading-8 text-sx-text-secondary">
            Spec-sheet controls, not a feature wall. Each row is a gate the
            command center actually enforces.
          </p>
        </div>
        <ul className="divide-y divide-white/[0.06] rounded-card border border-white/[0.08] bg-sx-bg-elevated/70">
          {enterpriseFeatures.map(feature => {
            const Icon = feature.icon;
            return (
              <li
                key={feature.title}
                className="grid gap-3 px-5 py-5 sm:grid-cols-[1.4rem_9rem_1fr] sm:items-start"
              >
                <Icon className="mt-0.5 h-5 w-5 text-[var(--sx-evidence)]" />
                <p className="text-sm font-semibold text-sx-text-primary">
                  {feature.title}
                </p>
                <p className="text-sm leading-6 text-sx-text-muted">
                  {feature.copy}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
