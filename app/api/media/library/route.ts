/**
 * Media Library API
 *
 * @description CRUD operations for media assets and folders
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase URL (PUBLIC)
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (SECRET)
 *
 * FAILURE MODE: Returns error response with details
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { auditLogger } from '@/lib/security/audit-logger';
import { mediaLibraryService, MediaFilterOptions } from '@/lib/services/media-library';
import { logger } from '@/lib/logger';

// Request validation schemas
const FilterSchema = z.object({
  type: z.union([
    z.enum(['image', 'video', 'audio']),
    z.array(z.enum(['image', 'video', 'audio'])),
  ]).optional(),
  provider: z.union([
    z.enum(['stability', 'dalle', 'gemini', 'runway', 'synthesia', 'd-id', 'elevenlabs']),
    z.array(z.enum(['stability', 'dalle', 'gemini', 'runway', 'synthesia', 'd-id', 'elevenlabs'])),
  ]).optional(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  tags: z.array(z.string()).optional(),
  folderId: z.string().nullable().optional(),
  isFavorite: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'usageCount', 'name']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
});

const CreateAssetSchema = z.object({
  type: z.enum(['image', 'video', 'audio']),
  provider: z.enum(['stability', 'dalle', 'gemini', 'runway', 'synthesia', 'd-id', 'elevenlabs']),
  base64Data: z.string().max(50 * 1024 * 1024, 'Base64 data exceeds 50MB limit').optional(),
  url: z.string().url().optional(),
  externalId: z.string().optional(),
  prompt: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  folderId: z.string().optional(),
});

const UpdateAssetSchema = z.object({
  id: z.string(),
  url: z.string().url().optional(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  folderId: z.string().nullable().optional(),
  isFavorite: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

// Type helpers for filter options
type MediaType = 'image' | 'video' | 'audio';
type MediaProvider = 'stability' | 'dalle' | 'gemini' | 'runway' | 'synthesia' | 'd-id' | 'elevenlabs';
type MediaStatus = 'pending' | 'processing' | 'completed' | 'failed';
type SortField = 'createdAt' | 'updatedAt' | 'usageCount' | 'name';
type SortOrder = 'asc' | 'desc';

const BatchUpdateSchema = z.object({
  assetIds: z.array(z.string()).min(1).max(100),
  updates: z.object({
    folderId: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
    addTags: z.array(z.string()).optional(),
    removeTags: z.array(z.string()).optional(),
    isFavorite: z.boolean().optional(),
    isArchived: z.boolean().optional(),
  }),
});

const BatchDeleteSchema = z.object({
  assetIds: z.array(z.string()).min(1).max(100),
});

/**
 * GET /api/media/library
 * Get media assets with filtering
 */
