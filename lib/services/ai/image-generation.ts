/**
 * AI Image Generation Service
 *
 * @description Multi-provider image generation using Stability AI, DALL-E, and Gemini Imagen
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - STABILITY_API_KEY: Stability AI API key (SECRET)
 * - OPENAI_API_KEY: OpenAI API key for DALL-E (SECRET)
 * - GEMINI_API_KEY: Google Gemini API key (SECRET)
 *
 * FAILURE MODE: Falls back to alternative providers, returns error if all fail
 */

import { logger } from '@/lib/logger';

// Provider types
export type ImageProvider = 'stability' | 'dalle' | 'gemini';

// Image generation options
export interface ImageGenerationOptions {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  style?: 'photorealistic' | 'artistic' | 'anime' | 'digital-art' | 'cinematic' | 'minimalist';
  quality?: 'standard' | 'hd';
  provider?: ImageProvider;
  seed?: number;
  steps?: number;
  guidanceScale?: number;
}

// Generation result
export interface ImageGenerationResult {
  success: boolean;
  imageUrl?: string;
  imageBase64?: string;
  provider: ImageProvider;
  metadata?: {
    seed?: number;
    width: number;
    height: number;
    model: string;
  };
  error?: string;
}

// Provider configurations
const STABILITY_API_BASE = 'https://api.stability.ai/v2beta';
const OPENAI_API_BASE = 'https://api.openai.com/v1';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// Aspect ratio to dimensions mapping
const ASPECT_RATIOS: Record<string, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1792, height: 1024 },
  '9:16': { width: 1024, height: 1792 },
  '4:3': { width: 1365, height: 1024 },
  '3:4': { width: 1024, height: 1365 },
};

// Style presets for enhanced prompts
const STYLE_PROMPTS: Record<string, string> = {
  photorealistic: 'Photorealistic, high detail, professional photography, 8k resolution',
  artistic: 'Artistic interpretation, creative, visually striking, painterly',
  anime: 'Anime style, vibrant colors, clean lines, Japanese animation aesthetic',
  'digital-art': 'Digital art, modern, sleek, professional illustration',
  cinematic: 'Cinematic, dramatic lighting, movie poster quality, epic scene',
  minimalist: 'Minimalist design, clean, simple, lots of whitespace, modern',
};

/**
 * Generate image using Stability AI (SDXL)
 */
async function generateWithStability(
  options: ImageGenerationOptions
): Promise<ImageGenerationResult> {
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) {
    return { success: false, provider: 'stability', error: 'STABILITY_API_KEY not configured' };
  }

  const dimensions = options.aspectRatio
    ? ASPECT_RATIOS[options.aspectRatio]
    : { width: options.width || 1024, height: options.height || 1024 };

  const stylePrompt = options.style ? STYLE_PROMPTS[options.style] : '';
  const fullPrompt = stylePrompt ? `${options.prompt}. ${stylePrompt}` : options.prompt;

  try {
    const response = await fetch(`${STABILITY_API_BASE}/stable-image/generate/sd3`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        prompt: fullPrompt,
        negative_prompt: options.negativePrompt || 'blurry, low quality, distorted, deformed',
        width: dimensions.width,
        height: dimensions.height,
        seed: options.seed || Math.floor(Math.random() * 2147483647),
        steps: options.steps || 30,
        cfg_scale: options.guidanceScale || 7,
        output_format: 'png',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Stability API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      success: true,
      provider: 'stability',
      imageBase64: data.artifacts?.[0]?.base64 || data.image,
      metadata: {
        seed: data.artifacts?.[0]?.seed,
        width: dimensions.width,
        height: dimensions.height,
        model: 'stable-diffusion-3',
      },
    };
  } catch (error: any) {
    logger.error('Stability AI generation failed:', { error });
    return { success: false, provider: 'stability', error: error.message };
  }
}

/**
 * Generate image using OpenAI DALL-E 3
 */
