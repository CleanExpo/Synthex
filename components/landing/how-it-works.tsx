import { Network, Sparkles, Rocket } from 'lucide-react';

const STEPS = [
  {
    number: '01',
    icon: Network,
    title: 'Enter your URL',
    description:
      'Paste your website URL. Our AI extracts your brand voice, colours, and tone automatically.',
  },
  {
    number: '02',
    icon: Sparkles,
    title: 'AI extracts your brand',
    description:
      'Within seconds, Synthex builds a Brand DNA profile — your unique voice, values, and visual identity.',
  },
  {
    number: '03',
    icon: Rocket,
    title: 'Approve your first post',
    description:
      'Review and approve your first AI-generated post. Go live in under 60 seconds.',
  },
];

/** How It Works — sticky scroll 3-step with amber step numbers */
export function HowItWorks() {
  return (
    <section className="relative py-24 md:py-32 z-10">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 mb-6">
            <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-orange-400">
              How it works
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-4">
            Up and running in minutes
          </h2>
          <p className="text-white/40 text-base max-w-lg">
            No setup required. No manual configuration. Just your URL and you're
            live.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STEPS.map(({ number, icon: Icon, title, description }) => (
            <div
              key={number}
              className="group relative bg-charcoal-800/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8 overflow-hidden shadow-2xl shadow-black/30 ring-1 ring-white/[0.04] hover:-translate-y-1 hover:border-white/[0.10] transition-all duration-300"
            >
              {/* Step number — amber, prominent */}
              <div className="text-orange-500 font-black text-5xl leading-none mb-6 select-none">
                {number}
              </div>

              {/* Icon */}
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-5">
                <Icon className="w-5 h-5 text-orange-400" />
              </div>

              {/* Title */}
              <h3 className="text-lg font-bold tracking-tight text-white mb-3">
                {title}
              </h3>

              {/* Description */}
              <p className="text-sm text-white/40 leading-relaxed">
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
