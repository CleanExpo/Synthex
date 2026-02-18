/**
 * Image Gallery Component
 *
 * @description Responsive grid display for generated images with loading
 * and empty states.
 */

'use client';

import { ImageResult } from '@/hooks/use-image-generation';
import { ImagePreviewCard, ImagePreviewCardSkeleton } from './image-preview-card';
import { Image as ImageIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface ImageGalleryProps {
  images: ImageResult[];
  isLoading?: boolean;
  emptyMessage?: string;
  skeletonCount?: number;
  onImageSelect?: (image: ImageResult) => void;
  onDownload?: (image: ImageResult) => void;
  onCopy?: (image: ImageResult) => void;
  onSaveToLibrary?: (image: ImageResult) => void;
  showMetadata?: boolean;
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ImageGallery({
  images,
  isLoading = false,
  emptyMessage = 'No images generated yet',
  skeletonCount = 4,
  onImageSelect,
  onDownload,
  onCopy,
  onSaveToLibrary,
  showMetadata = true,
  className,
}: ImageGalleryProps) {
  // Loading state - show skeletons
  if (isLoading && images.length === 0) {
    return (
      <div
        className={cn(
          'grid gap-4',
          'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
          className
        )}
      >
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <ImagePreviewCardSkeleton key={`skeleton-${i}`} />
        ))}
      </div>
    );
  }

  // Empty state
  if (!isLoading && images.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-12',
          'text-center',
          className
        )}
      >
        <div className="p-4 rounded-full bg-white/5 border border-white/10 mb-4">
          <ImageIcon className="h-8 w-8 text-gray-500" />
        </div>
        <p className="text-gray-400">{emptyMessage}</p>
        <p className="text-sm text-gray-500 mt-1">
          Generate some images to see them here
        </p>
      </div>
    );
  }

  // Gallery grid
  return (
    <div
      className={cn(
        'grid gap-4',
        'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
        className
      )}
    >
      {images.map((image, index) => (
        <div
          key={image.mediaAssetId || `image-${index}`}
          className={cn(
            'cursor-pointer transition-transform duration-200',
            onImageSelect && 'hover:scale-[1.02]'
          )}
          onClick={() => onImageSelect?.(image)}
        >
          <ImagePreviewCard
            image={image}
            showMetadata={showMetadata}
            onDownload={() => onDownload?.(image)}
            onCopy={() => onCopy?.(image)}
            onSaveToLibrary={
              onSaveToLibrary ? () => onSaveToLibrary(image) : undefined
            }
          />
        </div>
      ))}

      {/* Show skeleton at end while loading more */}
      {isLoading &&
        images.length > 0 &&
        Array.from({ length: 2 }).map((_, i) => (
          <ImagePreviewCardSkeleton key={`loading-${i}`} />
        ))}
    </div>
  );
}

// ============================================================================
// SINGLE IMAGE DISPLAY VARIANT
// ============================================================================

interface SingleImageDisplayProps {
  image: ImageResult | null;
  isLoading?: boolean;
  onDownload?: () => void;
  onCopy?: () => void;
  onSaveToLibrary?: () => void;
  showMetadata?: boolean;
  className?: string;
}

export function SingleImageDisplay({
  image,
  isLoading = false,
  onDownload,
  onCopy,
  onSaveToLibrary,
  showMetadata = true,
  className,
}: SingleImageDisplayProps) {
  if (isLoading) {
    return (
      <div
        className={cn(
          'w-full max-w-md mx-auto',
          className
        )}
      >
        <ImagePreviewCardSkeleton />
      </div>
    );
  }

  if (!image) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-12',
          'text-center',
          className
        )}
      >
        <div className="p-4 rounded-full bg-white/5 border border-white/10 mb-4">
          <ImageIcon className="h-8 w-8 text-gray-500" />
        </div>
        <p className="text-gray-400">No image generated</p>
        <p className="text-sm text-gray-500 mt-1">
          Enter a prompt and click Generate
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'w-full max-w-md mx-auto',
        className
      )}
    >
      <ImagePreviewCard
        image={image}
        showMetadata={showMetadata}
        onDownload={onDownload}
        onCopy={onCopy}
        onSaveToLibrary={onSaveToLibrary}
      />
    </div>
  );
}