async function generateWithDalle(
  options: ImageGenerationOptions
): Promise<ImageGenerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { success: false, provider: 'dalle', error: 'OPENAI_API_KEY not configured' };
  }

  // DALL-E 3 supports specific sizes
  let size: '1024x1024' | '1792x1024' | '1024x1792' = '1024x1024';
  if (options.aspectRatio === '16:9') size = '1792x1024';
  else if (options.aspectRatio === '9:16') size = '1024x1792';

  const stylePrompt = options.style ? STYLE_PROMPTS[options.style] : '';
  const fullPrompt = stylePrompt ? `${options.prompt}. ${stylePrompt}` : options.prompt;

  try {
    const response = await fetch(`${OPENAI_API_BASE}/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: fullPrompt,
        n: 1,
        size,
        quality: options.quality || 'standard',
        response_format: 'b64_json',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `DALL-E API error: ${response.status}`);
    }

    const data = await response.json();
    const [width, height] = size.split('x').map(Number);

    return {
      success: true,
      provider: 'dalle',
      imageBase64: data.data?.[0]?.b64_json,
      imageUrl: data.data?.[0]?.url,
      metadata: {
        width,
        height,
        model: 'dall-e-3',
      },
    };
  } catch (error: any) {
    logger.error('DALL-E generation failed:', { error });
    return { success: false, provider: 'dalle', error: error.message };
  }
}

/**
 * Generate image using Google Gemini Imagen
 */
async function generateWithGemini(
  options: ImageGenerationOptions
): Promise<ImageGenerationResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { success: false, provider: 'gemini', error: 'GEMINI_API_KEY not configured' };
  }

  const stylePrompt = options.style ? STYLE_PROMPTS[options.style] : '';
  const fullPrompt = stylePrompt ? `${options.prompt}. ${stylePrompt}` : options.prompt;

  try {
    const response = await fetch(
      `${GEMINI_API_BASE}/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Generate an image: ${fullPrompt}`,
            }],
          }],
          generationConfig: {
            responseModalities: ['image', 'text'],
            responseMimeType: 'image/png',
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `Gemini API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract image from response
    const imagePart = data.candidates?.[0]?.content?.parts?.find(
      (part: any) => part.inlineData?.mimeType?.startsWith('image/')
    );

    if (!imagePart) {
      throw new Error('No image in Gemini response');
    }

    const dimensions = options.aspectRatio
      ? ASPECT_RATIOS[options.aspectRatio]
      : { width: 1024, height: 1024 };

    return {
      success: true,
      provider: 'gemini',
      imageBase64: imagePart.inlineData.data,
      metadata: {
        width: dimensions.width,
        height: dimensions.height,
        model: 'gemini-2.0-flash-exp',
      },
    };
  } catch (error: any) {
    logger.error('Gemini generation failed:', { error });
    return { success: false, provider: 'gemini', error: error.message };
  }
}

/**
 * Main image generation function with provider fallback
 */
export async function generateImage(
  options: ImageGenerationOptions
): Promise<ImageGenerationResult> {
  const providers: ImageProvider[] = options.provider
    ? [options.provider]
    : ['stability', 'dalle', 'gemini'];

  for (const provider of providers) {
    logger.info(`Attempting image generation with ${provider}`, {
      prompt: options.prompt.substring(0, 100),
    });

    let result: ImageGenerationResult;

    switch (provider) {
      case 'stability':
        result = await generateWithStability(options);
        break;
      case 'dalle':
        result = await generateWithDalle(options);
        break;
      case 'gemini':
        result = await generateWithGemini(options);
        break;
      default:
        continue;
    }

    if (result.success) {
      logger.info(`Image generated successfully with ${provider}`);
      return result;
    }

    logger.warn(`${provider} failed, trying next provider`, { error: result.error });
  }

  return {
    success: false,
    provider: providers[0],
    error: 'All image generation providers failed',
  };
}

/**
 * Generate multiple image variations
 */
export async function generateVariations(
  options: ImageGenerationOptions,
  count: number = 4
): Promise<ImageGenerationResult[]> {
  const results: ImageGenerationResult[] = [];

  // Generate variations by modifying seed
  const baseSeed = options.seed || Math.floor(Math.random() * 1000000);

  for (let i = 0; i < count; i++) {
    const variationOptions = {
      ...options,
      seed: baseSeed + i * 1000,
    };

    const result = await generateImage(variationOptions);
    results.push(result);

    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}

/**
 * Enhance prompt for better results
 */
export function enhancePrompt(
  prompt: string,
  style?: string,
  brandColors?: string[]
): string {
  let enhanced = prompt;

  // Add style enhancement
  if (style && STYLE_PROMPTS[style]) {
    enhanced = `${enhanced}. ${STYLE_PROMPTS[style]}`;
  }

  // Add brand colors if provided
  if (brandColors && brandColors.length > 0) {
    const colorText = brandColors.join(', ');
    enhanced = `${enhanced}. Color palette: ${colorText}`;
  }

  // Add quality keywords
  enhanced = `${enhanced}. High quality, detailed, professional`;

  return enhanced;
}

/**
 * Validate image dimensions for platform requirements
 */
export function getOptimalDimensions(
  platform: string
): { width: number; height: number; aspectRatio: string } {
  const platformDimensions: Record<string, { width: number; height: number; aspectRatio: string }> = {
    instagram_feed: { width: 1080, height: 1080, aspectRatio: '1:1' },
    instagram_story: { width: 1080, height: 1920, aspectRatio: '9:16' },
    twitter: { width: 1600, height: 900, aspectRatio: '16:9' },
    linkedin: { width: 1200, height: 627, aspectRatio: '16:9' },
    facebook: { width: 1200, height: 630, aspectRatio: '16:9' },
    tiktok: { width: 1080, height: 1920, aspectRatio: '9:16' },
    youtube_thumbnail: { width: 1280, height: 720, aspectRatio: '16:9' },
  };

  return platformDimensions[platform] || { width: 1024, height: 1024, aspectRatio: '1:1' };
}

// Export singleton functions
export const imageGenerationService = {
  generate: generateImage,
  generateVariations,
  enhancePrompt,
  getOptimalDimensions,
};
