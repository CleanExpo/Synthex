'use client';

import Link from 'next/link';
import { HeroVisual } from './HeroVisual';
import { LiveDemoWidget } from './LiveDemoWidget';

function EyebrowPill({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/10 mb-8 backdrop-blur-md relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-r from-[#FF8A00]/10 to-[#9D4EDD]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-[#FF8A00] to-[#9D4EDD] shadow-[0_0_10px_#9D4EDD] animate-pulse flex-shrink-0" />
      <span className="text-xs font-semibold tracking-widest uppercase bg-gradient-to-r from-white/90 to-white/50 bg-clip-text text-transparent relative z-10">
        {children}
      </span>
    </div>
  );
}

function SocialProofRow() {
  return (
    <div className="flex items-center gap-3 mt-8">
      <div className="flex -space-x-2">
        {[
          {
            initials: 'JD',
            bg: 'bg-[#FF8A00]',
            shadow: 'shadow-[#FF8A00]/30',
            title: 'Jane Doe - Cafe Owner',
          },
          {
            initials: 'KM',
            bg: 'bg-[#9D4EDD]',
            shadow: 'shadow-[#9D4EDD]/30',
            title: 'Kyle Morrison - Plumber',
          },
          {
            initials: 'SR',
            bg: 'bg-indigo-500',
            shadow: 'shadow-indigo-500/30',
            title: 'Sarah Reeves - Retail Store',
          },
          {
            initials: 'AL',
            bg: 'bg-rose-500',
            shadow: 'shadow-rose-500/30',
            title: 'Alex Liu - Gym Studio',
          },
        ].map(({ initials, bg, shadow, title }) => (
          <div
            key={initials}
            title={title}
            className={`w-8 h-8 rounded-full border-2 border-[#09090B] ${bg} ${shadow} shadow-lg flex-shrink-0 flex items-center justify-center text-[9px] font-black uppercase tracking-tight text-white`}
          >
            {initials}
          </div>
        ))}
      </div>
      <p className="text-sm text-white/50">
        Trusted by 5,000+ local businesses
      </p>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="relative min-h-[100dvh] flex items-center pt-24 pb-16 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-to-br from-[#9D4EDD]/[0.12] to-transparent blur-[120px] rounded-full" />
        <div className="absolute top-1/2 right-[-10%] w-[500px] h-[500px] bg-[#FF8A00]/[0.1] blur-[140px] rounded-full" />
        <div className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-indigo-500/[0.08] blur-[150px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10 w-full mt-10">
        <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-12 items-center">
          {/* Left — copy */}
          <div>
            <div>
              <EyebrowPill>
                The Pocket Agency for Local Business
              </EyebrowPill>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display font-medium tracking-tight text-white leading-[1.05] mb-6">
              Local Discovery. <br />
              <span className="bg-gradient-to-r from-[#FF8A00] to-[#9D4EDD] bg-clip-text text-transparent italic pr-2">
                Fully Automated.
              </span>
            </h1>

            <p className="text-lg text-white/60 max-w-lg leading-relaxed mb-10 font-sans">
              Stop fighting algorithms and wasting hours on social media. 
              Synthex learns your business and acts as your elite marketing team — scheduling, generating, and engaging across all platforms.
            </p>

            <div>
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <Link
                  href="/signup"
                  className="premium-btn text-white font-semibold rounded-full px-8 py-3.5 text-[15px] inline-flex items-center justify-center transition-all duration-300"
                >
                  Start Dominating Local
                </Link>
                <Link
                  href="/features"
                  className="group relative inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white/[0.03] border border-white/10 text-white hover:bg-white/[0.08] rounded-full transition-all duration-300 text-[15px] font-medium backdrop-blur-md"
                >
                  See it work
                </Link>
              </div>
              <p className="text-sm text-white/40">
                No credit card required · Cancel anytime
              </p>
            </div>

            <div>
              <SocialProofRow />
            </div>
          </div>

          {/* Right — visual + LiveDemoWidget */}
          <div className="relative">
            <HeroVisual className="absolute inset-0 w-full h-full opacity-60 pointer-events-none" />
            <LiveDemoWidget />
          </div>
        </div>
      </div>
    </section>
  );
}
