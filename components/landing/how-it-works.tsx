'use client';

import { useEffect, useRef, useState } from 'react';

const STEPS = [
  {
    number: '01',
    title: 'Tell us about your business',
    description:
      'Tell us about your business and how you talk. Synthex learns your voice — so every post sounds like you, not like generic AI. Takes about 5 minutes. No tech knowledge needed.',
    details: [
      'Works for cafés, tradies, salons, gyms and more',
      'Connect your social accounts in seconds',
      'Your voice, your tone — AI learns it fast',
    ],
    accentColor: '#06b6d4',
  },
  {
    number: '02',
    title: 'We write your posts',
    description:
      'Synthex creates social media posts that sound like you — not a robot. Every post is written for your specific business and audience. Review them before they go out, or let them publish automatically.',
    details: [
      'Posts written in your tone and style',
      'Works across Instagram, Facebook, TikTok and more',
      'You approve or let it run on autopilot',
    ],
    accentColor: '#06b6d4',
  },
  {
    number: '03',
    title: 'Your social media stays active',
    description:
      'Synthex keeps your pages consistently active — posting at the right times, engaging your audience, and helping new customers find you. You focus on running your business.',
    details: [
      'Posts published at the best time for your audience',
      'Consistent presence without lifting a finger',
      'Watch your following and enquiries grow',
    ],
    accentColor: '#06b6d4',
  },
];

export function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.15 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const interval = setInterval(() => {
      setActiveStep(prev => (prev + 1) % STEPS.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isVisible]);

  const active = STEPS[activeStep]!;

  return (
    <section
      ref={sectionRef}
      className="relative py-20 md:py-28 z-10 border-y border-white/[0.06]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16 max-w-xl">
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/30 mb-4 block">
            How It Works
          </span>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">
            Up and running
            <br />
            <span className="text-cyan-400">in 10 minutes.</span>
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            No tech skills. No long setup. No waiting. Most business owners have
            their first week of posts ready before they finish their morning
            coffee — and they actually sound like themselves.
          </p>
        </div>

        {/* Timeline layout */}
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-20">
          {/* Left — step list (timeline) */}
          <div className="flex-[2] relative">
            {/* Vertical spine */}
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-gradient-to-b from-white/[0.06] via-white/[0.03] to-transparent" />

            <div className="space-y-0">
              {STEPS.map((step, index) => {
                const isActive = index === activeStep;
                return (
                  <button
                    key={step.number}
                    onClick={() => setActiveStep(index)}
                    className="relative w-full text-left flex items-start gap-5 py-6 group transition-all duration-300"
                    aria-label={`Step ${step.number}: ${step.title}`}
                  >
                    {/* Node */}
                    <div
                      className="relative z-10 w-9 h-9 flex-shrink-0 flex items-center justify-center border transition-all duration-300 rounded-xl"
                      style={{
                        borderColor: isActive
                          ? 'rgba(6,182,212,0.4)'
                          : 'rgba(255,255,255,0.06)',
                        backgroundColor: isActive
                          ? 'rgba(6,182,212,0.1)'
                          : 'rgba(255,255,255,0.02)',
                      }}
                    >
                      <span
                        className="font-mono text-[10px] font-medium"
                        style={{
                          color: isActive ? '#06b6d4' : 'rgba(255,255,255,0.3)',
                        }}
                      >
                        {step.number}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="pt-1.5">
                      <p
                        className="text-sm font-medium tracking-wide transition-colors duration-300"
                        style={{
                          color: isActive
                            ? 'rgba(255,255,255,0.9)'
                            : 'rgba(255,255,255,0.35)',
                        }}
                      >
                        {step.title}
                      </p>
                      {isActive && (
                        <p className="mt-1.5 text-xs text-gray-400 leading-relaxed">
                          {step.description}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right — active step detail */}
          <div className="flex-[3]">
            <div
              key={activeStep}
              className="p-8 lg:p-10 border border-white/[0.06] bg-white/[0.02] rounded-2xl relative overflow-hidden"
            >
              {/* Ambient glow */}
              <div
                className="absolute top-0 right-0 w-64 h-64 blur-3xl opacity-10 -z-0 rounded-full pointer-events-none"
                style={{
                  background:
                    'radial-gradient(circle, #06b6d4, transparent 70%)',
                }}
              />

              <div className="relative z-10">
                {/* Step number */}
                <div className="flex items-center gap-3 mb-6">
                  <span
                    className="font-mono text-4xl font-extralight text-cyan-400"
                    style={{ opacity: 0.3 }}
                  >
                    {active.number}
                  </span>
                  <div className="h-px flex-1 bg-white/[0.06]" />
                </div>

                {/* Title */}
                <h3 className="text-2xl lg:text-3xl font-bold text-white tracking-tight mb-4">
                  {active.title}
                </h3>

                {/* Description */}
                <p className="text-gray-400 text-sm leading-relaxed mb-8">
                  {active.description}
                </p>

                {/* Details list */}
                <div className="space-y-3">
                  {active.details.map((detail, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-1 h-1 rounded-full flex-shrink-0 bg-cyan-400" />
                      <span className="text-sm text-white/60">{detail}</span>
                    </div>
                  ))}
                </div>

                {/* Progress dots */}
                <div className="flex gap-2 mt-10 pt-6 border-t border-white/[0.06]">
                  {STEPS.map((_, i) => (
                    <div
                      key={i}
                      className="h-[2px] flex-1 transition-all duration-300 rounded-full"
                      style={{
                        backgroundColor:
                          i === activeStep
                            ? '#06b6d4'
                            : 'rgba(255,255,255,0.08)',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="mt-6 text-center">
              <a
                href="/signup"
                className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-white font-semibold text-sm rounded-full transition-colors duration-200"
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
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HowItWorks;
