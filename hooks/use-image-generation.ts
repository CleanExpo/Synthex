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
  error?: string;
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
  platformDimensions: PlatformDimensions | null;
  availableStyles: ImageStyle[];
  availableProviders: ImageProvider[];

  // Actions
  generate: (options: ImageGenerationOptions) => Promise<ImageResult | null>;
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
  const [generatedImage, setGeneratedImage] = useState<ImageResult | null>(null);
  const [variations, setVariations] = useState<ImageResult[]>([]);
  const [error, setError] = useState<string | null>(null);
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
  const [availableProviders, setAvailableProviders] = useState<ImageProvider[]>([
    'stability',
    'dalle',
    'gemini',
  ]);
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
          setError(errorMessage);
          return {
            success: false,
            provider: data.provider || options.provider || 'stability',
            error: errorMessage,
          };
        }

        const result: ImageResult = {
          success: true,
          provider: data.provider,
          imageBase64: data.imageBase64,
          imageUrl: data.imageUrl,
          metadata: data.metadata,
          mediaAssetId: data.mediaAssetId,
        };

        setGeneratedImage(result);
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to generate image';
        if (mountedRef.current) {
          setError(errorMessage);
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
            metadata?: { seed?: number; width: number; height: number; model: string };
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
  }, []);

  // Clear error only
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // State
    isGenerating,
    generatedImage,
    variations,
    error,
    platformDimensions,
    availableStyles,
    availableProviders,

    // Actions
    generate,
    generateVariations,
    fetchPlatformDimensions,
    clearResults,
    clearError,
  };
}
