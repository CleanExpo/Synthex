'use client';

import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

export const CleanLightHero = () => {
  return (
    <section className="relative min-h-[90vh] flex flex-col items-center justify-center pt-32 pb-20 overflow-hidden bg-[#fafafa] selection:bg-[#ffd1dc]/40">
      
      {/* Pristine Whitespace Background with Soft Candy Ambient Light */}
      <div className="absolute inset-0 bg-[#fafafa] z-0"></div>
      
      {/* Top Ambient Glow / Candy Lights */}
      <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-[radial-gradient(ellipse_at_center,_#ffd1dc_0%,_transparent_60%)] opacity-40 blur-[130px] pointer-events-none z-0"></div>
      <div className="absolute top-[20%] left-[-15%] w-[40vw] h-[40vw] bg-[radial-gradient(ellipse_at_center,_#e0c3fc_0%,_transparent_60%)] opacity-30 blur-[110px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-20%] right-[20%] w-[40vw] h-[40vw] bg-[radial-gradient(ellipse_at_center,_#c1f0d3_0%,_transparent_60%)] opacity-30 blur-[90px] pointer-events-none z-0"></div>
      
      {/* Elegant Mesh Lines */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,transparent,rgba(0,0,0,0.03),transparent)] opacity-[0.15] pointer-events-none z-0"></div>

      <div className="max-w-5xl mx-auto w-full relative z-10 flex flex-col items-center text-center px-4">
        
        {/* Subtle Badge */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-neutral-200/60 bg-white/60 backdrop-blur-xl shadow-sm text-xs font-medium text-neutral-600 mb-8"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#ff9bb3] animate-pulse"></span>
          Synthex Engine v4.0 is live
        </motion.div>

        {/* Crisp Typography */}
        <motion.h1 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl md:text-7xl lg:text-8xl font-medium tracking-tight text-neutral-900 mb-6 leading-tight"
        >
          Clarity for growth. <br/> Without the noise.
        </motion.h1>

        <motion.p 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="text-lg md:text-xl text-neutral-500 max-w-2xl text-center font-light leading-relaxed mb-10"
        >
          The elegant standard for AI-driven omnichannel strategy. Synthex replaces chaotic dashboards with pure generative performance.
        </motion.p>

        {/* Elegant Action Area */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col sm:flex-row items-center gap-4"
        >
          <button className="h-12 px-8 rounded-full bg-neutral-900 text-white font-medium text-sm flex items-center gap-2 hover:bg-black hover:scale-[1.02] hover:shadow-[0_15px_30px_rgba(0,0,0,0.12)] transition-all">
            Start Building
            <ChevronRight size={16} />
          </button>
          <button className="h-12 px-8 rounded-full bg-white border border-neutral-200 text-neutral-700 font-medium text-sm hover:bg-neutral-50 hover:border-neutral-300 transition-colors shadow-sm">
            Watch Demo
          </button>
        </motion.div>

        {/* Clean Dashboard Glass Mockup */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-4xl mt-20 aspect-video rounded-2xl border border-white bg-white/40 backdrop-blur-3xl shadow-[0_40px_100px_-20px_rgba(0,0,0,0.08)] relative overflow-hidden flex flex-col"
        >
           {/* Light IDE Header */}
           <div className="h-10 border-b border-neutral-200/50 flex items-center px-4 gap-2 bg-white/40">
              <div className="w-3 h-3 rounded-full bg-neutral-300"></div>
              <div className="w-3 h-3 rounded-full bg-neutral-300"></div>
              <div className="w-3 h-3 rounded-full bg-neutral-300"></div>
              <div className="flex-1 text-center text-xs font-medium text-neutral-400">synthex-omnichannel</div>
           </div>
           
           {/* Soft Data Visuals */}
           <div className="flex-1 p-8 flex flex-col gap-6">
              <div className="w-1/3 h-6 bg-white/60 rounded-md border border-white shadow-sm"></div>
              <div className="w-full flex-1 border border-neutral-100 bg-white/20 rounded-xl flex items-end gap-3 p-6 shadow-sm">
                 <div className="flex-1 h-[40%] bg-gradient-to-t from-neutral-200 to-neutral-100 rounded-md"></div>
                 <div className="flex-1 h-[60%] bg-gradient-to-t from-neutral-200 to-neutral-100 rounded-md"></div>
                 <div className="flex-1 h-[75%] bg-gradient-to-t from-[#e0c3fc]/60 to-[#e0c3fc]/30 border border-white rounded-md shadow-[0_0_20px_rgba(224,195,252,0.3)]"></div>
                 <div className="flex-1 h-[95%] bg-gradient-to-t from-[#ffd1dc]/80 to-[#ffd1dc]/40 border border-white rounded-md shadow-[0_0_20px_rgba(255,209,220,0.4)]"></div>
              </div>
           </div>
        </motion.div>

      </div>
    </section>
  );
};
