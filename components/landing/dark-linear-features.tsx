'use client';

import { motion } from 'framer-motion';
import { Target, Layers, Zap, ArrowRight, ShieldCheck } from 'lucide-react';

const features = [
  {
    icon: <Zap size={24} className="text-[#ffd1dc]" />,
    title: "Instant Setup",
    desc: "Connect your ad accounts in two clicks and have Synthex generative pipelines active in under 60 seconds."
  },
  {
    icon: <Target size={24} className="text-[#e0c3fc]" />,
    title: "Predictive Targeting",
    desc: "Our embeddings analyze past conversion data to construct completely new audience segments automatically."
  },
  {
    icon: <Layers size={24} className="text-white" />,
    title: "Omnichannel Scale",
    desc: "Push perfectly cropped, hyper-personalized messaging across 9 networks simultaneously."
  },
  {
    icon: <ShieldCheck size={24} className="text-white/60" />,
    title: "Brand Safe",
    desc: "A built-in heuristics engine ensures every piece of content matches your brand's strict voice guidelines."
  }
];

export const DarkLinearFeatures = () => {
  return (
    <section className="py-32 bg-[#030303] text-white overflow-hidden relative border-t border-white/5" id="features">
      
      {/* Subtle Ambient Grid */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,rgba(255,255,255,0.05),transparent,rgba(255,255,255,0.05))] opacity-20 pointer-events-none z-0"></div>

      <div className="max-w-6xl mx-auto px-6 relative z-10 flex flex-col md:flex-row gap-16">
        
        {/* Left Copy */}
        <div className="md:w-1/3 flex flex-col justify-center">
          <motion.h2 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-4xl lg:text-5xl font-medium tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-500 mb-6 leading-tight"
          >
            Engineering meets Marketing.
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-neutral-400 font-light leading-relaxed mb-8"
          >
            Synthex replaces disjointed tools with a unified, pure-AI engine that writes, designs, and optimizes your campaigns with zero human bottleneck.
          </motion.p>
          <motion.a 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            href="#docs" 
            className="inline-flex items-center gap-2 text-sm font-medium text-[#c1f0d3] hover:text-white transition-colors cursor-pointer"
          >
            Explore the pipeline architecture <ArrowRight size={16} />
          </motion.a>
        </div>

        {/* Right Grid */}
        <div className="md:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-px bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(255,255,255,0.02)]">
          {features.map((feature, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 * idx }}
              className="bg-[#050505] p-10 hover:bg-[#0a0a0a] transition-colors group relative"
            >
              {/* Top ambient highlight on hover */}
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="mb-6 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all">
                {feature.icon}
              </div>
              <h3 className="text-lg font-medium text-white mb-3 tracking-wide">{feature.title}</h3>
              <p className="text-sm font-light text-neutral-500 leading-relaxed group-hover:text-neutral-400 transition-colors">
                {feature.desc}
              </p>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
};
