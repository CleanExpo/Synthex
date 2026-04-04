'use client';

import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

export const DarkLinearHero = () => {
  return (
    <section className="relative min-h-[90vh] flex flex-col items-center justify-center pt-32 pb-20 overflow-hidden bg-[#030303] selection:bg-[#e0c3fc]/30">
      
      {/* Deep Space Background with Ambient Candy Glow from Bottom */}
      <div className="absolute inset-0 bg-[#030303] z-0"></div>
      
      {/* Bottom Ambient Lighting: Lavender & Peach */}
      <div className="absolute bottom-[-20%] left-1/4 w-[50vw] h-[40vh] bg-[radial-gradient(ellipse_at_top,_#e0c3fc_0%,_transparent_70%)] opacity-20 blur-[120px] mix-blend-screen pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] right-1/4 w-[40vw] h-[30vh] bg-[radial-gradient(ellipse_at_top,_#ffd1dc_0%,_transparent_70%)] opacity-15 blur-[100px] mix-blend-screen pointer-events-none z-0"></div>
      
      {/* Ambient Grid lines (1px minimal) */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,transparent,rgba(255,255,255,0.1),transparent)] opacity-20 pointer-events-none z-0"></div>

      <div className="max-w-5xl mx-auto w-full relative z-10 flex flex-col items-center text-center px-4">
        
        {/* Subtle Badge */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-xs font-mono text-[#e0c3fc] mb-8"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#ffd1dc] animate-pulse"></span>
          Synthex Engine v4.0 is live
        </motion.div>

        {/* Crisp, Maximal Minimalist Typography */}
        <motion.h1 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl md:text-7xl lg:text-8xl font-medium tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-neutral-500 mb-6"
        >
          Market with precision. <br/> Scale without friction.
        </motion.h1>

        <motion.p 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="text-lg md:text-xl text-neutral-400 max-w-2xl text-center font-light leading-relaxed mb-10"
        >
          The absolute standard for AI-driven omnichannel growth. Synthex replaces chaotic dashboards with pure generative intelligence.
        </motion.p>

        {/* Refined Actions */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col sm:flex-row items-center gap-4"
        >
          <button className="h-12 px-8 rounded-full bg-white text-black font-medium text-sm flex items-center gap-2 hover:bg-neutral-200 hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,255,255,0.15)]">
            Start Building
            <ChevronRight size={16} />
          </button>
          <button className="h-12 px-8 rounded-full bg-transparent border border-white/10 text-white font-medium text-sm hover:bg-white/5 transition-colors">
            Read Docs
          </button>
        </motion.div>

        {/* Dashboard / IDE Preview Window */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-4xl mt-20 aspect-video rounded-xl border border-white/10 bg-[#0a0a0a]/80 backdrop-blur-2xl shadow-[0_20px_80px_-20px_rgba(224,195,252,0.15)] relative overflow-hidden flex flex-col"
        >
           {/* Fake IDE Header */}
           <div className="h-10 border-b border-white/5 flex items-center px-4 gap-2 bg-white/5">
              <div className="w-3 h-3 rounded-full bg-neutral-700"></div>
              <div className="w-3 h-3 rounded-full bg-neutral-700"></div>
              <div className="w-3 h-3 rounded-full bg-neutral-700"></div>
              <div className="flex-1 text-center text-xs font-mono text-neutral-500">synthex-workspace</div>
           </div>
           
           {/* Mock Data Vis */}
           <div className="flex-1 p-8 flex flex-col gap-6">
              <div className="w-1/3 h-6 bg-white/5 rounded-md animate-pulse"></div>
              <div className="w-full flex-1 border border-white/5 rounded-lg flex items-end gap-2 p-4">
                 <div className="w-1/6 h-[30%] bg-white/5 rounded-t-sm"></div>
                 <div className="w-1/6 h-[50%] bg-white/5 rounded-t-sm"></div>
                 <div className="w-1/6 h-[40%] bg-white/5 rounded-t-sm"></div>
                 <div className="w-1/6 h-[70%] bg-[#e0c3fc]/20 rounded-t-sm relative">
                    <div className="absolute top-0 w-full h-1 bg-[#e0c3fc] shadow-[0_0_10px_#e0c3fc]"></div>
                 </div>
                 <div className="w-1/6 h-[90%] bg-[#ffd1dc]/20 rounded-t-sm relative">
                    <div className="absolute top-0 w-full h-1 bg-[#ffd1dc] shadow-[0_0_10px_#ffd1dc]"></div>
                 </div>
              </div>
           </div>
        </motion.div>

      </div>
    </section>
  );
};
