'use client';

import { useState } from 'react';
import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
import Link from 'next/link';

export const BrutalistNav = () => {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);

  useMotionValueEvent(scrollY, 'change', (latest) => {
    if (latest > 10) setScrolled(true);
    else setScrolled(false);
  });

  return (
    <motion.header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? 'py-2' : 'py-6 px-4 md:px-8'
      }`}
    >
      <div 
        className={`w-full max-w-7xl mx-auto flex items-center justify-between border-4 border-black bg-slate-100 text-black px-6 py-4 shadow-brutal transition-all duration-300 ${
           scrolled ? 'rounded-none border-x-0 md:rounded-xl md:border-x-4' : 'rounded-none'
        }`}
      >
        {/* Logo */}
        <Link href="/" className="flex flex-row items-center gap-2 group">
           <div className="w-10 h-10 border-4 border-black bg-acid-pink flex items-center justify-center -rotate-6 group-hover:rotate-0 transition-transform">
             <span className="font-black text-white text-xl">S</span>
           </div>
           <span className="font-black text-2xl tracking-tighter uppercase">Synthex</span>
        </Link>

        {/* Desktop Links */}
        <nav className="hidden md:flex items-center space-x-8 font-black uppercase text-sm tracking-widest">
          {['Features', 'Integrations', 'Pricing', 'Resources'].map((item) => (
            <Link 
              key={item} 
              href={`#${item.toLowerCase()}`}
              className="hover:bg-acid-yellow hover:text-black px-2 py-1 transition-colors border-2 border-transparent hover:border-black"
            >
              {item}
            </Link>
          ))}
        </nav>

        {/* Auth CTA */}
        <div className="flex items-center space-x-6">
          <Link href="/login" className="font-black uppercase text-sm hover:underline hidden sm:block tracking-widest">
            Login
          </Link>
          <Link 
            href="/login"
            className="px-6 py-2 border-4 border-black bg-acid-orange font-black uppercase text-sm text-black shadow-brutal hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[6px] active:translate-x-[6px] active:shadow-none transition-all"
          >
            Get Started
          </Link>
        </div>
      </div>
    </motion.header>
  );
};