export async function GET(request: NextRequest) {
  // Security check
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  const userId = security.context.userId!;
  const { searchParams } = new URL(request.url);

  try {
    // Check for specific asset request
    const assetId = searchParams.get('id');
    if (assetId) {
      const asset = await mediaLibraryService.getAsset(userId, assetId);
      if (!asset) {
        return APISecurityChecker.createSecureResponse(
          { error: 'Asset not found' },
          404
        );
      }
      return APISecurityChecker.createSecureResponse({ asset });
    }

    // Check for stats request
    if (searchParams.get('stats') === 'true') {
      const stats = await mediaLibraryService.getStats(userId);
      return APISecurityChecker.createSecureResponse({ stats });
    }

    // Check for folders request
    if (searchParams.get('folders') === 'true') {
      const folders = await mediaLibraryService.getFolders(userId);
      return APISecurityChecker.createSecureResponse({ folders });
    }

    // Parse filter options from query params
    const filterOptions: MediaFilterOptions = {};

    const type = searchParams.get('type');
    if (type) {
      filterOptions.type = type.includes(',')
        ? (type.split(',') as MediaType[])
        : (type as MediaType);
    }

    const provider = searchParams.get('provider');
    if (provider) {
      filterOptions.provider = provider.includes(',')
        ? (provider.split(',') as MediaProvider[])
        : (provider as MediaProvider);
    }

    const status = searchParams.get('status');
    if (status) filterOptions.status = status as MediaStatus;

    const tags = searchParams.get('tags');
    if (tags) filterOptions.tags = tags.split(',');

    const folderId = searchParams.get('folderId');
    if (folderId === 'null') filterOptions.folderId = null;
    else if (folderId) filterOptions.folderId = folderId;

    const isFavorite = searchParams.get('isFavorite');
    if (isFavorite) filterOptions.isFavorite = isFavorite === 'true';

    const isArchived = searchParams.get('isArchived');
    if (isArchived) filterOptions.isArchived = isArchived === 'true';

    const search = searchParams.get('search');
    if (search) filterOptions.search = search;

    const startDate = searchParams.get('startDate');
    if (startDate) filterOptions.startDate = startDate;

    const endDate = searchParams.get('endDate');
    if (endDate) filterOptions.endDate = endDate;

    const sortBy = searchParams.get('sortBy');
    if (sortBy) filterOptions.sortBy = sortBy as SortField;

    const sortOrder = searchParams.get('sortOrder');
    if (sortOrder) filterOptions.sortOrder = sortOrder as SortOrder;

    const limit = searchParams.get('limit');
    if (limit) filterOptions.limit = parseInt(limit, 10);

    const offset = searchParams.get('offset');
    if (offset) filterOptions.offset = parseInt(offset, 10);

    const result = await mediaLibraryService.getAssets(userId, filterOptions);

    return APISecurityChecker.createSecureResponse({
      assets: result.assets,
      total: result.total,
      limit: filterOptions.limit || 50,
      offset: filterOptions.offset || 0,
      hasMore: (filterOptions.offset || 0) + result.assets.length < result.total,
    });
  } catch (error: unknown) {
    logger.error('Media library GET error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}

/**
 * POST /api/media/library
 * Create a new media asset or folder
 */
export async function POST(request: NextRequest) {
  // Security check
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  const userId = security.context.userId!;
  const { searchParams } = new URL(request.url);

  try {
    const body = await request.json();

    // Create folder
    if (searchParams.get('folder') === 'true') {
      const folderSchema = z.object({
        name: z.string().min(1).max(100),
        parentId: z.string().optional(),
        color: z.string().optional(),
        icon: z.string().optional(),
      });

      const validated = folderSchema.parse(body);
      const folder = await mediaLibraryService.createFolder(userId, validated);

      await auditLogger.logData(
        'create',
        'folder',
        folder.id,
        userId,
        'success',
        { action: 'MEDIA_FOLDER_CREATE', name: folder.name }
      );

      return APISecurityChecker.createSecureResponse({ folder }, 201);
    }

    // Create asset
    const validated = CreateAssetSchema.parse(body);
    const asset = await mediaLibraryService.createAsset(userId, validated);

    await auditLogger.logData(
      'create',
      'media',
      asset.id,
      userId,
      'success',
      { action: 'MEDIA_ASSET_CREATE', type: asset.type, provider: asset.provider }
    );

    return APISecurityChecker.createSecureResponse({ asset }, 201);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation error', details: error.errors },
        400
      );
    }

    logger.error('Media library POST error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}

/**
 * PUT /api/media/library
 * Update media asset(s) or folder
 */
export async function PUT(request: NextRequest) {
  // Security check
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  const userId = security.context.userId!;
  const { searchParams } = new URL(request.url);

  try {
    const body = await request.json();

    // Update folder
    if (searchParams.get('folder') === 'true') {
      const folderSchema = z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        parentId: z.string().nullable().optional(),
        color: z.string().optional(),
        icon: z.string().optional(),
      });

      const validated = folderSchema.parse(body);
      const { id, ...updates } = validated;
      const folder = await mediaLibraryService.updateFolder(userId, id, updates);

      if (!folder) {
        return APISecurityChecker.createSecureResponse(
          { error: 'Folder not found' },
          404
        );
      }

      return APISecurityChecker.createSecureResponse({ folder });
    }

    // Batch update
    if (searchParams.get('batch') === 'true') {
      const validated = BatchUpdateSchema.parse(body);
      const result = await mediaLibraryService.batchUpdate(
        userId,
        validated.assetIds,
        validated.updates
      );

      await auditLogger.logData(
        'update',
        'media',
        undefined,
        userId,
        'success',
        {
          action: 'MEDIA_BATCH_UPDATE',
          count: validated.assetIds.length,
          processed: result.processed,
          failed: result.failed,
        }
      );

      return APISecurityChecker.createSecureResponse({ result });
    }

    // Single asset update
    const validated = UpdateAssetSchema.parse(body);
    const { id, ...updates } = validated;
    const asset = await mediaLibraryService.updateAsset(userId, id, updates);

    if (!asset) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Asset not found' },
        404
      );
    }

    await auditLogger.logData(
      'update',
      'media',
      id,
      userId,
      'success',
      { action: 'MEDIA_ASSET_UPDATE', updates: Object.keys(updates) }
    );

    return APISecurityChecker.createSecureResponse({ asset });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation error', details: error.errors },
        400
      );
    }

    logger.error('Media library PUT error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}

/**
 * DELETE /api/media/library
 * Delete media asset(s) or folder
 */
export async function DELETE(request: NextRequest) {
  // Security check
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  const userId = security.context.userId!;
  const { searchParams } = new URL(request.url);

  try {
    const body = await request.json();

    // Delete folder
    if (searchParams.get('folder') === 'true') {
      const folderSchema = z.object({
        id: z.string(),
        moveAssetsTo: z.string().nullable().optional(),
      });

      const validated = folderSchema.parse(body);
      const success = await mediaLibraryService.deleteFolder(
        userId,
        validated.id,
        validated.moveAssetsTo
      );

      if (!success) {
        return APISecurityChecker.createSecureResponse(
          { error: 'Failed to delete folder' },
          500
        );
      }

      await auditLogger.logData(
        'delete',
        'folder',
        validated.id,
        userId,
        'success',
        { action: 'MEDIA_FOLDER_DELETE' }
      );

      return APISecurityChecker.createSecureResponse({ success: true });
    }

    // Batch delete
    if (searchParams.get('batch') === 'true') {
      const validated = BatchDeleteSchema.parse(body);
      const result = await mediaLibraryService.batchDelete(userId, validated.assetIds);

      await auditLogger.logData(
        'delete',
        'media',
        undefined,
        userId,
        'success',
        {
          action: 'MEDIA_BATCH_DELETE',
          count: validated.assetIds.length,
          processed: result.processed,
          failed: result.failed,
        }
      );

      return APISecurityChecker.createSecureResponse({ result });
    }

    // Single asset delete
    const singleSchema = z.object({ id: z.string() });
    const validated = singleSchema.parse(body);
    const success = await mediaLibraryService.deleteAsset(userId, validated.id);

    if (!success) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Failed to delete asset' },
        500
      );
    }

    await auditLogger.logData(
      'delete',
      'media',
      validated.id,
      userId,
      'success',
      { action: 'MEDIA_ASSET_DELETE' }
    );

    return APISecurityChecker.createSecureResponse({ success: true });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation error', details: error.errors },
        400
      );
    }

    logger.error('Media library DELETE error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}
