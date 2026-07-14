/**
 * AI Image Generation Hook
 *
 * @description Hook for generating AI images with provider selection,
 * style presets, and platform-optimized dimensions.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_APP_URL: Application base URL (PUBLIC)
 */

'use client';

import { useState, useCallback, useRef } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export type ImageProvider = 'stability' | 'dalle' | 'gemini';

export type ImageStyle =
  | 'photorealistic'
  | 'artistic'
  | 'anime'
  | 'digital-art'
  | 'cinematic'
  | 'minimalist';

export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

export interface ImageGenerationOptions {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: AspectRatio;
  width?: number;
  height?: number;
  style?: ImageStyle;
  quality?: 'standard' | 'hd';
  provider?: ImageProvider;
  seed?: number;
  steps?: number;
  guidanceScale?: number;
  platform?: string;
  brandColors?: string[];
  enhancePrompt?: boolean;
  saveToLibrary?: boolean;
  referenceSet?: string;
  useReferences?: boolean;
}

export interface ImageResult {
  success: boolean;
  provider: ImageProvider;
  imageBase64?: string;
  imageUrl?: string;
  metadata?: {
    seed?: number;
    width: number;
    height: number;
    model: string;
  };
  mediaAssetId?: string;
  grounded?: boolean;
  referenceSet?: string;
  refCount?: number;
  error?: string;
  /**
   * True when the server refused generation under the Real Images Only
   * mandate (422 { error, blocked: true } — no owned references for the
   * subject, or the grounded call failed closed). Lets the UI branch to the
   * dedicated blocked-state panel instead of the generic error styling.
   */
  blocked?: boolean;
}

export interface ReferenceSetOption {
  industry: string;
  label: string;
}

// Batch generation (spec 2026-07-12 Part E) — a `variants: 3` POST to the
// same endpoint. Batch responses carry no imageBase64 (Vercel 4.5MB response
// cap), so base64-provider variants render via mediaAssetImageSrc() instead.
export interface BatchImage extends ImageResult {
  generationId: string;
  mediaAssetId?: string;
}

export interface BatchResult {
  batchGroupId: string;
  images: BatchImage[];
}

/** URL for GET /api/media/assets/[id]/image — serves a stored media asset. */
export function mediaAssetImageSrc(mediaAssetId: string): string {
  return `/api/media/assets/${mediaAssetId}/image`;
}

export interface PlatformDimensions {
  [platform: string]: {
    width: number;
    height: number;
    aspectRatio: string;
  };
}

interface PlatformDimensionsResponse {
  platforms: PlatformDimensions;
  styles: ImageStyle[];
  providers: ImageProvider[];
  referenceSets?: ReferenceSetOption[];
}

// ============================================================================
// HOOK: useImageGeneration
// ============================================================================

export interface UseImageGenerationReturn {
  // State
  isGenerating: boolean;
  generatedImage: ImageResult | null;
  variations: ImageResult[];
  error: string | null;
  /** True when `error` is a 422 blocked-generation refusal (Real Images Only mandate), not a generic failure. */
  blocked: boolean;
  platformDimensions: PlatformDimensions | null;
  availableStyles: ImageStyle[];
  availableProviders: ImageProvider[];
  availableReferenceSets: ReferenceSetOption[];

  // Actions
  generate: (options: ImageGenerationOptions) => Promise<ImageResult | null>;
  generateBatch: (
    options: ImageGenerationOptions
  ) => Promise<BatchResult | null>;
  generateVariations: (
    options: ImageGenerationOptions,
    count?: number
  ) => Promise<ImageResult[]>;
  fetchPlatformDimensions: (platform?: string) => Promise<void>;
  clearResults: () => void;
  clearError: () => void;
}

