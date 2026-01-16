'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Sparkles, Copy, CheckCircle } from '@/components/icons';
import { toast } from 'sonner';

export default function TestAI() {
  const [loading, setLoading] = useState(false);
  const [platform, setPlatform] = useState('twitter');
  const [topic, setTopic] = useState('AI and marketing automation');
  const [tone, setTone] = useState('professional');
  const [includeEmojis, setIncludeEmojis] = useState(true);
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const generateContent = async () => {
    setLoading(true);
    setError('');
    setGeneratedContent(null);

    try {
      const response = await fetch('/api/ai/generate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          type: 'post',
          platform,
          topic,
          tone,
          includeEmojis,
          includeHashtags,
          includeCTA: true,
          targetAudience: 'Marketing professionals and business owners',
          length: 'medium'
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate content');
      }

      setGeneratedContent(data.data);
      toast.success('Content generated successfully!');
    } catch (err: any) {
      console.error('Generation error:', err);
      setError(err.message || 'Failed to generate content');
      
      // If API key is not configured, show demo content
      if (err.message.includes('API') || err.message.includes('key')) {
        setGeneratedContent({
          content: `🚀 ${topic} is revolutionizing the way we work! 

Here's what you need to know:
• Automate repetitive tasks
• Focus on strategic thinking
• Scale your impact 10x

The future is here, and it's powered by AI. 💡

#AI #Marketing #Automation #Innovation #FutureOfWork`,
          platform,
          hashtags: ['#AI', '#Marketing', '#Automation', '#Innovation', '#FutureOfWork'],
          emojis: ['🚀', '💡'],
          estimatedEngagement: 85,
          viralScore: 7.5,
          metadata: {
            generatedAt: new Date(),
            model: 'demo',
            tokens: 0,
            processingTime: 0
          }
        });
        setError('Using demo content (configure OpenRouter API key for real AI generation)');
      }
    } finally {
      setLoading(false);
    }
  };

  const copyContent = () => {
    if (generatedContent?.content) {
      navigator.clipboard.writeText(generatedContent.content);
      setCopied(true);
      toast.success('Content copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">AI Content Generator</h1>
          <p className="text-gray-400">Test the AI-powered content generation system</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <Card>
            <CardHeader>
              <CardTitle>Content Parameters</CardTitle>
              <CardDescription>Configure your content generation settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="platform">Platform</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger id="platform">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="twitter">Twitter/X</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="topic">Topic</Label>
                <Textarea
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="What should the content be about?"
                  className="min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tone">Tone</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger id="tone">
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

              <div className="flex items-center space-x-2">
                <Switch
                  id="emojis"
                  checked={includeEmojis}
                  onCheckedChange={setIncludeEmojis}
                />
                <Label htmlFor="emojis">Include Emojis</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="hashtags"
                  checked={includeHashtags}
                  onCheckedChange={setIncludeHashtags}
                />
                <Label htmlFor="hashtags">Include Hashtags</Label>
              </div>

              <Button 
                onClick={generateContent} 
                className="w-full"
                disabled={loading || !topic}
              >
                {loading ? (
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

          {/* Output Section */}
          <Card>
            <CardHeader>
              <CardTitle>Generated Content</CardTitle>
              <CardDescription>AI-generated content will appear here</CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert className="mb-4 border-yellow-500 bg-yellow-50">
                  <AlertDescription className="text-yellow-800">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {generatedContent ? (
                <div className="space-y-4">
                  <div className="relative">
                    <Textarea
                      value={generatedContent.content}
                      readOnly
                      className="min-h-[200px] pr-12"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute top-2 right-2"
                      onClick={copyContent}
                    >
                      {copied ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {generatedContent.hashtags && generatedContent.hashtags.length > 0 && (
                    <div>
                      <Label className="text-sm text-gray-600">Hashtags</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {generatedContent.hashtags.map((tag: string, i: number) => (
                          <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <Label className="text-sm text-gray-600">Engagement Score</Label>
                      <div className="text-2xl font-bold text-green-600">
                        {generatedContent.estimatedEngagement || 'N/A'}%
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-600">Viral Score</Label>
                      <div className="text-2xl font-bold text-purple-600">
                        {generatedContent.viralScore || 'N/A'}/10
                      </div>
                    </div>
                  </div>

                  {generatedContent.metadata && (
                    <div className="text-xs text-gray-500 pt-2 border-t">
                      Generated with {generatedContent.metadata.model || 'AI'} at{' '}
                      {new Date(generatedContent.metadata.generatedAt).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Configure settings and click generate to create content</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Info Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h3 className="font-semibold mb-2">1. Configure Settings</h3>
                <p className="text-sm text-gray-600">
                  Choose your platform, topic, and tone to match your brand voice
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">2. AI Generation</h3>
                <p className="text-sm text-gray-600">
                  Our AI analyzes viral patterns and creates optimized content
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">3. Copy & Post</h3>
                <p className="text-sm text-gray-600">
                  Review the generated content and post it to your social media
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}