/**
 * Image Generator Component
 *
 * @description Form for AI image generation with style presets,
 * platform dimensions, and provider selection.
 */

'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import {
  useImageGeneration,
  ImageGenerationOptions,
  ImageResult,
  ImageStyle,
  AspectRatio,
  ImageProvider,
} from '@/hooks/use-image-generation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Image,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  Camera,
  Palette,
  Video,
  Edit3,
  Wand2,
  Minus,
} from '@/components/icons';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface ImageGeneratorProps {
  onGenerate?: (result: ImageResult) => void;
  defaultPlatform?: string;
  className?: string;
}

// Style preset configuration with icons
const STYLE_PRESETS: {
  id: ImageStyle;
  label: string;
  icon: typeof Camera;
  description: string;
}[] = [
  {
    id: 'photorealistic',
    label: 'Photorealistic',
    icon: Camera,
    description: 'High-quality, realistic photos',
  },
  {
    id: 'artistic',
    label: 'Artistic',
    icon: Palette,
    description: 'Creative, painterly style',
  },
  {
    id: 'anime',
    label: 'Anime',
    icon: Sparkles,
    description: 'Japanese animation style',
  },
  {
    id: 'digital-art',
    label: 'Digital Art',
    icon: Edit3,
    description: 'Modern digital illustration',
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    icon: Video,
    description: 'Movie-like dramatic scenes',
  },
  {
    id: 'minimalist',
    label: 'Minimalist',
    icon: Minus,
    description: 'Clean, simple designs',
  },
];

// Platform presets
const PLATFORM_PRESETS = [
  { id: 'instagram_feed', label: 'Instagram Feed', ratio: '1:1' },
  { id: 'instagram_story', label: 'Instagram Story', ratio: '9:16' },
  { id: 'twitter', label: 'Twitter/X', ratio: '16:9' },
  { id: 'linkedin', label: 'LinkedIn', ratio: '16:9' },
  { id: 'facebook', label: 'Facebook', ratio: '16:9' },
  { id: 'tiktok', label: 'TikTok', ratio: '9:16' },
  { id: 'youtube_thumbnail', label: 'YouTube Thumbnail', ratio: '16:9' },
];

// Aspect ratio options
const ASPECT_RATIOS: { id: AspectRatio; label: string }[] = [
  { id: '1:1', label: 'Square (1:1)' },
  { id: '16:9', label: 'Landscape (16:9)' },
  { id: '9:16', label: 'Portrait (9:16)' },
  { id: '4:3', label: 'Standard (4:3)' },
  { id: '3:4', label: 'Portrait (3:4)' },
];

// Provider options
const PROVIDERS: { id: ImageProvider | 'auto'; label: string; description: string }[] = [
  { id: 'auto', label: 'Auto', description: 'Best available provider' },
  { id: 'stability', label: 'Stability AI', description: 'Stable Diffusion 3' },
  { id: 'dalle', label: 'DALL·E 3', description: 'OpenAI' },
  { id: 'gemini', label: 'Gemini', description: 'Google Imagen' },
];

// Constants
const MAX_PROMPT_LENGTH = 4000;
const MAX_NEGATIVE_PROMPT_LENGTH = 2000;
const LINE_HEIGHT = 24;
const MAX_ROWS = 6;

// ============================================================================
// COMPONENT
// ============================================================================

