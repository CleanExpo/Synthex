'use client';

import { useState, useEffect } from 'react';
import {
  getConsentCookie,
  setConsentCookie,
  ConsentValue,
} from '@/lib/cookie-consent';

export interface UseCookieConsentReturn {
  status: ConsentValue | null;
  isLoading: boolean;
  accept: () => void;
  decline: () => void;
}

export function useCookieConsent(): UseCookieConsentReturn {
  const [status, setStatus] = useState<ConsentValue | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setStatus(getConsentCookie());
    setIsLoading(false);
  }, []);

  const accept = () => {
    setConsentCookie('accepted');
    setStatus('accepted');
    window.dispatchEvent(new CustomEvent('cookie-consent-accepted'));
  };

  const decline = () => {
    setConsentCookie('declined');
    setStatus('declined');
  };

  return { status, isLoading, accept, decline };
}
