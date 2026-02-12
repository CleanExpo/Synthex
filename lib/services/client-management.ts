/**
 * Client/Workspace Management Service
 *
 * @description Multi-client workspace management for marketing agencies
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase URL (PUBLIC)
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (SECRET)
 *
 * FAILURE MODE: Returns error response with details
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// Client types
export interface Client {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  domain?: string;
  logo?: string;
  industry?: string;
  timezone: string;
  brandGuidelines?: BrandGuidelines;
  whiteLabel?: WhiteLabelConfig;
  settings: ClientSettings;
  status: 'active' | 'paused' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface BrandGuidelines {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logo: string;
  fonts: {
    heading: string;
    body: string;
  };
  voiceTone: string;
  keywords: string[];
  competitors: string[];
  hashtags: string[];
}

export interface WhiteLabelConfig {
  enabled: boolean;
  customDomain?: string;
  logoUrl?: string;
  faviconUrl?: string;
  brandName?: string;
  primaryColor?: string;
  hideWatermark: boolean;
  customEmailDomain?: string;
}

export interface ClientSettings {
  approvalRequired: boolean;
  autoPublish: boolean;
  defaultPlatforms: string[];
  postingFrequency: {
    min: number;
    max: number;
    unit: 'day' | 'week' | 'month';
  };
  notifications: {
    email: boolean;
    slack?: string;
    discord?: string;
  };
  contentGuidelines: string;
  restrictedTopics: string[];
}

// Workspace member
export interface WorkspaceMember {
  id: string;
  userId: string;
  clientId: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  permissions: string[];
  invitedAt: string;
  acceptedAt?: string;
  status: 'pending' | 'active' | 'suspended';
}

// Client analytics summary
export interface ClientAnalyticsSummary {
  totalPosts: number;
  scheduledPosts: number;
  publishedPosts: number;
  totalEngagement: number;
  avgEngagementRate: number;
  totalReach: number;
  topPlatform: string;
  growthRate: number;
  lastActivity: string;
}

class ClientManagementService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Get all clients for an organization
   */
  async getClients(
    organizationId: string,
    options: {
      status?: 'active' | 'paused' | 'archived' | 'all';
      search?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ clients: Client[]; total: number }> {
    try {
      let query = this.supabase
        .from('clients')
        .select('*', { count: 'exact' })
        .eq('organization_id', organizationId);

      if (options.status && options.status !== 'all') {
        query = query.eq('status', options.status);
      }

      if (options.search) {
        query = query.or(`name.ilike.%${options.search}%,domain.ilike.%${options.search}%`);
      }

      query = query.order('name', { ascending: true });

      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        clients: (data || []).map(this.mapDbToClient),
        total: count || 0,
      };
    } catch (error: unknown) {
      logger.error('Failed to get clients:', { error, organizationId });
      throw error;
    }
  }

  /**
   * Get a single client
   */
  async getClient(clientId: string, userId: string): Promise<Client | null> {
    try {
      // Verify user has access to this client
      const hasAccess = await this.checkClientAccess(clientId, userId);
      if (!hasAccess) {
        return null;
      }

      const { data, error } = await this.supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (error || !data) return null;

      return this.mapDbToClient(data);
    } catch (error: unknown) {
      logger.error('Failed to get client:', { error, clientId });
      throw error;
    }
  }

  /**
   * Create a new client
   */
  async createClient(
    organizationId: string,
    userId: string,
    data: {
      name: string;
      domain?: string;
      industry?: string;
      timezone?: string;
      logo?: string;
      brandGuidelines?: Partial<BrandGuidelines>;
      settings?: Partial<ClientSettings>;
    }
  ): Promise<Client> {
    try {
      const slug = this.generateSlug(data.name);

      const defaultSettings: ClientSettings = {
        approvalRequired: true,
        autoPublish: false,
        defaultPlatforms: [],
        postingFrequency: { min: 1, max: 5, unit: 'day' },
        notifications: { email: true },
        contentGuidelines: '',
        restrictedTopics: [],
      };

      const { data: client, error } = await this.supabase
        .from('clients')
        .insert({
          organization_id: organizationId,
          name: data.name,
          slug,
          domain: data.domain,
          industry: data.industry,
          timezone: data.timezone || 'UTC',
          logo: data.logo,
          brand_guidelines: data.brandGuidelines || null,
          settings: { ...defaultSettings, ...data.settings },
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Add creator as owner
      await this.supabase.from('client_members').insert({
        client_id: client.id,
        user_id: userId,
        role: 'owner',
        permissions: ['*'],
        invited_at: new Date().toISOString(),
        accepted_at: new Date().toISOString(),
        status: 'active',
      });

      return this.mapDbToClient(client);
    } catch (error: unknown) {
      logger.error('Failed to create client:', { error, organizationId });
      throw error;
    }
  }

  /**
   * Update a client
   */
  async updateClient(
    clientId: string,
    userId: string,
    updates: Partial<{
      name: string;
      domain: string;
      industry: string;
      timezone: string;
      logo: string;
      brandGuidelines: BrandGuidelines;
      whiteLabel: WhiteLabelConfig;
      settings: ClientSettings;
      status: 'active' | 'paused' | 'archived';
    }>
  ): Promise<Client | null> {
    try {
      // Check permissions
      const hasAccess = await this.checkClientAccess(clientId, userId, ['admin', 'owner']);
      if (!hasAccess) {
        throw new Error('Insufficient permissions');
      }

      const dbUpdates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.name !== undefined) {
        dbUpdates.name = updates.name;
        dbUpdates.slug = this.generateSlug(updates.name);
      }
      if (updates.domain !== undefined) dbUpdates.domain = updates.domain;
      if (updates.industry !== undefined) dbUpdates.industry = updates.industry;
      if (updates.timezone !== undefined) dbUpdates.timezone = updates.timezone;
      if (updates.logo !== undefined) dbUpdates.logo = updates.logo;
      if (updates.brandGuidelines !== undefined) dbUpdates.brand_guidelines = updates.brandGuidelines;
      if (updates.whiteLabel !== undefined) dbUpdates.white_label = updates.whiteLabel;
      if (updates.settings !== undefined) dbUpdates.settings = updates.settings;
      if (updates.status !== undefined) dbUpdates.status = updates.status;

      const { data, error } = await this.supabase
        .from('clients')
        .update(dbUpdates)
        .eq('id', clientId)
        .select()
        .single();

      if (error) throw error;

      return this.mapDbToClient(data);
    } catch (error: unknown) {
      logger.error('Failed to update client:', { error, clientId });
      throw error;
    }
  }

  /**
   * Delete/archive a client
   */
  async archiveClient(clientId: string, userId: string): Promise<boolean> {
    try {
      const hasAccess = await this.checkClientAccess(clientId, userId, ['owner']);
      if (!hasAccess) {
        throw new Error('Only owner can archive client');
      }

      const { error } = await this.supabase
        .from('clients')
        .update({
          status: 'archived',
          updated_at: new Date().toISOString(),
        })
        .eq('id', clientId);

      if (error) throw error;

      return true;
    } catch (error: unknown) {
      logger.error('Failed to archive client:', { error, clientId });
      throw error;
    }
  }

  // ==================== Member Management ====================

  /**
   * Get client members
   */
  async getMembers(clientId: string, userId: string): Promise<WorkspaceMember[]> {
    try {
      const hasAccess = await this.checkClientAccess(clientId, userId);
      if (!hasAccess) {
        throw new Error('Access denied');
      }

      const { data, error } = await this.supabase
        .from('client_members')
        .select('*, users(email, name, avatar_url)')
        .eq('client_id', clientId)
        .order('role', { ascending: true });

      if (error) throw error;

      return (data || []).map(m => ({
        id: m.id,
        userId: m.user_id,
        clientId: m.client_id,
        role: m.role,
        permissions: m.permissions || [],
        invitedAt: m.invited_at,
        acceptedAt: m.accepted_at,
        status: m.status,
        user: m.users,
      }));
    } catch (error: unknown) {
      logger.error('Failed to get members:', { error, clientId });
      throw error;
    }
  }

  /**
   * Invite a member to client workspace
   */
  async inviteMember(
    clientId: string,
    inviterId: string,
    inviteeEmail: string,
    role: 'admin' | 'editor' | 'viewer',
    permissions?: string[]
  ): Promise<{ inviteId: string; inviteLink: string }> {
    try {
      const hasAccess = await this.checkClientAccess(clientId, inviterId, ['admin', 'owner']);
      if (!hasAccess) {
        throw new Error('Only admins can invite members');
      }

      // Find user by email or create invite token
      const { data: existingUser } = await this.supabase
        .from('users')
        .select('id')
        .eq('email', inviteeEmail)
        .single();

      const inviteToken = this.generateInviteToken();

      const { data: invite, error } = await this.supabase
        .from('client_members')
        .insert({
          client_id: clientId,
          user_id: existingUser?.id || null,
          email: existingUser ? null : inviteeEmail,
          role,
          permissions: permissions || this.getDefaultPermissions(role),
          invited_at: new Date().toISOString(),
          invite_token: existingUser ? null : inviteToken,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      const inviteLink = existingUser
        ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/clients/${clientId}`
        : `${process.env.NEXT_PUBLIC_APP_URL}/invite/${inviteToken}`;

      return {
        inviteId: invite.id,
        inviteLink,
      };
    } catch (error: unknown) {
      logger.error('Failed to invite member:', { error, clientId });
      throw error;
    }
  }

  /**
   * Update member role
   */
  async updateMember(
    clientId: string,
    memberId: string,
    updaterId: string,
    updates: { role?: 'admin' | 'editor' | 'viewer'; permissions?: string[] }
  ): Promise<WorkspaceMember | null> {
    try {
      const hasAccess = await this.checkClientAccess(clientId, updaterId, ['owner']);
      if (!hasAccess) {
        throw new Error('Only owner can update member roles');
      }

      const dbUpdates: Record<string, unknown> = {};
      if (updates.role) {
        dbUpdates.role = updates.role;
        dbUpdates.permissions = updates.permissions || this.getDefaultPermissions(updates.role);
      }
      if (updates.permissions && !updates.role) {
        dbUpdates.permissions = updates.permissions;
      }

      const { data, error } = await this.supabase
        .from('client_members')
        .update(dbUpdates)
        .eq('id', memberId)
        .eq('client_id', clientId)
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        userId: data.user_id,
        clientId: data.client_id,
        role: data.role,
        permissions: data.permissions || [],
        invitedAt: data.invited_at,
        acceptedAt: data.accepted_at,
        status: data.status,
      };
    } catch (error: unknown) {
      logger.error('Failed to update member:', { error, clientId, memberId });
      throw error;
    }
  }

  /**
   * Remove member from client
   */
  async removeMember(clientId: string, memberId: string, removerId: string): Promise<boolean> {
    try {
      const hasAccess = await this.checkClientAccess(clientId, removerId, ['admin', 'owner']);
      if (!hasAccess) {
        throw new Error('Only admins can remove members');
      }

      // Can't remove the owner
      const { data: member } = await this.supabase
        .from('client_members')
        .select('role')
        .eq('id', memberId)
        .single();

      if (member?.role === 'owner') {
        throw new Error('Cannot remove client owner');
      }

      const { error } = await this.supabase
        .from('client_members')
        .delete()
        .eq('id', memberId)
        .eq('client_id', clientId);

      if (error) throw error;

      return true;
    } catch (error: unknown) {
      logger.error('Failed to remove member:', { error, clientId, memberId });
      throw error;
    }
  }

  // ==================== Analytics ====================

  /**
   * Get client analytics summary
   */
  async getClientAnalytics(
    clientId: string,
    userId: string,
    dateRange: { start: string; end: string }
  ): Promise<ClientAnalyticsSummary> {
    try {
      const hasAccess = await this.checkClientAccess(clientId, userId);
      if (!hasAccess) {
        throw new Error('Access denied');
      }

      // Get posts stats
      const { data: posts, count: totalPosts } = await this.supabase
        .from('scheduled_posts')
        .select('status, analytics, platform, published_at', { count: 'exact' })
        .eq('client_id', clientId)
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end);

      const scheduledPosts = posts?.filter(p => p.status === 'scheduled').length || 0;
      const publishedPosts = posts?.filter(p => p.status === 'published').length || 0;

      let totalEngagement = 0;
      let totalImpressions = 0;
      let totalReach = 0;
      const platformCounts: Record<string, number> = {};

      for (const post of posts || []) {
        const analytics = post.analytics || {};
        totalEngagement += (analytics.likes || 0) + (analytics.comments || 0) + (analytics.shares || 0);
        totalImpressions += analytics.impressions || 0;
        totalReach += analytics.reach || 0;
        platformCounts[post.platform] = (platformCounts[post.platform] || 0) + 1;
      }

      const avgEngagementRate = totalImpressions > 0
        ? (totalEngagement / totalImpressions) * 100
        : 0;

      const topPlatform = Object.entries(platformCounts)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || 'none';

      // Calculate growth rate (compare to previous period)
      const periodLength = new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime();
      const prevStart = new Date(new Date(dateRange.start).getTime() - periodLength).toISOString();
      const prevEnd = dateRange.start;

      const { count: prevPosts } = await this.supabase
        .from('scheduled_posts')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .eq('status', 'published')
        .gte('published_at', prevStart)
        .lte('published_at', prevEnd);

      const growthRate = prevPosts && prevPosts > 0
        ? ((publishedPosts - prevPosts) / prevPosts) * 100
        : 0;

      // Get last activity
      const { data: lastPost } = await this.supabase
        .from('scheduled_posts')
        .select('created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return {
        totalPosts: totalPosts || 0,
        scheduledPosts,
        publishedPosts,
        totalEngagement,
        avgEngagementRate,
        totalReach,
        topPlatform,
        growthRate,
        lastActivity: lastPost?.created_at || '',
      };
    } catch (error: unknown) {
      logger.error('Failed to get client analytics:', { error, clientId });
      throw error;
    }
  }

  // ==================== Workspace Switching ====================

  /**
   * Get user's active workspace/client
   */
  async getActiveWorkspace(userId: string): Promise<Client | null> {
    try {
      const { data: userSettings } = await this.supabase
        .from('user_settings')
        .select('active_client_id')
        .eq('user_id', userId)
        .single();

      if (!userSettings?.active_client_id) {
        // Return first available client
        const { data: firstClient } = await this.supabase
          .from('client_members')
          .select('client_id')
          .eq('user_id', userId)
          .eq('status', 'active')
          .limit(1)
          .single();

        if (firstClient) {
          return this.getClient(firstClient.client_id, userId);
        }
        return null;
      }

      return this.getClient(userSettings.active_client_id, userId);
    } catch (error: unknown) {
      logger.error('Failed to get active workspace:', { error, userId });
      return null;
    }
  }

  /**
   * Switch active workspace
   */
  async switchWorkspace(userId: string, clientId: string): Promise<boolean> {
    try {
      const hasAccess = await this.checkClientAccess(clientId, userId);
      if (!hasAccess) {
        throw new Error('Access denied to this workspace');
      }

      await this.supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          active_client_id: clientId,
          updated_at: new Date().toISOString(),
        });

      return true;
    } catch (error: unknown) {
      logger.error('Failed to switch workspace:', { error, userId, clientId });
      throw error;
    }
  }

  // ==================== Private Methods ====================

  private async checkClientAccess(
    clientId: string,
    userId: string,
    allowedRoles?: string[]
  ): Promise<boolean> {
    const { data } = await this.supabase
      .from('client_members')
      .select('role')
      .eq('client_id', clientId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (!data) return false;
    if (!allowedRoles) return true;
    return allowedRoles.includes(data.role);
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  }

  private generateInviteToken(): string {
    return `inv_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private getDefaultPermissions(role: string): string[] {
    switch (role) {
      case 'owner':
        return ['*'];
      case 'admin':
        return ['posts:*', 'analytics:read', 'settings:read', 'members:read'];
      case 'editor':
        return ['posts:create', 'posts:edit', 'posts:read', 'analytics:read'];
      case 'viewer':
        return ['posts:read', 'analytics:read'];
      default:
        return ['posts:read'];
    }
  }

  private mapDbToClient(data: {
    id: string;
    organization_id: string;
    name: string;
    slug: string;
    domain?: string;
    logo?: string;
    industry?: string;
    timezone?: string;
    brand_guidelines?: BrandGuidelines;
    white_label?: WhiteLabelConfig;
    settings?: ClientSettings;
    status: 'active' | 'paused' | 'archived';
    created_at: string;
    updated_at: string;
  }): Client {
    const defaultSettings: ClientSettings = {
      approvalRequired: false,
      autoPublish: false,
      defaultPlatforms: [],
      postingFrequency: { min: 1, max: 5, unit: 'day' },
      notifications: { email: true },
      contentGuidelines: '',
      restrictedTopics: [],
    };

    return {
      id: data.id,
      organizationId: data.organization_id,
      name: data.name,
      slug: data.slug,
      domain: data.domain,
      logo: data.logo,
      industry: data.industry,
      timezone: data.timezone || 'UTC',
      brandGuidelines: data.brand_guidelines,
      whiteLabel: data.white_label,
      settings: data.settings || defaultSettings,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}

// Export singleton
export const clientManagement = new ClientManagementService();
