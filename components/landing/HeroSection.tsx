'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight } from '@/components/icons';

export function HeroSection() {
  return (
    <section className="relative pt-32 pb-40 px-6 overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[radial-gradient(circle_at_center,rgba(255,107,53,0.15)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[radial-gradient(circle_at_center,rgba(244,114,182,0.10)_0%,transparent_70%)] pointer-events-none" />

      <div className="container mx-auto relative z-10 flex flex-col items-center text-center">
        {/* Top Badge */}
        <div className="inline-flex items-center space-x-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-8 backdrop-blur-md">
          <span className="text-candy-orange">✨</span>
          <span className="text-sm text-white/80 font-medium">
            Synthex v3.0 is live
          </span>
        </div>

        {/* H1 Headline */}
        <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-white max-w-5xl leading-[1.1] mb-8">
          Fully Autonomous <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-candy-orange via-candy-yellow to-candy-green">
            Social Media Agency
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-xl md:text-2xl text-white/60 max-w-3xl mb-12 font-light">
          Stop scheduling. Start scaling. Our AI agent creates, schedules, and
          optimizes viral content across 9 platforms—24/7.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6">
          <Button
            asChild
            size="lg"
            className="h-14 px-8 text-lg bg-candy-orange hover:bg-candy-orange/90 text-charcoal-950 font-bold rounded-full shadow-[0_0_40px_rgba(255,107,53,0.4)] transition-all hover:scale-105"
          >
            <Link href="/signup">
              Start Free Trial
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-14 px-8 text-lg bg-white/5 border-white/10 hover:bg-white/10 text-white rounded-full backdrop-blur-md transition-all"
          >
            <Link href="/demo">
              Watch Demo
              <span className="ml-2 text-white/40 border border-white/10 rounded px-2 py-0.5 text-xs">
                2 min
              </span>
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-20 text-white text-center opacity-50">
        Dashboard Preview disabled for stability test...
      </div>
    </section>
  );
}
