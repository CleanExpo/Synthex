'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DashboardSkeleton } from '@/components/skeletons';
import { APIErrorCard } from '@/components/error-states';
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
  Sparkles,
  Copy,
  Download,
  Share2,
  Save,
  Edit,
  RefreshCw,
  Wand2,
  Brain,
  TrendingUp,
  Clock,
  Hash,
  Smile,
  Type,
  Palette,
  Target,
  BarChart3,
  CheckCircle,
  AlertCircle,
  Loader2,
  Twitter,
  Linkedin,
  Instagram,
  Facebook,
  Video,
} from '@/components/icons';
import toast from 'react-hot-toast';

// Platform icons
const platformIcons = {
  twitter: Twitter,
  linkedin: Linkedin,
  instagram: Instagram,
  facebook: Facebook,
  tiktok: Video,
};

// Hook types
const hookTypes = [
  { value: 'question', label: 'Question', description: 'Engage with questions' },
  { value: 'story', label: 'Story', description: 'Tell compelling stories' },
  { value: 'educational', label: 'Educational', description: 'Teach and inform' },
  { value: 'achievement', label: 'Achievement', description: 'Share wins' },
  { value: 'controversy', label: 'Controversy', description: 'Spark debate' },
  { value: 'humor', label: 'Humor', description: 'Make them laugh' },
  { value: 'vulnerability', label: 'Vulnerability', description: 'Be authentic' },
  { value: 'relatable', label: 'Relatable', description: 'Connect emotionally' },
];

// Tone options
const toneOptions = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'authoritative', label: 'Authoritative' },
  { value: 'inspirational', label: 'Inspirational' },
  { value: 'humorous', label: 'Humorous' },
];

