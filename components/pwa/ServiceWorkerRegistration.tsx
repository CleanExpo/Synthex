'use client';

import { useEffect } from 'react';

function isLocalDevHost(): boolean {
  if (typeof window === 'undefined') return false;
  const { hostname } = window.location;
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.local')
  );
}

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const disableForDev =
      process.env.NODE_ENV === 'development' || isLocalDevHost();

    if (disableForDev) {
      const hadController = Boolean(navigator.serviceWorker.controller);
      void Promise.all([
        navigator.serviceWorker
          .getRegistrations()
          .then(regs => Promise.all(regs.map(reg => reg.unregister()))),
        caches
          .keys()
          .then(keys => Promise.all(keys.map(key => caches.delete(key)))),
      ]).then(() => {
        if (!hadController) return;
        if (sessionStorage.getItem('synthex-sw-dev-cleared') === '1') return;
        sessionStorage.setItem('synthex-sw-dev-cleared', '1');
        window.location.reload();
      });
      return;
    }

    void navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch(() => {});
  }, []);

  return null;
}
