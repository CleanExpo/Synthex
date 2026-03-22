'use client';

import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

/** Testimonials — premium candy-coloured cards with glass morphism and gradient styling.
 *  AI-generated placeholder testimonials until real customer reviews are collected. */

const TESTIMONIALS = [
  {
    quote:
      "Synthex didn't just automate our social footprint; it fundamentally redefined how we interface with global markets. The results are immediate, measurable, and real.",
    name: 'Josh Mackay',
    title: 'CEO / Digital Horizons',
    initials: 'JM',
  },
  {
    quote:
      "We went from spending 12 hours a week on social content to under two. The AI understands our brand voice better than most junior copywriters we've hired.",
    name: 'Priya Sharma',
    title: 'Marketing Director / Verdant Co.',
    initials: 'PS',
  },
  {
    quote:
      'The cross-platform scheduling alone saved us three headcounts. Pair that with the analytics engine and you have a genuine competitive advantage.',
    name: 'Liam Chen',
    title: 'Head of Growth / NovaBuild',
    initials: 'LC',
  },
];

export function Testimonials() {
  return (
    <section className="relative py-24 md:py-32 z-10">
      {/* Ambient candy glow background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-orange-500/[0.08] blur-3xl rounded-full animate-pulse" />
        <div
          className="absolute top-1/3 right-1/4 w-80 h-80 bg-pink-500/[0.06] blur-3xl rounded-full animate-pulse"
          style={{ animationDelay: '1s' }}
        />
      </div>

      <div className="max-w-5xl mx-auto px-6 relative z-10">
        <div
          className="bg-charcoal-800/60 backdrop-blur-xl rounded-2xl p-10 md:p-16 relative overflow-hidden shadow-2xl shadow-black/30 ring-1 ring-white/[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(135deg, rgba(18,18,30,0.6) 0%, rgba(26,15,35,0.6) 100%)',
            border: '1px solid',
            borderImage:
              'linear-gradient(135deg, rgba(255,107,53,0.3) 0%, rgba(244,114,182,0.3) 100%) 1',
          }}
        >
          {/* Ambient glow inside card */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-gradient-to-b from-orange-500/[0.08] via-pink-500/[0.05] to-transparent blur-3xl rounded-full pointer-events-none" />

          <div className="relative z-10">
            {/* Large decorative quote mark with gradient */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="font-black text-[8rem] leading-none mb-4 select-none bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, #FF6B35 0%, #F472B6 100%)',
              }}
            >
              &ldquo;
            </motion.div>

            {/* Testimonial cards */}
            <div className="space-y-10">
              {TESTIMONIALS.map((t, idx) => (
                <motion.div
                  key={t.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  viewport={{ once: true }}
                >
                  <blockquote className="text-lg md:text-xl lg:text-2xl font-bold tracking-tight text-white leading-snug mb-6 max-w-4xl">
                    {t.quote}
                  </blockquote>

                  {/* Attribution */}
                  <div className="flex items-center gap-4">
                    {/* Avatar with candy gradient ring */}
                    <div
                      className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-sm relative"
                      style={{
                        background:
                          'linear-gradient(135deg, rgba(255,107,53,0.2) 0%, rgba(244,114,182,0.2) 100%)',
                        boxShadow: '0 0 20px rgba(255,107,53,0.3)',
                      }}
                    >
                      <div
                        className="absolute inset-0 rounded-full"
                        style={{
                          border: '2px solid',
                          borderImage:
                            'linear-gradient(135deg, #FF6B35, #F472B6) 1',
                        }}
                      />
                      <span className="relative z-10">{t.initials}</span>
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm">
                        {t.name}
                      </div>
                      <div className="text-xs text-white/40 mt-0.5">
                        {t.title}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* AI-generated disclaimer with elegant styling */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-10 pt-6 border-t border-white/[0.04]"
            >
              <div
                className="flex items-start gap-3 p-4 rounded-lg"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(255,107,53,0.08) 0%, rgba(244,114,182,0.08) 100%)',
                  border: '1px solid rgba(255,107,53,0.2)',
                }}
              >
                <CheckCircle2 className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-white/60 leading-relaxed">
                  These testimonials are AI-generated placeholders while we
                  collect real customer feedback. We&apos;re striving for 5-star
                  reviews from every client &mdash; yours could be next.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
