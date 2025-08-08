/**
 * Supabase Client Configuration
 * Handles database connection and authentication
 */

import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'X-Client-Info': 'synthex-marketing-platform'
    }
  }
});

// Database helper functions
export const db = {
  // User management
  users: {
    async getProfile(userId) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return data;
    },
    
    async updateProfile(userId, updates) {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    
    async createProfile(profile) {
      const { data, error } = await supabase
        .from('profiles')
        .insert(profile)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
  },
  
  // Content management
  content: {
    async saveOptimizedContent(userId, content) {
      const { data, error } = await supabase
        .from('optimized_content')
        .insert({
          user_id: userId,
          platform: content.platform,
          original_content: content.originalContent,
          optimized_content: content.optimizedContent,
          score: content.score,
          hashtags: content.hashtags,
          suggestions: content.suggestions,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    
    async getUserContent(userId, limit = 50) {
      const { data, error } = await supabase
        .from('optimized_content')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data;
    },
    
    async deleteContent(contentId, userId) {
      const { error } = await supabase
        .from('optimized_content')
        .delete()
        .eq('id', contentId)
        .eq('user_id', userId);
      
      if (error) throw error;
      return true;
    }
  },
  
  // Analytics
  analytics: {
    async trackOptimization(userId, platform, score) {
      const { data, error } = await supabase
        .from('analytics')
        .insert({
          user_id: userId,
          event_type: 'optimization',
          platform,
          score,
          timestamp: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    
    async getUserAnalytics(userId, days = 30) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const { data, error } = await supabase
        .from('analytics')
        .select('*')
        .eq('user_id', userId)
        .gte('timestamp', startDate.toISOString())
        .order('timestamp', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  },
  
  // Campaigns
  campaigns: {
    async createCampaign(userId, campaign) {
      const { data, error } = await supabase
        .from('campaigns')
        .insert({
          user_id: userId,
          ...campaign,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    
    async getUserCampaigns(userId) {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  }
};

// Auth helper functions
export const auth = {
  async signUp(email, password, metadata = {}) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    });
    
    if (error) throw error;
    return data;
  },
  
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    return data;
  },
  
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
  
  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  },
  
  async resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    
    if (error) throw error;
  },
  
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  }
};

// Real-time subscriptions
export const realtime = {
  subscribeToUserContent(userId, callback) {
    return supabase
      .channel(`user_content_${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'optimized_content',
        filter: `user_id=eq.${userId}`
      }, callback)
      .subscribe();
  },
  
  subscribeToAnalytics(userId, callback) {
    return supabase
      .channel(`user_analytics_${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'analytics',
        filter: `user_id=eq.${userId}`
      }, callback)
      .subscribe();
  },
  
  unsubscribe(subscription) {
    return supabase.removeChannel(subscription);
  }
};

// Storage helper
export const storage = {
  async uploadFile(bucket, path, file) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file);
    
    if (error) throw error;
    return data;
  },
  
  async getFileUrl(bucket, path) {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);
    
    return data.publicUrl;
  },
  
  async deleteFile(bucket, path) {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);
    
    if (error) throw error;
    return true;
  }
};

// Database connection test
export async function testDatabaseConnection() {
  try {
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    if (error) throw error;
    return { connected: true, message: 'Database connection successful' };
  } catch (error) {
    return { connected: false, message: error.message };
  }
}

// Export for browser usage
if (typeof window !== 'undefined') {
  window.synthexSupabase = { supabase, db, auth, realtime, storage, testDatabaseConnection };
}