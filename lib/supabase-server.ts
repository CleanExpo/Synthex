/**
 * Supabase Server Client for Next.js App Router
 * Unified database client for server-side operations
 *
 * SECURITY: OAuth tokens (access_token, refresh_token) are encrypted at rest
 * using AES-256-GCM via lib/security/field-encryption.ts
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (SECRET)
 * - FIELD_ENCRYPTION_KEY: 32-byte hex key for token encryption (CRITICAL)
 */

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { encryptField, decryptFieldSafe } from '@/lib/security/field-encryption';

/** Campaign creation/update data */
export interface CampaignData {
  name?: string;
  description?: string;
  platform?: string;
  status?: 'draft' | 'active' | 'paused' | 'completed';
  start_date?: string;
  end_date?: string;
  settings?: Record<string, unknown>;
}

/** Post creation/update data */
export interface PostData {
  content?: string;
  media_urls?: string[];
  hashtags?: string[];
  status?: 'draft' | 'scheduled' | 'published' | 'failed';
  scheduled_at?: string;
  platform?: string;
}

/** Post update data */
export interface PostUpdateData {
  content?: string;
  status?: 'draft' | 'scheduled' | 'published' | 'failed';
  published_at?: string;
  analytics?: Record<string, number>;
}

/** API usage tracking data */
export interface ApiUsageData {
  endpoint: string;
  method: string;
  tokens?: number;
  cost?: number;
  response_time_ms?: number;
  status_code?: number;
}

/** Platform connection data */
export interface PlatformConnectionData {
  platform: string;
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  account_id?: string;
  account_name?: string;
  is_active?: boolean;
  last_metrics?: Record<string, number>;
}

/** Platform connection update data */
export interface PlatformConnectionUpdateData {
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  is_active?: boolean;
  last_metrics?: Record<string, number>;
  last_sync_at?: string;
}

/** Audit log entry */
export interface AuditLogEntry {
  user_id?: string;
  action: string;
  resource_type?: string;
  resource?: string;
  resource_id?: string;
  outcome?: 'success' | 'failure';
  category?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  details?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
}

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
    async create(userId: string, campaign: CampaignData) {
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
    async create(campaignId: string, post: PostData) {
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

    async update(id: string, updates: PostUpdateData) {
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
    async track(userId: string, usage: ApiUsageData) {
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

  // Platform connections (tokens encrypted at rest)
  platformConnections: {
    async create(userId: string, connection: PlatformConnectionData) {
      const supabase = createServerClient();

      // Encrypt OAuth tokens before storing
      const encryptedConnection = {
        ...connection,
        access_token: connection.access_token
          ? encryptField(connection.access_token)
          : undefined,
        refresh_token: connection.refresh_token
          ? encryptField(connection.refresh_token)
          : undefined,
      };

      const { data, error } = await supabase
        .from('platform_connections')
        .insert({
          user_id: userId,
          ...encryptedConnection
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

      // Decrypt OAuth tokens before returning
      return (data || []).map((conn) => ({
        ...conn,
        access_token: decryptFieldSafe(conn.access_token),
        refresh_token: decryptFieldSafe(conn.refresh_token),
      }));
    },

    async update(id: string, updates: PlatformConnectionUpdateData) {
      const supabase = createServerClient();

      // Encrypt OAuth tokens if being updated
      const encryptedUpdates = {
        ...updates,
        access_token: updates.access_token
          ? encryptField(updates.access_token)
          : updates.access_token,
        refresh_token: updates.refresh_token
          ? encryptField(updates.refresh_token)
          : updates.refresh_token,
      };

      const { data, error } = await supabase
        .from('platform_connections')
        .update(encryptedUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  },

  // Audit logging
  audit: {
    async log(entry: AuditLogEntry) {
      const supabase = createServerClient();
      const { error } = await supabase
        .from('audit_logs')
        .insert({ id: crypto.randomUUID(), ...entry });

      if (error) {
        console.error('Failed to create audit log:', error);
      }
    }
  }
};