'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardSkeleton } from '@/components/skeletons';
import { APIErrorCard } from '@/components/error-states';
import toast from 'react-hot-toast';

import {
  type Device,
  type MediaType,
  type PreviewMode,
  platformConfigs,
  getValidationErrors,
  extractHashtags,
  extractMentions,
  exportContent,
  SandboxHeader,
  ContentEditor,
  PreviewPanel,
} from '@/components/sandbox';

export default function SandboxPage() {
  const [content, setContent] = useState('');
  const [platform, setPlatform] = useState('twitter');
  const [device, setDevice] = useState<Device>('mobile');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('visual');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [mentions, setMentions] = useState<string[]>([]);
  const [mediaType, setMediaType] = useState<MediaType>('none');
  const [characterCount, setCharacterCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const config = platformConfigs[platform];

  // Initialize sandbox
  useEffect(() => {
    const initSandbox = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 400));
        setIsLoading(false);
      } catch {
        setError('Failed to initialize sandbox');
        setIsLoading(false);
      }
    };
    initSandbox();
  }, []);

  useEffect(() => {
    // Update counts
    setCharacterCount(content.length);
    setWordCount(content.split(/\s+/).filter(Boolean).length);

    // Extract hashtags and mentions
    const hashtagMatches = extractHashtags(content);
    const mentionMatches = extractMentions(content);
    setHashtags(hashtagMatches);
    setMentions(mentionMatches);

    // Validate content
    setValidationErrors(getValidationErrors(content, config, platform, hashtagMatches));
  }, [content, platform, config]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content);
    toast.success('Content copied to clipboard!');
  }, [content]);

  const handleExport = useCallback(() => {
    exportContent(content, platform);
    toast.success('Content exported!');
  }, [content, platform]);

  const handleReset = useCallback(() => {
    setContent('');
    setHashtags([]);
    setMentions([]);
    setValidationErrors([]);
    toast.success('Content reset');
  }, []);

  const handleShare = useCallback(async () => {
    if (!content.trim()) {
      toast.error('Please add some content first');
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${config.name} Post Preview`,
          text: content,
        });
        toast.success('Content shared!');
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          navigator.clipboard.writeText(content);
          toast.success('Content copied to clipboard!');
        }
      }
    } else {
      navigator.clipboard.writeText(content);
      toast.success('Content copied to clipboard for sharing!');
    }
  }, [content, config.name]);

  const handleRetry = useCallback(() => {
    setError(null);
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 400);
  }, []);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="p-6">
        <APIErrorCard
          title="Sandbox Error"
          message={error}
          onRetry={handleRetry}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SandboxHeader onReset={handleReset} onExport={handleExport} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ContentEditor
          platform={platform}
          onPlatformChange={setPlatform}
          content={content}
          onContentChange={setContent}
          maxChars={config.maxChars}
          characterCount={characterCount}
          wordCount={wordCount}
          mediaType={mediaType}
          onMediaTypeChange={setMediaType}
          hashtags={hashtags}
          mentions={mentions}
          validationErrors={validationErrors}
          onCopy={handleCopy}
          onShare={handleShare}
        />

        <PreviewPanel
          platform={platform}
          content={content}
          mediaType={mediaType}
          device={device}
          onDeviceChange={setDevice}
          previewMode={previewMode}
          onPreviewModeChange={setPreviewMode}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
          hashtags={hashtags}
          mentions={mentions}
          characterCount={characterCount}
          wordCount={wordCount}
        />
      </div>
    </div>
  );
}
