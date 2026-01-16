'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import {
  ParallaxContainer,
  RevealOnScroll,
  MagneticButton,
  FloatingElement,
  GradientText,
  Card3D,
  MorphingShape,
  Typewriter,
  GlitchText,
  LoadingSpinner,
  ResponsiveContainer,
  AnimatedCounter,
  BlurIn,
  TiltCard,
  animations
} from '@/components/ui/enhanced/AnimationLibrary';

// Dynamic imports for components that use window
const ParticleEffect = dynamic(() => import('@/components/ui/enhanced/AnimationLibrary').then(mod => ({ default: mod.ParticleEffect })), { ssr: false });
const CursorTrail = dynamic(() => import('@/components/ui/enhanced/AnimationLibrary').then(mod => ({ default: mod.CursorTrail })), { ssr: false });
import { motion } from 'framer-motion';
import { Sparkles, Zap, Heart, Star, Globe, Cpu, Layers, Shield } from '@/components/icons';

export default function AnimationShowcase() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/30 to-gray-900 overflow-hidden">
      <CursorTrail />
      <ParticleEffect count={30} />
      
      <ResponsiveContainer className="container mx-auto px-6 py-12">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="text-center mb-16"
        >
          <GlitchText text="Animation Showcase" className="text-6xl font-bold text-white mb-4" />
          <Typewriter 
            text="Explore our collection of advanced UI animations and 3D effects" 
            className="text-xl text-gray-400"
          />
        </motion.header>

        {/* Gradient Text Section */}
        <RevealOnScroll width="100%">
          <div className="mb-16 text-center">
            <h2 className="text-4xl font-bold mb-8">
              <GradientText text="Dynamic Gradient Text" />
            </h2>
            <p className="text-gray-400">Text that animates through multiple gradient colors</p>
          </div>
        </RevealOnScroll>

        {/* 3D Cards Grid */}
        <RevealOnScroll width="100%">
          <h2 className="text-4xl font-bold text-white text-center mb-12">3D Interactive Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <Card3D className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 backdrop-blur-xl rounded-2xl p-8 border border-purple-500/20">
              <Sparkles className="w-12 h-12 text-purple-400 mb-4" />
              <h3 className="text-2xl font-bold text-white mb-2">3D Transform</h3>
              <p className="text-gray-400">Hover to see the 3D perspective effect</p>
            </Card3D>
            
            <TiltCard className="bg-gradient-to-br from-blue-900/50 to-cyan-900/50 backdrop-blur-xl rounded-2xl p-8 border border-blue-500/20">
              <Zap className="w-12 h-12 text-blue-400 mb-4" />
              <h3 className="text-2xl font-bold text-white mb-2">Tilt Effect</h3>
              <p className="text-gray-400">Smooth tilt animation on hover</p>
            </TiltCard>
            
            <Card3D className="bg-gradient-to-br from-green-900/50 to-emerald-900/50 backdrop-blur-xl rounded-2xl p-8 border border-green-500/20">
              <Heart className="w-12 h-12 text-green-400 mb-4" />
              <h3 className="text-2xl font-bold text-white mb-2">Depth Layers</h3>
              <p className="text-gray-400">Multiple depth layers for realism</p>
            </Card3D>
          </div>
        </RevealOnScroll>

        {/* Floating Elements */}
        <ParallaxContainer offset={100}>
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-12">Floating Elements</h2>
            <div className="flex justify-center gap-8">
              <FloatingElement duration={2} delay={0}>
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                  <Star className="w-10 h-10 text-white" />
                </div>
              </FloatingElement>
              <FloatingElement duration={2.5} delay={0.5}>
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                  <Globe className="w-10 h-10 text-white" />
                </div>
              </FloatingElement>
              <FloatingElement duration={3} delay={1}>
                <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                  <Cpu className="w-10 h-10 text-white" />
                </div>
              </FloatingElement>
            </div>
          </div>
        </ParallaxContainer>

        {/* Magnetic Buttons */}
        <RevealOnScroll width="100%">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-12">Magnetic Buttons</h2>
            <div className="flex justify-center gap-6 flex-wrap">
              <MagneticButton className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full font-bold hover:shadow-xl transition-shadow">
                Hover Me
              </MagneticButton>
              <MagneticButton className="px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-full font-bold hover:shadow-xl transition-shadow">
                Magnetic Effect
              </MagneticButton>
              <MagneticButton className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full font-bold hover:shadow-xl transition-shadow">
                Follow Cursor
              </MagneticButton>
            </div>
          </div>
        </RevealOnScroll>

        {/* Animated Counters */}
        <BlurIn duration={1.5}>
          <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 backdrop-blur-xl rounded-3xl p-12 mb-16 border border-purple-500/20">
            <h2 className="text-4xl font-bold text-white text-center mb-12">Animated Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-5xl font-bold text-purple-400">
                  <AnimatedCounter to={1000} suffix="+" duration={2} />
                </div>
                <p className="text-gray-400 mt-2">Happy Users</p>
              </div>
              <div>
                <div className="text-5xl font-bold text-pink-400">
                  <AnimatedCounter to={95} suffix="%" duration={2.5} />
                </div>
                <p className="text-gray-400 mt-2">Satisfaction</p>
              </div>
              <div>
                <div className="text-5xl font-bold text-blue-400">
                  <AnimatedCounter to={50} suffix="K" duration={3} />
                </div>
                <p className="text-gray-400 mt-2">Downloads</p>
              </div>
              <div>
                <div className="text-5xl font-bold text-green-400">
                  <AnimatedCounter to={24} suffix="/7" duration={3.5} />
                </div>
                <p className="text-gray-400 mt-2">Support</p>
              </div>
            </div>
          </div>
        </BlurIn>

        {/* Morphing Shapes */}
        <div className="relative mb-16">
          <h2 className="text-4xl font-bold text-white text-center mb-12 relative z-10">
            Morphing SVG Shapes
          </h2>
          <div className="flex justify-center gap-8">
            <MorphingShape className="w-48 h-48" />
            <MorphingShape colors={["#06b6d4", "#10b981"]} className="w-48 h-48" />
            <MorphingShape colors={["#f59e0b", "#ef4444"]} className="w-48 h-48" />
          </div>
        </div>

        {/* Stagger Animation Example */}
        <RevealOnScroll width="100%">
          <h2 className="text-4xl font-bold text-white text-center mb-12">Stagger Animations</h2>
          <motion.div
            variants={animations.staggerChildren}
            initial="initial"
            animate="animate"
            className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16"
          >
            {[Layers, Shield, Cpu, Globe].map((Icon, index) => (
              <motion.div
                key={index}
                variants={animations.fadeInUp}
                whileHover={{ scale: 1.1, rotate: 5 }}
                className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-8 border border-purple-500/20 text-center"
              >
                <Icon className="w-12 h-12 text-purple-400 mx-auto mb-4" />
                <p className="text-white font-semibold">Feature {index + 1}</p>
              </motion.div>
            ))}
          </motion.div>
        </RevealOnScroll>

        {/* Loading Spinners */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-12">Loading Animations</h2>
          <div className="flex justify-center gap-8">
            <LoadingSpinner size={40} color="#8b5cf6" />
            <LoadingSpinner size={50} color="#ec4899" />
            <LoadingSpinner size={60} color="#06b6d4" />
          </div>
        </div>

        {/* Pulse Animation */}
        <div className="text-center">
          <motion.div
            animate={animations.pulseAnimation.animate}
            className="inline-block px-12 py-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
          >
            <span className="text-2xl font-bold text-white">Pulsing Element</span>
          </motion.div>
        </div>
      </ResponsiveContainer>
    </div>
  );
}