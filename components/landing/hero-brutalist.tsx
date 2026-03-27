'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { Play, Terminal, Pause } from 'lucide-react';
import { useState } from 'react';

export const HeroBrutalist = () => {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <section className="relative min-h-[90vh] flex items-center pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden px-4 md:px-8 bg-black">
      {/* VEO CONCEPT: Full Bleed Background Video Loop */}
      <div className="absolute inset-0 z-0 opacity-40 mix-blend-screen overflow-hidden">
        {/* Placeholder for Gemini Veo Output */}
        <div className="w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-800 via-black to-black animate-pulse flex items-center justify-center">
             <span className="font-mono text-neutral-600 tracking-widest">[ VEO_DATALINK_ESTABLISHED ]</span>
        </div>
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay"></div>
      </div>

      <div className="max-w-7xl mx-auto flex flex-col items-start gap-8 z-10 w-full relative">
        
        {/* Audio / Music Generation Concept Toggle */}
        <motion.button
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setIsPlaying(!isPlaying)}
          className="flex items-center gap-3 bg-[#ff9900] text-black border-4 border-black px-4 py-2 font-black uppercase tracking-widest text-xs sm:text-sm shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:bg-white transition-colors"
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          <span>{isPlaying ? 'PAUSE GEMINI AUDIO' : 'INITIATE SOUNDSCAPE'}</span>
          {isPlaying && (
            <div className="flex gap-1 ml-2">
               <span className="w-1 h-3 bg-black animate-[bounce_1s_infinite]"></span>
               <span className="w-1 h-4 bg-black animate-[bounce_1s_infinite_0.1s]"></span>
               <span className="w-1 h-2 bg-black animate-[bounce_1s_infinite_0.2s]"></span>
            </div>
          )}
        </motion.button>

        {/* Brutalist Typography */}
         <motion.h1
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="text-7xl sm:text-8xl md:text-[10rem] font-black uppercase leading-[0.8] text-white tracking-tighter"
            style={{ WebkitTextStroke: '2px black', textShadow: '8px 8px 0px #ff3300' }}
          >
            SYS<br />
            OVERRIDE
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl md:text-2xl text-slate-300 font-mono max-w-2xl border-l-4 border-[#00ff66] pl-6 py-2 bg-black/60 backdrop-blur-sm"
          >
            &gt; Raw multimodal processing power.<br/>
            &gt; Connecting Veo heuristics... [OK]<br/>
            &gt; No abstraction. Just the machine.
          </motion.p>

          {/* Embeddings / Semantic Search CLI Concept */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="w-full max-w-2xl mt-8"
          >
             <div className="w-full bg-neutral-900 border-4 border-white p-4 flex items-center gap-4 text-white font-mono shadow-[8px_8px_0px_0px_rgba(0,255,102,1)]">
                <Terminal className="text-[#00ff66] animate-pulse" size={24} />
                <input 
                  type="text" 
                  placeholder="Enter embedding query vector..."
                  className="bg-transparent border-none outline-none flex-1 text-lg placeholder-neutral-600 focus:placeholder-neutral-500"
                />
                <button className="bg-white text-black px-6 py-3 uppercase font-black hover:bg-[#00ff66] transition-colors">
                  Execute
                </button>
             </div>
          </motion.div>

      </div>
    </section>
  );
};
