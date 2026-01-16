'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { 
  LiquidText,
  NeonCard,
  DNALoader,
  HolographicCard,
  KineticText,
  OrganicBlob,
  InfiniteMarquee,
  FractalTree,
  CyberpunkButton,
  WaveText,
  RippleButton,
  FlipCard3D,
  SpotlightCard
} from '@/components/ui/enhanced/UltraModernAnimations';

// Dynamic imports for components that use window
const MatrixRain = dynamic(() => import('@/components/ui/enhanced/UltraModernAnimations').then(mod => ({ default: mod.MatrixRain })), { ssr: false });
const GlowingOrbs = dynamic(() => import('@/components/ui/enhanced/UltraModernAnimations').then(mod => ({ default: mod.GlowingOrbs })), { ssr: false });
const AuroraBackground = dynamic(() => import('@/components/ui/enhanced/UltraModernAnimations').then(mod => ({ default: mod.AuroraBackground })), { ssr: false });
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Zap, 
  Globe, 
  Cpu, 
  Code2, 
  Palette, 
  Layers, 
  Shield,
  Rocket,
  Star,
  Heart,
  Diamond
} from '@/components/icons';

export default function UltraAnimationsShowcase() {
  const [activeSection, setActiveSection] = React.useState('hero');
  
  const sections = [
    { id: 'hero', label: 'Hero', icon: Rocket },
    { id: 'text', label: 'Typography', icon: Code2 },
    { id: 'cards', label: 'Cards', icon: Layers },
    { id: 'buttons', label: 'Buttons', icon: Zap },
    { id: 'backgrounds', label: 'Backgrounds', icon: Palette },
    { id: 'loaders', label: 'Loaders', icon: Cpu },
    { id: '3d', label: '3D Effects', icon: Globe },
  ];

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 z-0">
        <AuroraBackground />
        <GlowingOrbs />
      </div>
      
      {/* Matrix Rain Toggle */}
      <div className="fixed top-4 right-4 z-50">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="px-4 py-2 bg-green-500/20 border border-green-500 rounded-lg text-green-400"
          onClick={() => {
            const matrixEl = document.getElementById('matrix-rain');
            if (matrixEl) {
              matrixEl.style.display = matrixEl.style.display === 'none' ? 'block' : 'none';
            }
          }}
        >
          Toggle Matrix
        </motion.button>
      </div>
      
      <div id="matrix-rain" style={{ display: 'none' }}>
        <MatrixRain />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-black/50 backdrop-blur-xl border-b border-white/10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <LiquidText text="ULTRA" className="text-3xl font-bold" />
            <div className="flex gap-2">
              {sections.map(({ id, label, icon: Icon }) => (
                <motion.button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                    activeSection === id 
                      ? 'bg-purple-500/20 border border-purple-500 text-purple-400' 
                      : 'bg-white/5 border border-white/10 text-white/60 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden md:inline">{label}</span>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative z-10 pt-24">
        <AnimatePresence mode="wait">
          {/* Hero Section */}
          {activeSection === 'hero' && (
            <motion.section
              key="hero"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="min-h-screen flex flex-col items-center justify-center px-6"
            >
              <div className="relative">
                <OrganicBlob color="#8b5cf6" />
                <div className="relative z-10 text-center">
                  <WaveText text="WELCOME TO THE FUTURE" className="text-6xl font-bold mb-8" />
                  <KineticText 
                    words={['Innovation', 'Creativity', 'Performance', 'Excellence']} 
                    className="text-4xl font-bold mb-8"
                  />
                  <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-12">
                    Experience the most advanced animation library showcasing cutting-edge web technologies
                  </p>
                  <div className="flex gap-4 justify-center">
                    <CyberpunkButton onClick={() => setActiveSection('text')}>
                      Explore Animations
                    </CyberpunkButton>
                    <RippleButton 
                      className="px-8 py-4 bg-purple-600 rounded-lg font-bold"
                      onClick={() => setActiveSection('cards')}
                    >
                      View Components
                    </RippleButton>
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {/* Typography Section */}
          {activeSection === 'text' && (
            <motion.section
              key="text"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="container mx-auto px-6 py-20"
            >
              <h2 className="text-5xl font-bold text-center mb-16">
                <LiquidText text="Typography Animations" />
              </h2>
              
              <div className="space-y-12 max-w-4xl mx-auto">
                <div className="text-center">
                  <h3 className="text-2xl mb-4 text-purple-400">Liquid Morphing Text</h3>
                  <LiquidText text="Hover Over Each Letter" className="text-4xl" />
                </div>
                
                <div className="text-center">
                  <h3 className="text-2xl mb-4 text-blue-400">Wave Animation</h3>
                  <WaveText text="Continuous Wave Motion" className="text-4xl" />
                </div>
                
                <div className="text-center">
                  <h3 className="text-2xl mb-4 text-green-400">Kinetic Typography</h3>
                  <KineticText 
                    words={['Dynamic', 'Animated', 'Engaging', 'Modern']} 
                    className="text-4xl"
                  />
                </div>
              </div>
            </motion.section>
          )}

          {/* Cards Section */}
          {activeSection === 'cards' && (
            <motion.section
              key="cards"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="container mx-auto px-6 py-20"
            >
              <h2 className="text-5xl font-bold text-center mb-16">
                Interactive Card Components
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
                <NeonCard className="p-8 rounded-2xl bg-gray-900/50 backdrop-blur-xl border border-purple-500/20">
                  <Sparkles className="w-12 h-12 text-purple-400 mb-4" />
                  <h3 className="text-2xl font-bold mb-2">Neon Glow Card</h3>
                  <p className="text-gray-400">Dynamic glow follows your cursor with radial gradient</p>
                </NeonCard>
                
                <HolographicCard className="p-8 rounded-2xl border border-pink-500/20">
                  <Zap className="w-12 h-12 text-pink-400 mb-4" />
                  <h3 className="text-2xl font-bold mb-2">Holographic Effect</h3>
                  <p className="text-gray-400">3D perspective with animated gradient overlay</p>
                </HolographicCard>
                
                <SpotlightCard className="p-8 rounded-2xl border border-blue-500/20">
                  <Globe className="w-12 h-12 text-blue-400 mb-4" />
                  <h3 className="text-2xl font-bold mb-2">Spotlight Card</h3>
                  <p className="text-gray-400">Illuminated area follows mouse movement</p>
                </SpotlightCard>
                
                <FlipCard3D
                  className="h-64"
                  front={
                    <div className="h-full bg-gradient-to-br from-green-900/50 to-emerald-900/50 backdrop-blur-xl rounded-2xl p-8 border border-green-500/20 flex flex-col justify-center">
                      <Star className="w-12 h-12 text-green-400 mb-4" />
                      <h3 className="text-2xl font-bold">Click to Flip</h3>
                      <p className="text-gray-400 mt-2">Front Side</p>
                    </div>
                  }
                  back={
                    <div className="h-full bg-gradient-to-br from-yellow-900/50 to-orange-900/50 backdrop-blur-xl rounded-2xl p-8 border border-yellow-500/20 flex flex-col justify-center">
                      <Heart className="w-12 h-12 text-yellow-400 mb-4" />
                      <h3 className="text-2xl font-bold">Back Side</h3>
                      <p className="text-gray-400 mt-2">Click again to flip back</p>
                    </div>
                  }
                />
                
                <SpotlightCard spotlightColor="rgba(236, 72, 153, 0.5)" className="p-8 rounded-2xl border border-pink-500/20">
                  <Diamond className="w-12 h-12 text-pink-400 mb-4" />
                  <h3 className="text-2xl font-bold mb-2">Custom Spotlight</h3>
                  <p className="text-gray-400">Pink spotlight with custom color</p>
                </SpotlightCard>
                
                <NeonCard glowColor="#06b6d4" className="p-8 rounded-2xl bg-gray-900/50 backdrop-blur-xl border border-cyan-500/20">
                  <Shield className="w-12 h-12 text-cyan-400 mb-4" />
                  <h3 className="text-2xl font-bold mb-2">Cyan Neon</h3>
                  <p className="text-gray-400">Custom colored neon glow effect</p>
                </NeonCard>
              </div>
            </motion.section>
          )}

          {/* Buttons Section */}
          {activeSection === 'buttons' && (
            <motion.section
              key="buttons"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="container mx-auto px-6 py-20"
            >
              <h2 className="text-5xl font-bold text-center mb-16">
                Advanced Button Components
              </h2>
              
              <div className="flex flex-col items-center gap-8 max-w-4xl mx-auto">
                <div className="w-full text-center">
                  <h3 className="text-2xl mb-4 text-purple-400">Cyberpunk Button</h3>
                  <div className="flex justify-center gap-4">
                    <CyberpunkButton>Primary Action</CyberpunkButton>
                    <CyberpunkButton className="bg-gradient-to-r from-pink-500 to-red-500">
                      Danger Action
                    </CyberpunkButton>
                  </div>
                </div>
                
                <div className="w-full text-center">
                  <h3 className="text-2xl mb-4 text-blue-400">Ripple Effect Buttons</h3>
                  <div className="flex justify-center gap-4 flex-wrap">
                    <RippleButton className="px-8 py-4 bg-purple-600 rounded-lg font-bold">
                      Purple Ripple
                    </RippleButton>
                    <RippleButton className="px-8 py-4 bg-blue-600 rounded-lg font-bold">
                      Blue Ripple
                    </RippleButton>
                    <RippleButton className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-500 rounded-lg font-bold">
                      Gradient Ripple
                    </RippleButton>
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {/* Backgrounds Section */}
          {activeSection === 'backgrounds' && (
            <motion.section
              key="backgrounds"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="container mx-auto px-6 py-20"
            >
              <h2 className="text-5xl font-bold text-center mb-16">
                Dynamic Backgrounds
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                <div className="relative h-64 bg-gray-900 rounded-2xl overflow-hidden border border-purple-500/20">
                  <div className="absolute inset-0">
                    <OrganicBlob color="#8b5cf6" />
                  </div>
                  <div className="relative z-10 p-8 h-full flex items-center justify-center">
                    <h3 className="text-2xl font-bold">Organic Blob</h3>
                  </div>
                </div>
                
                <div className="relative h-64 bg-gray-900 rounded-2xl overflow-hidden border border-green-500/20">
                  <FractalTree />
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <h3 className="text-2xl font-bold">Fractal Tree</h3>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 text-center">
                <p className="text-gray-400 mb-4">The Aurora and Glowing Orbs backgrounds are active throughout the page</p>
                <p className="text-gray-400">Click "Toggle Matrix" in the top-right to see the Matrix Rain effect</p>
              </div>
            </motion.section>
          )}

          {/* Loaders Section */}
          {activeSection === 'loaders' && (
            <motion.section
              key="loaders"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="container mx-auto px-6 py-20"
            >
              <h2 className="text-5xl font-bold text-center mb-16">
                Loading Animations
              </h2>
              
              <div className="flex flex-col items-center gap-12">
                <div className="text-center">
                  <h3 className="text-2xl mb-6 text-purple-400">DNA Helix Loader</h3>
                  <DNALoader />
                </div>
                
                <div className="text-center">
                  <h3 className="text-2xl mb-6 text-blue-400">Infinity Marquee</h3>
                  <div className="w-full max-w-4xl overflow-hidden">
                    <InfiniteMarquee speed={10}>
                      <div className="flex gap-8">
                        {['React', 'Next.js', 'TypeScript', 'Framer Motion', 'Three.js'].map((tech) => (
                          <div key={tech} className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full">
                            <span className="font-bold">{tech}</span>
                          </div>
                        ))}
                      </div>
                    </InfiniteMarquee>
                  </div>
                </div>
                
                <div className="text-center">
                  <h3 className="text-2xl mb-6 text-green-400">Reverse Marquee</h3>
                  <div className="w-full max-w-4xl overflow-hidden">
                    <InfiniteMarquee speed={15} direction="right">
                      <div className="flex gap-8">
                        {[Sparkles, Zap, Globe, Cpu, Shield].map((Icon, i) => (
                          <div key={i} className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                            <Icon className="w-8 h-8 text-white" />
                          </div>
                        ))}
                      </div>
                    </InfiniteMarquee>
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {/* 3D Section */}
          {activeSection === '3d' && (
            <motion.section
              key="3d"
              initial={{ opacity: 0, rotateY: -20 }}
              animate={{ opacity: 1, rotateY: 0 }}
              exit={{ opacity: 0, rotateY: 20 }}
              className="container mx-auto px-6 py-20"
            >
              <h2 className="text-5xl font-bold text-center mb-16">
                3D Effects & Transformations
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                <FlipCard3D
                  className="h-80"
                  front={
                    <div className="h-full bg-gradient-to-br from-purple-900 to-pink-900 rounded-2xl p-8 flex flex-col justify-center items-center text-center">
                      <Cpu className="w-16 h-16 text-white mb-4" />
                      <h3 className="text-3xl font-bold mb-2">Front Side</h3>
                      <p className="text-gray-300">Click to reveal the back</p>
                    </div>
                  }
                  back={
                    <div className="h-full bg-gradient-to-br from-blue-900 to-cyan-900 rounded-2xl p-8 flex flex-col justify-center items-center text-center">
                      <Globe className="w-16 h-16 text-white mb-4 animate-spin-slow" />
                      <h3 className="text-3xl font-bold mb-2">Back Side</h3>
                      <p className="text-gray-300">3D flip animation with spring physics</p>
                    </div>
                  }
                />
                
                <HolographicCard className="h-80 p-8 rounded-2xl border border-purple-500/20 flex flex-col justify-center items-center text-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  >
                    <Star className="w-16 h-16 text-purple-400 mb-4" />
                  </motion.div>
                  <h3 className="text-3xl font-bold mb-2">Holographic</h3>
                  <p className="text-gray-400">Move your mouse to see 3D perspective</p>
                </HolographicCard>
              </div>
              
              <div className="mt-12 text-center">
                <p className="text-xl text-gray-400">
                  All cards feature advanced 3D transformations using CSS preserve-3d and perspective
                </p>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}