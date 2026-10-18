/**
 * Client/Workspace Management Service
 *
 * @description Multi-client workspace management for marketing agencies
 *
 * NOT PROVISIONED: the clients, client_members, scheduled_posts and
 * user_settings tables this service was written against have no Prisma
 * model. Every operation throws ClientWorkspaceNotProvisionedError naming the
 * missing table instead of returning empty data or dropping a write.
 */

import {
  FEATURE_NOT_PROVISIONED,
  tableUnavailable,
} from '@/lib/api/not-provisioned';

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

/** Thrown by every client-workspace operation: its tables are not provisioned. */
export class ClientWorkspaceNotProvisionedError extends Error {
  readonly code = FEATURE_NOT_PROVISIONED;
  constructor(readonly table: string) {
    super(tableUnavailable(table).reason);
    this.name = 'ClientWorkspaceNotProvisionedError';
  }
}

function notProvisioned(table: string): never {
  throw new ClientWorkspaceNotProvisionedError(table);
}

class ClientManagementService {
  /**
   * Get all clients for an organization
   */
  async getClients(
    _organizationId: string,
    _options: {
      status?: 'active' | 'paused' | 'archived' | 'all';
      search?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ clients: Client[]; total: number }> {
    return notProvisioned('clients');
  }

  /**
   * Get a single client
   */
  async getClient(_clientId: string, _userId: string): Promise<Client | null> {
    return notProvisioned('clients');
  }

  /**
   * Create a new client
   */
  async createClient(
    _organizationId: string,
    _userId: string,
    _data: {
      name: string;
      domain?: string;
      industry?: string;
      timezone?: string;
      logo?: string;
      brandGuidelines?: Partial<BrandGuidelines>;
      settings?: Partial<ClientSettings>;
    }
  ): Promise<Client> {
    return notProvisioned('clients');
  }

  /**
   * Update a client
   */
  async updateClient(
    _clientId: string,
    _userId: string,
    _updates: Partial<{
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
    return notProvisioned('clients');
  }

  /**
   * Delete/archive a client
   */
  async archiveClient(_clientId: string, _userId: string): Promise<boolean> {
    return notProvisioned('clients');
  }

  // ==================== Member Management ====================

  /**
   * Get client members
   */
  async getMembers(
    _clientId: string,
    _userId: string
  ): Promise<WorkspaceMember[]> {
    return notProvisioned('client_members');
  }

  /**
   * Invite a member to client workspace
   */
  async inviteMember(
    _clientId: string,
    _inviterId: string,
    _inviteeEmail: string,
    _role: 'admin' | 'editor' | 'viewer',
    _permissions?: string[]
  ): Promise<{ inviteId: string; inviteLink: string }> {
    return notProvisioned('client_members');
  }

  /**
   * Update member role
   */
  async updateMember(
    _clientId: string,
    _memberId: string,
    _updaterId: string,
    _updates: { role?: 'admin' | 'editor' | 'viewer'; permissions?: string[] }
  ): Promise<WorkspaceMember | null> {
    return notProvisioned('client_members');
  }

  /**
   * Remove member from client
   */
  async removeMember(
    _clientId: string,
    _memberId: string,
    _removerId: string
  ): Promise<boolean> {
    return notProvisioned('client_members');
  }

  // ==================== Analytics ====================

  /**
   * Get client analytics summary
   */
  async getClientAnalytics(
    _clientId: string,
    _userId: string,
    _dateRange: { start: string; end: string }
  ): Promise<ClientAnalyticsSummary> {
    return notProvisioned('scheduled_posts');
  }

  // ==================== Workspace Switching ====================

  /**
   * Get user's active workspace/client
   */
  async getActiveWorkspace(_userId: string): Promise<Client | null> {
    return notProvisioned('client_members');
  }

  /**
   * Switch active workspace
   */
  async switchWorkspace(_userId: string, _clientId: string): Promise<boolean> {
    return notProvisioned('client_members');
  }
}

// Export singleton
export const clientManagement = new ClientManagementService();
