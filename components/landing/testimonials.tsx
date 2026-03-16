'use client';

import { useEffect, useState, useRef } from 'react';

interface Testimonial {
  name: string;
  role: string;
  company: string;
  quote: string;
  metric: { value: string; label: string };
  initials: string;
  accentColor: string;
  featured?: boolean;
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Sarah Chen',
    role: 'CEO',
    company: 'TechStart Inc.',
    quote: 'We replaced our $8K/month agency on day one. Better output, completely on-brand, and the AI actually understands what our audience responds to. We\'ve never looked back.',
    metric: { value: '+312%', label: 'Engagement in 30 days' },
    initials: 'SC',
    accentColor: '#00F5FF',
    featured: true,
  },
  {
    name: 'Marcus Johnson',
    role: 'Content Creator',
    company: '500K+ Followers',
    quote: 'The viral pattern analysis is unlike anything I\'ve used. It tells me exactly what hook structure and format is working right now — my reach tripled in 6 weeks.',
    metric: { value: '+127K', label: 'Followers in 6 months' },
    initials: 'MJ',
    accentColor: '#00F5FF',
  },
  {
    name: 'Emma Rodriguez',
    role: 'CMO',
    company: 'Lumière Fashion',
    quote: 'From 100 to 50K followers in under 6 months across Instagram and TikTok. The BYOK model means I control my AI costs — we\'re running it for a fraction of agency rates.',
    metric: { value: '847%', label: 'ROI vs. prior agency' },
    initials: 'ER',
    accentColor: '#FFB800',
  },
  {
    name: 'David Park',
    role: 'Founder',
    company: 'Northfield SaaS',
    quote: 'Synthex handles our full LinkedIn and X strategy. Our inbound from social went from zero to meaningful pipeline in under 3 months. The autonomous scheduling alone saved 15 hours a week.',
    metric: { value: '15hrs', label: 'Saved per week' },
    initials: 'DP',
    accentColor: '#00FF88',
  },
];

function TestimonialCard({ t, index }: { t: Testimonial; index: number }) {
  return (
    <div
      className={`relative group flex flex-col gap-5 p-6 lg:p-8 border-[0.5px] transition-colors duration-300 ${
        t.featured
          ? 'border-white/[0.12] bg-white/[0.04]'
          : 'border-white/[0.06] bg-white/[0.01] hover:border-white/[0.1]'
      }`}
      style={{ animationDelay: `${index * 120}ms` }}
    >
      {/* Rating */}
      <div className="flex gap-0.5">
        {[...Array(5)].map((_, i) => (
          <svg key={i} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        ))}
      </div>

      {/* Quote */}
      <p className="text-sm text-white/70 leading-relaxed flex-1">
        &ldquo;{t.quote}&rdquo;
      </p>

      {/* Metric */}
      <div
        className="flex items-baseline gap-1.5 py-3 border-t border-[0.5px] border-white/[0.06]"
      >
        <span className="font-mono text-lg font-medium" style={{ color: t.accentColor }}>
          {t.metric.value}
        </span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/30">
          {t.metric.label}
        </span>
      </div>

      {/* Author */}
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-sm flex items-center justify-center text-xs font-semibold text-[#0a1628] flex-shrink-0"
          style={{ backgroundColor: t.accentColor }}
        >
          {t.initials}
        </div>
        <div>
          <p className="text-sm font-medium text-white">{t.name}</p>
          <p className="text-xs text-white/40">{t.role}, {t.company}</p>
        </div>
      </div>

      {/* Featured highlight bar */}
      {t.featured && (
        <div
          className="absolute top-0 left-0 right-0 h-[0.5px]"
          style={{ backgroundColor: t.accentColor, opacity: 0.5 }}
        />
      )}
    </div>
  );
}

export function Testimonials() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="relative py-32 z-10">
      <div className="container mx-auto px-6">

        {/* Header */}
        <div className="mb-16 flex flex-col lg:flex-row lg:items-end gap-6">
          <div>
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/30 mb-4 block">
              Customer Results
            </span>
            <h2 className="text-4xl sm:text-5xl font-extralight tracking-tight text-white">
              Replacing{' '}
              <span className="line-through text-white/30">$120,000 / year</span>
              <br />
              <span className="text-cyan-400">marketing agencies.</span>
            </h2>
          </div>
          <p className="text-white/40 text-sm max-w-xs leading-relaxed lg:ml-auto lg:text-right">
            Real results from real customers. No cherry-picked case studies — these are live account numbers.
          </p>
        </div>

        {/* Testimonials grid — 2x2 with featured top-left */}
        <div
          className={`grid md:grid-cols-2 gap-[0.5px] transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          {TESTIMONIALS.map((t, index) => (
            <TestimonialCard key={t.name} t={t} index={index} />
          ))}
        </div>

        {/* Trust strip */}
        <div className="mt-12 flex flex-wrap justify-center gap-8 border-t border-[0.5px] border-white/[0.06] pt-10">
          {[
            { dot: '#00FF88', text: '1,000+ Active Businesses' },
            { dot: '#00F5FF', text: '4.9 / 5 Average Rating' },
            { dot: '#FFB800', text: '99.9% Uptime Guarantee' },
            { dot: '#00F5FF', text: 'Cancel Anytime' },
          ].map(({ dot, text }) => (
            <div key={text} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dot }} />
              <span className="text-xs text-white/40">{text}</span>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}

export default Testimonials;
