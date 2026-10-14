'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, Zap, Palette, Star, Code2, Cpu } from '@/components/icons';
import MarketingLayout from '@/components/marketing/MarketingLayout';
import { CaptionDemo } from '@/components/demo/CaptionDemo';

const backgroundElements = [
  { icon: Star, delay: 0, duration: 20 },
  { icon: Code2, delay: 2, duration: 25 },
  { icon: Cpu, delay: 4, duration: 30 },
  { icon: Zap, delay: 6, duration: 22 },
  { icon: Palette, delay: 8, duration: 28 },
];

export default function DemoClient() {
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

            <h1 className="text-5xl md:text-6xl font-bold mb-6 px-6">
              <span className="bg-gradient-to-r from-orange-400 via-orange-400 to-orange-300 bg-clip-text text-transparent">
                Try the caption generator
              </span>
            </h1>

            <p className="text-xl text-gray-400 max-w-2xl mx-auto px-6">
              Enter your business name and get a social media caption in seconds
              — no signup required.
            </p>
          </header>

          <div className="container mx-auto px-6 pb-20">
            <CaptionDemo />
          </div>

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
        </div>
      </div>
    </MarketingLayout>
  );
}
