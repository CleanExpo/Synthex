'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

export const CleanLightNav = () => {
  return (
    <motion.nav 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-5xl"
    >
      <div className="flex items-center justify-between px-6 py-3 bg-white/70 backdrop-blur-2xl border border-neutral-200/50 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
        
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#ffd1dc] to-[#e0c3fc] shadow-[0_4px_10px_rgba(255,209,220,0.5)] group-hover:scale-110 transition-transform"></div>
          <span className="text-neutral-900 font-semibold tracking-wide">Synthex</span>
        </Link>

        {/* Links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-500">
          <Link href="#features" className="hover:text-neutral-900 transition-colors">Features</Link>
          <Link href="#solutions" className="hover:text-neutral-900 transition-colors">Solutions</Link>
          <Link href="#pricing" className="hover:text-neutral-900 transition-colors">Pricing</Link>
          <Link href="#docs" className="hover:text-neutral-900 transition-colors">Developers</Link>
        </div>

        {/* CTA */}
        <div className="flex items-center gap-4">
          <Link href="/login" className="hidden sm:block text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors">
            Sign In
          </Link>
          <Link href="/signup" className="px-5 py-2 text-sm font-medium text-white bg-neutral-900 rounded-full hover:bg-black transition-colors shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
            Start Free
          </Link>
        </div>

      </div>
    </motion.nav>
  );
};
