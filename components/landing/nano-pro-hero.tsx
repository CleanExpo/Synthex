'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, BarChart, Layers } from 'lucide-react';

export const NanoProHero = () => {
  return (
    <section className="relative min-h-screen pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden px-4 md:px-8 bg-[#fafafa] selection:bg-[#ffd1dc]/40">
      
      {/* Background Sophisticated Candy Glow */}
      <div className="absolute top-0 left-1/4 w-[50vw] h-[50vw] bg-[radial-gradient(circle,_#ffd1dc_0%,_transparent_60%)] opacity-40 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-[10%] w-[40vw] h-[40vw] bg-[radial-gradient(circle,_#e0c3fc_0%,_transparent_60%)] opacity-30 blur-[100px] pointer-events-none"></div>
      <div className="absolute top-1/2 left-[10%] w-[30vw] h-[30vw] bg-[radial-gradient(circle,_#c1f0d3_0%,_transparent_60%)] opacity-30 blur-[80px] pointer-events-none"></div>

      <div className="max-w-6xl mx-auto w-full relative z-10 flex flex-col items-center text-center">
        
        {/* Subtle Badge */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-neutral-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] text-sm font-medium text-neutral-600 mb-8"
        >
          <Sparkles size={16} className="text-[#e2a0ff]" />
          <span>The next generation of AI marketing forms.</span>
        </motion.div>

        {/* Clean, Elegant Typography */}
        <div className="max-w-4xl relative z-20">
           <motion.h1 
             initial={{ y: 30, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
             className="text-6xl md:text-8xl font-medium tracking-tight text-neutral-900 leading-[1.05]"
           >
             Synthex is clarity for your growth.
           </motion.h1>
           
           <motion.p 
             initial={{ y: 30, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
             className="text-xl text-neutral-500 mt-8 max-w-2xl mx-auto font-light leading-relaxed"
           >
             A deeply intelligent, frictionless platform that scales your omnichannel presence without the noise. Pure performance.
           </motion.p>
        </div>

        {/* Action Area */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="mt-10 flex items-center justify-center gap-6 relative z-30"
        >
           <button className="bg-neutral-900 text-white px-8 py-4 rounded-full font-medium text-lg flex items-center gap-3 hover:bg-neutral-800 hover:-translate-y-1 transition-all shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
             Start building for free
             <ArrowRight size={20} />
           </button>
           <button className="text-neutral-600 font-medium px-8 py-4 hover:text-neutral-900 transition-colors">
             View Documentation
           </button>
        </motion.div>

        {/* Pristine Glass Floating Grid Elements */}
        <div className="w-full mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 relative z-20 px-4 md:px-0">
           
           <motion.div 
             initial={{ opacity: 0, y: 40 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
             className="bg-white/80 backdrop-blur-2xl p-8 rounded-[2rem] border border-white shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)] flex flex-col items-start hover:-translate-y-2 transition-transform duration-500"
           >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ffd1dc] to-[#ffe8ed] flex items-center justify-center mb-6 shadow-sm border border-white">
                 <Layers className="text-[#ff9bb3]" size={24} />
              </div>
              <h3 className="text-xl font-semibold text-neutral-900 mb-2">Omnichannel Flow</h3>
              <p className="text-neutral-500 text-sm leading-relaxed text-left">
                Seamlessly distribute your brand voice across 9+ platforms simultaneously.
              </p>
           </motion.div>

           <motion.div 
             initial={{ opacity: 0, y: 40 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
             className="bg-white/80 backdrop-blur-2xl p-8 rounded-[2rem] border border-white shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)] flex flex-col items-start hover:-translate-y-2 transition-transform duration-500 md:-translate-y-6 md:hover:-translate-y-8"
           >
              <div className="w-full aspect-[2/1] rounded-xl bg-gradient-to-r from-[#e0c3fc]/30 to-[#ffd1dc]/30 mb-6 border border-white/50 relative overflow-hidden flex items-center justify-center">
                 <span className="text-4xl font-light text-neutral-800 tracking-tighter">10X ROI</span>
                 <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-white/60 to-transparent"></div>
              </div>
              <h3 className="text-xl font-semibold text-neutral-900 mb-2">Generative Scaling</h3>
              <p className="text-neutral-500 text-sm leading-relaxed text-left">
                Hyper-personalized content that naturally accelerates conversion metrics without forcing it.
              </p>
           </motion.div>

           <motion.div 
             initial={{ opacity: 0, y: 40 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
             className="bg-white/80 backdrop-blur-2xl p-8 rounded-[2rem] border border-white shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)] flex flex-col items-start hover:-translate-y-2 transition-transform duration-500"
           >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#c1f0d3] to-[#e6faee] flex items-center justify-center mb-6 shadow-sm border border-white">
                 <BarChart className="text-[#7bd59f]" size={24} />
              </div>
              <h3 className="text-xl font-semibold text-neutral-900 mb-2">Clear Analytics</h3>
              <p className="text-neutral-500 text-sm leading-relaxed text-left">
                No cluttered dashboards. Just the beautiful, concise data you need to drive results.
              </p>
           </motion.div>

        </div>

      </div>
    </section>
  );
};
