'use client';

import { motion } from 'framer-motion';
import { Cpu } from '@/components/icons';

const terminalLines = [
  { text: 'Initializing Synthex Engine v3.0...', delay: 0 },
  { text: 'Connecting to social APIs (Twitter, LinkedIn, IG)...', delay: 1 },
  {
    text: '[SUCCESS] APIs connected. Latency: 12ms',
    color: 'text-candy-green',
    delay: 2,
  },
  { text: 'Analyzing audience demographics and past performance...', delay: 3 },
  {
    text: '> Discovered overlapping peak activity at 14:30 GMT',
    color: 'text-candy-orange',
    delay: 4,
  },
  { text: "Scraping trending topics in 'SaaS Marketing' niche...", delay: 5 },
  {
    text: '[OK] 142,034 data points processed.',
    color: 'text-candy-green',
    delay: 6,
  },
  { text: 'Generating 10 viral-optimized content variations...', delay: 7 },
  { text: 'Applying brand persona (Confidence: 98.4%)...', delay: 8 },
  {
    text: '> Content scheduled. Synthex Agent enters standby mode.',
    color: 'text-candy-orange',
    delay: 9,
  },
];

export function AgentTerminal() {
  return (
    <section className="py-24 px-6 relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(244,114,182,0.05)_0%,transparent_70%)] pointer-events-none rounded-full" />

      <div className="container mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          <motion.div
            initial={{ opacity: 1, x: 0 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="w-full lg:w-1/2"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
              Watch your AI agent <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-candy-pink to-candy-orange">
                do the heavy lifting
              </span>
            </h2>
            <p className="text-lg text-white/50 mb-8 max-w-lg">
              Synthex doesn't just schedule posts. It actively reasons through
              your audience data, applies predictive models, and crafts content
              autonomously. You just approve the results.
            </p>
            <div className="flex items-center space-x-4">
              <div className="h-px bg-white/20 flex-grow" />
              <span className="text-xs text-candy-orange font-mono uppercase tracking-widest">
                Autonomous Pipeline
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 1, x: 0 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8 }}
            className="w-full lg:w-1/2"
          >
            <div className="rounded-xl overflow-hidden bg-[#0A0A12] border border-white/10 shadow-2xl shadow-candy-orange/10">
              {/* Terminal Header */}
              <div className="bg-[#12121E] px-4 py-3 flex items-center border-b border-white/5">
                <div className="flex space-x-2 mr-4">
                  <div className="w-3 h-3 rounded-full bg-white/20" />
                  <div className="w-3 h-3 rounded-full bg-white/20" />
                  <div className="w-3 h-3 rounded-full bg-white/20" />
                </div>
                <div className="flex items-center space-x-2 text-white/40 text-xs font-mono">
                  <Cpu className="w-3 h-3" />
                  <span>synthex_auto_agent.exe</span>
                </div>
              </div>

              {/* Terminal Body */}
              <div className="p-6 font-mono text-sm leading-relaxed max-h-[400px] overflow-y-auto">
                {terminalLines.map((line, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 1, y: 0 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: line.delay * 0.3, duration: 0.4 }}
                    className="mb-2"
                  >
                    <span className="text-white/30 mr-4">[12:00:00]</span>
                    <span className={line.color || 'text-white/80'}>
                      {line.text}
                    </span>
                  </motion.div>
                ))}

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="w-3 h-5 bg-candy-orange mt-4"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
