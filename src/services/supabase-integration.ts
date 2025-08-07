/**
 * Supabase Integration Service
 * Connects the application to Supabase for data persistence and real-time features
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { marketingOrchestrator } from '../agents/marketing-orchestrator';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Public client for frontend operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Service client for backend operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Database Schema Interfaces
 */
export interface DBUser {
  id: string;
  email: string;
  name: string;
  company?: string;
  role: 'admin' | 'manager' | 'user';
  subscription_tier: 'free' | 'starter' | 'professional' | 'enterprise';
  created_at: Date;
  updated_at: Date;
  settings: Record<string, any>;
}

export interface DBCampaign {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  platforms: string[];
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  objectives: string[];
  budget_total: number;
  budget_spent: number;
  start_date: Date;
  end_date?: Date;
  target_audience: Record<string, any>;
  content_strategy: Record<string, any>;
  performance_metrics: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface DBPost {
  id: string;
  campaign_id: string;
  platform: string;
  content_type: 'text' | 'image' | 'video' | 'carousel' | 'story';
  content: {
    text?: string;
    media_urls?: string[];
    hashtags?: string[];
    mentions?: string[];
  };
  scheduled_at?: Date;
  published_at?: Date;
  platform_post_id?: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  metrics: {
    impressions?: number;
    reach?: number;
    engagement?: number;
    clicks?: number;
    conversions?: number;
  };
  created_at: Date;
  updated_at: Date;
}

export interface DBAnalytics {
  id: string;
  campaign_id?: string;
  post_id?: string;
  platform: string;
  metric_type: string;
  value: number;
  recorded_at: Date;
  metadata?: Record<string, any>;
}

export interface DBAgentTask {
  id: string;
  agent_type: string;
  task_type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  payload: Record<string, any>;
  result?: Record<string, any>;
  error?: string;
  created_at: Date;
  started_at?: Date;
  completed_at?: Date;
}

/**
 * Supabase Service Class
 */
export class SupabaseService {
  private client: SupabaseClient;
  private adminClient: SupabaseClient;

  constructor() {
    this.client = supabase;
    this.adminClient = supabaseAdmin;
    this.initializeRealtimeSubscriptions();
  }

  /**
   * Initialize real-time subscriptions
   */
  private initializeRealtimeSubscriptions(): void {
    // Subscribe to campaign changes
    this.client
      .channel('campaigns')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'campaigns'
      }, (payload) => {
        this.handleCampaignChange(payload);
      })
      .subscribe();