export function ImageGenerator({
  onGenerate,
  defaultPlatform,
  className,
}: ImageGeneratorProps) {
  // State
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<ImageStyle>('photorealistic');
  const [selectedPlatform, setSelectedPlatform] = useState(defaultPlatform || '');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [selectedProvider, setSelectedProvider] = useState<ImageProvider | 'auto'>('auto');
  const [quality, setQuality] = useState<'standard' | 'hd'>('standard');
  const [enhancePrompt, setEnhancePrompt] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Hook
  const { generate, isGenerating, error, clearError } = useImageGeneration();

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const maxHeight = LINE_HEIGHT * MAX_ROWS;
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    }
  }, [prompt]);

  // Update aspect ratio when platform changes
  useEffect(() => {
    if (selectedPlatform) {
      const platform = PLATFORM_PRESETS.find((p) => p.id === selectedPlatform);
      if (platform) {
        setAspectRatio(platform.ratio as AspectRatio);
      }
    }
  }, [selectedPlatform]);

  // Validation
  const isOverLimit = prompt.length > MAX_PROMPT_LENGTH;
  const isEmpty = !prompt.trim();
  const canGenerate = !isEmpty && !isOverLimit && !isGenerating;

  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canGenerate) return;

    clearError();

    const options: ImageGenerationOptions = {
      prompt: prompt.trim(),
      negativePrompt: negativePrompt.trim() || undefined,
      style: selectedStyle,
      aspectRatio,
      platform: selectedPlatform || undefined,
      provider: selectedProvider === 'auto' ? undefined : selectedProvider,
      quality,
      enhancePrompt,
      saveToLibrary: true,
    };

    const result = await generate(options);

    if (result?.success && onGenerate) {
      onGenerate(result);
    }
  };

  return (
    <Card
      className={cn(
        'bg-white/5 backdrop-blur-md border-white/10',
        'shadow-lg shadow-black/20',
        className
      )}
    >
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-white">
          <Image className="h-5 w-5 text-cyan-400" />
          Generate Image
        </CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Prompt input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">
              Describe your image
            </label>
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A vibrant sunset over a city skyline, golden hour lighting..."
                rows={2}
                disabled={isGenerating}
                className={cn(
                  'w-full resize-none rounded-xl px-4 py-3 text-sm',
                  'bg-white/5 border border-white/10 text-white placeholder:text-gray-500',
                  'focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'transition-colors duration-200',
                  isOverLimit && 'border-red-500/50 focus:ring-red-500/50'
                )}
                style={{ lineHeight: `${LINE_HEIGHT}px` }}
              />
            </div>
            <div className="flex justify-between items-center px-1 text-xs">
              <span className="text-gray-500">Be descriptive for best results</span>
              <span
                className={cn(isOverLimit ? 'text-red-400' : 'text-gray-500')}
              >
                {prompt.length}/{MAX_PROMPT_LENGTH}
              </span>
            </div>
          </div>

          {/* Style presets */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Style</label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {STYLE_PRESETS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedStyle(id)}
                  disabled={isGenerating}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-xl',
                    'border transition-all duration-200',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    selectedStyle === id
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Platform and Aspect Ratio */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Platform selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Platform
              </label>
              <Select
                value={selectedPlatform}
                onValueChange={setSelectedPlatform}
                disabled={isGenerating}
              >
                <SelectTrigger variant="glass">
                  <SelectValue placeholder="Select platform (optional)" />
                </SelectTrigger>
                <SelectContent variant="glass-solid">
                  <SelectItem value="">Custom dimensions</SelectItem>
                  {PLATFORM_PRESETS.map((platform) => (
                    <SelectItem key={platform.id} value={platform.id}>
                      <div className="flex items-center justify-between gap-2 w-full">
                        <span>{platform.label}</span>
                        <Badge variant="outline" className="text-xs">
                          {platform.ratio}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Aspect ratio override */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Aspect Ratio
              </label>
              <Select
                value={aspectRatio}
                onValueChange={(v) => setAspectRatio(v as AspectRatio)}
                disabled={isGenerating}
              >
                <SelectTrigger variant="glass">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent variant="glass-solid">
                  {ASPECT_RATIOS.map((ratio) => (
                    <SelectItem key={ratio.id} value={ratio.id}>
                      {ratio.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Advanced options toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            {showAdvanced ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            Advanced Options
          </button>

          {/* Advanced options */}
          {showAdvanced && (
            <div className="space-y-4 p-4 rounded-xl bg-white/5 border border-white/10">
              {/* Negative prompt */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">
                  Negative Prompt
                </label>
                <textarea
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="Things to avoid: blurry, low quality, distorted..."
                  rows={2}
                  disabled={isGenerating}
                  className={cn(
                    'w-full resize-none rounded-xl px-4 py-3 text-sm',
                    'bg-white/5 border border-white/10 text-white placeholder:text-gray-500',
                    'focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                />
                <div className="text-xs text-gray-500 text-right">
                  {negativePrompt.length}/{MAX_NEGATIVE_PROMPT_LENGTH}
                </div>
              </div>

              {/* Provider selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">
                  Provider
                </label>
                <Select
                  value={selectedProvider}
                  onValueChange={(v) =>
                    setSelectedProvider(v as ImageProvider | 'auto')
                  }
                  disabled={isGenerating}
                >
                  <SelectTrigger variant="glass">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent variant="glass-solid">
                    {PROVIDERS.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        <div className="flex items-center gap-2">
                          <span>{provider.label}</span>
                          <span className="text-xs text-gray-500">
                            {provider.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Quality toggle (for DALL-E) */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-300">
                    HD Quality
                  </label>
                  <p className="text-xs text-gray-500">
                    Higher quality (DALL·E 3 only)
                  </p>
                </div>
                <Switch
                  checked={quality === 'hd'}
                  onCheckedChange={(checked) =>
                    setQuality(checked ? 'hd' : 'standard')
                  }
                  disabled={isGenerating}
                  variant="glass-primary"
                />
              </div>

              {/* Enhance prompt toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-300">
                    Enhance Prompt
                  </label>
                  <p className="text-xs text-gray-500">
                    Add quality keywords automatically
                  </p>
                </div>
                <Switch
                  checked={enhancePrompt}
                  onCheckedChange={setEnhancePrompt}
                  disabled={isGenerating}
                  variant="glass-primary"
                />
              </div>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Generate button */}
          <Button
            type="submit"
            disabled={!canGenerate}
            className={cn(
              'w-full h-12 rounded-xl font-medium',
              'bg-gradient-to-r from-cyan-500 to-cyan-600',
              'hover:from-cyan-400 hover:to-cyan-500',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-all duration-200'
            )}
          >
            {isGenerating ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Wand2 className="h-4 w-4" />
                <span>Generate Image</span>
              </div>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
