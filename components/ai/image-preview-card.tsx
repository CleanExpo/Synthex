/**
 * Image Preview Card Component
 *
 * @description Display card for a single generated image with actions overlay.
 */

'use client';

import { useState } from 'react';
import { ImageResult, ImageProvider } from '@/hooks/use-image-generation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  Copy,
  Save,
  AlertTriangle,
  Check,
  Image as ImageIcon,
} from '@/components/icons';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface ImagePreviewCardProps {
  image: ImageResult;
  onDownload?: () => void;
  onCopy?: () => void;
  onSaveToLibrary?: () => void;
  showMetadata?: boolean;
  className?: string;
}

// Provider display names
const PROVIDER_LABELS: Record<ImageProvider, string> = {
  stability: 'Stability AI',
  dalle: 'DALL·E 3',
  gemini: 'Gemini',
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ImagePreviewCard({
  image,
  onDownload,
  onCopy,
  onSaveToLibrary,
  showMetadata = true,
  className,
}: ImagePreviewCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);

  // Generate the image src from base64 or URL
  const imageSrc = image.imageBase64
    ? `data:image/png;base64,${image.imageBase64}`
    : image.imageUrl || '';

  // Handle copy to clipboard
  const handleCopy = async () => {
    if (!image.imageBase64) return;

    try {
      // Convert base64 to blob
      const response = await fetch(`data:image/png;base64,${image.imageBase64}`);
      const blob = await response.blob();

      // Copy to clipboard
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      onCopy?.();
    } catch (error) {
      console.error('Failed to copy image:', error);
    }
  };

  // Handle download
  const handleDownload = () => {
    if (!imageSrc) return;

    const link = document.createElement('a');
    link.href = imageSrc;
    link.download = `generated-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    onDownload?.();
  };

  // Error state
  if (!image.success) {
    return (
      <div
        className={cn(
          'relative aspect-square rounded-xl overflow-hidden',
          'bg-white/5 border border-white/10',
          'flex items-center justify-center',
          className
        )}
      >
        <div className="flex flex-col items-center gap-2 text-center p-4">
          <div className="p-2 rounded-full bg-red-500/20 border border-red-500/30">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <p className="text-sm text-red-300">{image.error || 'Failed to generate'}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative rounded-xl overflow-hidden group',
        'bg-white/5 border border-white/10',
        'transition-all duration-300',
        isHovered && 'border-cyan-500/30 shadow-lg shadow-cyan-500/10',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image */}
      <div className="aspect-square relative">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt="Generated image"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-900">
            <ImageIcon className="h-12 w-12 text-gray-700" />
          </div>
        )}

        {/* Provider badge */}
        <Badge
          variant="secondary"
          className={cn(
            'absolute top-2 left-2 text-xs',
            'bg-black/60 backdrop-blur-sm border-white/10 text-white'
          )}
        >
          {PROVIDER_LABELS[image.provider]}
        </Badge>

        {/* Hover overlay with actions */}
        <div
          className={cn(
            'absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent',
            'flex items-end justify-center p-4',
            'opacity-0 group-hover:opacity-100',
            'transition-opacity duration-300'
          )}
        >
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleDownload}
              className="bg-white/10 hover:bg-white/20 border-white/20"
            >
              <Download className="h-4 w-4" />
            </Button>

            <Button
              size="sm"
              variant="secondary"
              onClick={handleCopy}
              className="bg-white/10 hover:bg-white/20 border-white/20"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>

            {onSaveToLibrary && !image.mediaAssetId && (
              <Button
                size="sm"
                variant="secondary"
                onClick={onSaveToLibrary}
                className="bg-white/10 hover:bg-white/20 border-white/20"
              >
                <Save className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Metadata */}
      {showMetadata && image.metadata && (
        <div className="p-3 border-t border-white/10 space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>
              {image.metadata.width} × {image.metadata.height}
            </span>
            <span className="text-gray-500">{image.metadata.model}</span>
          </div>
          {image.metadata.seed !== undefined && (
            <div className="text-xs text-gray-500">
              Seed: {image.metadata.seed}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SKELETON
// ============================================================================

export function ImagePreviewCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative aspect-square rounded-xl overflow-hidden',
        'bg-white/5 border border-white/10',
        'animate-pulse',
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
      <div className="absolute bottom-3 left-3 right-3 h-4 bg-white/10 rounded" />
    </div>
  );
}
