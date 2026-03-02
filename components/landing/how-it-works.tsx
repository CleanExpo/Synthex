'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Link2,
  Brain,
  Sparkles,
  Rocket,
  ChevronRight,
  Zap
} from '@/components/icons';

const steps = [
  {
    number: '01',
    title: 'Connect Your Accounts',
    description: 'Link all your social media platforms in under 2 minutes. Secure OAuth integration with enterprise-grade encryption.',
    icon: Link2,
    color: 'from-cyan-500 to-blue-500',
    glowColor: 'rgba(6, 182, 212, 0.3)',
    features: ['One-click OAuth', 'Bank-level security', '6 platforms supported'],
  },
  {
    number: '02',
    title: 'AI Analyzes Your Brand',
    description: 'Our AI studies your voice, audience, and top performers to create your personalized growth strategy.',
    icon: Brain,
    color: 'from-cyan-500 to-cyan-500',
    glowColor: 'rgba(6, 182, 212, 0.3)',
    features: ['Brand voice learning', 'Audience insights', 'Competitor analysis'],
  },
  {
    number: '03',
    title: 'Generate Viral Content',
    description: 'Create scroll-stopping posts optimized for each platform. A/B test variations to maximize engagement.',
    icon: Sparkles,
    color: 'from-pink-500 to-rose-500',
    glowColor: 'rgba(236, 72, 153, 0.3)',
    features: ['10+ variations per post', 'Platform optimization', 'Trending formats'],
  },
  {
    number: '04',
    title: 'Watch Your Growth Explode',
    description: 'Schedule posts at optimal times. Track real-time analytics. Celebrate your 2.2x engagement boost.',
    icon: Rocket,
    color: 'from-amber-500 to-orange-500',
    glowColor: 'rgba(245, 158, 11, 0.3)',
    features: ['Smart scheduling', 'Live analytics', 'ROI tracking'],
  },
];

function StepCard({ step, index, isActive }: { step: typeof steps[0]; index: number; isActive: boolean }) {
  const Icon = step.icon;

  return (
    <div
      data-step-card
      className={`relative group transition-all duration-500 ${
        isActive ? 'scale-100 opacity-100' : 'scale-95 opacity-60'
      }`}
    >
      {/* Connection line to next step */}
      {index < steps.length - 1 && (
        <div className="hidden lg:block absolute top-1/2 -right-8 w-16 h-[2px]">
          <div className={`h-full bg-gradient-to-r ${step.color} opacity-30`} />
          <ChevronRight className="absolute -right-2 -top-2 w-5 h-5 text-white/30" />
        </div>
      )}

      {/* Card */}
      <div
        className={`relative p-6 lg:p-8 rounded-2xl border transition-all duration-500 ${
          isActive
            ? 'bg-white/[0.08] border-white/[0.15]'
            : 'bg-white/[0.03] border-white/[0.06]'
        }`}
      >
        {/* Glow effect */}
        <div
          className={`absolute inset-0 rounded-2xl blur-2xl transition-opacity duration-500 ${
            isActive ? 'opacity-40' : 'opacity-0'
          }`}
          style={{ background: `radial-gradient(ellipse at center, ${step.glowColor}, transparent 70%)` }}
        />

        <div className="relative">
          {/* Step number */}
          <span className={`text-xs font-bold bg-gradient-to-r ${step.color} bg-clip-text text-transparent`}>
            STEP {step.number}
          </span>

          {/* Icon */}
          <div
            className={`mt-4 w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br ${step.color} shadow-lg transition-transform duration-300 group-hover:scale-110`}
          >
            <Icon className="w-7 h-7 text-white" />
          </div>

          {/* Title */}
          <h3 className="mt-5 text-xl lg:text-2xl font-bold text-white">
            {step.title}
          </h3>

          {/* Description */}
          <p className="mt-3 text-sm lg:text-base text-slate-400 leading-relaxed">
            {step.description}
          </p>

          {/* Features */}
          <ul className="mt-5 space-y-2">
            {step.features.map((feature, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                <Zap className={`w-4 h-4 bg-gradient-to-r ${step.color} bg-clip-text`} style={{ color: step.glowColor.replace('0.3', '1') }} />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Auto-advance steps
  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [isVisible]);

  // Intersection observer for visibility
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-20 lg:py-32 px-6 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-900/5 to-transparent" />

      <div className="container mx-auto relative">
        {/* Header */}
        <div data-how-header className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.05] border border-white/[0.08] text-sm font-medium text-cyan-300 mb-6">
            <Zap className="w-4 h-4" />
            Simple 4-Step Process
          </span>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4">
            How <span className="gradient-text-premium">SYNTHEX</span> Works
          </h2>
          <p className="text-lg lg:text-xl text-slate-400 max-w-2xl mx-auto">
            From signup to viral content in minutes. No learning curve, no complexity.
          </p>
        </div>

        {/* Step indicator dots */}
        <div className="flex justify-center gap-3 mb-12">
          {steps.map((step, index) => (
            <button
              key={index}
              onClick={() => setActiveStep(index)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index === activeStep
                  ? `bg-gradient-to-r ${step.color} scale-125`
                  : 'bg-white/20 hover:bg-white/40'
              }`}
              aria-label={`Go to step ${index + 1}`}
            />
          ))}
        </div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {steps.map((step, index) => (
            <StepCard
              key={step.number}
              step={step}
              index={index}
              isActive={index === activeStep}
            />
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <p className="text-slate-400 mb-6">Ready to start your growth journey?</p>
          <a
            href="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-600 text-white font-semibold hover:from-cyan-500 hover:to-cyan-500 transition-all duration-300 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-105"
          >
            Get Started Free
            <ChevronRight className="w-5 h-5" />
          </a>
        </div>
      </div>
    </section>
  );
}

export default HowItWorks;
