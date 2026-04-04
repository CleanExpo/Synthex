'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { Card } from '@/components/ui/card';
import {
  BarChart3,
  TrendingUp,
  Users,
  Zap,
  CheckCircle2,
} from '@/components/icons';

export function DashboardPreview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  // 3D perspective scroll effects
  const rotateX = useTransform(scrollYProgress, [0, 0.5, 1], [25, 5, -10]);
  const rotateY = useTransform(scrollYProgress, [0, 0.5, 1], [-10, 0, 10]);
  const rotateZ = useTransform(scrollYProgress, [0, 0.5, 1], [-5, 0, 5]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.8, 1, 0.9]);
  const y = useTransform(scrollYProgress, [0, 0.5, 1], [100, 0, -100]);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.8, 1], [0, 1, 1, 0]);

  return (
    <div
      ref={containerRef}
      className="w-full flex justify-center perspective-[2000px] my-24"
    >
      <motion.div
        style={{
          rotateX,
          rotateY,
          rotateZ,
          scale,
          y,
          opacity,
          transformStyle: 'preserve-3d',
        }}
        className="w-full max-w-5xl relative"
      >
        {/* Glow behind the dashboard */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,107,53,0.15)_0%,transparent_70%)] rounded-[3rem] -z-10" />

        {/* The Dashboard 'Window' */}
        <div className="rounded-2xl border border-white/10 bg-surface-darker/90 backdrop-blur-3xl overflow-hidden shadow-2xl shadow-candy-orange/10 flex flex-col">
          {/* Dashboard Header / Browser Bar */}
          <div className="h-12 border-b border-white/10 bg-white/[0.02] flex items-center px-4 space-x-2">
            <div className="flex space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
            </div>
            <div className="mx-auto bg-surface-base border border-white/5 rounded-md px-32 py-1 text-xs text-white/40">
              app.synthex.social/dashboard
            </div>
            <div className="w-12" /> {/* Spacer to center URL */}
          </div>

          {/* Dashboard Body */}
          <div className="p-6 grid grid-cols-12 gap-6 relative">
            {/* Sidebar */}
            <div className="col-span-3 space-y-4">
              <div className="h-8 w-24 bg-white/10 rounded-md mb-8" />
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-10 w-full bg-white/5 rounded-lg flex items-center px-4 space-x-3"
                >
                  <div className="w-4 h-4 rounded-sm bg-white/20" />
                  <div
                    className={`h-2 rounded-full bg-white/20 ${i === 0 ? 'w-24' : i === 1 ? 'w-32 bg-candy-orange/50' : 'w-20'}`}
                  />
                </div>
              ))}
            </div>

            {/* Main Content Area */}
            <div className="col-span-9 space-y-6">
              {/* Top Stats */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    icon: <TrendingUp className="w-5 h-5 text-candy-green" />,
                    label: 'Engagement Rate',
                    val: '+428%',
                    color: 'from-candy-green/20',
                  },
                  {
                    icon: <Users className="w-5 h-5 text-candy-orange" />,
                    label: 'Audience Growth',
                    val: '+12.5k',
                    color: 'from-candy-orange/20',
                  },
                  {
                    icon: <Zap className="w-5 h-5 text-candy-yellow" />,
                    label: 'AI Actions Taken',
                    val: '8,432',
                    color: 'from-candy-yellow/20',
                  },
                ].map((stat, i) => (
                  <Card
                    key={i}
                    className={`p-5 bg-gradient-to-br ${stat.color} to-surface-base border border-white/5 relative overflow-hidden group hover:border-white/20 transition-all`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 rounded-lg bg-surface-darker/50">
                        {stat.icon}
                      </div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-white tracking-tight">
                        {stat.val}
                      </div>
                      <div className="text-sm text-white/50">{stat.label}</div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Chart Activity */}
              <Card className="p-6 bg-surface-base border border-white/5 h-64 relative overflow-hidden">
                <div className="flex justify-between items-center mb-6">
                  <div className="text-sm font-medium text-white/80">
                    Cross-Platform Activity
                  </div>
                  <div className="text-xs px-3 py-1 rounded-full bg-white/10 text-white/60">
                    Last 7 Days
                  </div>
                </div>
                {/* Simulated Chart */}
                <div className="absolute bottom-6 left-6 right-6 h-40 flex items-end justify-between space-x-2">
                  {[
                    40, 60, 45, 80, 55, 90, 70, 100, 85, 110, 95, 120, 105, 130,
                  ].map((height, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: `${height}%` }}
                      transition={{
                        duration: 1,
                        delay: i * 0.05 + 0.5,
                        type: 'spring',
                      }}
                      className="w-full bg-gradient-to-t from-candy-orange/10 to-candy-orange/80 rounded-t-sm"
                    />
                  ))}
                </div>

                {/* Floating tooltips */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.5, duration: 0.5 }}
                  className="absolute top-20 right-32 bg-surface-darker border border-white/10 px-3 py-2 rounded-lg shadow-xl shadow-black/50 text-xs text-white z-10"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <CheckCircle2 className="w-3 h-3 text-candy-green" />
                    <span>Viral Thread Detected</span>
                  </div>
                  <div className="text-white/50 text-[10px]">
                    +1,204 RTs in 1 hour
                  </div>
                </motion.div>
              </Card>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
