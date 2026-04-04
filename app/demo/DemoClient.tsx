'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Layers,
  Zap,
  Globe,
  Palette,
  Rocket,
  ArrowRight,
  Star,
  Code2,
  Cpu,
  Play,
} from '@/components/icons';
import MarketingLayout from '@/components/marketing/MarketingLayout';

const demos = [
  {
    title: 'Ultra Modern Animations',
    description:
      'Cutting-edge animations with Matrix rain, holographic cards, and cyberpunk effects',
    href: '/demo/ultra-animations',
    icon: Rocket,
    gradient: 'from-orange-500 to-orange-500',
    features: [
      'Matrix Rain',
      'Cyberpunk UI',
      'Holographic Cards',
      'DNA Loader',
    ],
    new: true,
  },
  {
    title: 'Animation Showcase',
    description: 'Comprehensive collection of reusable animation components',
    href: '/demo/animation-showcase',
    icon: Sparkles,
    gradient: 'from-orange-600 to-orange-400',
    features: ['3D Cards', 'Magnetic Buttons', 'Parallax', 'Morphing Shapes'],
  },
  {
    title: 'Enhanced Landing Page',
    description:
      'Next-gen landing page with 3D effects and advanced animations',
    href: '/demo/enhanced-landing',
    icon: Globe,
    gradient: 'from-orange-500 to-orange-500',
    features: [
      '3D Spheres',
      'Particle Fields',
      'Profile Cards',
      'Glassmorphism',
    ],
  },
  {
    title: 'Enhanced Sandbox',
    description: 'AI-powered content creation with 3D visualization',
    href: '/demo/enhanced-sandbox',
    icon: Layers,
    gradient: 'from-orange-400 to-orange-400',
    features: ['AI Generator', 'Platform Selector', '3D Preview', 'Analytics'],
  },
];

const backgroundElements = [
  { icon: Star, delay: 0, duration: 20 },
  { icon: Code2, delay: 2, duration: 25 },
  { icon: Cpu, delay: 4, duration: 30 },
  { icon: Zap, delay: 6, duration: 22 },
  { icon: Palette, delay: 8, duration: 28 },
];

export default function DemoIndex() {
  // Defer window-dependent values to avoid hydration mismatch.
  // Server renders with deterministic defaults; client replaces after mount.
  const [dims, setDims] = useState({ w: 1920, h: 1080 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDims({ w: window.innerWidth, h: window.innerHeight });
    setMounted(true);
  }, []);

  // Deterministic pseudo-random positions per element index (avoids Math.random
  // producing different results on server vs client).
  const seedPos = (index: number, range: number) =>
    (((index * 397 + 251) % 1000) / 1000) * range;

  return (
    <MarketingLayout currentPage="demo">
      <div className="relative overflow-hidden">
        {/* Animated Background */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          {backgroundElements.map(({ icon: Icon, delay, duration }, i) => (
            <div
              key={i}
              className="absolute"
              style={{
                left: seedPos(i, dims.w),
                top: -100,
              }}
            >
              <Icon
                className={`w-8 h-8 text-orange-500/20 ${!mounted ? 'opacity-0' : ''}`}
              />
            </div>
          ))}

          {/* Gradient Orbs */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl" />
        </div>

        {/* Content */}
        <div className="relative z-10">
          {/* Header */}
          <header className="text-center py-20">
            <div className="inline-block mb-6">
              <Sparkles className="w-16 h-16 text-orange-400 mx-auto" />
            </div>

            <h1 className="text-6xl md:text-7xl font-bold mb-6">
              <span className="bg-gradient-to-r from-orange-400 via-orange-400 to-orange-300 bg-clip-text text-transparent">
                Animation Gallery
              </span>
            </h1>

            <p className="text-xl text-gray-400 max-w-2xl mx-auto px-6">
              Explore our collection of cutting-edge UI animations, 3D effects,
              and interactive components
            </p>
          </header>

          {/* Product Demo Video */}
          <div className="container mx-auto px-6 pb-16">
            <div className="max-w-4xl mx-auto">
              <div className="relative rounded-2xl overflow-hidden border border-orange-500/20 bg-surface-base/80 shadow-2xl shadow-orange-500/10">
                <div className="aspect-video">
                  <iframe
                    src="https://www.youtube.com/embed/vnn6SJUlsWU"
                    title="Synthex Product Demo"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="w-full h-full"
                  />
                </div>
                <div className="p-6">
                  <h2 className="text-2xl font-bold text-white mb-2">
                    Synthex Product Demo
                  </h2>
                  <p className="text-gray-400">
                    Full walkthrough of the Synthex AI marketing platform — see
                    the dashboard, content generator, scheduler, and analytics
                    in action.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Demo Cards Grid */}
          <div className="container mx-auto px-6 pb-20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
              {demos.map((demo, index) => {
                const Icon = demo.icon;
                return (
                  <div key={demo.href}>
                    <Link href={demo.href}>
                      <div className="relative group h-full hover:scale-105 transition-transform duration-200">
                        {/* Card */}
                        <div className="relative bg-surface-base/80 backdrop-blur-xl rounded-2xl border border-orange-500/20 overflow-hidden h-full hover:border-orange-500/40 transition-colors">
                          {/* New Badge */}
                          {demo.new && (
                            <div className="absolute top-4 right-4 z-10">
                              <span className="px-3 py-1 bg-gradient-to-r from-orange-500 to-orange-500 rounded-full text-xs font-bold text-white">
                                NEW
                              </span>
                            </div>
                          )}

                          {/* Gradient Overlay */}
                          <div
                            className={`absolute inset-0 bg-gradient-to-br ${demo.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}
                          />

                          {/* Content */}
                          <div className="relative p-8">
                            {/* Icon */}
                            <div
                              className={`w-16 h-16 bg-gradient-to-br ${demo.gradient} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}
                            >
                              <Icon className="w-8 h-8 text-white" />
                            </div>

                            {/* Title & Description */}
                            <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-orange-400 group-hover:to-orange-400 group-hover:bg-clip-text transition-all duration-300">
                              {demo.title}
                            </h3>
                            <p className="text-gray-400 mb-6">
                              {demo.description}
                            </p>

                            {/* Features */}
                            <div className="flex flex-wrap gap-2 mb-6">
                              {demo.features.map(feature => (
                                <span
                                  key={feature}
                                  className="px-3 py-1 bg-orange-500/10 backdrop-blur-sm rounded-full text-xs text-orange-300 border border-orange-500/20"
                                >
                                  {feature}
                                </span>
                              ))}
                            </div>

                            {/* CTA */}
                            <div className="flex items-center text-white group-hover:text-orange-400 transition-colors">
                              <span className="font-semibold">
                                Explore Demo
                              </span>
                              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}
