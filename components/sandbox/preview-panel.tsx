'use client';

/**
 * Preview Panel Component
 * Live preview with device selector and view modes
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, Code, Maximize2, Minimize2, XCircle } from '@/components/icons';
import { devicePresets } from './sandbox-config';
import { PlatformMockup } from './platform-mockups';
import type { Device, MediaType, PreviewMode } from './types';

interface PreviewPanelProps {
  platform: string;
  content: string;
  mediaType: MediaType;
  device: Device;
  onDeviceChange: (device: Device) => void;
  previewMode: PreviewMode;
  onPreviewModeChange: (mode: PreviewMode) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  hashtags: string[];
  mentions: string[];
  characterCount: number;
  wordCount: number;
}

export function PreviewPanel({
  platform,
  content,
  mediaType,
  device,
  onDeviceChange,
  previewMode,
  onPreviewModeChange,
  isFullscreen,
  onToggleFullscreen,
  hashtags,
  mentions,
  characterCount,
  wordCount,
}: PreviewPanelProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Live Preview</CardTitle>
            <CardDescription className="text-gray-400">
              See how your content will look
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            {/* Device Selector */}
            <div className="flex space-x-1 bg-white/5 rounded-lg p-1">
              {Object.entries(devicePresets).map(([key, preset]) => {
                const Icon = preset.icon;
                return (
                  <button
                    key={key}
                    onClick={() => onDeviceChange(key as Device)}
                    className={`p-2 rounded transition-all ${
                      device === key
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'text-gray-400 hover:text-white'
                    }`}
                    title={preset.label}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={onToggleFullscreen}
              className="text-gray-400"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={previewMode} onValueChange={(v) => onPreviewModeChange(v as PreviewMode)}>
          <TabsList className="grid grid-cols-2 bg-white/5">
            <TabsTrigger value="visual">
              <Eye className="mr-2 h-4 w-4" />
              Visual
            </TabsTrigger>
            <TabsTrigger value="code">
              <Code className="mr-2 h-4 w-4" />
              Code
            </TabsTrigger>
          </TabsList>
          <TabsContent value="visual" className="mt-4">
            <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-gray-900 p-8' : ''}`}>
              {isFullscreen && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onToggleFullscreen}
                  className="absolute top-4 right-4 text-white"
                >
                  <XCircle className="h-5 w-5" />
                </Button>
              )}
              <div className={`mx-auto ${device === 'mobile' ? 'max-w-sm' : device === 'tablet' ? 'max-w-2xl' : 'max-w-4xl'}`}>
                <PlatformMockup platform={platform} content={content} mediaType={mediaType} />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="code" className="mt-4">
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-xs text-gray-300 overflow-x-auto">
                <code>{JSON.stringify({
                  platform,
                  content,
                  metadata: {
                    hashtags,
                    mentions,
                    mediaType,
                    characterCount,
                    wordCount,
                  }
                }, null, 2)}</code>
              </pre>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
