/**
 * AI Images Dashboard Page
 *
 * @description Two-column layout with image generator and gallery.
 * Requires Professional subscription or higher.
 */

'use client';

import { useState, useCallback } from 'react';
import { useImageGeneration, ImageResult } from '@/hooks/use-image-generation';
import { ImageGenerator } from '@/components/ai/image-generator';
import { ImageGallery } from '@/components/ai/image-gallery';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@/hooks/use-user';
import {
  Image,
  Crown,
  Sparkles,
  Trash2,
  Download,
} from '@/components/icons';
import Link from 'next/link';
import { notify } from '@/lib/notifications';

export default function AIImagesPage() {
  const { user, isLoading: userLoading } = useUser();
  const { clearResults } = useImageGeneration();
  const [generatedImages, setGeneratedImages] = useState<ImageResult[]>([]);

  // Check subscription (Professional+ required)
  const hasProfessional =
    user?.subscriptionTier === 'professional' ||
    user?.subscriptionTier === 'enterprise' ||
    user?.subscriptionTier === 'agency';

  // Handle generated image
  const handleImageGenerated = useCallback((result: ImageResult) => {
    if (result.success) {
      setGeneratedImages((prev) => [result, ...prev]);
      notify.success('Image generated successfully!');
    }
  }, []);

  // Clear gallery
  const handleClearGallery = useCallback(() => {
    setGeneratedImages([]);
    clearResults();
  }, [clearResults]);

  // Download image
  const handleDownload = useCallback((image: ImageResult) => {
    if (!image.imageBase64 && !image.imageUrl) return;

    const link = document.createElement('a');
    link.href = image.imageBase64
      ? `data:image/png;base64,${image.imageBase64}`
      : image.imageUrl!;
    link.download = `synthex-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify.success('Image downloaded');
  }, []);

  // Copy to clipboard
  const handleCopy = useCallback(async (image: ImageResult) => {
    if (!image.imageBase64) {
      notify.error('Cannot copy this image');
      return;
    }

    try {
      const byteCharacters = atob(image.imageBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      notify.success('Image copied to clipboard');
    } catch (err) {
      notify.error('Failed to copy image');
    }
  }, []);

  // Loading state while checking user
  if (userLoading) {
    return null; // Let loading.tsx handle this
  }

  // Upgrade required state
  if (!hasProfessional) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-start gap-3 mb-8">
          <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20">
            <Image className="h-6 w-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">AI Image Generation</h1>
            <p className="text-gray-400">Generate stunning visuals for your social content</p>
          </div>
        </div>

        <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30">
          <CardContent className="py-12">
            <div className="text-center max-w-md mx-auto">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/20 mb-4">
                <Crown className="w-8 h-8 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                Upgrade to Professional
              </h3>
              <p className="text-gray-300 mb-6">
                AI Image Generation is available on Professional plan and above.
                Create unlimited AI-powered images for your social media content.
              </p>
              <Button asChild className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                <Link href="/dashboard/billing">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Upgrade Now
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Page Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20">
            <Image className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">AI Image Generation</h1>
            <p className="text-sm text-gray-400">Generate visuals for your social content</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {generatedImages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearGallery}
              className="bg-white/5 border-white/10 hover:bg-white/10"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Gallery
            </Button>
          )}
          <Badge variant="outline" className="bg-cyan-500/10 border-cyan-500/30 text-cyan-300">
            Professional
          </Badge>
        </div>
      </div>

      {/* Main content - two column layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Generator panel */}
        <div className="w-full lg:w-[450px] lg:border-r border-white/10 overflow-y-auto p-6 bg-[#0f172a]/30">
          <ImageGenerator onGenerate={handleImageGenerated} />
        </div>

        {/* Gallery panel */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#0a0f1a]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Generated Images
              {generatedImages.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-400">
                  ({generatedImages.length})
                </span>
              )}
            </h2>
            {generatedImages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => generatedImages.forEach(handleDownload)}
                className="text-gray-400 hover:text-white"
              >
                <Download className="h-4 w-4 mr-2" />
                Download All
              </Button>
            )}
          </div>

          <ImageGallery
            images={generatedImages}
            onDownload={handleDownload}
            onCopy={handleCopy}
            emptyMessage="No images generated yet"
          />
        </div>
      </div>
    </div>
  );
}
