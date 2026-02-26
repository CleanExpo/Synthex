/**
 * API Key Required (402) Response Interceptor
 *
 * Shows a toast notification when AI routes return 402 (API_KEY_REQUIRED).
 * Integrated into fetchWithCSRF and fetchWithAuth to provide global coverage.
 *
 * Debounced to prevent toast spam from multiple concurrent requests.
 */

'use client';

import toast from 'react-hot-toast';

let lastToastTime = 0;
const TOAST_COOLDOWN = 5000; // 5 seconds between toasts

/**
 * Handles 402 API_KEY_REQUIRED responses by showing a toast notification.
 * Debounced to prevent toast spam from multiple concurrent requests.
 */
export function handleApiKeyRequired(): void {
  const now = Date.now();
  if (now - lastToastTime < TOAST_COOLDOWN) return;
  lastToastTime = now;

  toast.error(
    'AI features require an API key. Add one in Settings \u2192 Integrations.',
    {
      id: 'api-key-required', // Prevents duplicate toasts
      duration: 8000,
    }
  );
}

/**
 * Checks a fetch Response for 402 status and triggers the API key prompt.
 * Returns true if 402 was detected, false otherwise.
 */
export function checkApiKeyRequired(response: Response): boolean {
  if (response.status === 402) {
    handleApiKeyRequired();
    return true;
  }
  return false;
}
