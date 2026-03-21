/**
 * Direct Supabase Service
 * Alternative implementation without Prisma dependencies
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Create clients
export const supabase = createClient(supabaseUrl, supabaseKey);
export const supabaseAdmin = createClient(supabaseUrl, serviceKey);

/**
 * Direct database operations without Prisma
 */
export class DirectSupabaseService {
  /**
   * User operations
   */
  async createUser(email: string, password: string, metadata?: any) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata }
    });
    
    if (error) throw error;
    return data;
  }

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    return data;
  }

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  /**
   * Campaign operations
   */
  async createCampaign(campaign: any) {
    const { data, error } = await supabase
      .from('campaigns')
      .insert(campaign)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async getCampaigns(userId: string) {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  }

  async updateCampaign(id: string, updates: any) {
    const { data, error } = await supabase
      .from('campaigns')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  /**
   * Post operations
   */
  async createPost(post: any) {
    const { data, error } = await supabase
      .from('posts')
      .insert(post)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async getPosts(campaignId: string) {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('scheduled_at', { ascending: true });
    
    if (error) throw error;
    return data;
  }

  /**
   * Analytics operations
   */
  async recordAnalytics(analytics: any) {
    const { error } = await supabase
      .from('analytics')
      .insert(analytics);
    
    if (error) throw error;
  }

  async getAnalytics(filters: any) {
    let query = supabase.from('analytics').select('*');
    
    if (filters.campaign_id) {
      query = query.eq('campaign_id', filters.campaign_id);
    }
    if (filters.platform) {
      query = query.eq('platform', filters.platform);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  /**
   * Real-time subscriptions
   */
  subscribeToCampaigns(callback: (payload: any) => void) {
    return supabase
      .channel('campaigns-channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'campaigns' },
        callback
      )
      .subscribe();
  }

  subscribeToPosts(callback: (payload: any) => void) {
    return supabase
      .channel('posts-channel')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'posts' },
        callback
      )
      .subscribe();
  }

  /**
   * Initialize database schema
   */
  async initializeSchema() {
    // This would normally run the schema.sql file
    // For now, we'll check if tables exist
    const { data, error } = await supabase
      .from('campaigns')
      .select('id')
      .limit(1);
    
    if (error && error.code === '42P01') {
      console.log('Tables not found. Please run schema.sql in Supabase dashboard.');
      return false;
    }
    
    return true;
  }
}

export const directSupabase = new DirectSupabaseService();