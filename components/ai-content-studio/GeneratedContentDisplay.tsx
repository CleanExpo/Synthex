'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sparkles, Copy, Download, RefreshCw, Zap, TrendingUp,
  Hash, Target, Check, MessageSquare
} from '@/components/icons';
import { platformIcons } from './constants';
import { getViralScoreColor, getEngagementColor } from './constants';
import type { GeneratedContent } from './types';

interface GeneratedContentDisplayProps {
  generatedContent: GeneratedContent | null;
  selectedVariation: number;
  setSelectedVariation: (v: number) => void;
  copiedContent: string;
  platform: string;
  onCopy: (text: string, type: string) => void;
  onDownload: () => void;
  onRegenerate: () => void;
}

export function GeneratedContentDisplay({
  generatedContent,
  selectedVariation,
  setSelectedVariation,
  copiedContent,
  platform,
  onCopy,
  onDownload,
  onRegenerate,
}: GeneratedContentDisplayProps) {
  const PlatformIcon = platformIcons[platform as keyof typeof platformIcons] || MessageSquare;

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlatformIcon className="w-5 h-5 text-cyan-500" />
            Generated Content
          </div>
          {generatedContent && (
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                aria-label="Copy content"
                onClick={() => onCopy(
                  selectedVariation === 0
                    ? generatedContent.content
                    : generatedContent.variations[selectedVariation - 1].content,
                  'content'
                )}
              >
                {copiedContent === 'content' ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
              <Button size="icon" variant="ghost" aria-label="Download content" onClick={onDownload}>
                <Download className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" aria-label="Regenerate content" onClick={onRegenerate}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardTitle>
        {generatedContent && (
          <CardDescription>
            Generated in {generatedContent.metadata.processingTime}ms using {generatedContent.metadata.model}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {generatedContent ? (
          <>
            {/* Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-white/5 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Viral Score</span>
                  <TrendingUp className={`w-4 h-4 ${getViralScoreColor(generatedContent.viralScore)}`} />
                </div>
                <p className={`text-2xl font-bold ${getViralScoreColor(generatedContent.viralScore)}`}>
                  {generatedContent.viralScore}%
                </p>
              </div>
              <div className="p-3 bg-white/5 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Est. Engagement</span>
                  <Zap className={`w-4 h-4 ${getEngagementColor(generatedContent.estimatedEngagement)}`} />
                </div>
                <p className={`text-2xl font-bold ${getEngagementColor(generatedContent.estimatedEngagement)}`}>
                  {generatedContent.estimatedEngagement}%
                </p>
              </div>
            </div>

            {/* Content Variations */}
            <Tabs value={selectedVariation.toString()} onValueChange={(v) => setSelectedVariation(parseInt(v))}>
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="0">Original</TabsTrigger>
                {generatedContent.variations.slice(0, 2).map((_, index) => (
                  <TabsTrigger key={index + 1} value={(index + 1).toString()}>
                    Variation {index + 1}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value="0" className="mt-4">
                <div className="p-4 bg-white/5 rounded-lg">
                  <p className="whitespace-pre-wrap">{generatedContent.content}</p>
                </div>
              </TabsContent>
              {generatedContent.variations.slice(0, 2).map((variation, index) => (
                <TabsContent key={index + 1} value={(index + 1).toString()} className="mt-4">
                  <div className="p-4 bg-white/5 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">{variation.style}</Badge>
                      <span className="text-sm text-gray-400">Score: {variation.score.toFixed(0)}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{variation.content}</p>
                  </div>
                </TabsContent>
              ))}
            </Tabs>

            {/* Hashtags */}
            {generatedContent.hashtags.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Hash className="w-4 h-4" />
                    Hashtags
                  </Label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onCopy(generatedContent.hashtags.join(' '), 'hashtags')}
                  >
                    {copiedContent === 'hashtags' ? (
                      <Check className="w-3 h-3 text-green-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {generatedContent.hashtags.map((tag, index) => (
                    <Badge key={index} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Hooks */}
            {generatedContent.hooks.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Hook Options
                </Label>
                <div className="space-y-2">
                  {generatedContent.hooks.map((hook, index) => (
                    <div
                      key={index}
                      className="p-2 bg-white/5 rounded-lg hover:bg-white/10 cursor-pointer transition-colors"
                      onClick={() => onCopy(hook, `hook-${index}`)}
                    >
                      <p className="text-sm">{hook}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            {generatedContent.cta && (
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <Label className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4" />
                  Call to Action
                </Label>
                <p className="text-sm">{generatedContent.cta}</p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <Sparkles className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Generate content to see it here</p>
            <p className="text-sm text-gray-500 mt-2">AI-powered content will appear instantly</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
