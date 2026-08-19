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
  async getIntegrations(organizationId?: string | null) {
    const params = new URLSearchParams();
    if (organizationId) params.set('organizationId', organizationId);
    const url = params.size
      ? `/api/integrations?${params.toString()}`
      : '/api/integrations';

    const response = await fetch(url, {
      credentials: 'include',
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch integrations');
    }

    return response.json();
  },

  async connectPlatform(platform: string, organizationId?: string | null) {
    const params = new URLSearchParams();
    if (organizationId) params.set('organizationId', organizationId);

    // Get OAuth URL
    const response = await fetch(
      `/api/auth/oauth/${platform}?${params.toString()}`,
      {
        credentials: 'include',
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to initiate OAuth');
    }

    const data = await response.json();

    // Full-page redirect for ALL platforms. OAuth requires a full browser
    // navigation; the old popup + postMessage handshake hung silently whenever
    // the provider consent page errored or the popup was blocked — X/Twitter
    // could sit on "Connecting to twitter..." forever. This mirrors the working
    // redirect in hooks/use-social-connections.ts (and the prior Reddit branch,
    // whose behaviour is preserved here as a subset of "all platforms"). The
    // callback either redirects back to the dashboard or, when it lands with no
    // opener, its postMessage HTML falls through to a location redirect — so a
    // full-page navigation completes cleanly in every case.
    window.location.href = data.authorizationUrl;
    // Page navigates away — the promise intentionally never resolves so callers
    // don't run post-connect logic against a page that is already unloading.
    return new Promise<{ success: boolean; platform: string }>(() => {});
  },

  async disconnectPlatform(platform: string, organizationId?: string | null) {
    const params = new URLSearchParams({ platform });
    if (organizationId) params.set('organizationId', organizationId);
    const response = await fetchWithCSRF(
      `/api/integrations?${params.toString()}`,
      {
        method: 'DELETE',
      }
    );

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
