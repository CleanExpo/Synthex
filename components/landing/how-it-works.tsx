'use client';

import { useEffect, useRef, useState } from 'react';

const STEPS = [
  {
    number: '01',
    title: 'Connect Your Accounts',
    description:
      'Link all your social media platforms in under 2 minutes via secure OAuth. No passwords stored — enterprise-grade encryption throughout.',
    details: ['One-click OAuth for all 9 platforms', 'AES-256-GCM token encryption', 'Instant account health checks'],
    accentColor: '#00F5FF',
  },
  {
    number: '02',
    title: 'AI Learns Your Brand',
    description:
      'Synthex analyses your existing content, top performers, competitors, and audience behaviour to build a deep brand profile unique to your business.',
    details: ['Brand voice fingerprinting', 'Audience demographics mapping', 'Competitor gap analysis'],
    accentColor: '#00F5FF',
  },
  {
    number: '03',
    title: 'Content Is Generated & Tested',
    description:
      'Your autonomous AI writes platform-optimised posts, headlines, and captions — then runs A/B tests to learn what converts best for your audience.',
    details: ['10+ content variants per campaign', 'Platform-native format optimisation', 'Automatic A/B testing & learning'],
    accentColor: '#FFB800',
  },
  {
    number: '04',
    title: 'Publish, Analyse, Optimise',
    description:
      'Posts go live at AI-determined optimal times. Real-time analytics feed back into the engine — your results compound week over week.',
    details: ['Predictive optimal posting windows', 'Live engagement & ROI tracking', 'Continuous strategy refinement'],
    accentColor: '#00FF88',
  },
];

export function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
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
      setActiveStep((prev) => (prev + 1) % STEPS.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isVisible]);

  const active = STEPS[activeStep]!;

  return (
    <section ref={sectionRef} className="relative py-32 z-10 border-y border-[0.5px] border-white/[0.06]">
      <div className="container mx-auto px-6">

        {/* Header */}
        <div className="mb-16 max-w-xl">
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/30 mb-4 block">
            Simple Process
          </span>
          <h2 className="text-4xl sm:text-5xl font-extralight tracking-tight text-white mb-4">
            From zero to autonomous<br />
            <span className="text-cyan-400">in under 10 minutes.</span>
          </h2>
          <p className="text-white/50 text-sm leading-relaxed">
            No learning curve. No agency onboarding call. No waiting weeks for results. Synthex is configured and operational the same day.
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
                      className="relative z-10 w-9 h-9 flex-shrink-0 flex items-center justify-center border-[0.5px] transition-all duration-300 rounded-sm"
                      style={{
                        borderColor: isActive ? `${step.accentColor}60` : 'rgba(255,255,255,0.06)',
                        backgroundColor: isActive ? `${step.accentColor}10` : 'rgba(255,255,255,0.02)',
                      }}
                    >
                      <span
                        className="font-mono text-[10px] font-medium"
                        style={{ color: isActive ? step.accentColor : 'rgba(255,255,255,0.3)' }}
                      >
                        {step.number}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="pt-1.5">
                      <p
                        className="text-sm font-medium tracking-wide transition-colors duration-300"
                        style={{ color: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)' }}
                      >
                        {step.title}
                      </p>
                      {isActive && (
                        <p className="mt-1.5 text-xs text-white/40 leading-relaxed">
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
              className="p-8 lg:p-10 border-[0.5px] border-white/[0.06] bg-white/[0.02] rounded-sm relative overflow-hidden"
            >
              {/* Ambient glow */}
              <div
                className="absolute top-0 right-0 w-64 h-64 blur-3xl opacity-10 -z-0 rounded-full pointer-events-none"
                style={{ background: `radial-gradient(circle, ${active.accentColor}, transparent 70%)` }}
              />

              <div className="relative z-10">
                {/* Step number */}
                <div className="flex items-center gap-3 mb-6">
                  <span
                    className="font-mono text-4xl font-extralight"
                    style={{ color: active.accentColor, opacity: 0.3 }}
                  >
                    {active.number}
                  </span>
                  <div className="h-px flex-1 bg-white/[0.06]" />
                </div>

                {/* Title */}
                <h3 className="text-2xl lg:text-3xl font-light text-white tracking-tight mb-4">
                  {active.title}
                </h3>

                {/* Description */}
                <p className="text-white/50 text-sm leading-relaxed mb-8">
                  {active.description}
                </p>

                {/* Details list */}
                <div className="space-y-3">
                  {active.details.map((detail, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div
                        className="w-1 h-1 rounded-full flex-shrink-0"
                        style={{ backgroundColor: active.accentColor }}
                      />
                      <span className="text-sm text-white/60">{detail}</span>
                    </div>
                  ))}
                </div>

                {/* Progress dots */}
                <div className="flex gap-2 mt-10 pt-6 border-t border-[0.5px] border-white/[0.06]">
                  {STEPS.map((_, i) => (
                    <div
                      key={i}
                      className="h-[2px] flex-1 transition-all duration-300 rounded-full"
                      style={{
                        backgroundColor: i === activeStep ? active.accentColor : 'rgba(255,255,255,0.08)',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="mt-6 text-center">
              <a
                href="/auth/signup"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-cyan-500 hover:bg-cyan-400 text-[#0a1628] font-semibold text-sm tracking-wide rounded-sm transition-colors duration-200"
              >
                Get Started Free
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
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
