'use client';

import { useState, useEffect } from 'react';
import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button'; // Assuming shadcn UI Button exists

export const DynamicNav = () => {
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useMotionValueEvent(scrollY, 'change', (latest) => {
    const previous = scrollY.getPrevious() ?? 0;
    
    // Add glass background if scrolled down a bit
    if (latest > 50) setScrolled(true);
    else setScrolled(false);
    
    // Hide nav bar if scrolling down fast
    if (latest > previous && latest > 150) {
      setHidden(true);
    } else {
      setHidden(false);
    }
  });

  return (
    <motion.header
      variants={{
        visible: { y: 0 },
        hidden: { y: '-100%' },
      }}
      animate={hidden ? 'hidden' : 'visible'}
      transition={{ duration: 0.35, ease: 'easeInOut' }}
      className={`fixed top-0 inset-x-0 z-50 flex items-center justify-center pt-4 px-4`}
    >
      <div 
        className={`w-full max-w-5xl flex items-center justify-between px-6 py-3 rounded-full transition-all duration-300 ${
          scrolled 
            ? 'bg-midnight-950/70 backdrop-blur-lg border border-midnight-700 shadow-xl' 
            : 'bg-transparent border border-transparent'
        }`}
      >
        {/* Logo */}
        <Link href="/" className="flex flex-row items-center gap-2 group">
           <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-aurora-cyan to-aurora-purple flex items-center justify-center p-1.5 shadow-glow-cyan">
             <Image src="/synthex-logo.png" alt="Synthex" width={24} height={24} className="brightness-0 invert" />
           </div>
           <span className="font-bold text-xl tracking-tight text-white group-hover:text-aurora-cyan transition-colors">Synthex</span>
        </Link>

        {/* Desktop Links */}
        <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-midnight-300">
          {['Features', 'Integrations', 'Pricing', 'Resources'].map((item) => (
            <Link 
              key={item} 
              href={`#${item.toLowerCase()}`}
              className="hover:text-white transition-colors py-1 relative after:absolute after:bottom-0 after:left-0 after:w-full after:h-px after:bg-aurora-cyan after:origin-right after:scale-x-0 hover:after:scale-x-100 hover:after:origin-left after:transition-transform after:duration-300"
            >
              {item}
            </Link>
          ))}
        </nav>

        {/* Auth CTA */}
        <div className="flex items-center space-x-4">
          <Link href="/login" className="text-sm font-medium text-midnight-300 hover:text-white hidden sm:block">
            Log in
          </Link>
          <Button asChild className="rounded-full bg-white text-midnight-950 font-bold hover:bg-aurora-cyan hover:text-white transition-colors">
            <Link href="/login">Get Started</Link>
          </Button>
        </div>
      </div>
    </motion.header>
  );
};
