import { Network, Sparkles, Rocket } from 'lucide-react';

const STEPS = [
  {
    number: '01',
    icon: Network,
    title: 'Connect Socials',
    description:
      'Securely link your profiles with high-grade encrypted API gateways designed for industrial scale.',
  },
  {
    number: '02',
    icon: Sparkles,
    title: 'Define Voice',
    description:
      "Train our neural engine on your brand's unique editorial authority and specific aesthetic parameters.",
  },
  {
    number: '03',
    icon: Rocket,
    title: 'Automate',
    description:
      'Execute the sequence. Watch Synthex curate, post, and intelligently engage across the web.',
  },
];

/** Deployment Pipeline — 3-card industrial process section */
export function HowItWorks() {
  return (
    <section className="relative py-24 md:py-32 z-10">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-[#ffb87b]/10 border border-[#ffb87b]/20 mb-6">
            <span className="font-mono text-[10px] font-black tracking-[0.3em] uppercase text-[#ffb87b]">
              Process
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-white mb-4">
            Deployment Pipeline
          </h2>
          {/* Orange underline divider */}
          <div className="w-16 h-0.5 bg-gradient-to-r from-[#ffb87b] to-[#ff8f00] mb-4" />
          <p className="text-white/40 font-mono text-sm">
            Standardised automation in &lt; 600 seconds.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STEPS.map(({ number, icon: Icon, title, description }) => (
            <div
              key={number}
              className="group relative bg-[rgba(28,27,27,0.9)] backdrop-blur-xl border border-[rgba(255,220,194,0.08)] rounded-sm p-8 overflow-hidden hover:-translate-y-1 hover:border-[rgba(255,184,123,0.2)] transition-all duration-300"
            >
              {/* Large watermark number */}
              <span className="absolute top-4 right-6 font-black text-7xl text-white/[0.04] select-none pointer-events-none">
                {number}
              </span>

              {/* Icon */}
              <div className="w-10 h-10 rounded-sm bg-[#ffb87b]/10 border border-[#ffb87b]/20 flex items-center justify-center mb-6 relative z-10">
                <Icon className="w-5 h-5 text-[#ffb87b]" />
              </div>

              {/* Step number badge */}
              <div className="font-mono text-[10px] font-black tracking-[0.3em] uppercase text-[#ffb87b]/60 mb-2 relative z-10">
                {number}
              </div>

              {/* Title */}
              <h3 className="text-lg font-black uppercase tracking-tight text-white mb-3 relative z-10">
                {title}
              </h3>

              {/* Description */}
              <p className="text-sm text-white/40 leading-relaxed relative z-10">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default HowItWorks;
