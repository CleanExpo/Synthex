'use client';

import { SynthexLogo } from '@/components/marketing/MarketingLayout';
import Link from 'next/link';

/**
 * Onboarding Layout — full-bleed wide canvas + unique geometric pattern.
 */

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface-dark text-white">
      {/* Base wash */}
      <div className="fixed inset-0 bg-gradient-to-br from-surface-dark via-surface-base to-surface-dark" />

      {/* Unique pattern: diagonal hatch + hex lattice + orbital arcs */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none opacity-[0.55]"
        style={{
          backgroundImage: `
            repeating-linear-gradient(
              -32deg,
              transparent,
              transparent 11px,
              rgba(249, 115, 22, 0.035) 11px,
              rgba(249, 115, 22, 0.035) 12px
            ),
            repeating-linear-gradient(
              58deg,
              transparent,
              transparent 17px,
              rgba(255, 255, 255, 0.02) 17px,
              rgba(255, 255, 255, 0.02) 18px
            )
          `,
        }}
      />
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none opacity-[0.4]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='84' height='48' viewBox='0 0 84 48'%3E%3Cpath d='M42 0 L63 12 L63 36 L42 48 L21 36 L21 12 Z' fill='none' stroke='rgba(249,115,22,0.07)' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: '84px 48px',
          maskImage:
            'radial-gradient(ellipse 80% 70% at 50% 40%, black 20%, transparent 75%)',
        }}
      />
      {/* Orbital rings */}
      <div
        aria-hidden
        className="fixed top-[-20%] left-[-10%] w-[70vw] h-[70vw] max-w-[900px] max-h-[900px] rounded-full border border-orange-500/10 pointer-events-none"
      />
      <div
        aria-hidden
        className="fixed top-[-12%] left-[-4%] w-[55vw] h-[55vw] max-w-[700px] max-h-[700px] rounded-full border border-white/5 pointer-events-none"
      />
      <div
        aria-hidden
        className="fixed bottom-[-25%] right-[-15%] w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] rounded-full border border-orange-500/8 pointer-events-none"
      />

      <div className="fixed top-1/4 right-1/4 w-80 h-80 bg-orange-500/6 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-1/3 left-1/5 w-72 h-72 bg-orange-400/4 rounded-full blur-[100px] pointer-events-none" />

      <header className="relative z-20 border-b border-[0.5px] border-white/6 bg-surface-dark/80 backdrop-blur-md">
        <div className="mx-auto w-full md:w-[80%] px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 w-fit group">
            <SynthexLogo className="w-8 h-8 opacity-90 group-hover:opacity-100 transition-opacity" />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-light tracking-[0.22em] text-white uppercase">
                Synthex
              </span>
              <span className="text-xs tracking-[0.16em] uppercase text-white/30">
                Onboarding
              </span>
            </div>
          </Link>
          <p className="hidden sm:block text-xs text-white/30 tracking-wide">
            Goal → brand → platforms
          </p>
        </div>
      </header>

      <div className="relative z-10 mx-auto w-full md:w-[80%] px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12">
        {children}
      </div>
    </div>
  );
}
