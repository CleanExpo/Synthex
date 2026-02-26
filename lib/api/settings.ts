/**
 * Settings API Client
 *
 * Client-side functions for profile, settings, integrations, and billing.
 *
 * AUTH: Uses `credentials: 'include'` so the httpOnly `auth-token` cookie
 * is sent automatically. The server-side routes extract the user ID from
 * that cookie via `getUserIdFromRequestOrCookies()`.
 *
 * This approach works for BOTH:
 *   - Google OAuth users (custom auth-token JWT)
 *   - Email/password users (Supabase Auth session cookies)
 */

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
    const response = await fetch('/api/user/profile', {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
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

    const response = await fetch('/api/user/avatar', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to upload avatar');
    }

    return response.json();
  },

  async deleteAvatar() {
    const response = await fetch('/api/user/avatar', {
      method: 'DELETE',
      credentials: 'include',
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
    const response = await fetch('/api/user/settings', {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
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

    // Return a promise that resolves when OAuth is complete
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (authWindow?.closed) {
          clearInterval(checkInterval);
          // Check if connection was successful
          this.getIntegrations()
            .then(resolve)
            .catch(reject);
        }
      }, 1000);
    });
  },

  async disconnectPlatform(platform: string) {
    const response = await fetch(`/api/integrations?platform=${platform}`, {
      method: 'DELETE',
      credentials: 'include',
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
