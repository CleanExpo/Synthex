'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface BrutalistBackgroundProps {
  children: ReactNode;
}

export const BrutalistBackground = ({ children }: BrutalistBackgroundProps) => {
  return (
    <div className="relative flex flex-col min-h-screen bg-slate-900 text-white overflow-hidden selection:bg-acid-pink selection:text-white">
      {/* Background Deep Slate */}
      <div className="absolute inset-0 bg-slate-900 z-0"></div>

      {/* Grid Canvas Overlay - Bold */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-30 pointer-events-none z-0" style={{ backgroundSize: '60px 60px' }}></div>

      {/* Massive Liquid Gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 mix-blend-screen opacity-20">
        <motion.div
           animate={{
            transform: [
              'translate(0%, 0%) scale(1)',
              'translate(-10%, 15%) scale(1.2)',
              'translate(-5%, -5%) scale(0.8)',
              'translate(0%, 0%) scale(1)',
            ],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
          className="absolute -top-[10%] -right-[10%] w-[60%] h-[70%] rounded-full bg-acid-pink blur-[120px]"
        />
        <motion.div
           animate={{
            transform: [
              'translate(0%, 0%) scale(1)',
              'translate(15%, -10%) scale(1.1)',
              'translate(5%, 15%) scale(0.9)',
              'translate(0%, 0%) scale(1)',
            ],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: 'linear', delay: 1 }}
          className="absolute -bottom-[10%] -left-[10%] w-[50%] h-[80%] rounded-full bg-acid-orange blur-[120px]"
        />
      </div>

      <div className="relative z-10 flex flex-col w-full min-h-screen">
        {children}
      </div>
    </div>
  );
};
