'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

export const DarkLinearNav = () => {
  return (
    <motion.nav 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-5xl"
    >
      <div className="flex items-center justify-between px-6 py-3 bg-[#0a0a0a]/60 backdrop-blur-xl border border-white/10 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#e0c3fc] to-[#ffd1dc] shadow-[0_0_15px_rgba(224,195,252,0.4)] group-hover:scale-110 transition-transform"></div>
          <span className="text-white font-medium tracking-wide">Synthex</span>
        </Link>

        {/* Links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-400">
          <Link href="#features" className="hover:text-white transition-colors">Features</Link>
          <Link href="#solutions" className="hover:text-white transition-colors">Solutions</Link>
          <Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link>
          <Link href="#docs" className="hover:text-white transition-colors">Developers</Link>
        </div>

        {/* CTA */}
        <div className="flex items-center gap-4">
          <Link href="/login" className="hidden sm:block text-sm font-medium text-neutral-400 hover:text-white transition-colors">
            Sign In
          </Link>
          <Link href="/signup" className="px-5 py-2 text-sm font-medium text-black bg-white rounded-full hover:bg-neutral-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.2)]">
            Start Free
          </Link>
        </div>

      </div>
    </motion.nav>
  );
};
