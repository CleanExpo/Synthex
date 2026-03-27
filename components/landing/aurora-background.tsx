'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode, useState, useEffect } from 'react';
import { Sparkles, Mic, Music2 } from 'lucide-react';

interface AuroraBackgroundProps {
  children: ReactNode;
}

export const AuroraBackground = ({ children }: AuroraBackgroundProps) => {
  const [showSearch, setShowSearch] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Keyboard shortcut for Embeddings Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="relative flex flex-col min-h-screen bg-[#050014] text-white overflow-hidden selection:bg-[#7b2cbf]/30 font-sans">
      {/* Background Deep Midnight */}
      <div className="absolute inset-0 bg-[#050014] z-0"></div>

      {/* Aurora Orbs - Enhanced for Ethereal Feel */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div
           animate={{
            transform: [
              'translate(0%, 0%) scale(1)',
              'translate(5%, 10%) scale(1.1)',
              'translate(-5%, 5%) scale(0.9)',
              'translate(0%, 0%) scale(1)',
            ],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-[20%] -left-[10%] w-[50vw] h-[50vh] rounded-full bg-[#7b2cbf]/20 blur-[120px] mix-blend-screen"
        />
        <motion.div
           animate={{
            transform: [
              'translate(0%, 0%) scale(1)',
              'translate(-5%, -10%) scale(1.1)',
              'translate(5%, -5%) scale(0.9)',
              'translate(0%, 0%) scale(1)',
            ],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute top-[20%] -right-[10%] w-[40vw] h-[60vh] rounded-full bg-[#00f5d4]/20 blur-[120px] mix-blend-screen"
        />
        <motion.div
            animate={{
            transform: [
              'translate(0%, 0%) scale(1)',
              'translate(10%, -5%) scale(1.1)',
              'translate(5%, 15%) scale(0.9)',
              'translate(0%, 0%) scale(1)',
            ],
          }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 5 }}
          className="absolute -bottom-[20%] left-[20%] w-[60vw] h-[50vh] rounded-full bg-[#f15bb5]/15 blur-[120px] mix-blend-screen"
        />
      </div>

      {/* Subtle Noise / Grid Overlay */}
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay pointer-events-none z-0"></div>
      
      {/* Ambient Audio Toggle Widget */}
      <div className="fixed bottom-6 right-6 z-50">
        <button 
          onClick={() => setIsPlaying(!isPlaying)}
          className={`flex items-center justify-center p-3 rounded-full backdrop-blur-xl border transition-all ${isPlaying ? 'bg-white/10 border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.2)]' : 'bg-black/20 border-white/5 hover:bg-white/5'}`}
        >
           <Music2 size={20} className={isPlaying ? 'text-[#00f5d4]' : 'text-neutral-500'} />
           {isPlaying && (
             <div className="absolute -top-12 right-0 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-xs font-mono text-[#00f5d4] flex items-center gap-2 whitespace-nowrap">
               <span className="w-1.5 h-1.5 rounded-full bg-[#00f5d4] animate-pulse"></span>
               Generative Ambient Active
             </div>
           )}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex flex-col w-full min-h-screen">
        {/* Global Floating Search Bar Hint */}
        <div className="w-full flex justify-center pt-8 pointer-events-none">
           <div className="px-4 py-2 rounded-full border border-white/10 bg-black/20 backdrop-blur-md flex items-center gap-3 text-sm text-neutral-400 font-medium">
             <Sparkles size={16} className="text-[#f15bb5]" />
             <span>Press</span>
             <kbd className="px-2 py-1 rounded bg-white/10 text-white font-mono text-xs">⌘ K</kbd>
             <span>for Semantic Embeddings Search</span>
           </div>
        </div>

        {children}
      </div>

      {/* Embeddings Search Command Palette Modal */}
      <AnimatePresence>
         {showSearch && (
           <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] px-4"
           >
              {/* Backdrop */}
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSearch(false)}></div>
              
              {/* Glass Modal */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                className="w-full max-w-2xl bg-white/5 backdrop-blur-3xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden relative"
              >
                 <div className="p-4 border-b border-white/10 flex items-center gap-3">
                    <Sparkles size={20} className="text-[#00f5d4]" />
                    <input 
                      autoFocus
                      type="text" 
                      placeholder="Ask the embedding space anything..." 
                      className="bg-transparent border-none outline-none flex-1 text-lg text-white placeholder-neutral-500 font-light"
                    />
                    <Mic size={20} className="text-neutral-500 hover:text-white cursor-pointer transition-colors" />
                 </div>
                 <div className="p-6 bg-black/20 h-[300px] flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center mb-4">
                       <span className="w-8 h-8 rounded-full bg-gradient-to-r from-[#7b2cbf] to-[#00f5d4] animate-[spin_3s_linear_infinite] blur-[2px]"></span>
                    </div>
                    <h3 className="text-lg text-white font-medium mb-2">Awaiting Parameters</h3>
                    <p className="text-neutral-400 text-sm max-w-xs">Connecting to Gemini Vector Store. Type your query to generate UI components and documentation matches.</p>
                 </div>
              </motion.div>
           </motion.div>
         )}
      </AnimatePresence>
    </div>
  );
};
