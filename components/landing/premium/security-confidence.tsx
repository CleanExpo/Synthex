import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  Globe,
  Lock,
  Shield,
  Users,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { SectionAtmosphere } from './section-atmosphere';

const securityItems = [
  { icon: Lock, label: 'Privacy by design' },
  { icon: FileText, label: 'Audit logs' },
  { icon: Users, label: 'Human review required' },
  { icon: Shield, label: 'Role permissions' },
  { icon: Clock, label: 'Version history' },
  { icon: CheckCircle2, label: 'Approval workflow' },
  { icon: Globe, label: 'Data residency controls' },
];

export function SecurityConfidence() {
  return (
    <section
      className="relative overflow-hidden bg-sx-bg-primary py-24 md:py-32"
      aria-labelledby="security-heading"
    >
      <SectionAtmosphere variant="evidence" />
      <div className="relative mx-auto max-w-content px-5">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--sx-evidence-bright)]">
              Security
            </p>
            <h2
              id="security-heading"
              className="mt-3 text-3xl font-semibold tracking-tight text-sx-text-primary md:text-5xl"
            >
              Your campaigns. Your approvals. Your audit trail.
            </h2>
            <p className="mt-5 text-base leading-8 text-sx-text-secondary">
              Explicit gates — no silent publishing, no exposed provider keys,
              no claims without evidence.
            </p>
            <div className="mt-8">
              <Button asChild variant="glass-secondary" size="lg">
                <Link href="/security">
                  Read security overview
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="relative rounded-card border border-[var(--sx-evidence)]/20 bg-[var(--sx-evidence-surface)] p-6">
            <div
              className="pointer-events-none absolute inset-6 rounded-full border border-[var(--sx-evidence)]/15"
              aria-hidden
            />
            <div className="relative grid gap-3 sm:grid-cols-2">
              {securityItems.map(item => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 rounded-btn border border-white/[0.06] bg-black/20 px-4 py-3.5"
                  >
                    <Icon className="h-5 w-5 shrink-0 text-[var(--sx-evidence-bright)]" />
                    <span className="text-sm font-medium text-sx-text-primary">
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
