'use client';

import { ThemeProvider } from 'next-themes';
import { useState, useEffect } from 'react';
import { AuthProvider } from '@/hooks/useAuth';
import { TooltipProvider } from '@/components/ui/tooltip';
// LenisProvider removed from root — Lenis + GSAP (~130 KB) was loading on every page
// including dashboard, admin, and settings where smooth scroll adds no value.
// Re-add LenisProvider to marketing pages only if needed (e.g., app/(marketing)/layout.tsx).

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR/SSG, render children without providers to avoid hydration issues
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <AuthProvider>
        <TooltipProvider delayDuration={300}>
          {children}
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
