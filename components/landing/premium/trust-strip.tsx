import {
  CheckCircle2,
  FileSearch,
  Lock,
  MapPin,
  Shield,
  Users,
} from '@/components/icons';

const trustItems = [
  { icon: Lock, label: 'Approval gated' },
  { icon: Users, label: 'Human review' },
  { icon: MapPin, label: 'Australian built' },
  { icon: FileSearch, label: 'Evidence backed' },
  { icon: Shield, label: 'No silent publishing' },
  { icon: CheckCircle2, label: 'Privacy first' },
];

export function TrustStrip() {
  const loop = [...trustItems, ...trustItems];
  return (
    <section
      className="relative overflow-hidden border-y border-white/[0.06] bg-sx-bg-secondary py-5"
      aria-label="Operating constraints"
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-sx-bg-secondary to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-sx-bg-secondary to-transparent"
        aria-hidden
      />
      <div className="landing-marquee-track flex w-max gap-10 px-5">
        {loop.map((item, index) => {
          const Icon = item.icon;
          return (
            <div
              key={`${item.label}-${index}`}
              className="flex items-center gap-2.5 text-xs font-medium tracking-[0.14em] text-sx-text-muted uppercase"
            >
              <Icon className="h-3.5 w-3.5 text-sx-accent" aria-hidden />
              {item.label}
            </div>
          );
        })}
      </div>
    </section>
  );
}
