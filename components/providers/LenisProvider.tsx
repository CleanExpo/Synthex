'use client';

// Lenis CSS is included in globals.css
import { createContext, useContext, useEffect, useState } from 'react';
import type Lenis from 'lenis';

interface LenisContextValue {
  lenis: Lenis | null;
}

const LenisContext = createContext<LenisContextValue>({ lenis: null });

export function useLenis() {
  return useContext(LenisContext);
}

export function LenisProvider({ children }: { children: React.ReactNode }) {
  const [lenis, setLenis] = useState<Lenis | null>(null);

  useEffect(() => {
    let cleanupFn: (() => void) | undefined;

    async function init() {
      const [LenisModule, gsapModule, ScrollTriggerModule] = await Promise.all([
        import('lenis'),
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);

      const LenisClass = LenisModule.default;
      const gsap = gsapModule.default;
      const { ScrollTrigger } = ScrollTriggerModule;

      gsap.registerPlugin(ScrollTrigger);

      const lenis = new LenisClass({
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 2,
      });

      setLenis(lenis);

      // Keep ScrollTrigger in sync with Lenis scroll position
      lenis.on('scroll', () => ScrollTrigger.update());

      // Prevent large lag spikes from breaking animations
      gsap.ticker.lagSmoothing(0);

      // Drive Lenis with GSAP ticker for frame-perfect sync
      const tickerCallback = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tickerCallback);

      cleanupFn = () => {
        gsap.ticker.remove(tickerCallback);
        lenis.destroy();
        setLenis(null);
      };
    }

    init().catch(console.error);

    return () => cleanupFn?.();
  }, []);

  return (
    <LenisContext.Provider value={{ lenis }}>
      {children}
    </LenisContext.Provider>
  );
}
