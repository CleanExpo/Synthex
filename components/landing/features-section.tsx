'use client';

/** Platform list for the bottom strip */
const PLATFORMS = ['LinkedIn', 'Instagram', 'TikTok', 'YouTube', 'X (Twitter)', 'Facebook', 'Pinterest', 'Reddit', 'Threads'];

interface Feature {
  tag: string;
  title: string;
  description: string;
  stats?: { value: string; label: string }[];
  accent: 'cyan' | 'emerald' | 'amber';
  size?: 'large' | 'small';
}

/** Primary feature rows — asymmetric layout, no symmetric bento grids */
const FEATURES_MAIN: Feature[] = [
  {
    tag: 'Core Engine',
    title: 'AI Content Generation',
    description:
      'Produce scroll-stopping posts, captions, and visuals at scale. Choose from 10+ content formats per platform, with AI that learns your brand voice and improves with every post.',
    stats: [
      { value: '10+', label: 'formats per platform' },
      { value: '3x', label: 'faster than manual' },
    ],
    accent: 'cyan',
    size: 'large',
  },
  {
    tag: 'Cost Control',
    title: 'Bring Your Own API Keys',
    description:
      'Connect your own OpenAI, Anthropic, or Google AI keys. Slash generation costs by up to 80% while keeping full ownership of your AI usage.',
    stats: [
      { value: '80%', label: 'cost reduction' },
    ],
    accent: 'emerald',
    size: 'small',
  },
];

const FEATURES_ROW2: Feature[] = [
  {
    tag: 'Scheduling',
    title: 'Smart Scheduler',
    description:
      'AI determines optimal posting windows based on your audience behaviour, platform algorithms, and competitor timing. Set it once — it runs forever.',
    accent: 'amber',
  },
  {
    tag: 'Intelligence',
    title: 'Viral Pattern Detection',
    description:
      'Analyse thousands of top-performing posts to reverse-engineer what makes content spread. Apply proven hooks, formats, and timing to every campaign.',
    accent: 'cyan',
  },
  {
    tag: 'Insights',
    title: 'Real-Time Analytics',
    description:
      'Live engagement metrics, follower growth, platform distribution, and predictive ROI — all in one dashboard. No more jumping between apps.',
    accent: 'cyan',
  },
];

const FEATURES_ROW3: Feature[] = [
  {
    tag: 'Brand',
    title: 'Brand Voice & Persona Engine',
    description:
      'Train Synthex on your tone, style, and audience. Every piece of generated content sounds unmistakably like you — not generic AI output.',
    accent: 'amber',
    size: 'small',
  },
  {
    tag: 'Search & Discovery',
    title: 'SEO + GEO Optimisation',
    description:
      'Built-in technical SEO auditing, keyword tracking, schema markup, and Generative Engine Optimisation (GEO) for AI search visibility. Your content gets found everywhere.',
    stats: [
      { value: 'GEO', label: 'AI search ready' },
      { value: 'E-E-A-T', label: 'compliant content' },
    ],
    accent: 'cyan',
    size: 'large',
  },
];

const ACCENT_CLASSES: Record<string, string> = {
  cyan: 'text-cyan-400 border-cyan-400/20',
  emerald: 'text-emerald-400 border-emerald-400/20',
  amber: 'text-amber-400 border-amber-400/20',
};

function FeatureCard({ feature, className = '' }: { feature: Feature; className?: string }) {
  const accentClass = ACCENT_CLASSES[feature.accent] ?? ACCENT_CLASSES.cyan;
  const accentColor = feature.accent === 'cyan' ? '#00F5FF' : feature.accent === 'emerald' ? '#00FF88' : '#FFB800';

  return (
    <div
      className={`group relative bg-white/[0.02] border-[0.5px] border-white/[0.06] hover:border-white/[0.12] transition-colors duration-300 p-6 lg:p-8 flex flex-col gap-4 ${className}`}
    >
      {/* Tag */}
      <span className={`text-[10px] uppercase tracking-[0.3em] ${accentClass.split(' ')[0]}`}>
        {feature.tag}
      </span>

      {/* Title */}
      <h3 className="text-xl lg:text-2xl font-light text-white tracking-tight">
        {feature.title}
      </h3>

      {/* Description */}
      <p className="text-sm text-white/50 leading-relaxed flex-1">
        {feature.description}
      </p>

      {/* Stats */}
      {feature.stats && feature.stats.length > 0 && (
        <div className="flex items-center gap-6 pt-4 border-t border-[0.5px] border-white/[0.06]">
          {feature.stats.map((stat, i) => (
            <div key={i} className="flex items-baseline gap-1.5">
              <span className="font-mono text-base font-medium" style={{ color: accentColor }}>
                {stat.value}
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/30">{stat.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Hover indicator */}
      <div
        className="absolute bottom-0 left-0 h-[0.5px] w-0 group-hover:w-full transition-all duration-500"
        style={{ backgroundColor: accentColor, opacity: 0.4 }}
      />
    </div>
  );
}

/** Features section — asymmetric rows, Scientific Luxury styling */
export function FeaturesSection() {
  return (
    <section className="relative py-32 z-10">
      <div className="container mx-auto px-6">

        {/* Section header */}
        <div className="mb-16 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/30 mb-4 block">
              Platform Capabilities
            </span>
            <h2 className="text-4xl sm:text-5xl font-extralight tracking-tight text-white">
              Everything your marketing<br />
              <span className="text-cyan-400">team does — automated.</span>
            </h2>
          </div>
          <p className="text-white/50 text-sm max-w-sm leading-relaxed lg:text-right">
            From content creation to competitor analysis, Synthex handles the full marketing stack. No subscriptions to 12 different tools.
          </p>
        </div>

        {/* Row 1: 60/40 asymmetric */}
        <div className="grid lg:grid-cols-[3fr_2fr] gap-[0.5px] mb-[0.5px]">
          <FeatureCard feature={FEATURES_MAIN[0]!} />
          <FeatureCard feature={FEATURES_MAIN[1]!} />
        </div>

        {/* Row 2: equal thirds */}
        <div className="grid md:grid-cols-3 gap-[0.5px] mb-[0.5px]">
          {FEATURES_ROW2.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </div>

        {/* Row 3: 40/60 asymmetric (reversed) */}
        <div className="grid lg:grid-cols-[2fr_3fr] gap-[0.5px] mb-[0.5px]">
          <FeatureCard feature={FEATURES_ROW3[0]!} />
          <FeatureCard feature={FEATURES_ROW3[1]!} />
        </div>

        {/* Platform support strip */}
        <div className="mt-16 pt-10 border-t border-[0.5px] border-white/[0.06]">
          <div className="flex flex-wrap items-center gap-3 justify-center">
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/30 mr-4">
              9 Platforms
            </span>
            {PLATFORMS.map((platform) => (
              <span
                key={platform}
                className="px-3 py-1 text-xs text-white/50 border-[0.5px] border-white/[0.06] bg-white/[0.02] rounded-sm"
              >
                {platform}
              </span>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
