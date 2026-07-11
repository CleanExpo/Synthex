'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SynthexMark } from '@/components/landing/public-v2';

const navLinks = [
  { href: '/features', label: 'Platform' },
  { href: '/security', label: 'Security' },
  { href: '/pricing', label: 'Pilot Access' },
  { href: '/about', label: 'About' },
  { href: '/login', label: 'Login' },
];

export function PremiumPublicNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 border-b border-white/[0.04] bg-sx-bg-primary/90 backdrop-blur-xl transition-all duration-150 ease-premium',
        scrolled ? 'py-3' : 'py-4'
      )}
    >
      <div className="mx-auto flex max-w-container items-center justify-between px-5">
        <Link
          href="/"
          className="flex items-center gap-3"
          aria-label="Synthex home"
        >
          <SynthexMark />
          <span className="text-sm font-semibold uppercase tracking-[0.28em] text-sx-text-primary">
            Synthex
          </span>
        </Link>
        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-sx-text-muted transition-colors duration-[160ms] hover:text-sx-text-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <Button asChild variant="premium-primary" size="lg">
          <Link href="/contact">
            Request access
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </header>
  );
}
