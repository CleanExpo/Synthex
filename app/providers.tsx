'use client';

import { ThemeProvider } from 'next-themes';
import { useState, useEffect } from 'react';
import { AuthProvider } from '@/hooks/useAuth';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LenisProvider } from '@/components/providers/LenisProvider';

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
    <LenisProvider>
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
    </LenisProvider>
  );
}
