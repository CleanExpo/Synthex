/**
 * Visual Asset Manager
 *
 * Manages the lifecycle of Paper Banana-generated visual assets.
 * Handles storage, metadata, quality tracking, and retrieval.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL) — For storing asset metadata
 *
 * FAILURE MODE: Returns error with details, never corrupts existing assets
 *
 * @module lib/services/visual-asset-manager
 */

import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';
import type { VisualType, GenerateVisualResponse, EvaluateVisualResponse } from './paper-banana-client';
import { generateDiagram, evaluateVisual, generateWithQualityGate } from './paper-banana-client';

// =============================================================================
// Types
// =============================================================================

export interface CreateVisualAssetInput {
  userId: string;
  reportId?: number;
  type: VisualType;
  prompt: string;
  data?: Record<string, unknown>;
  style?: string;
  useQualityGate?: boolean;
  minQuality?: number;
}

export interface VisualAssetResult {
  id: number;
  imageUrl: string;
  thumbnailUrl?: string;
  qualityScore?: number;
  altText?: string;
  caption?: string;
  status: string;
}

export interface AssetListOptions {
  userId: string;
  reportId?: number;
  type?: VisualType;
  minQuality?: number;
  limit?: number;
  offset?: number;
}

// =============================================================================
// Asset Creation
// =============================================================================

/**
 * Generate a visual and store it as an asset in the database.
 */
export async function createVisualAsset(input: CreateVisualAssetInput): Promise<VisualAssetResult> {
  logger.info('Creating visual asset', { userId: input.userId, type: input.type });

  try {
    // Generate the visual
    let result: GenerateVisualResponse;

    if (input.useQualityGate) {
      result = await generateWithQualityGate(
        { type: input.type, prompt: input.prompt, data: input.data, style: input.style },
        { minQuality: input.minQuality || 70 }
      );
    } else {
      result = await generateDiagram({
        type: input.type,
        prompt: input.prompt,
        data: input.data,
        style: input.style,
      });
    }

    // Generate alt text and caption from the prompt
    const altText = generateAltText(input.type, input.prompt);
    const caption = generateCaption(input.type, input.prompt);
    const qualityScore = result.metadata?.pipeline?.critic?.score;

    // Store in database
    const asset = await prisma.visualAsset.create({
      data: {
        userId: input.userId,
        reportId: input.reportId || null,
        type: input.type,
        prompt: input.prompt,
        imageUrl: result.imageUrl,
        thumbnailUrl: result.thumbnailUrl || null,
        metadata: result.metadata as any,
        qualityScore: qualityScore || null,
        altText,
        caption,
        status: qualityScore && qualityScore >= 70 ? 'approved' : 'generated',
      },
    });

    logger.info('Visual asset created', { id: asset.id, qualityScore, status: asset.status });

    return {
      id: asset.id,
      imageUrl: asset.imageUrl,
      thumbnailUrl: asset.thumbnailUrl || undefined,
      qualityScore: asset.qualityScore || undefined,
      altText: asset.altText || undefined,
      caption: asset.caption || undefined,
      status: asset.status,
    };
  } catch (error) {
    logger.error('Failed to create visual asset', { error, userId: input.userId });
    throw error;
  }
}

/**
 * Re-evaluate an existing asset's quality.
 */
export async function reevaluateAsset(assetId: number): Promise<EvaluateVisualResponse> {
  const asset = await prisma.visualAsset.findUnique({ where: { id: assetId } });
  if (!asset) throw new Error(`Visual asset ${assetId} not found`);

  const evaluation = await evaluateVisual({
    imageUrl: asset.imageUrl,
    context: asset.prompt,
  });

  // Update asset with new quality score
  await prisma.visualAsset.update({
    where: { id: assetId },
    data: {
      qualityScore: evaluation.qualityScore,
      status: evaluation.qualityScore >= 70 ? 'approved' : 'needs_improvement',
      metadata: {
        ...(asset.metadata as Record<string, unknown> || {}),
        lastEvaluation: {
          score: evaluation.qualityScore,
          feedback: evaluation.feedback,
          dimensions: evaluation.dimensions,
          evaluatedAt: new Date().toISOString(),
        },
      },
    },
  });

  return evaluation;
}

// =============================================================================
// Asset Retrieval
// =============================================================================

/**
 * List visual assets with filtering.
 */
export async function listVisualAssets(options: AssetListOptions) {
  const where: Record<string, unknown> = { userId: options.userId };

  if (options.reportId) where.reportId = options.reportId;
  if (options.type) where.type = options.type;
  if (options.minQuality) where.qualityScore = { gte: options.minQuality };

  const [assets, total] = await Promise.all([
    prisma.visualAsset.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
      take: options.limit || 20,
      skip: options.offset || 0,
    }),
    prisma.visualAsset.count({ where: where as any }),
  ]);

  return {
    assets: assets.map(a => ({
      id: a.id,
      type: a.type,
      imageUrl: a.imageUrl,
      thumbnailUrl: a.thumbnailUrl,
      qualityScore: a.qualityScore,
      altText: a.altText,
      caption: a.caption,
      status: a.status,
      createdAt: a.createdAt.toISOString(),
    })),
    total,
    hasMore: (options.offset || 0) + (options.limit || 20) < total,
  };
}

/**
 * Get a single visual asset by ID.
 */
export async function getVisualAsset(assetId: number, userId: string) {
  const asset = await prisma.visualAsset.findFirst({
    where: { id: assetId, userId },
  });

  if (!asset) return null;

  return {
    id: asset.id,
    type: asset.type,
    prompt: asset.prompt,
    imageUrl: asset.imageUrl,
    thumbnailUrl: asset.thumbnailUrl,
    qualityScore: asset.qualityScore,
    altText: asset.altText,
    caption: asset.caption,
    status: asset.status,
    metadata: asset.metadata,
    createdAt: asset.createdAt.toISOString(),
  };
}

/**
 * Delete a visual asset.
 */
export async function deleteVisualAsset(assetId: number, userId: string): Promise<boolean> {
  const asset = await prisma.visualAsset.findFirst({
    where: { id: assetId, userId },
  });

  if (!asset) return false;

  await prisma.visualAsset.delete({ where: { id: assetId } });
  logger.info('Visual asset deleted', { id: assetId, userId });
  return true;
}

// =============================================================================
// Helpers
// =============================================================================

function generateAltText(type: VisualType, prompt: string): string {
  const prefix = {
    diagram: 'Diagram showing',
    plot: 'Data visualization of',
    infographic: 'Infographic illustrating',
    before_after: 'Before and after comparison of',
  }[type];

  // Take first 120 chars of prompt for alt text
  const description = prompt.length > 120 ? prompt.substring(0, 117) + '...' : prompt;
  return `${prefix} ${description}`;
}

function generateCaption(type: VisualType, prompt: string): string {
  const prefix = {
    diagram: 'Figure:',
    plot: 'Chart:',
    infographic: 'Infographic:',
    before_after: 'Comparison:',
  }[type];

  const description = prompt.length > 200 ? prompt.substring(0, 197) + '...' : prompt;
  return `${prefix} ${description}. Generated via Paper Banana AI.`;
}
