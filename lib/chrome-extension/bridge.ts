/**
 * Chrome Extension Bridge
 *
 * Communication layer between the Synthex web app and the Synthex
 * Chrome Extension. Uses window.postMessage for same-window messaging
 * (content script injects the pong handler).
 *
 * All methods are safe to call even when the extension is not installed —
 * they resolve with null / empty arrays rather than throwing.
 *
 * Message protocol:
 *   App  → Extension: window.postMessage({ type: 'SYNTHEX_EXTENSION_*' }, '*')
 *   Ext  → App:       window.postMessage({ type: 'SYNTHEX_EXTENSION_*', ...data }, '*')
 *
 * @module lib/chrome-extension/bridge
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ExtensionCapabilities {
  available: boolean;
  version?: string;
  currentTabUrl?: string;
  /** Platforms the browser session is logged into (extension-detected) */
  loggedInPlatforms?: string[];
}

export interface ExtensionSocialDetection {
  platform: string;
  loggedIn: boolean;
  /** Username / page name if the extension could read it from the DOM */
  username?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** How long to wait for the extension to respond before assuming not installed */
const PING_TIMEOUT_MS = 800;

/** Supported platforms for login detection */
export const DETECTABLE_PLATFORMS = [
  'instagram',
  'facebook',
  'twitter',
  'linkedin',
  'tiktok',
  'youtube',
  'pinterest',
  'reddit',
  'threads',
] as const;

// ============================================================================
// BRIDGE
// ============================================================================

/**
 * Check if the Synthex Chrome Extension is installed and available.
 * Resolves with extension capabilities, or { available: false } if not found.
 */
export function checkExtensionAvailability(): Promise<ExtensionCapabilities> {
  // SSR guard
  if (typeof window === 'undefined') {
    return Promise.resolve({ available: false });
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve({ available: false });
    }, PING_TIMEOUT_MS);

    function handler(event: MessageEvent) {
      if (
        event.source !== window ||
        event.data?.type !== 'SYNTHEX_EXTENSION_PONG'
      ) {
        return;
      }

      clearTimeout(timeout);
      window.removeEventListener('message', handler);

      resolve({
        available: true,
        version: event.data.version as string | undefined,
        currentTabUrl: event.data.currentTabUrl as string | undefined,
        loggedInPlatforms: (event.data.loggedInPlatforms as string[] | undefined) ?? [],
      });
    }

    window.addEventListener('message', handler);
    window.postMessage({ type: 'SYNTHEX_EXTENSION_PING' }, '*');
  });
}

/**
 * Ask the extension which social platforms the user is currently logged into.
 * Returns an empty array if the extension is not available.
 */
export function detectLoggedInPlatforms(): Promise<ExtensionSocialDetection[]> {
  if (typeof window === 'undefined') {
    return Promise.resolve([]);
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve([]);
    }, PING_TIMEOUT_MS * 2); // Allow extra time for platform checks

    function handler(event: MessageEvent) {
      if (
        event.source !== window ||
        event.data?.type !== 'SYNTHEX_EXTENSION_SOCIAL_RESULT'
      ) {
        return;
      }

      clearTimeout(timeout);
      window.removeEventListener('message', handler);

      const platforms = (event.data.platforms as ExtensionSocialDetection[] | undefined) ?? [];
      resolve(platforms);
    }

    window.addEventListener('message', handler);
    window.postMessage({ type: 'SYNTHEX_EXTENSION_DETECT_SOCIAL' }, '*');
  });
}

/**
 * Request the current browser tab URL from the extension.
 * Returns null if the extension is not available.
 */
export function getCurrentTabUrl(): Promise<string | null> {
  if (typeof window === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve(null);
    }, PING_TIMEOUT_MS);

    function handler(event: MessageEvent) {
      if (
        event.source !== window ||
        event.data?.type !== 'SYNTHEX_EXTENSION_TAB_URL'
      ) {
        return;
      }

      clearTimeout(timeout);
      window.removeEventListener('message', handler);
      resolve((event.data.url as string | undefined) ?? null);
    }

    window.addEventListener('message', handler);
    window.postMessage({ type: 'SYNTHEX_EXTENSION_GET_TAB_URL' }, '*');
  });
}

/**
 * Notify the extension that an OAuth flow is starting for a platform.
 * The extension can use this to assist (e.g. detect if user is already logged in).
 */
export function notifyOAuthStarting(platform: string): void {
  if (typeof window === 'undefined') return;
  window.postMessage(
    { type: 'SYNTHEX_EXTENSION_OAUTH_STARTING', platform },
    '*',
  );
}
