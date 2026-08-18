/**
 * Public-profile URL checks for LinkedIn and Facebook.
 */

import type { ProfilePlatform } from './types';

export type UrlValidation =
  | { ok: true; url: string }
  | { ok: false; error: string };

function hostnameOf(url: URL): string {
  return url.hostname.replace(/^www\./i, '').toLowerCase();
}

function isLinkedInHost(host: string): boolean {
  return host === 'linkedin.com' || host.endsWith('.linkedin.com');
}

function isFacebookHost(host: string): boolean {
  return (
    host === 'facebook.com' ||
    host === 'fb.com' ||
    host === 'm.facebook.com' ||
    host === 'web.facebook.com' ||
    host.endsWith('.facebook.com')
  );
}

/**
 * Confirm the URL belongs to the chosen platform and is a public profile/page.
 */
export function validateProfileUrl(
  platform: ProfilePlatform,
  raw: string
): UrlValidation {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return { ok: false, error: 'profileUrl must be a valid URL' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, error: 'profileUrl must use http or https' };
  }

  const host = hostnameOf(parsed);
  const path = parsed.pathname.toLowerCase();

  if (platform === 'linkedin') {
    if (!isLinkedInHost(host)) {
      return {
        ok: false,
        error: 'LinkedIn URLs must be on linkedin.com',
      };
    }
    const isProfile =
      path.includes('/in/') ||
      path.includes('/company/') ||
      path.includes('/school/') ||
      path.includes('/pub/');
    if (!isProfile) {
      return {
        ok: false,
        error:
          'LinkedIn URL must be a public profile (/in/), company, or school page',
      };
    }
  } else {
    if (!isFacebookHost(host)) {
      return {
        ok: false,
        error: 'Facebook URLs must be on facebook.com or fb.com',
      };
    }
    if (path === '/' || path === '') {
      return {
        ok: false,
        error: 'Facebook URL must point to a public page or profile',
      };
    }
  }

  return { ok: true, url: parsed.toString() };
}
