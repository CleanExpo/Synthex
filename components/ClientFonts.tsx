'use client';

import { useEffect } from 'react';

/**
 * ClientFonts — asynchronous font loader.
 *
 * Injects the Fontshare stylesheet after hydration so it never blocks the
 * critical rendering path. The guard prevents double-injection on hot reloads.
 *
 * Upgrade path: once woff2 files are placed in public/fonts/, switch to
 * next/font/local and delete this component.
 */
export function ClientFonts() {
  useEffect(() => {
    if (document.querySelector('link[data-font="satoshi"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.setAttribute('data-font', 'satoshi');
    link.href =
      'https://api.fontshare.com/v2/css?f[]=satoshi@900,700,500,400&display=swap';
    document.head.appendChild(link);
  }, []);

  return null;
}
