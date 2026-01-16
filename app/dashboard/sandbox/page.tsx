'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Code,
  Eye,
  Smartphone,
  Monitor,
  Tablet,
  Copy,
  Download,
  Share2,
  Palette,
  Type,
  Image as ImageIcon,
  Video,
  Link2,
  Hash,
  AtSign,
  MessageSquare,
  Heart,
  Repeat,
  Bookmark,
  Send,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  AlertCircle,
  Twitter,
  Linkedin,
  Instagram,
  Facebook,
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  Minimize2,
} from '@/components/icons';
import toast from 'react-hot-toast';

// Platform configurations
const platformConfigs = {
  twitter: {
    icon: Twitter,
    name: 'Twitter',
    maxChars: 280,
    features: ['hashtags', 'mentions', 'threads', 'media'],
    mockupBg: 'bg-black',
    textColor: 'text-white',
  },
  linkedin: {
    icon: Linkedin,
    name: 'LinkedIn',
    maxChars: 3000,
    features: ['hashtags', 'mentions', 'articles', 'media'],
    mockupBg: 'bg-white',
    textColor: 'text-gray-900',
  },
  instagram: {
    icon: Instagram,
    name: 'Instagram',
    maxChars: 2200,
    features: ['hashtags', 'mentions', 'reels', 'stories', 'carousel'],
    mockupBg: 'bg-gradient-to-br from-purple-600 to-pink-500',
    textColor: 'text-white',
  },
  facebook: {
    icon: Facebook,
    name: 'Facebook',
    maxChars: 63206,
    features: ['hashtags', 'mentions', 'stories', 'media', 'links'],
    mockupBg: 'bg-blue-600',
    textColor: 'text-white',
  },
  tiktok: {
    icon: Video,
    name: 'TikTok',
    maxChars: 2200,
    features: ['hashtags', 'mentions', 'sounds', 'effects'],
    mockupBg: 'bg-black',
    textColor: 'text-white',
  },
};

// Device presets
const devicePresets = {
  mobile: { width: 375, height: 667, label: 'iPhone', icon: Smartphone },
  tablet: { width: 768, height: 1024, label: 'iPad', icon: Tablet },
  desktop: { width: 1440, height: 900, label: 'Desktop', icon: Monitor },
};

const getValidationErrors = (
  content: string,
  config: { maxChars: number },
  platform: string,
  hashtags: string[]
) => {
  const errors: string[] = [];

  if (content.length > config.maxChars) {
    errors.push(`Content exceeds ${config.maxChars} character limit`);
  }

  if (platform === 'twitter' && hashtags.length > 3) {
    errors.push('Too many hashtags (max 3 recommended)');
  }

  if (platform === 'instagram' && hashtags.length > 30) {
    errors.push('Too many hashtags (max 30)');
  }

  if (platform === 'tiktok' && !content.includes('#')) {
    errors.push('TikTok posts perform better with hashtags');
  }

  return errors;
};