export default function ContentPage() {
  const [platform, setPlatform] = useState('twitter');
  const [topic, setTopic] = useState('');
  const [hookType, setHookType] = useState('question');
  const [tone, setTone] = useState('casual');
  const [personaId, setPersonaId] = useState('none');
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [includeEmojis, setIncludeEmojis] = useState(true);
  const [targetLength, setTargetLength] = useState('medium');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [selectedVariation, setSelectedVariation] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize page
  useEffect(() => {
    const init = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        setIsLoading(false);
      } catch (err) {
        setError('Failed to load content generator');
        setIsLoading(false);
      }
    };
    init();
  }, []);

  // Mock personas (in production, fetch from database)
  const personas = [
    { id: '1', name: 'Professional Voice' },
    { id: '2', name: 'Casual Creator' },
    { id: '3', name: 'Thought Leader' },
  ];

  const handleGenerate = async () => {
    if (!topic) {
      toast.error('Please enter a topic');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          personaId: personaId === 'none' ? null : personaId,
          topic,
          hookType,
          tone,
          includeHashtags,
          includeEmojis,
          targetLength,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setGeneratedContent(data.content);
        setEditedContent(data.content.primary);
        toast.success('Content generated successfully!');
      } else {
        toast.error(data.error || 'Failed to generate content');
      }
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate content');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard!');
  };

  const handleSave = () => {
    // In production, save to database
    toast.success('Content saved as draft');
  };

  const handleSchedule = () => {
    // Navigate to scheduling page
    toast.success('Opening scheduler...');
  };

  const handleTrainAI = () => {
    toast.success('AI training feature coming soon');
  };

  const handleViewAnalytics = () => {
    window.location.href = '/dashboard/analytics';
  };

  const getContentToDisplay = () => {
    if (!generatedContent) return '';
    if (editMode) return editedContent;
    if (selectedVariation === 0) return generatedContent.primary;
    return generatedContent.variations[selectedVariation - 1];
  };

  const PlatformIcon = platformIcons[platform as keyof typeof platformIcons];

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="p-6">
        <APIErrorCard
          title="Content Generator Error"
          message={error}
          onRetry={() => {
            setError(null);
            setIsLoading(true);
            setTimeout(() => setIsLoading(false), 500);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Content Generator</h1>
          <p className="text-gray-400 mt-1">
            AI-powered content creation with viral patterns
          </p>
        </div>
        <div className="flex space-x-3 mt-4 sm:mt-0">
          <Button onClick={handleTrainAI} variant="outline" className="bg-white/5 border-white/10 text-white hover:bg-white/10">
            <Brain className="mr-2 h-4 w-4" />
            Train AI
          </Button>
          <Button onClick={handleViewAnalytics} className="gradient-primary text-white">
            <TrendingUp className="mr-2 h-4 w-4" />
            View Analytics
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Generated Today</CardTitle>
            <Sparkles className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">24</div>
            <p className="text-xs text-gray-500 mt-1">+12% from yesterday</p>
          </CardContent>
        </Card>
        <Card variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Avg Engagement</CardTitle>
            <BarChart3 className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">8.7%</div>
            <p className="text-xs text-gray-500 mt-1">Above industry avg</p>
          </CardContent>
        </Card>
        <Card variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Scheduled</CardTitle>
            <Clock className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">15</div>
            <p className="text-xs text-gray-500 mt-1">Next 7 days</p>
          </CardContent>
        </Card>
        <Card variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Success Rate</CardTitle>
            <Target className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">92%</div>
            <p className="text-xs text-gray-500 mt-1">Hit targets</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Generation Settings */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Generation Settings</CardTitle>
            <CardDescription className="text-gray-400">
              Configure your content parameters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Platform Selection */}
            <div>
              <Label className="text-gray-400">Platform</Label>
              <div className="grid grid-cols-5 gap-2 mt-2">
                {Object.entries(platformIcons).map(([key, Icon]) => (
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
                    <p className="text-xs mt-1 capitalize">{key}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Topic Input */}
            <div>
              <Label htmlFor="topic" className="text-gray-400">Topic</Label>
              <Input
                id="topic"
                placeholder="What do you want to create content about?"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 mt-2"
              />
            </div>

            {/* Hook Type */}
            <div>
              <Label className="text-gray-400">Hook Type</Label>
              <Select value={hookType} onValueChange={setHookType}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {hookTypes.map((hook) => (
                    <SelectItem key={hook.value} value={hook.value}>
                      <div>
                        <div className="font-medium">{hook.label}</div>
                        <div className="text-xs text-gray-400">{hook.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tone */}
            <div>
              <Label className="text-gray-400">Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {toneOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Persona */}
            <div>
              <Label className="text-gray-400">Persona (Optional)</Label>
              <Select value={personaId} onValueChange={setPersonaId}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white mt-2">
                  <SelectValue placeholder="Select a persona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {personas.map((persona) => (
                    <SelectItem key={persona.id} value={persona.id}>
                      {persona.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Length */}
            <div>
              <Label className="text-gray-400">Content Length</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {['short', 'medium', 'long'].map((length) => (
                  <button
                    key={length}
                    onClick={() => setTargetLength(length)}
                    className={`py-2 px-4 rounded-lg border capitalize transition-all ${
                      targetLength === length
                        ? 'bg-purple-500/20 border-purple-500'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {length}
                  </button>
                ))}
              </div>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeHashtags}
                  onChange={(e) => setIncludeHashtags(e.target.checked)}
                  className="rounded border-gray-600 text-purple-500 focus:ring-purple-500"
                />
                <Hash className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-white">Include Hashtags</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeEmojis}
                  onChange={(e) => setIncludeEmojis(e.target.checked)}
                  className="rounded border-gray-600 text-purple-500 focus:ring-purple-500"
                />
                <Smile className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-white">Include Emojis</span>
              </label>
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !topic}
              className="w-full gradient-primary text-white"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Generate Content
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Generated Content */}
        <Card variant="glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Generated Content</CardTitle>
                <CardDescription className="text-gray-400">
                  AI-generated content based on your settings
                </CardDescription>
              </div>
              {generatedContent && (
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditMode(!editMode)}
                    className="text-gray-400"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleGenerate}
                    className="text-gray-400"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {generatedContent ? (
              <div className="space-y-4">
                {/* Variations Tabs */}
                <Tabs value={String(selectedVariation)} onValueChange={(v) => setSelectedVariation(Number(v))}>
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
                        onChange={(e) => setEditedContent(e.target.value)}
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
                {generatedContent.metadata && (
                  <div className="p-4 bg-white/5 rounded-lg space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Platform</span>
                      <span className="text-white capitalize">{generatedContent.metadata.platform}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Hook Type</span>
                      <span className="text-white capitalize">{generatedContent.metadata.hookType}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Character Count</span>
                      <span className="text-white">{generatedContent.metadata.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Est. Engagement</span>
                      <span className="text-white">{generatedContent.metadata.estimatedEngagement}%</span>
                    </div>
                    {generatedContent.metadata.hashtags.length > 0 && (
                      <div className="pt-2 border-t border-white/10">
                        <p className="text-xs text-gray-400 mb-1">Hashtags</p>
                        <div className="flex flex-wrap gap-1">
                          {generatedContent.metadata.hashtags.map((tag: string, i: number) => (
                            <span key={i} className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded">
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
                    onClick={() => handleCopy(getContentToDisplay())}
                    variant="outline"
                    className="flex-1 bg-white/5 border-white/10 text-white hover:bg-white/10"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </Button>
                  <Button
                    onClick={handleSave}
                    variant="outline"
                    className="flex-1 bg-white/5 border-white/10 text-white hover:bg-white/10"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                  <Button
                    onClick={handleSchedule}
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
      </div>
    </div>
  );
}