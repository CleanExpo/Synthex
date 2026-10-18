/**
 * Media Library Management Service
 *
 * @description Centralized management for all generated media assets
 *
 * FAILURE MODE: the media_assets and media_folders tables are not in
 * prisma/schema.prisma, so every method throws MediaLibraryNotProvisionedError.
 * Nothing is read or saved; no method returns empty data in place of a
 * failed read.
 */

import {
  FEATURE_NOT_PROVISIONED,
  notProvisionedBody,
} from '@/lib/api/not-provisioned';

// Media asset types
export type MediaType = 'image' | 'video' | 'audio';
export type MediaStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type MediaProvider =
  | 'stability'
  | 'dalle'
  | 'gemini'
  | 'runway'
  | 'synthesia'
  | 'd-id'
  | 'elevenlabs'
  | 'remotion'
  | 'fal';

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

export class MediaLibraryNotProvisionedError extends Error {
  readonly code = FEATURE_NOT_PROVISIONED;

  constructor(readonly table: 'media_assets' | 'media_folders') {
    super(notProvisionedBody(table, 'Media library').message);
    this.name = 'MediaLibraryNotProvisionedError';
  }
}

const assetsUnavailable = (): Promise<never> =>
  Promise.reject(new MediaLibraryNotProvisionedError('media_assets'));
const foldersUnavailable = (): Promise<never> =>
  Promise.reject(new MediaLibraryNotProvisionedError('media_folders'));

class MediaLibraryService {
  async getAssets(
    userId: string,
    options: MediaFilterOptions = {}
  ): Promise<{ assets: MediaAsset[]; total: number }> {
    return assetsUnavailable();
  }

  async getAsset(userId: string, assetId: string): Promise<MediaAsset | null> {
    return assetsUnavailable();
  }

  async createAsset(
    userId: string,
    options: MediaUploadOptions
  ): Promise<MediaAsset> {
    return assetsUnavailable();
  }

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
    return assetsUnavailable();
  }

  async deleteAsset(userId: string, assetId: string): Promise<boolean> {
    return assetsUnavailable();
  }

  async batchDelete(
    userId: string,
    assetIds: string[]
  ): Promise<BatchOperationResult> {
    return assetsUnavailable();
  }

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
    return assetsUnavailable();
  }

  async incrementUsage(userId: string, assetId: string): Promise<void> {
    return assetsUnavailable();
  }

  async getFolders(userId: string): Promise<MediaFolder[]> {
    return foldersUnavailable();
  }

  async createFolder(
    userId: string,
    options: { name: string; parentId?: string; color?: string; icon?: string }
  ): Promise<MediaFolder> {
    return foldersUnavailable();
  }

  async updateFolder(
    userId: string,
    folderId: string,
    updates: Partial<{
      name: string;
      parentId: string | null;
      color: string;
      icon: string;
    }>
  ): Promise<MediaFolder | null> {
    return foldersUnavailable();
  }

  async deleteFolder(
    userId: string,
    folderId: string,
    moveAssetsTo?: string | null
  ): Promise<boolean> {
    return foldersUnavailable();
  }

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
    return assetsUnavailable();
  }
}

// Export singleton
export const mediaLibraryService = new MediaLibraryService();