export default function SandboxPage() {
  const [content, setContent] = useState('');
  const [platform, setPlatform] = useState('twitter');
  const [device, setDevice] = useState('mobile');
  const [previewMode, setPreviewMode] = useState('visual');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [mentions, setMentions] = useState<string[]>([]);
  const [mediaType, setMediaType] = useState('none');
  const [characterCount, setCharacterCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const config = platformConfigs[platform as keyof typeof platformConfigs];
  const DeviceIcon = devicePresets[device as keyof typeof devicePresets].icon;

  useEffect(() => {
    // Update counts
    setCharacterCount(content.length);
    setWordCount(content.split(/\s+/).filter(Boolean).length);

    // Extract hashtags and mentions
    const hashtagMatches = content.match(/#\w+/g) || [];
    const mentionMatches = content.match(/@\w+/g) || [];
    setHashtags(hashtagMatches);
    setMentions(mentionMatches);

    // Validate content
    setValidationErrors(getValidationErrors(content, config, platform, hashtagMatches));
  }, [content, platform, config]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    toast.success('Content copied to clipboard!');
  };

  const handleExport = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${platform}-content-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Content exported!');
  };

  const handleReset = () => {
    setContent('');
    setHashtags([]);
    setMentions([]);
    setValidationErrors([]);
    toast.success('Content reset');
  };

  const renderMockup = () => {
    switch (platform) {
      case 'twitter':
        return (
          <div className="bg-black rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500"></div>
              <div className="flex-1">
                <div className="flex items-center space-x-1">
                  <span className="font-bold text-white">Your Name</span>
                  <CheckCircle className="h-4 w-4 text-blue-400" />
                  <span className="text-gray-500">@username · now</span>
                </div>
                <div className="mt-2 text-white whitespace-pre-wrap">{content || 'Your content will appear here...'}</div>
                {mediaType !== 'none' && (
                  <div className="mt-3 bg-gray-800 rounded-lg h-48 flex items-center justify-center">
                    {mediaType === 'image' && <ImageIcon className="h-12 w-12 text-gray-600" />}
                    {mediaType === 'video' && <Video className="h-12 w-12 text-gray-600" />}
                  </div>
                )}
                <div className="mt-3 flex items-center space-x-6 text-gray-500">
                  <button className="flex items-center space-x-1 hover:text-blue-400">
                    <MessageSquare className="h-5 w-5" />
                    <span className="text-sm">0</span>
                  </button>
                  <button className="flex items-center space-x-1 hover:text-green-400">
                    <Repeat className="h-5 w-5" />
                    <span className="text-sm">0</span>
                  </button>
                  <button className="flex items-center space-x-1 hover:text-red-400">
                    <Heart className="h-5 w-5" />
                    <span className="text-sm">0</span>
                  </button>
                  <button className="flex items-center space-x-1 hover:text-blue-400">
                    <Bookmark className="h-5 w-5" />
                  </button>
                  <button className="flex items-center space-x-1 hover:text-blue-400">
                    <Send className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <button className="text-gray-500 hover:text-white">
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </div>
          </div>
        );

      case 'instagram':
        return (
          <div className="bg-white rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500"></div>
                <span className="font-semibold text-sm">username</span>
              </div>
              <MoreHorizontal className="h-5 w-5 text-gray-700" />
            </div>
            {mediaType !== 'none' ? (
              <div className="bg-gray-200 h-96 flex items-center justify-center">
                {mediaType === 'image' && <ImageIcon className="h-16 w-16 text-gray-400" />}
                {mediaType === 'video' && <Video className="h-16 w-16 text-gray-400" />}
              </div>
            ) : (
              <div className="bg-gradient-to-br from-purple-500 to-pink-500 h-96 flex items-center justify-center">
                <p className="text-white text-center px-4">{content || 'Your content preview'}</p>
              </div>
            )}
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <Heart className="h-6 w-6" />
                  <MessageSquare className="h-6 w-6" />
                  <Send className="h-6 w-6" />
                </div>
                <Bookmark className="h-6 w-6" />
              </div>
              <p className="font-semibold text-sm mb-1">0 likes</p>
              <p className="text-sm">
                <span className="font-semibold">username</span> {content || 'Caption here...'}
              </p>
            </div>
          </div>
        );

      case 'linkedin':
        return (
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-start space-x-3">
              <div className="w-12 h-12 rounded-full bg-blue-600"></div>
              <div className="flex-1">
                <div>
                  <p className="font-semibold">Your Name</p>
                  <p className="text-sm text-gray-600">Professional Title</p>
                  <p className="text-xs text-gray-500">now · 🌐</p>
                </div>
                <div className="mt-3 text-gray-900 whitespace-pre-wrap">
                  {content || 'Your professional content will appear here...'}
                </div>
                {mediaType !== 'none' && (
                  <div className="mt-3 bg-gray-100 rounded-lg h-48 flex items-center justify-center border">
                    {mediaType === 'image' && <ImageIcon className="h-12 w-12 text-gray-400" />}
                    {mediaType === 'video' && <Video className="h-12 w-12 text-gray-400" />}
                  </div>
                )}
                <div className="mt-3 pt-3 border-t flex items-center justify-between text-gray-600">
                  <div className="flex items-center space-x-4">
                    <button className="flex items-center space-x-1 hover:text-blue-600">
                      <span className="text-sm">👍 Like</span>
                    </button>
                    <button className="flex items-center space-x-1 hover:text-blue-600">
                      <span className="text-sm">💬 Comment</span>
                    </button>
                    <button className="flex items-center space-x-1 hover:text-blue-600">
                      <span className="text-sm">🔄 Repost</span>
                    </button>
                    <button className="flex items-center space-x-1 hover:text-blue-600">
                      <span className="text-sm">📤 Send</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className={`${config.mockupBg} rounded-lg p-6`}>
            <p className={`${config.textColor} whitespace-pre-wrap`}>
              {content || 'Your content will appear here...'}
            </p>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Content Sandbox</h1>
          <p className="text-gray-400 mt-1">
            Test and preview your content across platforms
          </p>
        </div>
        <div className="flex space-x-3 mt-4 sm:mt-0">
          <Button onClick={handleReset} variant="outline" className="bg-white/5 border-white/10 text-white hover:bg-white/10">
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button onClick={handleExport} className="gradient-primary text-white">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Editor */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Content Editor</CardTitle>
            <CardDescription className="text-gray-400">
              Compose and edit your content
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Platform Selector */}
            <div>
              <Label className="text-gray-400">Platform</Label>
              <div className="grid grid-cols-5 gap-2 mt-2">
                {Object.entries(platformConfigs).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => setPlatform(key)}
                      className={`p-3 rounded-lg border transition-all ${
                        platform === key
                          ? 'bg-purple-500/20 border-purple-500'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <Icon className="h-5 w-5 mx-auto" />
                      <p className="text-xs mt-1">{config.name}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content Input */}
            <div>
              <Label htmlFor="content" className="text-gray-400">Content</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Start typing your content..."
                className="min-h-[300px] bg-white/5 border-white/10 text-white placeholder:text-gray-500 mt-2"
                maxLength={config.maxChars}
              />
              <div className="flex justify-between text-xs mt-2">
                <span className="text-gray-500">
                  {wordCount} words · {characterCount} characters
                </span>
                <span className={characterCount > config.maxChars ? 'text-red-400' : 'text-gray-500'}>
                  {characterCount} / {config.maxChars}
                </span>
              </div>
            </div>

            {/* Media Type */}
            <div>
              <Label className="text-gray-400">Media Attachment</Label>
              <Select value={mediaType} onValueChange={setMediaType}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Media</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="gif">GIF</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Extracted Elements */}
            {(hashtags.length > 0 || mentions.length > 0) && (
              <div className="p-4 bg-white/5 rounded-lg space-y-3">
                {hashtags.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-2">Hashtags ({hashtags.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {hashtags.map((tag, i) => (
                        <span key={i} className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {mentions.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-2">Mentions ({mentions.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {mentions.map((mention, i) => (
                        <span key={i} className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded">
                          {mention}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Validation */}
            {validationErrors.length > 0 && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="flex items-center mb-2">
                  <AlertCircle className="h-4 w-4 text-red-400 mr-2" />
                  <p className="text-sm font-medium text-red-400">Validation Issues</p>
                </div>
                <ul className="space-y-1">
                  {validationErrors.map((error, i) => (
                    <li key={i} className="text-xs text-red-300 flex items-start">
                      <XCircle className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex space-x-2">
              <Button onClick={handleCopy} variant="outline" className="flex-1 bg-white/5 border-white/10 text-white hover:bg-white/10">
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
              <Button className="flex-1 gradient-primary text-white">
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card className="glass-card">
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
                        onClick={() => setDevice(key)}
                        className={`p-2 rounded transition-all ${
                          device === key
                            ? 'bg-purple-500/20 text-purple-400'
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
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="text-gray-400"
                >
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={previewMode} onValueChange={setPreviewMode}>
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
                      onClick={() => setIsFullscreen(false)}
                      className="absolute top-4 right-4 text-white"
                    >
                      <XCircle className="h-5 w-5" />
                    </Button>
                  )}
                  <div className={`mx-auto ${device === 'mobile' ? 'max-w-sm' : device === 'tablet' ? 'max-w-2xl' : 'max-w-4xl'}`}>
                    {renderMockup()}
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
      </div>
    </div>
  );
}