    // Subscribe to post changes
    this.client
      .channel('posts')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'posts'
      }, (payload) => {
        this.handlePostChange(payload);
      })
      .subscribe();

    // Subscribe to analytics updates
    this.client
      .channel('analytics')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'analytics'
      }, (payload) => {
        this.handleAnalyticsUpdate(payload);
      })
      .subscribe();
  }

  /**
   * User Management
   */
  async createUser(userData: Partial<DBUser>): Promise<DBUser> {
    const { data, error } = await this.adminClient
      .from('users')
      .insert(userData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getUser(userId: string): Promise<DBUser | null> {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  }

  async updateUser(userId: string, updates: Partial<DBUser>): Promise<DBUser> {
    const { data, error } = await this.client
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Campaign Management
   */
  async createCampaign(campaignData: Partial<DBCampaign>): Promise<DBCampaign> {
    const { data, error } = await this.client
      .from('campaigns')
      .insert(campaignData)
      .select()
      .single();

    if (error) throw error;

    // Notify orchestrator about new campaign
    marketingOrchestrator.launchCampaign({
      id: data.id,
      name: data.name,
      platforms: data.platforms,
      objectives: data.objectives,
      budget: data.budget_total,
      startDate: new Date(data.start_date),
      endDate: data.end_date ? new Date(data.end_date) : new Date(),
      targetAudience: data.target_audience,
      content: data.content_strategy,
      status: data.status
    });

    return data;
  }

  async getCampaigns(userId: string): Promise<DBCampaign[]> {
    const { data, error } = await this.client
      .from('campaigns')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async updateCampaign(campaignId: string, updates: Partial<DBCampaign>): Promise<DBCampaign> {
    const { data, error } = await this.client
      .from('campaigns')
      .update(updates)
      .eq('id', campaignId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteCampaign(campaignId: string): Promise<void> {
    const { error } = await this.client
      .from('campaigns')
      .delete()
      .eq('id', campaignId);

    if (error) throw error;
  }

  /**
   * Post Management
   */
  async createPost(postData: Partial<DBPost>): Promise<DBPost> {
    const { data, error } = await this.client
      .from('posts')
      .insert(postData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getPosts(campaignId: string): Promise<DBPost[]> {
    const { data, error } = await this.client
      .from('posts')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('scheduled_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async updatePost(postId: string, updates: Partial<DBPost>): Promise<DBPost> {
    const { data, error } = await this.client
      .from('posts')
      .update(updates)
      .eq('id', postId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async schedulePost(postData: Partial<DBPost>): Promise<DBPost> {
    postData.status = 'scheduled';
    return await this.createPost(postData);
  }

  /**
   * Analytics Management
   */
  async recordAnalytics(analyticsData: Partial<DBAnalytics>): Promise<void> {
    const { error } = await this.client
      .from('analytics')
      .insert(analyticsData);

    if (error) throw error;
  }

  async getAnalytics(filters: {
    campaign_id?: string;
    post_id?: string;
    platform?: string;
    start_date?: Date;
    end_date?: Date;
  }): Promise<DBAnalytics[]> {
    let query = this.client.from('analytics').select('*');

    if (filters.campaign_id) {
      query = query.eq('campaign_id', filters.campaign_id);
    }
    if (filters.post_id) {
      query = query.eq('post_id', filters.post_id);
    }
    if (filters.platform) {
      query = query.eq('platform', filters.platform);
    }
    if (filters.start_date) {
      query = query.gte('recorded_at', filters.start_date.toISOString());
    }
    if (filters.end_date) {
      query = query.lte('recorded_at', filters.end_date.toISOString());
    }

    const { data, error } = await query.order('recorded_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getAggregatedAnalytics(campaignId: string): Promise<any> {
    const { data, error } = await this.client
      .rpc('get_campaign_analytics', { campaign_id: campaignId });

    if (error) throw error;
    return data;
  }

  /**
   * Agent Task Management
   */
  async createAgentTask(taskData: Partial<DBAgentTask>): Promise<DBAgentTask> {
    const { data, error } = await this.client
      .from('agent_tasks')
      .insert(taskData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getAgentTasks(filters: {
    agent_type?: string;
    status?: string;
    priority?: string;
  }): Promise<DBAgentTask[]> {
    let query = this.client.from('agent_tasks').select('*');

    if (filters.agent_type) {
      query = query.eq('agent_type', filters.agent_type);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.priority) {
      query = query.eq('priority', filters.priority);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async updateAgentTask(taskId: string, updates: Partial<DBAgentTask>): Promise<DBAgentTask> {
    const { data, error } = await this.client
      .from('agent_tasks')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * AI Content Generation
   */
  async generateContent(
    platform: string,
    prompt: string,
    campaignId?: string
  ): Promise<any> {
    // Use the marketing orchestrator to generate content
    const content = await marketingOrchestrator.generateContent(platform, prompt, {
      campaignId
    });

    // Store generated content
    if (campaignId) {
      await this.createPost({
        campaign_id: campaignId,
        platform,
        content_type: 'text',
        content: {
          text: content.content.text,
          hashtags: content.content.hashtags
        },
        status: 'draft'
      });
    }

    return content;
  }

  /**
   * Campaign Analytics
   */
  async analyzeCampaign(campaignId: string): Promise<any> {
    // Get analysis from orchestrator
    const analysis = await marketingOrchestrator.analyzeCampaign(campaignId);

    // Store analysis results
    await this.recordAnalytics({
      campaign_id: campaignId,
      platform: 'all',
      metric_type: 'analysis',
      value: analysis.analysis.roi,
      metadata: analysis
    });

    return analysis;
  }

  /**
   * Budget Optimization
   */
  async optimizeBudget(campaignId: string): Promise<any> {
    // Get campaign details
    const { data: campaign } = await this.client
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (!campaign) throw new Error('Campaign not found');

    // Optimize budget using orchestrator
    const optimization = await marketingOrchestrator.optimizeBudget(
      campaignId,
      campaign.budget_total - campaign.budget_spent
    );

    // Update campaign with new budget allocation
    await this.updateCampaign(campaignId, {
      performance_metrics: {
        ...campaign.performance_metrics,
        budget_allocation: optimization.newAllocation
      }
    });

    return optimization;
  }

  /**
   * Competitive Intelligence
   */
  async getCompetitiveIntelligence(competitors: string[]): Promise<any> {
    const intelligence = await marketingOrchestrator.getCompetitiveIntelligence(competitors);

    // Store intelligence data
    for (const [competitor, data] of Object.entries(intelligence)) {
      await this.client
        .from('competitive_intelligence')
        .upsert({
          competitor_name: competitor,
          data,
          updated_at: new Date()
        });
    }

    return intelligence;
  }

  /**
   * Real-time event handlers
   */
  private handleCampaignChange(payload: any): void {
    console.log('Campaign changed:', payload);
    
    // Notify relevant agents about campaign changes
    if (payload.eventType === 'UPDATE' && payload.new.status === 'active') {
      marketingOrchestrator.emit('campaign-activated', payload.new);
    }
  }

  private handlePostChange(payload: any): void {
    console.log('Post changed:', payload);
    
    // Handle scheduled posts
    if (payload.eventType === 'INSERT' && payload.new.status === 'scheduled') {
      // Schedule publication
      this.schedulePublication(payload.new);
    }
  }

  private handleAnalyticsUpdate(payload: any): void {
    console.log('Analytics updated:', payload);
    
    // Trigger real-time dashboard updates
    marketingOrchestrator.emit('analytics-update', payload.new);
  }

  /**
   * Schedule post publication
   */
  private async schedulePublication(post: DBPost): Promise<void> {
    if (!post.scheduled_at) return;

    const delay = new Date(post.scheduled_at).getTime() - Date.now();
    
    if (delay > 0) {
      setTimeout(async () => {
        try {
          // Publish through platform agent
          const result = await marketingOrchestrator.platformAgents
            .get(post.platform)
            ?.publishPost(post);

          // Update post status
          await this.updatePost(post.id, {
            status: 'published',
            published_at: new Date(),
            platform_post_id: result.postId
          });
        } catch (error) {
          console.error('Failed to publish post:', error);
          await this.updatePost(post.id, {
            status: 'failed',
            metrics: { ...post.metrics, error: String(error) }
          });
        }
      }, delay);
    }
  }

  /**
   * Authentication helpers
   */
  async signUp(email: string, password: string, metadata?: any): Promise<any> {
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    });

    if (error) throw error;

    // Create user profile
    if (data.user) {
      await this.createUser({
        id: data.user.id,
        email,
        name: metadata?.name || email.split('@')[0],
        role: 'user',
        subscription_tier: 'free'
      });
    }

    return data;
  }

  async signIn(email: string, password: string): Promise<any> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    return data;
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) throw error;
  }

  async getSession(): Promise<any> {
    const { data } = await this.client.auth.getSession();
    return data.session;
  }

  async getAuthUser(): Promise<any> {
    const { data } = await this.client.auth.getUser();
    return data.user;
  }
}

// Export singleton instance
export const supabaseService = new SupabaseService();