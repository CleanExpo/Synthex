export const CONSENT_COOKIE_NAME = 'cookie-consent';
export type ConsentValue = 'accepted' | 'declined';

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

export function getConsentCookie(): ConsentValue | null {
  if (typeof window === 'undefined') return null;
  const match = document.cookie
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith(`${CONSENT_COOKIE_NAME}=`));
  if (!match) return null;
  const value = match.split('=')[1];
  return value === 'accepted' || value === 'declined' ? value : null;
}

export function setConsentCookie(value: ConsentValue): void {
  if (typeof window === 'undefined') return;
  document.cookie = `${CONSENT_COOKIE_NAME}=${value}; max-age=${ONE_YEAR_SECONDS}; path=/; SameSite=Lax`;
}

export function hasConsentCookie(): boolean {
  return getConsentCookie() !== null;
}
