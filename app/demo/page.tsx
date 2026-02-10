'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
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
  Cpu
} from '@/components/icons';
import MarketingLayout from '@/components/marketing/MarketingLayout';

const demos = [
  {
    title: 'Ultra Modern Animations',
    description: 'Cutting-edge animations with Matrix rain, holographic cards, and cyberpunk effects',
    href: '/demo/ultra-animations',
    icon: Rocket,
    gradient: 'from-cyan-500 to-teal-500',
    features: ['Matrix Rain', 'Cyberpunk UI', 'Holographic Cards', 'DNA Loader'],
    new: true
  },
  {
    title: 'Animation Showcase',
    description: 'Comprehensive collection of reusable animation components',
    href: '/demo/animation-showcase',
    icon: Sparkles,
    gradient: 'from-cyan-600 to-cyan-400',
    features: ['3D Cards', 'Magnetic Buttons', 'Parallax', 'Morphing Shapes']
  },
  {
    title: 'Enhanced Landing Page',
    description: 'Next-gen landing page with 3D effects and advanced animations',
    href: '/demo/enhanced-landing',
    icon: Globe,
    gradient: 'from-teal-500 to-cyan-500',
    features: ['3D Spheres', 'Particle Fields', 'Profile Cards', 'Glassmorphism']
  },
  {
    title: 'Enhanced Sandbox',
    description: 'AI-powered content creation with 3D visualization',
    href: '/demo/enhanced-sandbox',
    icon: Layers,
    gradient: 'from-cyan-400 to-teal-400',
    features: ['AI Generator', 'Platform Selector', '3D Preview', 'Analytics']
  }
];

const backgroundElements = [
  { icon: Star, delay: 0, duration: 20 },
  { icon: Code2, delay: 2, duration: 25 },
  { icon: Cpu, delay: 4, duration: 30 },
  { icon: Zap, delay: 6, duration: 22 },
  { icon: Palette, delay: 8, duration: 28 }
];

export default function DemoIndex() {
  return (
    <MarketingLayout currentPage="demo">
      <div className="relative overflow-hidden">
        {/* Animated Background */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          {backgroundElements.map(({ icon: Icon, delay, duration }, i) => (
            <motion.div
              key={i}
              className="absolute"
              initial={{
                x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1920),
                y: -100,
                rotate: 0
              }}
              animate={{
                y: typeof window !== 'undefined' ? window.innerHeight + 100 : 1080,
                rotate: 360,
                x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1920)
              }}
              transition={{
                duration,
                delay,
                repeat: Infinity,
                ease: "linear"
              }}
            >
              <Icon className="w-8 h-8 text-cyan-500/20" />
            </motion.div>
          ))}

          {/* Gradient Orbs */}
          <motion.div
            className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3]
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <motion.div
            className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl"
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.5, 0.3, 0.5]
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10">
          {/* Header */}
          <motion.header
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
            className="text-center py-20"
          >
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="inline-block mb-6"
            >
              <Sparkles className="w-16 h-16 text-cyan-400 mx-auto" />
            </motion.div>

            <h1 className="text-6xl md:text-7xl font-bold mb-6">
              <span className="bg-gradient-to-r from-cyan-400 via-teal-400 to-cyan-300 bg-clip-text text-transparent">
                Animation Gallery
              </span>
            </h1>

            <p className="text-xl text-gray-400 max-w-2xl mx-auto px-6">
              Explore our collection of cutting-edge UI animations, 3D effects, and interactive components
            </p>
          </motion.header>

          {/* Demo Cards Grid */}
          <div className="container mx-auto px-6 pb-20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
              {demos.map((demo, index) => {
                const Icon = demo.icon;
                return (
                  <motion.div
                    key={demo.href}
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.5 }}
                  >
                    <Link href={demo.href}>
                      <motion.div
                        whileHover={{ scale: 1.02, y: -5 }}
                        whileTap={{ scale: 0.98 }}
                        className="relative group h-full"
                      >
                        {/* Card */}
                        <div className="relative bg-[#0f172a]/80 backdrop-blur-xl rounded-2xl border border-cyan-500/20 overflow-hidden h-full hover:border-cyan-500/40 transition-colors">
                          {/* New Badge */}
                          {demo.new && (
                            <motion.div
                              initial={{ x: 100, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              transition={{ delay: 0.5 + index * 0.1 }}
                              className="absolute top-4 right-4 z-10"
                            >
                              <span className="px-3 py-1 bg-gradient-to-r from-cyan-500 to-teal-500 rounded-full text-xs font-bold text-white">
                                NEW
                              </span>
                            </motion.div>
                          )}

                          {/* Gradient Overlay */}
                          <div className={`absolute inset-0 bg-gradient-to-br ${demo.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />

                          {/* Content */}
                          <div className="relative p-8">
                            {/* Icon */}
                            <div className={`w-16 h-16 bg-gradient-to-br ${demo.gradient} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                              <Icon className="w-8 h-8 text-white" />
                            </div>

                            {/* Title & Description */}
                            <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-cyan-400 group-hover:to-teal-400 group-hover:bg-clip-text transition-all duration-300">
                              {demo.title}
                            </h3>
                            <p className="text-gray-400 mb-6">
                              {demo.description}
                            </p>

                            {/* Features */}
                            <div className="flex flex-wrap gap-2 mb-6">
                              {demo.features.map((feature) => (
                                <span
                                  key={feature}
                                  className="px-3 py-1 bg-cyan-500/10 backdrop-blur-sm rounded-full text-xs text-cyan-300 border border-cyan-500/20"
                                >
                                  {feature}
                                </span>
                              ))}
                            </div>

                            {/* CTA */}
                            <div className="flex items-center text-white group-hover:text-cyan-400 transition-colors">
                              <span className="font-semibold">Explore Demo</span>
                              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                            </div>
                          </div>

                          {/* Animated Border */}
                          <motion.div
                            className="absolute inset-0 rounded-2xl pointer-events-none"
                            animate={{
                              boxShadow: [
                                '0 0 0 0px rgba(6, 182, 212, 0)',
                                '0 0 0 2px rgba(6, 182, 212, 0.3)',
                                '0 0 0 0px rgba(6, 182, 212, 0)',
                              ]
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              delay: index * 0.2
                            }}
                          />
                        </div>
                      </motion.div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}
