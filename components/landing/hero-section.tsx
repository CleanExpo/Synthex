'use client';

import Link from 'next/link';
import Image from 'next/image';

const TRUST_ITEMS = [
  { value: '14-day', label: 'free trial' },
  { value: 'BYOK', label: 'your API keys' },
  { value: '9', label: 'platforms' },
  { value: '24 / 7', label: 'autonomous' },
];

/** Hero section — asymmetric 60/40 layout, Scientific Luxury typography */
export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center pt-24 pb-16">
      <div className="container mx-auto px-6 relative z-10">
        <div className="flex flex-col lg:flex-row gap-12 xl:gap-20 items-center">

          {/* Left — Content (60%) */}
          <div className="flex-[6] order-1 text-center lg:text-left">

            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2.5 mb-10">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[10px] uppercase tracking-[0.35em] text-white/40">
                AI Marketing Automation Platform
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-[5.5rem] font-extralight tracking-tight text-white leading-[1.02] mb-6">
              Your marketing,<br />
              <span className="text-cyan-400">fully autonomous.</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg text-white/50 max-w-xl mx-auto lg:mx-0 leading-relaxed mb-8">
              Synthex replaces your entire social media operation with autonomous AI agents. Create, schedule, optimise, and publish across 9 platforms — without lifting a finger.
            </p>

            {/* Pricing callout */}
            <div className="inline-flex items-center gap-3 mb-10 px-4 py-2.5 border-l-2 border-cyan-400/60 bg-cyan-500/[0.04]">
              <span className="text-sm text-white/60">
                From{' '}
                <span className="font-mono text-white font-medium">$249</span>
                {' '}/month — or use your own API keys to cut costs further
              </span>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-12">
              <Link
                href="/auth/signup"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-cyan-500 hover:bg-cyan-400 text-[#0a1628] font-semibold text-sm tracking-wide rounded-sm transition-colors duration-200"
              >
                Start Free Trial
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 border-[0.5px] border-white/[0.15] hover:border-white/30 text-white/60 hover:text-white text-sm tracking-wide rounded-sm transition-all duration-200 bg-white/[0.02] hover:bg-white/[0.04]"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Watch Demo
              </Link>
            </div>

            {/* Trust data strip */}
            <div className="flex flex-wrap gap-x-8 gap-y-3 justify-center lg:justify-start border-t border-[0.5px] border-white/[0.06] pt-8">
              {TRUST_ITEMS.map((item) => (
                <div key={item.label} className="flex items-baseline gap-1.5">
                  <span className="font-mono text-sm font-medium text-white">{item.value}</span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-white/30">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Image (40%) */}
          <div className="flex-[4] order-2 relative w-full max-w-lg lg:max-w-none">
            <div className="relative">
              {/* Ambient glow */}
              <div className="absolute -inset-8 bg-gradient-to-t from-cyan-500/15 via-transparent to-transparent blur-3xl -z-10 rounded-full" />

              {/* Image frame */}
              <div className="border-[0.5px] border-white/[0.06] rounded-sm overflow-hidden shadow-2xl shadow-black/50">
                <Image
                  src="/images/hero-robot.png"
                  alt="Synthex — Autonomous AI Marketing Platform"
                  width={2048}
                  height={1152}
                  priority
                  className="w-full h-auto object-cover"
                />
              </div>

              {/* Corner accent */}
              <div className="absolute -bottom-3 -right-3 w-24 h-24 border-r border-b border-cyan-400/20 rounded-sm pointer-events-none" />
              <div className="absolute -top-3 -left-3 w-24 h-24 border-l border-t border-white/[0.06] rounded-sm pointer-events-none" />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
