import { supabase } from '@/lib/supabase-client';

// Profile API functions
export const profileAPI = {
  async getProfile() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No session');

    const response = await fetch('/api/user/profile', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch profile');
    }

    return response.json();
  },

  async updateProfile(data: any) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No session');

    const response = await fetch('/api/user/profile', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to update profile');
    }

    return response.json();
  },

  async uploadAvatar(file: File) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No session');

    const formData = new FormData();
    formData.append('avatar', file);

    const response = await fetch('/api/user/avatar', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload avatar');
    }

    return response.json();
  },

  async deleteAvatar() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No session');

    const response = await fetch('/api/user/avatar', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete avatar');
    }

    return response.json();
  },
};

// Settings API functions
export const settingsAPI = {
  async getSettings() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No session');

    const response = await fetch('/api/user/settings', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch settings');
    }

    return response.json();
  },

  async updateSettings(type: string, settings: any) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No session');

    const response = await fetch('/api/user/settings', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type, settings }),
    });

    if (!response.ok) {
      throw new Error('Failed to update settings');
    }

    return response.json();
  },
};

// Integrations API functions
export const integrationsAPI = {
  async getIntegrations() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No session');

    const response = await fetch('/api/integrations', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch integrations');
    }

    return response.json();
  },

  async connectPlatform(platform: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No session');

    // Get OAuth URL
    const response = await fetch(`/api/auth/oauth/${platform}`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to initiate OAuth');
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
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No session');

    const response = await fetch(`/api/integrations?platform=${platform}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to disconnect platform');
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