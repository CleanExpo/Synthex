'use client';

import Link from 'next/link';
import { LiveDemoWidget } from './LiveDemoWidget';

/** Eyebrow pill label */
function EyebrowPill({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 mb-8">
      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse flex-shrink-0" />
      <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-orange-400">
        {children}
      </span>
    </div>
  );
}

/** Social proof row */
function SocialProofRow() {
  return (
    <div className="flex items-center gap-3 mt-8">
      <div className="flex -space-x-2">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className="w-8 h-8 rounded-full border-2 border-charcoal-900 bg-charcoal-600 flex-shrink-0"
          />
        ))}
      </div>
      <p className="text-sm text-white/50">
        Start growing your social presence
      </p>
    </div>
  );
}

/** Hero section — 55/45 asymmetric layout with LiveDemoWidget */
export function HeroSection() {
  return (
    <section className="relative min-h-[100dvh] flex items-center pt-24 pb-16 overflow-hidden">
      {/* Warm ambient glow */}
      <div className="absolute top-1/3 -left-48 w-[600px] h-[600px] bg-orange-500/[0.04] blur-[200px] rounded-full pointer-events-none" />
      <div className="absolute top-1/2 right-0 w-[400px] h-[400px] bg-orange-500/[0.03] blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-12 items-center">
          {/* Left — copy */}
          <div>
            <EyebrowPill>AI-native social media</EyebrowPill>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.05] mb-6">
              The social media platform that{' '}
              <em className="text-orange-500 not-italic">works for you</em>
            </h1>

            <p className="text-lg text-white/50 max-w-lg leading-relaxed mb-10">
              AI generates posts in seconds. You approve. Synthex handles the
              rest — scheduling, engagement, and analytics across every channel.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-orange-500 text-charcoal-900 font-bold rounded-full hover:bg-orange-400 hover:-translate-y-0.5 transition-all duration-200 text-sm"
              >
                Start free
              </Link>
              <Link
                href="/features"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white/[0.04] border border-white/10 text-white/80 hover:text-white hover:bg-white/[0.08] rounded-full transition-all duration-200 text-sm font-medium"
              >
                See it work
              </Link>
            </div>

            <SocialProofRow />
          </div>

          {/* Right — LiveDemoWidget */}
          <div>
            <LiveDemoWidget />
          </div>
        </div>
      </div>
    </section>
  );
}
