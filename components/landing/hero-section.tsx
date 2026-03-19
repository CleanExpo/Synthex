'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';

/** Hero section — 2-column industrial amber theme with parallax radial gradient */
export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = section.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      section.style.setProperty('--mouse-x', `${x}%`);
      section.style.setProperty('--mouse-y', `${y}%`);
    };

    section.addEventListener('mousemove', handleMouseMove);
    return () => section.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex items-center pt-24 pb-16 overflow-hidden"
      style={
        {
          '--mouse-x': '50%',
          '--mouse-y': '50%',
        } as React.CSSProperties
      }
    >
      {/* Dot grid background */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,184,123,0.4) 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }}
      />

      {/* Parallax radial gradient that follows the mouse */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-700"
        style={{
          background: `radial-gradient(ellipse 60% 60% at var(--mouse-x) var(--mouse-y), rgba(255,184,123,0.08) 0%, transparent 70%)`,
        }}
      />

      {/* Ambient glow top-left */}
      <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-[#ffb87b]/[0.06] blur-[180px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left column — content */}
          <div>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm bg-[#ffb87b]/10 border border-[#ffb87b]/20 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ffb87b] animate-pulse flex-shrink-0" />
              <span className="font-mono text-[10px] font-black tracking-[0.3em] uppercase text-[#ffb87b]">
                Amber Zenith System 1.4.0
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black uppercase tracking-tight text-white leading-[1.0] mb-6">
              Social media,
              <br />
              <span className="text-[#ffb87b]">Handled.</span>
            </h1>

            {/* Subtext */}
            <p className="text-base text-white/50 max-w-lg leading-relaxed mb-10 font-mono">
              Industrial-grade social automation. Deploy AI agents that curate,
              post, and engage across every channel — with zero manual
              intervention required.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-[#ffb87b] to-[#ff8f00] text-[#2e1500] font-black rounded-sm hover:shadow-[0_0_35px_rgba(255,184,123,0.5)] hover:-translate-y-1 transition-all duration-200 text-sm uppercase tracking-wide"
              >
                Initialize Trial
              </Link>
              <Link
                href="/platform"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white/[0.04] border border-white/10 text-white/80 hover:text-white hover:bg-white/[0.08] rounded-sm transition-all duration-200 text-sm font-semibold uppercase tracking-wide"
              >
                View Core
              </Link>
            </div>
          </div>

          {/* Right column — dashboard image + floating widgets */}
          <div className="relative">
            {/* Main glass card */}
            <div className="relative bg-[rgba(28,27,27,0.9)] backdrop-blur-xl border border-[rgba(255,220,194,0.08)] rounded-sm overflow-hidden shadow-2xl shadow-black/50">
              <Image
                src="/images/hero-robot.png"
                alt="Synthex — AI Social Media Automation Platform"
                width={2048}
                height={1152}
                priority
                className="w-full h-auto object-cover"
              />

              {/* Inner overlay shimmer */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#050505]/60 via-transparent to-transparent pointer-events-none" />
            </div>

            {/* Floating widget — top right: +84% Throughput */}
            <div className="absolute -top-4 -right-4 bg-[rgba(28,27,27,0.95)] backdrop-blur-xl border border-[rgba(255,220,194,0.12)] rounded-sm px-4 py-3 shadow-xl">
              <div className="font-mono text-[10px] font-black tracking-[0.3em] uppercase text-white/40 mb-1">
                Throughput
              </div>
              <div className="text-xl font-black text-[#ffb87b]">+84%</div>
            </div>

            {/* Floating widget — bottom left: System Optimal */}
            <div className="absolute -bottom-4 -left-4 bg-[rgba(28,27,27,0.95)] backdrop-blur-xl border border-[rgba(255,220,194,0.12)] rounded-sm px-4 py-3 shadow-xl">
              <div className="font-mono text-[10px] font-black tracking-[0.3em] uppercase text-white/40 mb-1">
                System Status
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                <span className="text-sm font-black text-white">Optimal</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
