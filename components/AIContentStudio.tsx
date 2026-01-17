'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { 
  Sparkles, Copy, Download, Share2, RefreshCw, Zap, TrendingUp,
  Calendar, Hash, Smile, Target, Wand2, Loader2, Check,
  Twitter, Instagram, Linkedin, Youtube, Facebook, MessageSquare
} from '@/components/icons';
import toast from 'react-hot-toast';

interface GeneratedContent {
  id: string;
  content: string;
  platform: string;
  variations: Array<{
    id: string;
    content: string;
    style: string;
    score: number;
  }>;
  hashtags: string[];
  emojis: string[];
  hooks: string[];
  cta?: string;
  estimatedEngagement: number;
  viralScore: number;
  metadata: {
    generatedAt: Date;
    model: string;
    tokens: number;
    processingTime: number;
  };
}

const platformIcons = {
  twitter: Twitter,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
  facebook: Facebook,
  tiktok: MessageSquare
};

const platformColors = {
  twitter: 'bg-blue-500',
  instagram: 'bg-gradient-to-br from-purple-600 to-pink-500',
  linkedin: 'bg-blue-700',
  youtube: 'bg-red-600',
  facebook: 'bg-blue-600',
  tiktok: 'bg-black'
};

export default function AIContentStudio() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [selectedVariation, setSelectedVariation] = useState(0);
  const [copiedContent, setCopiedContent] = useState('');
  
  const [formData, setFormData] = useState({
    type: 'post',
    platform: 'twitter',
    topic: '',
    tone: 'professional',
    keywords: '',
    targetAudience: '',
    length: 'medium',
    includeEmojis: true,
    includeHashtags: true,
    includeCTA: false
  });

  const [contentHistory, setContentHistory] = useState<GeneratedContent[]>([]);

  const handleGenerate = async () => {
    if (!formData.topic && !formData.keywords) {
      toast.error('Please provide a topic or keywords');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/ai/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          keywords: formData.keywords ? formData.keywords.split(',').map(k => k.trim()) : []
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate content');
      }

      const result = await response.json();
      setGeneratedContent(result.data);
      setContentHistory(prev => [result.data, ...prev].slice(0, 10));
      setSelectedVariation(0);
      toast.success('Content generated successfully!');
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate content');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedContent(type);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedContent(''), 2000);
  };

  const downloadContent = () => {
    if (!generatedContent) return;
    
    const content = selectedVariation === 0 
      ? generatedContent.content 
      : generatedContent.variations[selectedVariation - 1].content;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${formData.platform}-content-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Content downloaded!');
  };

  const regenerateContent = () => {
    handleGenerate();
  };

  const getViralScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getEngagementColor = (rate: number) => {
    if (rate >= 4) return 'text-green-500';
    if (rate >= 2.5) return 'text-yellow-500';
    return 'text-orange-500';
  };

  const PlatformIcon = platformIcons[formData.platform as keyof typeof platformIcons] || MessageSquare;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold gradient-text">AI Content Studio</h2>
          <p className="text-gray-400 mt-2">Generate viral content with AI-powered creativity</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-purple-500 text-purple-400">
            <Zap className="w-3 h-3 mr-1" />
            AI Powered
          </Badge>
          <Badge variant="outline" className="border-green-500 text-green-400">
            <TrendingUp className="w-3 h-3 mr-1" />
            Viral Optimized
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Generation Form */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-purple-500" />
              Content Configuration
            </CardTitle>
            <CardDescription>Customize your AI-generated content</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Platform Selection */}
            <div className="space-y-2">
              <Label>Platform</Label>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(platformIcons).map(([platform, Icon]) => (
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
              </div>
            </div>

            {/* Content Type */}
            <div className="space-y-2">
              <Label>Content Type</Label>
              <Select 
                value={formData.type} 
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
              <Select 
                value={formData.tone} 
                onValueChange={(value) => setFormData({ ...formData, tone: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full gradient-primary"
            >
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

        {/* Generated Content Display */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlatformIcon className="w-5 h-5 text-purple-500" />
                Generated Content
              </div>
              {generatedContent && (
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => copyToClipboard(
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
                  <Button size="icon" variant="ghost" onClick={downloadContent}>
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={regenerateContent}>
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
                        onClick={() => copyToClipboard(generatedContent.hashtags.join(' '), 'hashtags')}
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
                        <Badge key={index} variant="secondary">
                          {tag}
                        </Badge>
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
                          onClick={() => copyToClipboard(hook, `hook-${index}`)}
                        >
                          <p className="text-sm">{hook}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CTA */}
                {generatedContent.cta && (
                  <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
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
      </div>

      {/* Content History */}
      {contentHistory.length > 0 && (
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-500" />
              Recent Generations
            </CardTitle>
            <CardDescription>Your content generation history</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {contentHistory.map((item) => {
                const Icon = platformIcons[item.platform as keyof typeof platformIcons] || MessageSquare;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                    onClick={() => {
                      setGeneratedContent(item);
                      setSelectedVariation(0);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${platformColors[item.platform as keyof typeof platformColors]}`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium truncate max-w-md">
                          {item.content.substring(0, 50)}...
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(item.metadata.generatedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        {item.viralScore}%
                      </Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(item.content, item.id);
                        }}
                      >
                        {copiedContent === item.id ? (
                          <Check className="w-3 h-3 text-green-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}