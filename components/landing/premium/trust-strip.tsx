import {
  CheckCircle2,
  FileSearch,
  Lock,
  MapPin,
  Shield,
  Users,
} from '@/components/icons';
import { cn } from '@/lib/utils';

const trustItems = [
  { icon: Lock, label: 'Approval gated' },
  { icon: Users, label: 'Human review' },
  { icon: MapPin, label: 'Australian built' },
  { icon: FileSearch, label: 'Evidence backed' },
  { icon: Shield, label: 'No silent publishing' },
  { icon: CheckCircle2, label: 'Privacy first' },
];

export function TrustStrip({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        'landing-trust-shimmer relative border-y border-white/[0.06] bg-gradient-to-r from-sx-bg-secondary via-sx-bg-panel to-sx-bg-secondary py-6',
        className
      )}
      aria-label="Trust indicators"
    >
      <div className="mx-auto flex max-w-container flex-wrap items-center justify-center gap-x-10 gap-y-4 px-5">
        {trustItems.map(item => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="flex items-center gap-2.5 text-xs font-medium tracking-wide text-sx-text-muted transition-colors duration-[160ms] hover:text-sx-text-secondary"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.06] bg-sx-bg-elevated/80">
                <Icon
                  className="h-3.5 w-3.5 text-sx-text-secondary"
                  aria-hidden
                />
              </span>
              <span>{item.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
