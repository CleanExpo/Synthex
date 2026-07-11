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
  { icon: Shield, label: 'SOC ready' },
  { icon: CheckCircle2, label: 'Privacy first' },
];

export function TrustStrip({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        'border-y border-white/[0.04] bg-sx-bg-secondary py-5',
        className
      )}
      aria-label="Trust indicators"
    >
      <div className="mx-auto flex max-w-container flex-wrap items-center justify-center gap-x-8 gap-y-3 px-5">
        {trustItems.map(item => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="flex items-center gap-2 text-xs font-medium text-sx-text-muted"
            >
              <Icon className="h-4 w-4 text-sx-text-secondary" aria-hidden />
              <span>{item.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
