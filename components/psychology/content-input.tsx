'use client';

/**
 * Content Input Form
 * Form for entering content to analyze
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, Brain, Loader2 } from '@/components/icons';
import { PLATFORMS, CONTENT_TYPES } from './config';
import type { Platform } from './types';

interface ContentInputProps {
  content: string;
  platform: string;
  contentType: string;
  targetAudience: string;
  isAnalyzing: boolean;
  onContentChange: (value: string) => void;
  onPlatformChange: (value: string) => void;
  onContentTypeChange: (value: string) => void;
  onTargetAudienceChange: (value: string) => void;
  onAnalyze: () => void;
}

export function ContentInput({
  content,
  platform,
  contentType,
  targetAudience,
  isAnalyzing,
  onContentChange,
  onPlatformChange,
  onContentTypeChange,
  onTargetAudienceChange,
  onAnalyze,
}: ContentInputProps) {
  const selectedPlatform = PLATFORMS.find((p) => p.id === platform);
  const maxLength = selectedPlatform?.maxLength || 5000;

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="flex items-center">
          <MessageSquare className="w-5 h-5 mr-2 text-cyan-400" />
          Content to Analyze
        </CardTitle>
        <CardDescription>
          Enter your marketing content for AI-powered psychology analysis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <textarea
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            placeholder="Enter your content here... (e.g., social media post, email subject line, ad copy)"
            className="w-full h-48 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
            maxLength={maxLength}
          />
          <div className="flex justify-between mt-2 text-sm text-gray-400">
            <span>{content.length} characters</span>
            <span>Max: {maxLength}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Platform
            </label>
            <select
              value={platform}
              onChange={(e) => onPlatformChange(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {PLATFORMS.map((p) => (
                <option key={p.id} value={p.id} className="bg-gray-800">
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Content Type
            </label>
            <select
              value={contentType}
              onChange={(e) => onContentTypeChange(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {CONTENT_TYPES.map((ct) => (
                <option key={ct.id} value={ct.id} className="bg-gray-800">
                  {ct.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Target Audience (optional)
          </label>
          <input
            type="text"
            value={targetAudience}
            onChange={(e) => onTargetAudienceChange(e.target.value)}
            placeholder="e.g., Tech professionals aged 25-45"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        <Button
          className="w-full gradient-primary text-white"
          onClick={onAnalyze}
          disabled={isAnalyzing || !content.trim()}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Brain className="w-4 h-4 mr-2" />
              Analyze Content
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
