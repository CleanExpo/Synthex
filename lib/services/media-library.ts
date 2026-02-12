/**
 * Media Library Management Service
 *
 * @description Centralized management for all generated media assets
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase URL (PUBLIC)
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (SECRET)
 *
 * FAILURE MODE: Returns error response with details
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// Media asset types
export type MediaType = 'image' | 'video' | 'audio';
export type MediaStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type MediaProvider = 'stability' | 'dalle' | 'gemini' | 'runway' | 'synthesia' | 'd-id' | 'elevenlabs';

// Media asset interface
export interface MediaAsset {
  id: string;
  userId: string;
  type: MediaType;
  provider: MediaProvider;
  status: MediaStatus;
  url?: string;
  base64Data?: string;
  externalId?: string;
  prompt?: string;
  metadata: Record<string, unknown>;
  tags: string[];
  folderId?: string;
  isFavorite: boolean;
  isArchived: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

// Media folder interface
export interface MediaFolder {
  id: string;
  userId: string;
  name: string;
  parentId?: string;
  color?: string;
  icon?: string;
  assetCount: number;
  createdAt: string;
  updatedAt: string;
}

// Filter options
export interface MediaFilterOptions {
  type?: MediaType | MediaType[];
  provider?: MediaProvider | MediaProvider[];
  status?: MediaStatus;
  tags?: string[];
  folderId?: string | null;
  isFavorite?: boolean;
  isArchived?: boolean;
  search?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'usageCount' | 'name';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

// Upload options
export interface MediaUploadOptions {
  type: MediaType;
  provider: MediaProvider;
  base64Data?: string;
  url?: string;
  externalId?: string;
  prompt?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  folderId?: string;
}

// Batch operation result
export interface BatchOperationResult {
  success: boolean;
  processed: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

/** Database row for media asset */
interface MediaAssetRow {
  id: string;
  user_id: string;
  type: MediaType;
  provider: MediaProvider;
  status?: MediaStatus;
  url?: string;
  video_url?: string;
  base64_data?: string;
  external_id?: string;
  prompt?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  folder_id?: string;
  is_favorite?: boolean;
  is_archived?: boolean;
  usage_count?: number;
  created_at: string;
  updated_at?: string;
}

/** Database row for media folder */
interface MediaFolderRow {
  id: string;
  user_id: string;
  name: string;
  parent_id?: string;
  color?: string;
  icon?: string;
  asset_count?: number;
  created_at: string;
  updated_at?: string;
}

