'use client';

import Link from 'next/link';
import Image from 'next/image';

const TRUST_SIGNALS = [
  { value: '10,000+', label: 'local businesses' },
  { value: '14-day', label: 'free trial, no card needed' },
  { value: '$49/mo', label: 'less than a social media post' },
];

/** Hero section — asymmetric 60/40 layout */
export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
        <div className="flex flex-col lg:flex-row gap-12 xl:gap-20 items-center">
          {/* Left — Content (60%) */}
          <div className="flex-[6] order-1 text-center lg:text-left">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2.5 mb-8">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[10px] uppercase tracking-[0.35em] text-white/40">
                Trusted by 10,000+ cafés, tradies, salons and gyms
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-[5rem] font-bold tracking-tight text-white leading-[1.05] mb-6">
              Your social media, <span className="text-cyan-400">handled.</span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl text-gray-300 max-w-xl mx-auto lg:mx-0 leading-relaxed mb-4">
              Synthex writes and posts for your café, salon, gym, or trade
              business — so you can focus on running it.
            </p>
            <p className="text-base text-gray-500 max-w-lg mx-auto lg:mx-0 leading-relaxed mb-10">
              No experience needed. No agency fees. No credit card required. Set up in 10 minutes.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-12">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-white font-semibold text-sm rounded-full transition-colors duration-200"
              >
                Start Free — No Card Needed
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 text-sm rounded-full transition-all duration-200"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
                Watch Demo
              </Link>
            </div>

            {/* Trust signals */}
            <div className="border-t border-white/[0.06] pt-6">
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                {TRUST_SIGNALS.map(item => (
                  <div key={item.label} className="flex items-center gap-2">
                    <span className="text-sm font-bold text-cyan-400">
                      {item.value}
                    </span>
                    <span className="text-sm text-white/40">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right — Image (40%) */}
          <div className="flex-[4] order-2 relative w-full max-w-lg lg:max-w-none">
            <div className="relative">
              {/* Ambient glow */}
              <div className="absolute -inset-8 bg-gradient-to-t from-cyan-500/15 via-transparent to-transparent blur-3xl -z-10 rounded-full" />

              {/* Image frame */}
              <div className="border border-white/[0.06] rounded-xl overflow-hidden shadow-2xl shadow-black/50">
                <Image
                  src="/images/hero-robot.png"
                  alt="Synthex — AI Social Media Automation Platform"
                  width={2048}
                  height={1152}
                  priority
                  className="w-full h-auto object-cover"
                />
              </div>

              {/* Corner accent */}
              <div className="absolute -bottom-3 -right-3 w-24 h-24 border-r border-b border-cyan-400/20 rounded-xl pointer-events-none" />
              <div className="absolute -top-3 -left-3 w-24 h-24 border-l border-t border-white/[0.06] rounded-xl pointer-events-none" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
