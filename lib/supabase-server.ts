/**
 * Supabase Server Client for Next.js App Router
 * Unified database client for server-side operations
 */

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Server-side Supabase client with service role key
export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }
  
  if (!supabaseServiceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Create client-side Supabase client for auth operations
export function createAuthClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }
  
  if (!supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

// Get authenticated user from cookies
export async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('supabase-auth-token');
  
  if (!token) return null;

  const supabase = createServerClient();
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token.value);
    if (error) throw error;
    return user;
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}

// Database helper functions for server-side use
export const serverDb = {
  // Campaigns
  campaigns: {
    async create(userId: string, campaign: any) {
      const supabase = createServerClient();
      const { data, error } = await supabase
        .from('campaigns')
        .insert({
          user_id: userId,
          ...campaign
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async list(userId: string) {
      const supabase = createServerClient();
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },

    async getStats(userId: string) {
      const supabase = createServerClient();
      
      // Get campaign count and recent campaigns
      const { data: campaigns, error: campaignsError } = await supabase
        .from('campaigns')
        .select('id, name, status, platform, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (campaignsError) throw campaignsError;

      // Get post counts
      const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select('id, status, campaign_id')
        .in('campaign_id', campaigns?.map(c => c.id) || []);

      if (postsError) throw postsError;

      const stats = {
        totalCampaigns: campaigns?.length || 0,
        activeCampaigns: campaigns?.filter(c => c.status === 'active').length || 0,
        draftCampaigns: campaigns?.filter(c => c.status === 'draft').length || 0,
        totalPosts: posts?.length || 0,
        publishedPosts: posts?.filter(p => p.status === 'published').length || 0,
        scheduledPosts: posts?.filter(p => p.status === 'scheduled').length || 0
      };

      return { campaigns, posts, stats };
    }
  },

  // Posts
  posts: {
    async create(campaignId: string, post: any) {
      const supabase = createServerClient();
      const { data, error } = await supabase
        .from('posts')
        .insert({
          campaign_id: campaignId,
          ...post
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async listByCampaign(campaignId: string) {
      const supabase = createServerClient();
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },

    async update(id: string, updates: any) {
      const supabase = createServerClient();
      const { data, error } = await supabase
        .from('posts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  },

  // API Usage tracking
  apiUsage: {
    async track(userId: string, usage: any) {
      const supabase = createServerClient();
      const { data, error } = await supabase
        .from('api_usage')
        .insert({
          user_id: userId,
          ...usage
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to track API usage:', error);
      }
      return data;
    },

    async getUsageStats(userId: string, days: number = 30) {
      const supabase = createServerClient();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('api_usage')
        .select('tokens, cost, created_at')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const totalTokens = data?.reduce((sum, item) => sum + (item.tokens || 0), 0) || 0;
      const totalCost = data?.reduce((sum, item) => sum + (item.cost || 0), 0) || 0;

      return {
        totalTokens,
        totalCost,
        usageCount: data?.length || 0,
        dailyUsage: data || []
      };
    }
  },

  // Platform connections
  platformConnections: {
    async create(userId: string, connection: any) {
      const supabase = createServerClient();
      const { data, error } = await supabase
        .from('platform_connections')
        .insert({
          user_id: userId,
          ...connection
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async list(userId: string) {
      const supabase = createServerClient();
      const { data, error } = await supabase
        .from('platform_connections')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },

    async update(id: string, updates: any) {
      const supabase = createServerClient();
      const { data, error } = await supabase
        .from('platform_connections')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  },

  // Audit logging
  audit: {
    async log(entry: any) {
      const supabase = createServerClient();
      const { error } = await supabase
        .from('audit_logs')
        .insert(entry);

      if (error) {
        console.error('Failed to create audit log:', error);
      }
    }
  }
};