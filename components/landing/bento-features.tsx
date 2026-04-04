'use client';

import { motion } from 'framer-motion';
import { Bot, Share2, Sparkles, Zap, BarChart3, Clock } from 'lucide-react';

const features = [
  {
    title: 'Voice Extraction Engine',
    description: 'Provide a URL and our AI instantly extracts your exact tone, style, and vocabulary.',
    icon: <Sparkles className="w-6 h-6 text-aurora-purple" />,
    className: 'md:col-span-2 md:row-span-2 bg-gradient-to-br from-midnight-800 to-midnight-900 border border-midnight-700/50 hover:border-aurora-purple/50',
    content: (
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-midnight-950 to-transparent pointer-events-none p-6 flex items-end">
        <div className="w-full bg-midnight-900/80 backdrop-blur-md rounded-lg p-3 border border-aurora-purple/20 flex items-center gap-3">
           <div className="w-8 h-8 rounded-full bg-aurora-purple/20 animate-pulse flex items-center justify-center">
             <Bot className="w-4 h-4 text-aurora-purple" />
           </div>
           <div className="flex-1 space-y-1.5 align-middle">
             <div className="h-2 w-3/4 bg-midnight-600 rounded"></div>
             <div className="h-2 w-1/2 bg-midnight-600 rounded"></div>
           </div>
        </div>
      </div>
    ),
  },
  {
    title: 'Real-Time Scoring',
    description: 'Score content for virality before publishing.',
    icon: <BarChart3 className="w-6 h-6 text-aurora-cyan" />,
    className: 'md:col-span-1 bg-midnight-900 border border-midnight-700 hover:border-aurora-cyan/50',
  },
  {
    title: 'Cross-Platform',
    description: 'Auto-formats for 9 different social networks instantly.',
    icon: <Share2 className="w-6 h-6 text-aurora-magenta" />,
    className: 'md:col-span-1 bg-midnight-900 border border-midnight-700 hover:border-aurora-magenta/50',
  },
  {
    title: 'Auto-Scheduling',
    description: 'Smart timing based on audience active hours.',
    icon: <Clock className="w-6 h-6 text-blue-400" />,
    className: 'md:col-span-1 bg-midnight-900 border border-midnight-700 hover:border-blue-400/50',
  },
  {
    title: 'One-Click Publish',
    description: 'Execute campaigns at the speed of thought.',
    icon: <Zap className="w-6 h-6 tracking-wide text-yellow-400" />,
    className: 'md:col-span-1 bg-midnight-900 border border-midnight-700 hover:border-yellow-400/50',
  },
];

export const BentoFeatures = () => {
  return (
    <section id="features" className="py-24 relative z-10 px-4 md:px-8">
      <div className="max-w-6xl mx-auto">
        <motion.div
           initial={{ opacity: 1, y: 20 }}
           whileInView={{ opacity: 1, y: 0 }}
           viewport={{ once: true, margin: '-100px' }}
           transition={{ duration: 0.6 }}
           className="text-center mb-16"
        >
           <h2 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-midnight-300">
             Everything you need. <br className="hidden sm:block"/>
             <span className="text-aurora-cyan">Nothing you don't.</span>
           </h2>
           <p className="mt-4 text-midnight-400 max-w-xl mx-auto text-lg">
             A complete suite of AI tools designed exclusively for precision marketing.
           </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[200px]">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 1, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.02 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className={`relative overflow-hidden rounded-3xl p-6 group transition-all duration-300 shadow-lg ${feature.className}`}
            >
              <div className="relative z-10 h-full flex flex-col justify-start">
                <div className="mb-4 bg-midnight-950 w-12 h-12 rounded-xl flex items-center justify-center border border-midnight-800 group-hover:shadow-glow-aurora transition-all duration-500">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-midnight-300 text-sm leading-relaxed max-w-xs">{feature.description}</p>
              </div>
              
              {/* Optional interactive content inside the bento box */}
              {feature.content && feature.content}
              
              {/* Hover Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
