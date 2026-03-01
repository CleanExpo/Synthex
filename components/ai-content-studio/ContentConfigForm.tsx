'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Sparkles, Wand2, Loader2, Smile, Hash, Target, Building
} from '@/components/icons';
import { platformIcons, platformColors } from './constants';
import type { Business, ContentFormData } from './types';

interface ContentConfigFormProps {
  formData: ContentFormData;
  setFormData: (data: ContentFormData | ((prev: ContentFormData) => ContentFormData)) => void;
  businesses: Business[];
  selectedBusinessId: string;
  setSelectedBusinessId: (id: string) => void;
  connectedPlatforms: Set<string>;
  loadingBusinesses: boolean;
  loadingConnections: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
}

export function ContentConfigForm({
  formData,
  setFormData,
  businesses,
  selectedBusinessId,
  setSelectedBusinessId,
  connectedPlatforms,
  loadingBusinesses,
  loadingConnections,
  isGenerating,
  onGenerate,
}: ContentConfigFormProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-cyan-500" />
          Content Configuration
        </CardTitle>
        <CardDescription>Customize your AI-generated content</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Business Selector */}
        {!loadingBusinesses && businesses.length > 1 && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Building className="w-4 h-4 text-cyan-500" />
              Creating for
            </Label>
            <Select value={selectedBusinessId} onValueChange={setSelectedBusinessId}>
              <SelectTrigger className="bg-white/5 border-cyan-500/10">
                <SelectValue placeholder="Select a business" />
              </SelectTrigger>
              <SelectContent>
                {businesses.map((biz) => (
                  <SelectItem key={biz.organizationId} value={biz.organizationId}>
                    {biz.displayName || biz.organizationName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {!loadingBusinesses && businesses.length === 1 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/5 border border-cyan-500/10 text-sm text-gray-300">
            <Building className="w-4 h-4 text-cyan-500 shrink-0" />
            <span>Creating for <span className="font-medium text-cyan-400">{businesses[0].displayName || businesses[0].organizationName}</span></span>
          </div>
        )}

        {/* Platform Selection */}
        <div className="space-y-2">
          <Label>Platform</Label>
          {loadingConnections ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading connected platforms...
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(platformIcons)
                .filter(([platform]) => {
                  if (!selectedBusinessId || connectedPlatforms.size === 0) return true;
                  return connectedPlatforms.has(platform);
                })
                .map(([platform, Icon]) => (
                  <Button
                    key={platform}
                    variant={formData.platform === platform ? 'default' : 'outline'}
                    className={formData.platform === platform ? platformColors[platform as keyof typeof platformColors] : ''}
                    onClick={() => setFormData({ ...formData, platform })}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {platform.charAt(0).toUpperCase() + platform.slice(1)}
                  </Button>
                ))}
              {selectedBusinessId && connectedPlatforms.size === 0 && !loadingConnections && (
                <p className="col-span-3 text-sm text-gray-500 text-center py-2">
                  No platforms connected for this business. Connect accounts in Settings.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Content Type */}
        <div className="space-y-2">
          <Label>Content Type</Label>
          <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="post">Single Post</SelectItem>
              <SelectItem value="caption">Caption</SelectItem>
              <SelectItem value="thread">Thread</SelectItem>
              <SelectItem value="story">Story</SelectItem>
              <SelectItem value="reel">Reel Script</SelectItem>
              <SelectItem value="article">Article</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Topic */}
        <div className="space-y-2">
          <Label>Topic or Theme</Label>
          <Textarea
            placeholder="E.g., sustainable fashion, AI productivity tools, healthy recipes..."
            value={formData.topic}
            onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
            className="bg-white/5 border-white/10"
          />
        </div>

        {/* Keywords */}
        <div className="space-y-2">
          <Label>Keywords (comma-separated)</Label>
          <Input
            placeholder="innovation, technology, future..."
            value={formData.keywords}
            onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
            className="bg-white/5 border-white/10"
          />
        </div>

        {/* Tone */}
        <div className="space-y-2">
          <Label>Tone</Label>
          <Select value={formData.tone} onValueChange={(value) => setFormData({ ...formData, tone: value })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="professional">Professional</SelectItem>
              <SelectItem value="casual">Casual</SelectItem>
              <SelectItem value="humorous">Humorous</SelectItem>
              <SelectItem value="inspirational">Inspirational</SelectItem>
              <SelectItem value="educational">Educational</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Target Audience */}
        <div className="space-y-2">
          <Label>Target Audience</Label>
          <Input
            placeholder="E.g., entrepreneurs, students, parents..."
            value={formData.targetAudience}
            onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
            className="bg-white/5 border-white/10"
          />
        </div>

        {/* Length */}
        <div className="space-y-2">
          <Label>Content Length</Label>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">Short</span>
            <Slider
              value={[formData.length === 'short' ? 0 : formData.length === 'medium' ? 50 : 100]}
              onValueChange={([value]) => {
                const length = value <= 33 ? 'short' : value <= 66 ? 'medium' : 'long';
                setFormData({ ...formData, length });
              }}
              max={100}
              step={1}
              className="flex-1"
            />
            <span className="text-sm text-gray-400">Long</span>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="emojis" className="flex items-center gap-2">
              <Smile className="w-4 h-4" />
              Include Emojis
            </Label>
            <Switch
              id="emojis"
              checked={formData.includeEmojis}
              onCheckedChange={(checked) => setFormData({ ...formData, includeEmojis: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="hashtags" className="flex items-center gap-2">
              <Hash className="w-4 h-4" />
              Include Hashtags
            </Label>
            <Switch
              id="hashtags"
              checked={formData.includeHashtags}
              onCheckedChange={(checked) => setFormData({ ...formData, includeHashtags: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="cta" className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              Include Call-to-Action
            </Label>
            <Switch
              id="cta"
              checked={formData.includeCTA}
              onCheckedChange={(checked) => setFormData({ ...formData, includeCTA: checked })}
            />
          </div>
        </div>

        {/* Generate Button */}
        <Button onClick={onGenerate} disabled={isGenerating} className="w-full gradient-primary">
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate Content
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