class MediaLibraryService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Get all media assets with filtering
   */
  async getAssets(
    userId: string,
    options: MediaFilterOptions = {}
  ): Promise<{ assets: MediaAsset[]; total: number }> {
    try {
      let query = this.supabase
        .from('media_assets')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      // Apply filters
      if (options.type) {
        if (Array.isArray(options.type)) {
          query = query.in('type', options.type);
        } else {
          query = query.eq('type', options.type);
        }
      }

      if (options.provider) {
        if (Array.isArray(options.provider)) {
          query = query.in('provider', options.provider);
        } else {
          query = query.eq('provider', options.provider);
        }
      }

      if (options.status) {
        query = query.eq('status', options.status);
      }

      if (options.folderId !== undefined) {
        if (options.folderId === null) {
          query = query.is('folder_id', null);
        } else {
          query = query.eq('folder_id', options.folderId);
        }
      }

      if (options.isFavorite !== undefined) {
        query = query.eq('is_favorite', options.isFavorite);
      }

      if (options.isArchived !== undefined) {
        query = query.eq('is_archived', options.isArchived);
      } else {
        // By default, exclude archived
        query = query.eq('is_archived', false);
      }

      if (options.tags && options.tags.length > 0) {
        query = query.overlaps('tags', options.tags);
      }

      if (options.search) {
        query = query.or(`prompt.ilike.%${options.search}%,metadata->>'name'.ilike.%${options.search}%`);
      }

      if (options.startDate) {
        query = query.gte('created_at', options.startDate);
      }

      if (options.endDate) {
        query = query.lte('created_at', options.endDate);
      }

      // Sorting
      const sortBy = options.sortBy || 'createdAt';
      const sortOrder = options.sortOrder || 'desc';
      const dbColumn = sortBy === 'createdAt' ? 'created_at'
        : sortBy === 'updatedAt' ? 'updated_at'
        : sortBy === 'usageCount' ? 'usage_count'
        : sortBy;
      query = query.order(dbColumn, { ascending: sortOrder === 'asc' });

      // Pagination
      const limit = options.limit || 50;
      const offset = options.offset || 0;
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      const assets: MediaAsset[] = (data || []).map(this.mapDbToAsset);

      return {
        assets,
        total: count || 0,
      };
    } catch (error: unknown) {
      logger.error('Failed to get media assets:', { error, userId });
      throw error;
    }
  }

  /**
   * Get a single media asset
   */
  async getAsset(userId: string, assetId: string): Promise<MediaAsset | null> {
    try {
      const { data, error } = await this.supabase
        .from('media_assets')
        .select('*')
        .eq('id', assetId)
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapDbToAsset(data);
    } catch (error: unknown) {
      logger.error('Failed to get media asset:', { error, userId, assetId });
      throw error;
    }
  }

  /**
   * Upload/create a new media asset
   */
  async createAsset(userId: string, options: MediaUploadOptions): Promise<MediaAsset> {
    try {
      const { data, error } = await this.supabase
        .from('media_assets')
        .insert({
          user_id: userId,
          type: options.type,
          provider: options.provider,
          status: 'completed',
          url: options.url,
          base64_data: options.base64Data,
          external_id: options.externalId,
          prompt: options.prompt,
          metadata: options.metadata || {},
          tags: options.tags || [],
          folder_id: options.folderId,
          is_favorite: false,
          is_archived: false,
          usage_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return this.mapDbToAsset(data);
    } catch (error: unknown) {
      logger.error('Failed to create media asset:', { error, userId });
      throw error;
    }
  }

  /**
   * Update a media asset
   */
  async updateAsset(
    userId: string,
    assetId: string,
    updates: Partial<{
      url: string;
      status: MediaStatus;
      metadata: Record<string, unknown>;
      tags: string[];
      folderId: string | null;
      isFavorite: boolean;
      isArchived: boolean;
    }>
  ): Promise<MediaAsset | null> {
    try {
      const dbUpdates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.url !== undefined) dbUpdates.url = updates.url;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.metadata !== undefined) dbUpdates.metadata = updates.metadata;
      if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
      if (updates.folderId !== undefined) dbUpdates.folder_id = updates.folderId;
      if (updates.isFavorite !== undefined) dbUpdates.is_favorite = updates.isFavorite;
      if (updates.isArchived !== undefined) dbUpdates.is_archived = updates.isArchived;

      const { data, error } = await this.supabase
        .from('media_assets')
        .update(dbUpdates)
        .eq('id', assetId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return this.mapDbToAsset(data);
    } catch (error: unknown) {
      logger.error('Failed to update media asset:', { error, userId, assetId });
      throw error;
    }
  }

  /**
   * Delete a media asset
   */
  async deleteAsset(userId: string, assetId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('media_assets')
        .delete()
        .eq('id', assetId)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      return true;
    } catch (error: unknown) {
      logger.error('Failed to delete media asset:', { error, userId, assetId });
      throw error;
    }
  }

  /**
   * Batch delete assets
   */
  async batchDelete(userId: string, assetIds: string[]): Promise<BatchOperationResult> {
    const errors: Array<{ id: string; error: string }> = [];
    let processed = 0;

    for (const id of assetIds) {
      try {
        await this.deleteAsset(userId, id);
        processed++;
      } catch (error: unknown) {
        errors.push({ id, error: error instanceof Error ? error.message : String(error) });
      }
    }

    return {
      success: errors.length === 0,
      processed,
      failed: errors.length,
      errors,
    };
  }

  /**
   * Batch update assets (e.g., move to folder, add tags)
   */
  async batchUpdate(
    userId: string,
    assetIds: string[],
    updates: Partial<{
      folderId: string | null;
      tags: string[];
      addTags: string[];
      removeTags: string[];
      isFavorite: boolean;
      isArchived: boolean;
    }>
  ): Promise<BatchOperationResult> {
    const errors: Array<{ id: string; error: string }> = [];
    let processed = 0;

    for (const id of assetIds) {
      try {
        // Handle tag operations
        const finalUpdates: Partial<{
          folderId: string | null;
          tags: string[];
          isFavorite: boolean;
          isArchived: boolean;
        }> = {};
        if (updates.folderId !== undefined) finalUpdates.folderId = updates.folderId;
        if (updates.isFavorite !== undefined) finalUpdates.isFavorite = updates.isFavorite;
        if (updates.isArchived !== undefined) finalUpdates.isArchived = updates.isArchived;
        if (updates.tags !== undefined) finalUpdates.tags = updates.tags;

        if (updates.addTags || updates.removeTags) {
          const asset = await this.getAsset(userId, id);
          if (asset) {
            let tags = [...asset.tags];
            if (updates.addTags) {
              tags = [...new Set([...tags, ...updates.addTags])];
            }
            if (updates.removeTags) {
              tags = tags.filter(t => !updates.removeTags!.includes(t));
            }
            finalUpdates.tags = tags;
          }
        }

        await this.updateAsset(userId, id, finalUpdates);
        processed++;
      } catch (error: unknown) {
        errors.push({ id, error: error instanceof Error ? error.message : String(error) });
      }
    }

    return {
      success: errors.length === 0,
      processed,
      failed: errors.length,
      errors,
    };
  }

  /**
   * Increment usage count
   */
  async incrementUsage(userId: string, assetId: string): Promise<void> {
    try {
      await this.supabase.rpc('increment_media_usage', {
        asset_id: assetId,
        user_id: userId,
      });
    } catch (error: unknown) {
      // Try direct update if RPC doesn't exist
      await this.supabase
        .from('media_assets')
        .update({
          usage_count: this.supabase.rpc('increment', { x: 1 }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', assetId)
        .eq('user_id', userId);
    }
  }

  // ==================== Folder Operations ====================

  /**
   * Get all folders
   */
  async getFolders(userId: string): Promise<MediaFolder[]> {
    try {
      const { data, error } = await this.supabase
        .from('media_folders')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true });

      if (error) {
        throw error;
      }

      return (data || []).map(this.mapDbToFolder);
    } catch (error: unknown) {
      logger.error('Failed to get media folders:', { error, userId });
      throw error;
    }
  }

  /**
   * Create a folder
   */
  async createFolder(
    userId: string,
    options: { name: string; parentId?: string; color?: string; icon?: string }
  ): Promise<MediaFolder> {
    try {
      const { data, error } = await this.supabase
        .from('media_folders')
        .insert({
          user_id: userId,
          name: options.name,
          parent_id: options.parentId,
          color: options.color,
          icon: options.icon,
          asset_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return this.mapDbToFolder(data);
    } catch (error: unknown) {
      logger.error('Failed to create media folder:', { error, userId });
      throw error;
    }
  }

  /**
   * Update a folder
   */
  async updateFolder(
    userId: string,
    folderId: string,
    updates: Partial<{ name: string; parentId: string | null; color: string; icon: string }>
  ): Promise<MediaFolder | null> {
    try {
      const dbUpdates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.parentId !== undefined) dbUpdates.parent_id = updates.parentId;
      if (updates.color !== undefined) dbUpdates.color = updates.color;
      if (updates.icon !== undefined) dbUpdates.icon = updates.icon;

      const { data, error } = await this.supabase
        .from('media_folders')
        .update(dbUpdates)
        .eq('id', folderId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return this.mapDbToFolder(data);
    } catch (error: unknown) {
      logger.error('Failed to update media folder:', { error, userId, folderId });
      throw error;
    }
  }

  /**
   * Delete a folder
   */
  async deleteFolder(userId: string, folderId: string, moveAssetsTo?: string | null): Promise<boolean> {
    try {
      // Move assets to new folder or root
      await this.supabase
        .from('media_assets')
        .update({ folder_id: moveAssetsTo || null })
        .eq('folder_id', folderId)
        .eq('user_id', userId);

      // Delete folder
      const { error } = await this.supabase
        .from('media_folders')
        .delete()
        .eq('id', folderId)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      return true;
    } catch (error: unknown) {
      logger.error('Failed to delete media folder:', { error, userId, folderId });
      throw error;
    }
  }

  // ==================== Analytics ====================

  /**
   * Get media library statistics
   */
  async getStats(userId: string): Promise<{
    totalAssets: number;
    byType: Record<MediaType, number>;
    byProvider: Record<string, number>;
    byStatus: Record<MediaStatus, number>;
    favorites: number;
    archived: number;
    totalUsage: number;
    recentAssets: MediaAsset[];
    mostUsed: MediaAsset[];
  }> {
    try {
      // Get counts
      const { count: totalAssets } = await this.supabase
        .from('media_assets')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Get type breakdown
      const { data: typeData } = await this.supabase
        .from('media_assets')
        .select('type')
        .eq('user_id', userId);

      const byType: Record<MediaType, number> = {
        image: 0,
        video: 0,
        audio: 0,
      };
      (typeData || []).forEach(r => {
        byType[r.type as MediaType] = (byType[r.type as MediaType] || 0) + 1;
      });

      // Get provider breakdown
      const { data: providerData } = await this.supabase
        .from('media_assets')
        .select('provider')
        .eq('user_id', userId);

      const byProvider: Record<string, number> = {};
      (providerData || []).forEach(r => {
        byProvider[r.provider] = (byProvider[r.provider] || 0) + 1;
      });

      // Get favorites count
      const { count: favorites } = await this.supabase
        .from('media_assets')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_favorite', true);

      // Get archived count
      const { count: archived } = await this.supabase
        .from('media_assets')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_archived', true);

      // Get recent assets
      const { data: recentData } = await this.supabase
        .from('media_assets')
        .select('*')
        .eq('user_id', userId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
        .limit(10);

      // Get most used
      const { data: mostUsedData } = await this.supabase
        .from('media_assets')
        .select('*')
        .eq('user_id', userId)
        .eq('is_archived', false)
        .order('usage_count', { ascending: false })
        .limit(10);

      return {
        totalAssets: totalAssets || 0,
        byType,
        byProvider,
        byStatus: { pending: 0, processing: 0, completed: totalAssets || 0, failed: 0 },
        favorites: favorites || 0,
        archived: archived || 0,
        totalUsage: 0, // Could sum usage_count if needed
        recentAssets: (recentData || []).map(this.mapDbToAsset),
        mostUsed: (mostUsedData || []).map(this.mapDbToAsset),
      };
    } catch (error: unknown) {
      logger.error('Failed to get media stats:', { error, userId });
      throw error;
    }
  }

  // ==================== Helpers ====================

  private mapDbToAsset(data: MediaAssetRow): MediaAsset {
    return {
      id: data.id,
      userId: data.user_id,
      type: data.type,
      provider: data.provider,
      status: data.status || 'completed',
      url: data.url || data.video_url,
      base64Data: data.base64_data,
      externalId: data.external_id,
      prompt: data.prompt,
      metadata: data.metadata || {},
      tags: data.tags || [],
      folderId: data.folder_id,
      isFavorite: data.is_favorite || false,
      isArchived: data.is_archived || false,
      usageCount: data.usage_count || 0,
      createdAt: data.created_at,
      updatedAt: data.updated_at || data.created_at,
    };
  }

  private mapDbToFolder(data: MediaFolderRow): MediaFolder {
    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      parentId: data.parent_id,
      color: data.color,
      icon: data.icon,
      assetCount: data.asset_count || 0,
      createdAt: data.created_at,
      updatedAt: data.updated_at || data.created_at,
    };
  }
}

// Export singleton
export const mediaLibraryService = new MediaLibraryService();
