'use client';

import { useEffect } from 'react';
import { getConsentCookie } from '@/lib/cookie-consent';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

type GAWindow = Window & { __GA_LOADED__?: boolean };

function injectGA() {
  if (!GA_ID || (window as GAWindow).__GA_LOADED__) return;
  (window as GAWindow).__GA_LOADED__ = true;

  const script1 = document.createElement('script');
  script1.async = true;
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script1);

  const script2 = document.createElement('script');
  script2.innerHTML = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${GA_ID}');
  `;
  document.head.appendChild(script2);
}

export function GoogleAnalyticsLoader() {
  useEffect(() => {
    if (!GA_ID) return;

    if (getConsentCookie() === 'accepted') {
      injectGA();
    }

    const handler = () => injectGA();
    window.addEventListener('cookie-consent-accepted', handler);
    return () => window.removeEventListener('cookie-consent-accepted', handler);
  }, []);

  return null;
}
