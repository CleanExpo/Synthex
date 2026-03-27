'use client';

import { motion } from 'framer-motion';
import { Target, Layers, Zap, ArrowRight, ShieldCheck } from 'lucide-react';

const features = [
  {
    icon: <Zap size={24} className="text-[#ff9bb3]" />,
    title: "Instant Setup",
    desc: "Connect your ad accounts in two clicks and align Synthex generative models instantly."
  },
  {
    icon: <Target size={24} className="text-[#c1a0e8]" />,
    title: "Predictive Segmenting",
    desc: "Our elegant embeddings evaluate conversion data to architect perfect audience parameters automatically."
  },
  {
    icon: <Layers size={24} className="text-neutral-900" />,
    title: "Generative Scale",
    desc: "Distribute highly targeted, auto-created visual content across your entire digital presence."
  },
  {
    icon: <ShieldCheck size={24} className="text-neutral-400" />,
    title: "Brand Protected",
    desc: "Intelligent heuristics constantly monitor tone and visual identity so your brand is bulletproof."
  }
];

export const CleanLightFeatures = () => {
  return (
    <section className="py-32 bg-[#fafafa] text-neutral-900 overflow-hidden relative" id="features">

      {/* Background Ambience */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[40vw] h-[40vh] bg-[radial-gradient(ellipse_at_center,_#c1f0d3_0%,_transparent_70%)] opacity-[0.15] blur-[100px] pointer-events-none z-0"></div>

      <div className="max-w-6xl mx-auto px-6 relative z-10 flex flex-col md:flex-row gap-16">
        
        {/* Left Copy */}
        <div className="md:w-1/3 flex flex-col justify-center">
          <motion.h2 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-4xl lg:text-5xl font-medium tracking-tight text-neutral-900 mb-6 leading-[1.1]"
          >
            Engineering<br/> meets Elegance.
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-neutral-500 font-light leading-relaxed mb-8"
          >
            Synthex replaces disjointed tools with a unified, meticulously crafted AI environment that writes and visualizes your business seamlessly.
          </motion.p>
          <motion.a 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            href="#docs" 
            className="inline-flex items-center gap-2 text-sm font-medium text-neutral-800 hover:text-neutral-500 transition-colors cursor-pointer group"
          >
            Explore the pipeline <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </motion.a>
        </div>

        {/* Right Flowing Grid */}
        <div className="md:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-6 relative">
          {features.map((feature, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 * idx, ease: "easeOut" }}
              className="bg-white p-8 rounded-[2rem] border border-neutral-100 shadow-[0_8px_30px_rgba(0,0,0,0.03)] hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] transition-all duration-500 flex flex-col items-start"
            >
              <div className="mb-8 w-14 h-14 rounded-2xl bg-neutral-50 border border-neutral-100 shadow-sm flex items-center justify-center">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold text-neutral-900 mb-3">{feature.title}</h3>
              <p className="text-sm font-light text-neutral-500 leading-relaxed">
                {feature.desc}
              </p>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
};
