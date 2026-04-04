'use client';

import { useEffect } from 'react';

/**
 * Registers the Next.js service worker (public/sw.js).
 * Mount once in app/layout.tsx — no UI rendered.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator))
      return;

    let registration: ServiceWorkerRegistration | null = null;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(reg => {
        registration = reg;

        // Prompt user when a new SW version is waiting
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;

          installing.addEventListener('statechange', () => {
            if (
              installing.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // A new version is ready — reload to activate
              // (silent auto-reload on next navigation is acceptable for a SaaS dashboard)
              installing.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(err => {
        // Non-fatal — app works without SW
        if (process.env.NODE_ENV === 'development') {
          console.warn('[SW] Registration failed:', err);
        }
      });

    return () => {
      // No cleanup needed — SW lifecycle is independent of React
    };
  }, []);

  return null;
}