export function useImageGeneration(): UseImageGenerationReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<ImageResult | null>(
    null
  );
  const [variations, setVariations] = useState<ImageResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [platformDimensions, setPlatformDimensions] =
    useState<PlatformDimensions | null>(null);
  const [availableStyles, setAvailableStyles] = useState<ImageStyle[]>([
    'photorealistic',
    'artistic',
    'anime',
    'digital-art',
    'cinematic',
    'minimalist',
  ]);
  const [availableProviders, setAvailableProviders] = useState<ImageProvider[]>(
    ['stability', 'dalle', 'gemini']
  );
  const [availableReferenceSets, setAvailableReferenceSets] = useState<
    ReferenceSetOption[]
  >([]);
  const mountedRef = useRef(true);

  // Generate a single image
  const generate = useCallback(
    async (options: ImageGenerationOptions): Promise<ImageResult | null> => {
      if (!options.prompt.trim()) {
        setError('Prompt is required');
        return null;
      }

      try {
        setIsGenerating(true);
        setError(null);
        setBlocked(false);

        const response = await fetch('/api/media/generate/image', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(options),
        });

        const data = await response.json();

        if (!mountedRef.current) return null;

        if (!data.success) {
          const errorMessage = data.error || 'Image generation failed';
          // 422 { error, blocked: true } — Real Images Only refusal, not a
          // generic failure (spec 2026-07-12 Part B/D).
          const isBlocked = response.status === 422 && data.blocked === true;
          setError(errorMessage);
          setBlocked(isBlocked);
          return {
            success: false,
            provider: data.provider || options.provider || 'stability',
            error: errorMessage,
            blocked: isBlocked,
          };
        }

        const result: ImageResult = {
          success: true,
          provider: data.provider,
          imageBase64: data.imageBase64,
          imageUrl: data.imageUrl,
          metadata: data.metadata,
          mediaAssetId: data.mediaAssetId,
          grounded: data.grounded,
          referenceSet: data.referenceSet,
          refCount: data.refCount,
        };

        setGeneratedImage(result);
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to generate image';
        if (mountedRef.current) {
          setError(errorMessage);
          setBlocked(false);
        }
        return {
          success: false,
          provider: options.provider || 'stability',
          error: errorMessage,
        };
      } finally {
        if (mountedRef.current) {
          setIsGenerating(false);
        }
      }
    },
    []
  );

  // Generate a batch of variants in one request (mirrors `generate`: same
  // endpoint, same error handling, `variants: 3` in the body).
  const generateBatch = useCallback(
    async (options: ImageGenerationOptions): Promise<BatchResult | null> => {
      if (!options.prompt.trim()) {
        setError('Prompt is required');
        return null;
      }

      try {
        setIsGenerating(true);
        setError(null);
        setBlocked(false);

        const response = await fetch('/api/media/generate/image', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...options, variants: 3 }),
        });

        const data = await response.json();

        if (!mountedRef.current) return null;

        if (!data.success) {
          // All-blocked batch → 422 { error, blocked: true } (spec Part B),
          // same shape as the single-image path.
          const isBlocked = response.status === 422 && data.blocked === true;
          setError(data.error || 'Image generation failed');
          setBlocked(isBlocked);
          return null;
        }

        const images: BatchImage[] = (data.images ?? []).map(
          (img: {
            generationId: string;
            success: boolean;
            provider: ImageProvider;
            imageUrl?: string;
            mediaAssetId?: string;
            metadata?: {
              seed?: number;
              width: number;
              height: number;
              model: string;
            };
            grounded?: boolean;
            referenceSet?: string;
            refCount?: number;
            error?: string;
            blocked?: boolean;
          }) => ({
            generationId: img.generationId,
            success: img.success,
            provider: img.provider,
            imageUrl: img.imageUrl,
            mediaAssetId: img.mediaAssetId,
            metadata: img.metadata,
            grounded: img.grounded,
            referenceSet: img.referenceSet,
            refCount: img.refCount,
            error: img.error,
            blocked: img.blocked,
          })
        );

        return { batchGroupId: data.batchGroupId, images };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to generate image';
        if (mountedRef.current) {
          setError(errorMessage);
          setBlocked(false);
        }
        return null;
      } finally {
        if (mountedRef.current) {
          setIsGenerating(false);
        }
      }
    },
    []
  );

  // Generate multiple variations
  const generateVariations = useCallback(
    async (
      options: ImageGenerationOptions,
      count: number = 4
    ): Promise<ImageResult[]> => {
      if (!options.prompt.trim()) {
        setError('Prompt is required');
        return [];
      }

      try {
        setIsGenerating(true);
        setError(null);
        setVariations([]);

        const response = await fetch('/api/media/generate/image', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...options,
            count,
          }),
        });

        const data = await response.json();

        if (!mountedRef.current) return [];

        if (!data.success) {
          setError(data.error || 'Failed to generate variations');
          return [];
        }

        const results: ImageResult[] = data.variations.map(
          (v: {
            success: boolean;
            provider: ImageProvider;
            imageBase64?: string;
            imageUrl?: string;
            metadata?: {
              seed?: number;
              width: number;
              height: number;
              model: string;
            };
            mediaAssetId?: string;
            error?: string;
          }) => ({
            success: v.success,
            provider: v.provider,
            imageBase64: v.imageBase64,
            imageUrl: v.imageUrl,
            metadata: v.metadata,
            mediaAssetId: v.mediaAssetId,
            error: v.error,
          })
        );

        setVariations(results);
        return results;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to generate variations';
        if (mountedRef.current) {
          setError(errorMessage);
        }
        return [];
      } finally {
        if (mountedRef.current) {
          setIsGenerating(false);
        }
      }
    },
    []
  );

  // Fetch platform dimensions
  const fetchPlatformDimensions = useCallback(
    async (platform?: string): Promise<void> => {
      try {
        const url = platform
          ? `/api/media/generate/image?platform=${encodeURIComponent(platform)}`
          : '/api/media/generate/image';

        const response = await fetch(url, {
          credentials: 'include',
        });

        const data: PlatformDimensionsResponse = await response.json();

        if (!mountedRef.current) return;

        if (data.platforms) {
          setPlatformDimensions(data.platforms);
        }
        if (data.styles) {
          setAvailableStyles(data.styles);
        }
        if (data.providers) {
          setAvailableProviders(data.providers);
        }
        if (data.referenceSets) {
          setAvailableReferenceSets(data.referenceSets);
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(
            err instanceof Error ? err.message : 'Failed to fetch dimensions'
          );
        }
      }
    },
    []
  );

  // Clear all results
  const clearResults = useCallback(() => {
    setGeneratedImage(null);
    setVariations([]);
    setError(null);
    setBlocked(false);
  }, []);

  // Clear error only
  const clearError = useCallback(() => {
    setError(null);
    setBlocked(false);
  }, []);

  return {
    // State
    isGenerating,
    generatedImage,
    variations,
    error,
    blocked,
    platformDimensions,
    availableStyles,
    availableProviders,
    availableReferenceSets,

    // Actions
    generate,
    generateBatch,
    generateVariations,
    fetchPlatformDimensions,
    clearResults,
    clearError,
  };
}
