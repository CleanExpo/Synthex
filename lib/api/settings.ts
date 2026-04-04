/**
 * Settings API Client
 *
 * Client-side functions for profile, settings, integrations, and billing.
 *
 * AUTH: Uses `credentials: 'include'` so the httpOnly `auth-token` cookie
 * is sent automatically. The server-side routes extract the user ID from
 * that cookie via `getUserIdFromRequestOrCookies()`.
 *
 * CSRF: Mutation calls (POST/PUT/DELETE) use `fetchWithCSRF` to include
 * the X-CSRF-Token header for double-submit token defense-in-depth.
 *
 * This approach works for BOTH:
 *   - Google OAuth users (custom auth-token JWT)
 *   - Email/password users (Supabase Auth session cookies)
 */

import { fetchWithCSRF } from '@/lib/csrf';

/** Profile update data */
interface ProfileUpdateData {
  name?: string;
  avatar?: string;
  bio?: string;
  location?: string;
  website?: string;
  company?: string;
  role?: string;
  phone?: string;
  social_links?: Record<string, string>;
  [key: string]: string | Record<string, string> | undefined;
}

/** Settings update data - can be an object or a primitive value */
type SettingsData = Record<string, unknown> | string | boolean | number;

// Profile API functions
export const profileAPI = {
  async getProfile() {
    const response = await fetch('/api/user/profile', {
      credentials: 'include',
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch profile');
    }

    return response.json();
  },

  async updateProfile(data: ProfileUpdateData) {
    const response = await fetchWithCSRF('/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update profile');
    }

    return response.json();
  },

  async uploadAvatar(file: File) {
    const formData = new FormData();
    formData.append('avatar', file);

    const response = await fetchWithCSRF('/api/user/avatar', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to upload avatar');
    }

    return response.json();
  },

  async deleteAvatar() {
    const response = await fetchWithCSRF('/api/user/avatar', {
      method: 'DELETE',
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete avatar');
    }

    return response.json();
  },
};

// Settings API functions
export const settingsAPI = {
  async getSettings() {
    const response = await fetch('/api/user/settings', {
      credentials: 'include',
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch settings');
    }

    return response.json();
  },

  async updateSettings(type: string, settings: SettingsData) {
    const response = await fetchWithCSRF('/api/user/settings', {
      method: 'PUT',
      body: JSON.stringify({ type, settings }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update settings');
    }

    return response.json();
  },
};

// Integrations API functions
export const integrationsAPI = {
  async getIntegrations() {
    const response = await fetch('/api/integrations', {
      credentials: 'include',
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch integrations');
    }

    return response.json();
  },

  async connectPlatform(platform: string) {
    // Get OAuth URL
    const response = await fetch(`/api/auth/oauth/${platform}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to initiate OAuth');
    }

    const data = await response.json();

    // Platforms that need full-page redirect instead of popup
    // (Reddit's OAuth page blocks popup navigation in some browsers/environments)
    const REDIRECT_PLATFORMS = new Set(['reddit']);
    if (REDIRECT_PLATFORMS.has(platform)) {
      window.location.href = data.authorizationUrl;
      // Page navigates away — promise intentionally never resolves
      return new Promise<{ success: boolean; platform: string }>(() => {});
    }

    // Open OAuth window
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const authWindow = window.open(
      data.authorizationUrl,
      `${platform}_oauth`,
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );

    if (!authWindow) {
      throw new Error('Popup was blocked. Please allow popups for this site and try again.');
    }

    // Wait for postMessage from callback or popup close
    return new Promise<{ success: boolean; platform: string }>((resolve, reject) => {
      let resolved = false;

      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === 'oauth-success' && event.data?.platform === platform) {
          resolved = true;
          cleanup();
          resolve({ success: true, platform });
        }
        if (event.data?.type === 'oauth-error' && event.data?.platform === platform) {
          resolved = true;
          cleanup();
          reject(new Error(event.data.error || `Failed to connect to ${platform}`));
        }
      };

      window.addEventListener('message', handleMessage);

      // Also poll for popup close as fallback (user closes window manually)
      const checkInterval = setInterval(() => {
        if (authWindow.closed && !resolved) {
          cleanup();
          // Popup closed without success message — check integrations anyway
          // (in case postMessage was missed due to timing)
          this.getIntegrations()
            .then((intData: { integrations?: Record<string, boolean> }) => {
              if (intData.integrations?.[platform]) {
                resolve({ success: true, platform });
              } else {
                reject(new Error(`Connection to ${platform} was cancelled or failed.`));
              }
            })
            .catch(() => reject(new Error(`Failed to verify ${platform} connection.`)));
        }
      }, 1000);

      // Timeout after 5 minutes
      const timeout = setTimeout(() => {
        if (!resolved) {
          cleanup();
          reject(new Error(`Connection to ${platform} timed out. Please try again.`));
        }
      }, 5 * 60 * 1000);

      function cleanup() {
        window.removeEventListener('message', handleMessage);
        clearInterval(checkInterval);
        clearTimeout(timeout);
      }
    });
  },

  async disconnectPlatform(platform: string) {
    const response = await fetchWithCSRF(`/api/integrations?platform=${platform}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to disconnect platform');
    }

    return response.json();
  },
};

// Billing API functions (placeholder for Stripe integration)
export const billingAPI = {
  async getSubscription() {
    // This would connect to Stripe API
    return {
      plan: 'pro',
      price: 49,
      status: 'active',
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };
  },

  async updatePaymentMethod(paymentMethodId: string) {
    // This would update Stripe payment method
    return { success: true };
  },

  async cancelSubscription() {
    // This would cancel Stripe subscription
    return { success: true };
  },

  async upgradePlan(planId: string) {
    // This would upgrade Stripe subscription
    return { success: true };
  },
};
