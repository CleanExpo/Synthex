'use client';

import { useEffect, useState, useRef } from 'react';
import { Star, Quote, BadgeCheck, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface Testimonial {
  id: number;
  name: string;
  role: string;
  company: string;
  quote: string;
  rating: number;
  avatar: {
    gradient: string;
    initials: string;
  };
  metrics?: {
    label: string;
    value: string;
    change: string;
  };
  verified: boolean;
  featured?: boolean;
}

const testimonials: Testimonial[] = [
  {
    id: 1,
    name: 'Sarah Chen',
    role: 'CEO',
    company: 'TechStart Inc.',
    quote: 'Replaced our $8k/month agency. Better results, fraction of the cost. The AI understands our brand voice perfectly.',
    rating: 5,
    avatar: {
      gradient: 'from-purple-500 via-fuchsia-500 to-pink-500',
      initials: 'SC',
    },
    metrics: {
      label: 'Engagement',
      value: '+312%',
      change: 'in 30 days',
    },
    verified: true,
    featured: false,
  },
  {
    id: 2,
    name: 'Marcus Johnson',
    role: 'Influencer',
    company: '500K+ Followers',
    quote: '3x our engagement in 30 days. The viral pattern analysis is game-changing. It\'s like having a team of experts 24/7.',
    rating: 5,
    avatar: {
      gradient: 'from-cyan-500 via-blue-500 to-purple-500',
      initials: 'MJ',
    },
    metrics: {
      label: 'Followers',
      value: '+127K',
      change: 'in 6 months',
    },
    verified: true,
    featured: true,
  },
  {
    id: 3,
    name: 'Emma Rodriguez',
    role: 'CMO',
    company: 'Fashion Brand',
    quote: 'From 100 to 50K followers in 6 months. The AI-generated content consistently outperforms what we created manually.',
    rating: 5,
    avatar: {
      gradient: 'from-amber-500 via-orange-500 to-red-500',
      initials: 'ER',
    },
    metrics: {
      label: 'ROI',
      value: '847%',
      change: 'vs. agency',
    },
    verified: true,
    featured: false,
  },
];

function TestimonialCard({ testimonial, index }: { testimonial: Testimonial; index: number }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`group relative transition-all duration-500 ${
        testimonial.featured ? 'lg:-mt-4 lg:mb-4 z-10' : ''
      }`}
      style={{ animationDelay: `${index * 150}ms` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Glow effect for featured */}
      {testimonial.featured && (
        <div className="absolute -inset-4 bg-gradient-to-r from-purple-500/20 via-fuchsia-500/20 to-purple-500/20 rounded-3xl blur-2xl opacity-60" />
      )}

      <Card
        className={`relative overflow-hidden backdrop-blur-sm transition-all duration-500 ${
          testimonial.featured
            ? 'bg-gradient-to-br from-white/[0.12] to-white/[0.06] border-purple-500/30 hover:border-purple-400/50'
            : 'bg-white/[0.06] border-white/[0.1] hover:border-white/[0.2] hover:bg-white/[0.08]'
        } p-6 lg:p-8`}
      >
        {/* Quote icon */}
        <Quote className={`absolute top-4 right-4 w-8 h-8 transition-opacity duration-300 ${isHovered ? 'opacity-20' : 'opacity-10'} text-white`} />

        {/* Star rating */}
        <div className="flex gap-1 mb-4">
          {[...Array(testimonial.rating)].map((_, i) => (
            <Star
              key={i}
              className="w-5 h-5 fill-yellow-400 text-yellow-400"
              style={{ animationDelay: `${i * 100}ms` }}
            />
          ))}
        </div>

        {/* Quote */}
        <p className="text-white/90 leading-relaxed mb-6 text-sm lg:text-base">
          "{testimonial.quote}"
        </p>

        {/* Metrics badge */}
        {testimonial.metrics && (
          <div className="mb-6 p-3 rounded-xl bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20">
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-400/80">{testimonial.metrics.label}</span>
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-400" />
                <span className="text-xs text-emerald-400/60">{testimonial.metrics.change}</span>
              </div>
            </div>
            <p className="text-2xl font-bold text-emerald-400 mt-1">
              {testimonial.metrics.value}
            </p>
          </div>
        )}

        <Separator className="bg-white/10 mb-4" />

        {/* Author */}
        <div className="flex items-center gap-4">
          {/* Avatar with gradient ring */}
          <div className="relative">
            {/* Animated ring */}
            <div
              className={`absolute -inset-1 rounded-full bg-gradient-to-r ${testimonial.avatar.gradient} opacity-0 group-hover:opacity-100 blur transition-opacity duration-500`}
            />
            <div
              className={`relative w-12 h-12 rounded-full bg-gradient-to-br ${testimonial.avatar.gradient} flex items-center justify-center text-white font-bold text-sm shadow-lg`}
            >
              {testimonial.avatar.initials}
            </div>
            {/* Verified badge */}
            {testimonial.verified && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center border-2 border-slate-900">
                <BadgeCheck className="w-3 h-3 text-white" />
              </div>
            )}
          </div>

          <div>
            <p className="font-semibold text-white flex items-center gap-2">
              {testimonial.name}
            </p>
            <p className="text-sm text-white/50">
              {testimonial.role}, {testimonial.company}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function Testimonials() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-20 lg:py-32 px-6 relative">
      <div className="container mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            Replacing <span className="text-red-400 line-through opacity-60">$120,000/Year</span> Agencies
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            See why businesses are switching from traditional agencies to SYNTHEX
          </p>
        </div>

        {/* Testimonials grid */}
        <div
          className={`grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto transition-all duration-1000 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          {testimonials.map((testimonial, index) => (
            <TestimonialCard
              key={testimonial.id}
              testimonial={testimonial}
              index={index}
            />
          ))}
        </div>

        {/* Trust indicators */}
        <div className="mt-16 flex flex-wrap justify-center gap-8 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>1,000+ Active Users</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-400" />
            <span>4.9/5 Average Rating</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>99.9% Uptime</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Testimonials;
