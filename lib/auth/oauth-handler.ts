/**
 * OAuth Handler for Social Login Integration
 * Provides a unified interface for OAuth authentication
 */

import toast from 'react-hot-toast';

interface OAuthProvider {
  name: string;
  icon?: any;
  platform: string;
}

export const oauthProviders: OAuthProvider[] = [
  { name: 'Google', platform: 'google' },
  { name: 'GitHub', platform: 'github' },
  { name: 'Twitter', platform: 'twitter' },
  { name: 'LinkedIn', platform: 'linkedin' },
  { name: 'Facebook', platform: 'facebook' },
];

/**
 * Initiates OAuth flow for a given provider
 */
export async function signInWithOAuth(provider: string) {
  try {
    // Check if we're in demo mode
    const isDemoMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                       process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://placeholder.supabase.co';
    
    if (isDemoMode) {
      toast.error(`${provider} login is not configured in demo mode. Please use demo@synthex.com / demo123`);
      return;
    }

    // Get current user email if logged in (for linking accounts)
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    
    // Call our OAuth API endpoint
    const response = await fetch(`/api/auth/oauth/${provider.toLowerCase()}${user?.email ? `?email=${user.email}` : ''}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(localStorage.getItem('authToken') ? {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        } : {})
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Failed to connect with ${provider}`);
    }

    const data = await response.json();
    
    if (data.authorizationUrl) {
      // Redirect to OAuth provider
      window.location.href = data.authorizationUrl;
    } else {
      throw new Error('No authorization URL received');
    }
  } catch (error: any) {
    console.error(`OAuth ${provider} error:`, error);
    
    // Provide helpful error messages
    if (error.message?.includes('not configured')) {
      toast.error(`${provider} login is not set up yet. Please use email/password or demo login.`);
    } else if (error.message?.includes('CLIENT_ID')) {
      toast.error(`${provider} OAuth is not configured. Contact support for assistance.`);
    } else {
      toast.error(error.message || `Failed to connect with ${provider}`);
    }
  }
}

/**
 * Handles OAuth callback after redirect
 */
export async function handleOAuthCallback(platform: string, code: string, state: string) {
  try {
    const response = await fetch(`/api/auth/oauth/${platform}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'OAuth callback failed');
    }

    const data = await response.json();
    
    if (data.success) {
      toast.success(`Successfully connected to ${platform}!`);
      
      // Redirect to dashboard or integrations page
      window.location.href = '/dashboard/integrations';
    } else {
      throw new Error(data.error || 'OAuth connection failed');
    }
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    toast.error(error.message || 'Failed to complete OAuth connection');
    
    // Redirect to login on error
    window.location.href = '/login';
  }
}

/**
 * Disconnects an OAuth provider
 */
export async function disconnectOAuth(platform: string) {
  try {
    const response = await fetch(`/api/integrations/${platform}/disconnect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to disconnect');
    }

    toast.success(`${platform} disconnected successfully`);
    return true;
  } catch (error: any) {
    console.error('Disconnect error:', error);
    toast.error(`Failed to disconnect ${platform}`);
    return false;
  }
}

/**
 * Checks if a provider is connected
 */
export async function isProviderConnected(platform: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/integrations/${platform}/status`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      }
    });

    if (!response.ok) return false;
    
    const data = await response.json();
    return data.connected === true;
  } catch {
    return false;
  }
}