'use client';

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import {
  Brain,
  Calendar,
  BarChart3,
  TrendingUp,
  Cpu,
  MessageSquare,
} from '@/components/icons';

export function BentoFeatures() {
  return (
    <section className="py-32 px-6 relative bg-charcoal-900 border-t border-white/5">
      {/* Background radial gradient */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(255,107,53,0.03)_0%,transparent_70%)] pointer-events-none" />

      <div className="container mx-auto">
        <div className="text-center mb-20 max-w-3xl mx-auto">
          <motion.h2
            initial={{ opacity: 1, y: 0 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight"
          >
            Capabilities designed for <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-candy-orange to-candy-pink">
              hyper-growth
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 1, y: 0 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-white/50"
          >
            We packed an entire marketing agency into a single, autonomous AI
            agent. From pattern recognition to predictive scheduling.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[400px]">
          {/* Card 1: AI Generation (Large) */}
          <motion.div
            initial={{ opacity: 1, scale: 1 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', bounce: 0.2, duration: 0.8 }}
            className="md:col-span-2 group"
          >
            <Card className="h-full bg-surface-dark border-white/5 overflow-hidden relative glass-hover transition-all duration-500">
              {/* Dynamic glowing mesh background */}
              <div className="absolute inset-0 bg-gradient-to-br from-candy-orange/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

              <div className="absolute top-8 left-8 z-10">
                <div className="w-12 h-12 rounded-xl bg-candy-orange/20 border border-candy-orange/30 flex items-center justify-center mb-6">
                  <Brain className="w-6 h-6 text-candy-orange" />
                </div>
                <h3 className="text-2xl font-semibold text-white mb-2">
                  Omnichannel AI Generation
                </h3>
                <p className="text-white/50 max-w-sm">
                  Generate 10-15 variations of viral-optimized content tailored
                  perfectly to each platform's algorithm.
                </p>
              </div>

              {/* Simulated typing interaction on hover */}
              <div className="absolute right-0 bottom-0 w-2/3 h-2/3 bg-black/40 border-t border-l border-white/10 rounded-tl-2xl p-6 transform translate-y-8 translate-x-8 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform duration-700">
                <div className="flex items-center space-x-2 mb-4">
                  <Cpu className="w-4 h-4 text-candy-orange" />
                  <span className="text-xs text-candy-orange font-mono">
                    Synthex_Agent_v3
                  </span>
                </div>
                <div className="space-y-3">
                  <div className="h-4 bg-white/10 rounded w-3/4" />
                  <div className="h-4 bg-white/10 rounded w-full" />
                  <div className="h-4 bg-white/10 rounded w-5/6" />
                  <div className="h-4 bg-candy-orange/40 rounded w-1/3 animate-pulse" />
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Card 2: Persona Learning */}
          <motion.div
            initial={{ opacity: 1, scale: 1 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{
              type: 'spring',
              bounce: 0.2,
              duration: 0.8,
              delay: 0.1,
            }}
            className="group"
          >
            <Card className="h-full bg-surface-dark border-white/5 overflow-hidden relative glass-hover transition-all duration-500 p-8 flex flex-col justify-between">
              <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-candy-pink/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

              <div>
                <div className="w-12 h-12 rounded-xl bg-candy-pink/20 border border-candy-pink/30 flex items-center justify-center mb-6">
                  <MessageSquare className="w-6 h-6 text-candy-pink" />
                </div>
                <h3 className="text-2xl font-semibold text-white mb-2">
                  Persona Mapping
                </h3>
                <p className="text-white/50">
                  Upload historical data. The AI learns your exact tone, slang,
                  and brand syntax.
                </p>
              </div>

              {/* Animated chat bubbles */}
              <div className="space-y-3 relative z-10 mt-8">
                <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-sm p-3 text-sm text-white/70 w-4/5 transform origin-bottom-left group-hover:scale-105 transition-transform duration-300">
                  "Analyze my top performing tweets from 2023..."
                </div>
                <div className="bg-candy-pink/20 border border-candy-pink/30 rounded-2xl rounded-br-sm p-3 text-sm text-candy-pink w-4/5 ml-auto text-right transform origin-bottom-right group-hover:scale-105 transition-transform duration-300 delay-100">
                  Tone acquired. 94% match.
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Card 3: Analytics */}
          <motion.div
            initial={{ opacity: 1, scale: 1 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{
              type: 'spring',
              bounce: 0.2,
              duration: 0.8,
              delay: 0.2,
            }}
            className="group"
          >
            <Card className="h-full bg-surface-dark border-white/5 overflow-hidden relative glass-hover transition-all duration-500 p-8 flex flex-col">
              <div className="absolute inset-0 bg-gradient-to-tr from-candy-green/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

              <div className="mb-auto">
                <div className="w-12 h-12 rounded-xl bg-candy-green/20 border border-candy-green/30 flex items-center justify-center mb-6">
                  <BarChart3 className="w-6 h-6 text-candy-green" />
                </div>
                <h3 className="text-2xl font-semibold text-white mb-2">
                  Real-time Analytics
                </h3>
                <p className="text-white/50">
                  Total cross-platform visibility.
                </p>
              </div>

              {/* Animated Bars */}
              <div className="h-32 flex items-end space-x-2 -mb-2 mt-4">
                {[40, 70, 50, 90, 60, 100].map((h, i) => (
                  <div
                    key={i}
                    className="w-full bg-white/5 rounded-t-sm relative overflow-hidden h-full"
                  >
                    <div
                      className="absolute bottom-0 w-full bg-candy-green transition-all duration-700 ease-out"
                      style={{ height: `${h}%` }}
                    />
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Card 4: Smart Scheduling (Large) */}
          <motion.div
            initial={{ opacity: 1, scale: 1 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{
              type: 'spring',
              bounce: 0.2,
              duration: 0.8,
              delay: 0.3,
            }}
            className="md:col-span-2 group"
          >
            <Card className="h-full bg-surface-dark border-white/5 overflow-hidden relative glass-hover transition-all duration-500 flex flex-col md:flex-row">
              <div className="absolute inset-0 bg-gradient-to-tl from-candy-yellow/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

              <div className="p-8 md:w-1/2 z-10 flex flex-col justify-center">
                <div className="w-12 h-12 rounded-xl bg-candy-yellow/20 border border-candy-yellow/30 flex items-center justify-center mb-6">
                  <Calendar className="w-6 h-6 text-candy-yellow" />
                </div>
                <h3 className="text-2xl font-semibold text-white mb-2">
                  Predictive Scheduling
                </h3>
                <p className="text-white/50 max-w-sm">
                  Synthex drops posts at the micro-second your audience is most
                  active. Stop guessing when to post.
                </p>
              </div>

              {/* Simulated Calendar UI */}
              <div className="md:w-1/2 p-8 relative flex items-center justify-center">
                <div className="absolute right-0 top-0 bottom-0 w-full bg-black/40 border-l border-white/10 p-6 flex flex-col">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-white/80 font-medium">This Week</span>
                    <TrendingUp className="text-candy-yellow w-4 h-4" />
                  </div>
                  <div className="grid grid-cols-5 gap-2 flex-grow">
                    {[...Array(15)].map((_, i) => (
                      <div
                        key={i}
                        className={`rounded-md ${i % 4 === 0 ? 'bg-candy-yellow border border-candy-yellow/50 shadow-glow-yellow scale-110 z-10' : 'bg-white/5'} transition-all duration-300`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
