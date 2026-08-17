'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowRight, Menu, X } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SynthexMark } from '@/components/landing/public-v2';
import { headerNavLinks, accountLink } from './public-chrome-links';

export function PremiumPublicNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const startHref =
    pathname === '/opportunity-map' ? '#build-map' : '/opportunity-map';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, []);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-200 ease-premium',
        scrolled
          ? 'bg-sx-bg-primary/80 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-2xl'
          : 'bg-transparent py-4'
      )}
    >
      <div
        className="landing-header-sheen pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-80"
        aria-hidden
      />
      <div className="mx-auto flex max-w-container items-center justify-between gap-2 px-5">
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
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {headerNavLinks.map(link => {
            const current = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'rounded-full px-3.5 py-2 text-sm transition-colors duration-[160ms]',
                  current
                    ? 'bg-white/[0.06] text-sx-text-primary'
                    : 'text-sx-text-muted hover:text-sx-text-primary'
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3 lg:ml-0">
          <Link
            href={accountLink.href}
            className="hidden min-h-11 items-center text-sm text-sx-text-muted transition-colors hover:text-sx-text-primary md:inline-flex"
          >
            {accountLink.label}
          </Link>
          <Button asChild variant="premium-primary" size="lg">
            <Link href={startHref} onClick={() => setMobileOpen(false)}>
              <span className="md:hidden">Start free</span>
              <span className="hidden md:inline">Build free map</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <button
            type="button"
            onClick={() => setMobileOpen(open => !open)}
            aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileOpen}
            aria-controls="public-mobile-navigation"
            className="grid min-h-11 min-w-11 place-items-center rounded-btn border border-white/[0.1] text-sx-text-secondary transition-colors hover:border-white/25 hover:text-sx-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sx-accent lg:hidden"
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
        {mobileOpen ? (
          <nav
            id="public-mobile-navigation"
            aria-label="Mobile primary"
            className="absolute inset-x-0 top-full border-y border-white/[0.08] bg-sx-bg-primary/95 px-5 py-4 shadow-2xl backdrop-blur-xl lg:hidden"
          >
            <div className="mx-auto grid max-w-container gap-1">
              {[...headerNavLinks, accountLink].map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={pathname === link.href ? 'page' : undefined}
                  onClick={() => setMobileOpen(false)}
                  className="flex min-h-11 items-center justify-between border-b border-white/[0.06] py-3 text-base text-sx-text-secondary last:border-b-0 hover:text-sx-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sx-accent"
                >
                  {link.label}
                  <ArrowRight className="h-4 w-4 text-sx-text-muted" />
                </Link>
              ))}
            </div>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
