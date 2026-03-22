'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { LiveDemoWidget } from './LiveDemoWidget';

/** Eyebrow pill label */
function EyebrowPill({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 mb-8">
      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse flex-shrink-0" />
      <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-orange-400">
        {children}
      </span>
    </div>
  );
}

/** Social proof row */
function SocialProofRow() {
  return (
    <div className="flex items-center gap-3 mt-8">
      <div className="flex -space-x-2">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className="w-8 h-8 rounded-full border-2 border-charcoal-900 bg-charcoal-600 flex-shrink-0"
          />
        ))}
      </div>
      <p className="text-sm text-white/50">
        Start growing your social presence
      </p>
    </div>
  );
}

const heroTextVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  }),
};

/** Hero section — 55/45 asymmetric layout with LiveDemoWidget */
export function HeroSection() {
  return (
    <>
      <style jsx>{`
        @keyframes gradientShift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

<<<<<<< HEAD
      <div className="max-w-7xl mx-auto px-6 relative z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-12 items-center">
          {/* Left — copy */}
          <div>
            <motion.div custom={0} variants={heroTextVariants} initial="hidden" animate="visible">
              <EyebrowPill>AI-native social media</EyebrowPill>
            </motion.div>

            <motion.h1
              custom={1}
              variants={heroTextVariants}
              initial="hidden"
              animate="visible"
              className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.05] mb-6"
            >
              The social media platform that{' '}
              <em className="text-orange-500 not-italic">works for you</em>
            </motion.h1>

            <motion.p
              custom={2}
              variants={heroTextVariants}
              initial="hidden"
              animate="visible"
              className="text-lg text-white/50 max-w-lg leading-relaxed mb-10"
            >
              AI generates posts in seconds. You approve. Synthex handles the
              rest — scheduling, engagement, and analytics across every channel.
            </motion.p>

            {/* CTAs with shimmer */}
            <motion.div
              custom={3}
              variants={heroTextVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-col sm:flex-row gap-3"
            >
              <Link
                href="/signup"
                className="group relative inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-orange-500 text-charcoal-900 font-bold rounded-full hover:bg-orange-400 hover:-translate-y-0.5 transition-all duration-200 text-sm overflow-hidden"
              >
                <span className="relative z-10">Start free</span>
                <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              </Link>
              <Link
                href="/features"
                className="group relative inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white/[0.04] border border-white/10 text-white/80 hover:text-white hover:bg-white/[0.08] rounded-full transition-all duration-200 text-sm font-medium overflow-hidden"
              >
                <span className="relative z-10">See it work</span>
                <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              </Link>
            </motion.div>

            <motion.div custom={4} variants={heroTextVariants} initial="hidden" animate="visible">
              <SocialProofRow />
            </motion.div>
          </div>

          {/* Right — LiveDemoWidget */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <LiveDemoWidget />
          </motion.div>
=======
        .gradient-text {
          background: linear-gradient(
            90deg,
            #ff6b35,
            #ffd60a,
            #ff3b5c,
            #f472b6,
            #ff6b35
          );
          background-size: 200% 100%;
          animation: gradientShift 6s ease infinite;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .candy-glow-text {
          text-shadow:
            0 0 40px rgba(255, 107, 53, 0.5),
            0 0 80px rgba(255, 107, 53, 0.3);
        }

        @keyframes floatParticles {
          0%,
          100% {
            transform: translateY(0px) translateX(0px);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(-100px) translateX(50px);
            opacity: 0;
          }
        }

        .particle {
          animation: floatParticles 8s ease-in-out infinite;
          position: absolute;
          border-radius: 50%;
        }

        .candy-gradient-btn {
          background: linear-gradient(135deg, #ff6b35 0%, #ff3b5c 100%);
          box-shadow: 0 0 30px rgba(255, 107, 53, 0.4);
        }

        .candy-gradient-btn:hover {
          box-shadow:
            0 0 50px rgba(255, 107, 53, 0.6),
            0 0 80px rgba(255, 59, 92, 0.4);
        }

        .glass-morphism-btn {
          backdrop-filter: blur(10px);
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .glass-morphism-btn:hover {
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.3);
          box-shadow: 0 0 30px rgba(255, 255, 255, 0.1);
        }
      `}</style>

      <section className="relative min-h-[100dvh] flex items-center pt-24 pb-16 overflow-hidden">
        {/* Premium mesh gradient background */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Deep purple to orange mesh */}
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-br from-purple-900/20 via-orange-500/10 to-transparent blur-[150px] rounded-full" />
          <div className="absolute top-1/2 right-0 w-[600px] h-[400px] bg-gradient-to-bl from-pink-500/15 via-orange-400/10 to-transparent blur-[150px] rounded-full" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-gradient-to-t from-orange-500/10 to-transparent blur-[120px] rounded-full" />
        </div>

        {/* Floating particles */}
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div
            key={`particle-${i}`}
            className="particle"
            style={{
              width: `${Math.random() * 8 + 4}px`,
              height: `${Math.random() * 8 + 4}px`,
              background: ['#FF6B35', '#FFD60A', '#FF3B5C', '#F472B6'][i % 4],
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${i * 1.3}s`,
            }}
          />
        ))}

        {/* Warm ambient glow - enhanced */}
        <div className="absolute top-1/3 -left-48 w-[600px] h-[600px] bg-orange-500/[0.08] blur-[200px] rounded-full pointer-events-none" />
        <div className="absolute top-1/2 right-0 w-[400px] h-[400px] bg-orange-500/[0.06] blur-[150px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 relative z-10 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-12 items-center">
            {/* Left — copy */}
            <div>
              <EyebrowPill>AI-native social media</EyebrowPill>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.05] mb-6">
                The social media platform that{' '}
                <em className="gradient-text candy-glow-text not-italic">
                  works for you
                </em>
              </h1>

              <p className="text-lg text-white/50 max-w-lg leading-relaxed mb-10">
                AI generates posts in seconds. You approve. Synthex handles the
                rest — scheduling, engagement, and analytics across every
                channel.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/signup"
                  className="candy-gradient-btn inline-flex items-center justify-center gap-2 px-8 py-3.5 text-charcoal-900 font-bold rounded-full hover:-translate-y-0.5 transition-all duration-200 text-sm"
                >
                  Start free
                </Link>
                <Link
                  href="/features"
                  className="glass-morphism-btn inline-flex items-center justify-center gap-2 px-8 py-3.5 text-white rounded-full hover:-translate-y-0.5 transition-all duration-200 text-sm font-medium"
                >
                  See it work
                </Link>
              </div>

              <SocialProofRow />
            </div>

            {/* Right — LiveDemoWidget */}
            <div>
              <LiveDemoWidget />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
