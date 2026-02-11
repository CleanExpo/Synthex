/**
 * Supabase Client for Next.js App Router
 * Using the existing Supabase configuration
 */

import { createClient, RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

/** Persona data for creation/update */
export interface PersonaInput {
  name: string;
  description?: string;
  voice_tone?: string;
  target_audience?: string;
  platforms?: string[];
  brand_guidelines?: string;
  [key: string]: unknown;
}

/** Content data for creation/update */
export interface ContentInput {
  title?: string;
  body: string;
  platform?: string;
  persona_id?: string;
  status?: 'draft' | 'scheduled' | 'published';
  scheduled_at?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Campaign data for creation/update */
export interface CampaignInput {
  name: string;
  description?: string;
  platform?: string;
  start_date?: string;
  end_date?: string;
  status?: 'draft' | 'active' | 'paused' | 'completed';
  goals?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Viral pattern data for creation */
export interface PatternInput {
  platform: string;
  pattern_type: string;
  pattern_data: Record<string, unknown>;
  engagement_score: number;
}

/** Auth state change callback type */
type AuthChangeCallback = (event: AuthChangeEvent, session: Session | null) => void;

/** Realtime change callback type */
type RealtimeChangeCallback = (payload: RealtimePostgresChangesPayload<{ [key: string]: unknown }>) => void;

// Get environment variables with fallback for SSG
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

// Create Supabase client with proper session management
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'synthex-auth-token',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'X-Client-Info': 'synthex-platform',
    },
  },
});

// Auth helper functions
export const auth = {
  async signUp(email: string, password: string, name?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          created_at: new Date().toISOString(),
        },
      },
    });

    if (error) throw error;

    // Create profile after signup
    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          email: data.user.email,
          name,
          created_at: new Date().toISOString(),
        });

      if (profileError) console.error('Profile creation error:', profileError);
    }

    return data;
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  },

  async signInWithGoogle() {
    // Use custom OAuth route instead of Supabase OAuth
    // This redirects to our /api/auth/oauth/google which handles the full flow
    window.location.href = '/api/auth/oauth/google';
  },

  async signInWithGithub() {
    // Use custom OAuth route instead of Supabase OAuth
    // This redirects to our /api/auth/oauth/github which handles the full flow
    window.location.href = '/api/auth/oauth/github';
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getCurrentUser() {
    // Skip during SSG/SSR
    if (typeof window === 'undefined') {
      return null;
    }
    
    try {
      // First try to get the session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.warn('Session error:', sessionError);
      }
      
      // If we have a session, return the user
      if (session?.user) {
        return session.user;
      }
      
      // Otherwise try to get the user directly
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        console.warn('User fetch error:', error);
        return null;
      }
      
      return user;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  },

  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) throw error;
  },

  onAuthStateChange(callback: AuthChangeCallback) {
    return supabase.auth.onAuthStateChange(callback);
  },
};

// Database helper functions
export const db = {
  // Personas
  personas: {
    async create(userId: string, persona: PersonaInput) {
      const { data, error } = await supabase
        .from('personas')
        .insert({
          user_id: userId,
          ...persona,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async list(userId: string) {
      const { data, error } = await supabase
        .from('personas')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },

    async update(id: string, updates: Partial<PersonaInput>) {
      const { data, error } = await supabase
        .from('personas')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async delete(id: string) {
      const { error } = await supabase.from('personas').delete().eq('id', id);

      if (error) throw error;
      return true;
    },
  },

  // Content
  content: {
    async create(userId: string, content: ContentInput) {
      const { data, error } = await supabase
        .from('content')
        .insert({
          user_id: userId,
          ...content,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async list(userId: string, limit = 50) {
      const { data, error } = await supabase
        .from('content')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    },

    async update(id: string, updates: Partial<ContentInput>) {
      const { data, error } = await supabase
        .from('content')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async delete(id: string) {
      const { error } = await supabase.from('content').delete().eq('id', id);

      if (error) throw error;
      return true;
    },
  },

  // Viral Patterns
  patterns: {
    async list(platform?: string) {
      let query = supabase
        .from('viral_patterns')
        .select('*')
        .order('engagement_score', { ascending: false });

      if (platform) {
        query = query.eq('platform', platform);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },

    async create(pattern: PatternInput) {
      const { data, error } = await supabase
        .from('viral_patterns')
        .insert({
          ...pattern,
          discovered_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  },

  // Campaigns
  campaigns: {
    async create(userId: string, campaign: CampaignInput) {
      const { data, error } = await supabase
        .from('campaigns')
        .insert({
          user_id: userId,
          ...campaign,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async list(userId: string) {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },

    async update(id: string, updates: Partial<CampaignInput>) {
      const { data, error } = await supabase
        .from('campaigns')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async delete(id: string) {
      const { error } = await supabase.from('campaigns').delete().eq('id', id);

      if (error) throw error;
      return true;
    },
  },
};

// Real-time subscriptions
export const realtime = {
  subscribeToContent(userId: string, callback: RealtimeChangeCallback) {
    return supabase
      .channel(`content_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'content',
          filter: `user_id=eq.${userId}`,
        },
        callback
      )
      .subscribe();
  },

  subscribeToCampaigns(userId: string, callback: RealtimeChangeCallback) {
    return supabase
      .channel(`campaigns_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaigns',
          filter: `user_id=eq.${userId}`,
        },
        callback
      )
      .subscribe();
  },

  unsubscribe(subscription: RealtimeChannel) {
    return supabase.removeChannel(subscription);
  },
};

// Storage helper
export const storage = {
  async uploadFile(bucket: string, path: string, file: File) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file);

    if (error) throw error;
    return data;
  },

  async getFileUrl(bucket: string, path: string) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);

    return data.publicUrl;
  },

  async deleteFile(bucket: string, path: string) {
    const { error } = await supabase.storage.from(bucket).remove([path]);

    if (error) throw error;
    return true;
  },
};

// Test connection
export async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);
    if (error) throw error;
    return { connected: true, message: 'Database connection successful' };
  } catch (error: unknown) {
    return { connected: false, message: error instanceof Error ? error.message : String(error) };
  }
}