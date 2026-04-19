'use client';

import Link from 'next/link';
import { HeroVisual } from './HeroVisual';
import { LiveDemoWidget } from './LiveDemoWidget';

function EyebrowPill({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/10 mb-8 backdrop-blur-md relative overflow-hidden group">
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `linear-gradient(to right, rgb(var(--color-amber) / 0.1), rgb(var(--color-purple) / 0.1))`,
        }}
      />
      <span
        className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0"
        style={{
          background: `linear-gradient(to right, rgb(var(--color-amber)), rgb(var(--color-purple)))`,
          boxShadow: `0 0 10px rgb(var(--color-purple) / 0.6)`,
        }}
      />
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
            bg: 'brand-amber',
            color: 'rgb(var(--color-amber))',
            title: 'Jane Doe - Cafe Owner',
          },
          {
            initials: 'KM',
            bg: 'brand-purple',
            color: 'rgb(var(--color-purple))',
            title: 'Kyle Morrison - Plumber',
          },
          {
            initials: 'SR',
            bg: 'indigo',
            color: '#6366f1',
            title: 'Sarah Reeves - Retail Store',
          },
          {
            initials: 'AL',
            bg: 'rose',
            color: '#f43f5e',
            title: 'Alex Liu - Gym Studio',
          },
        ].map(({ initials, color, title }) => (
          <div
            key={initials}
            title={title}
            className="w-8 h-8 rounded-full border-2 border-[#09090B] shadow-lg flex-shrink-0 flex items-center justify-center text-[9px] font-black uppercase tracking-tight text-white"
            style={{ backgroundColor: color }}
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
      {/* Two calm ambient blobs — no gradient stacking beyond 2 layers */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div
          className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full blur-[100px]"
          style={{ background: 'rgb(var(--color-purple) / 0.09)' }}
        />
        <div
          className="absolute top-1/2 right-[-8%] w-[400px] h-[400px] rounded-full blur-[120px]"
          style={{ background: 'rgb(var(--color-amber) / 0.08)' }}
        />
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
              <span
                className="bg-clip-text text-transparent italic pr-2"
                style={{
                  backgroundImage: `linear-gradient(to right, rgb(var(--color-amber)), rgb(var(--color-purple)))`,
                }}
              >
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
