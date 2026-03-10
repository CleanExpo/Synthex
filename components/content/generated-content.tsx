'use client';

/**
 * Generated Content Component
 * Display and manage generated content
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Edit, RefreshCw, Copy, Save, Clock } from '@/components/icons';
import type { GeneratedContentData } from './types';

interface GeneratedContentProps {
  content: GeneratedContentData | null;
  selectedVariation: number;
  onVariationChange: (variation: number) => void;
  editMode: boolean;
  onEditModeToggle: () => void;
  editedContent: string;
  onEditedContentChange: (content: string) => void;
  onRefresh: () => void;
  onCopy: (content: string) => void;
  onSave: () => void;
  onSchedule: () => void;
}

export function GeneratedContent({
  content,
  selectedVariation,
  onVariationChange,
  editMode,
  onEditModeToggle,
  editedContent,
  onEditedContentChange,
  onRefresh,
  onCopy,
  onSave,
  onSchedule,
}: GeneratedContentProps) {
  const getContentToDisplay = () => {
    if (!content) return '';
    if (editMode) return editedContent;
    if (selectedVariation === 0) return content.primary;
    return content.variations[selectedVariation - 1] || '';
  };

  return (
    <Card variant="glass">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Generated Content</CardTitle>
            <CardDescription className="text-gray-400">
              AI-generated content based on your settings
            </CardDescription>
          </div>
          {content && (
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={onEditModeToggle}
                className="text-gray-400"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onRefresh}
                className="text-gray-400"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {content ? (
          <div className="space-y-4">
            {/* Variations Tabs */}
            <Tabs value={String(selectedVariation)} onValueChange={(v) => onVariationChange(Number(v))}>
              <TabsList className="grid grid-cols-4 bg-white/5">
                <TabsTrigger value="0">Primary</TabsTrigger>
                <TabsTrigger value="1">Variation 1</TabsTrigger>
                <TabsTrigger value="2">Variation 2</TabsTrigger>
                <TabsTrigger value="3">Variation 3</TabsTrigger>
              </TabsList>
              <TabsContent value={String(selectedVariation)} className="mt-4">
                {editMode ? (
                  <Textarea
                    value={editedContent}
                    onChange={(e) => onEditedContentChange(e.target.value)}
                    className="min-h-[200px] bg-white/5 border-white/10 text-white"
                  />
                ) : (
                  <div className="p-4 bg-white/5 rounded-lg">
                    <p className="text-white whitespace-pre-wrap">
                      {getContentToDisplay()}
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Metadata */}
            {content.metadata && (
              <div className="p-4 bg-white/5 rounded-lg space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Platform</span>
                  <span className="text-white capitalize">{content.metadata.platform}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Hook Type</span>
                  <span className="text-white capitalize">{content.metadata.hookType}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Character Count</span>
                  <span className="text-white">{content.metadata.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Est. Engagement</span>
                  <span className="text-white">{content.metadata.estimatedEngagement}%</span>
                </div>
                {content.metadata.hashtags.length > 0 && (
                  <div className="pt-2 border-t border-white/10">
                    <p className="text-xs text-gray-400 mb-1">Hashtags</p>
                    <div className="flex flex-wrap gap-1">
                      {content.metadata.hashtags.map((tag: string, i: number) => (
                        <span key={i} className="text-xs bg-cyan-500/20 text-cyan-300 px-2 py-1 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex space-x-2">
              <Button
                onClick={() => onCopy(getContentToDisplay())}
                variant="outline"
                className="flex-1 bg-white/5 border-white/10 text-white hover:bg-white/10"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
              <Button
                onClick={onSave}
                variant="outline"
                className="flex-1 bg-white/5 border-white/10 text-white hover:bg-white/10"
              >
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
              <Button
                onClick={onSchedule}
                className="flex-1 gradient-primary text-white"
              >
                <Clock className="mr-2 h-4 w-4" />
                Schedule
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <Sparkles className="h-16 w-16 mx-auto mb-4 text-gray-500" />
            <h3 className="text-xl font-semibold text-white mb-2">No Content Yet</h3>
            <p className="text-gray-400">
              Configure your settings and click generate to create content
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
