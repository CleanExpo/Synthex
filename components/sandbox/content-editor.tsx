'use client';

/**
 * Content Editor Component
 * Main editor card with all input controls
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Share2 } from '@/components/icons';
import { PlatformSelector } from './platform-selector';
import { ContentInput } from './content-input';
import { MediaSelector } from './media-selector';
import { ExtractedElements } from './extracted-elements';
import { ValidationErrors } from './validation-errors';
import type { MediaType } from './types';

interface ContentEditorProps {
  platform: string;
  onPlatformChange: (platform: string) => void;
  content: string;
  onContentChange: (content: string) => void;
  maxChars: number;
  characterCount: number;
  wordCount: number;
  mediaType: MediaType;
  onMediaTypeChange: (type: MediaType) => void;
  hashtags: string[];
  mentions: string[];
  validationErrors: string[];
  onCopy: () => void;
  onShare: () => void;
}

export function ContentEditor({
  platform,
  onPlatformChange,
  content,
  onContentChange,
  maxChars,
  characterCount,
  wordCount,
  mediaType,
  onMediaTypeChange,
  hashtags,
  mentions,
  validationErrors,
  onCopy,
  onShare,
}: ContentEditorProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Content Editor</CardTitle>
        <CardDescription className="text-gray-400">
          Compose and edit your content
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <PlatformSelector selected={platform} onSelect={onPlatformChange} />

        <ContentInput
          content={content}
          onChange={onContentChange}
          maxChars={maxChars}
          characterCount={characterCount}
          wordCount={wordCount}
        />

        <MediaSelector value={mediaType} onChange={onMediaTypeChange} />

        <ExtractedElements hashtags={hashtags} mentions={mentions} />

        <ValidationErrors errors={validationErrors} />

        <div className="flex space-x-2">
          <Button
            onClick={onCopy}
            variant="outline"
            className="flex-1 bg-white/5 border-white/10 text-white hover:bg-white/10"
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy
          </Button>
          <Button onClick={onShare} className="flex-1 gradient-primary text-white">
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
