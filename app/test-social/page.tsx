'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, 
  Send, 
  CheckCircle, 
  XCircle,
  Twitter,
  Linkedin,
  Instagram,
  Facebook,
  Video,
  Hash,
  AtSign,
  Calendar
} from '@/components/icons';
import { toast } from 'sonner';

const PLATFORMS = [
  { id: 'twitter', name: 'Twitter/X', icon: Twitter, color: 'bg-blue-500', maxLength: 280 },
  { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, color: 'bg-blue-700', maxLength: 3000 },
  { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'bg-pink-500', maxLength: 2200 },
  { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'bg-blue-600', maxLength: 63206 },
  { id: 'tiktok', name: 'TikTok', icon: Video, color: 'bg-black', maxLength: 2200 }
];

export default function TestSocial() {
  const [content, setContent] = useState('🚀 Excited to share that our AI-powered marketing platform is transforming how businesses connect with their audience!\n\nKey features:\n✅ Smart content generation\n✅ Multi-platform posting\n✅ Real-time analytics\n✅ Viral pattern detection');
  const [selectedPlatforms, setSelectedPlatforms] = useState(['twitter', 'linkedin']);
  const [hashtags, setHashtags] = useState('#AI #Marketing #SocialMedia #Innovation');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [postHistory, setPostHistory] = useState<any[]>([]);

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platformId) 
        ? prev.filter(p => p !== platformId)
        : [...prev, platformId]
    );
  };

  const postToSocial = async () => {
    if (!content || selectedPlatforms.length === 0) {
      toast.error('Please enter content and select at least one platform');
      return;
    }

    setLoading(true);
    setResults(null);

    try {
      const hashtagArray = hashtags
        .split(/[\s,]+/)
        .filter(tag => tag.length > 0)
        .map(tag => tag.startsWith('#') ? tag : `#${tag}`);

      const response = await fetch('/api/social/post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          content,
          platforms: selectedPlatforms,
          hashtags: hashtagArray
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to post');
      }

      setResults(data);
      
      if (data.success) {
        toast.success(`Successfully posted to ${data.results.length} platform(s)!`);
        // Add to history
        setPostHistory(prev => [{
          content: content.substring(0, 100) + '...',
          platforms: selectedPlatforms,
          timestamp: new Date().toLocaleTimeString(),
          success: true
        }, ...prev.slice(0, 4)]);
      } else {
        toast.warning('Some platforms failed. Check results for details.');
      }
    } catch (error: any) {
      console.error('Posting error:', error);
      toast.error(error.message || 'Failed to post to social media');
      setResults({
        success: false,
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const getCharacterCount = () => {
    const minLength = Math.min(...selectedPlatforms.map(p => 
      PLATFORMS.find(plat => plat.id === p)?.maxLength || Infinity
    ));
    return {
      current: content.length,
      max: minLength === Infinity ? 0 : minLength,
      percentage: minLength === Infinity ? 0 : (content.length / minLength) * 100
    };
  };

  const charCount = getCharacterCount();

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Social Media Publisher</h1>
          <p className="text-gray-400">Post to multiple social media platforms simultaneously</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Compose Post</CardTitle>
                <CardDescription>Create your social media content</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="What's on your mind?"
                    className="min-h-[150px]"
                  />
                  <div className="flex justify-between mt-2 text-sm">
                    <span className={`${charCount.percentage > 90 ? 'text-red-500' : 'text-gray-500'}`}>
                      {charCount.current} / {charCount.max || '∞'} characters
                    </span>
                    {charCount.percentage > 90 && (
                      <span className="text-yellow-500">
                        Approaching character limit
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    <Hash className="inline w-4 h-4 mr-1" />
                    Hashtags
                  </label>
                  <Textarea
                    value={hashtags}
                    onChange={(e) => setHashtags(e.target.value)}
                    placeholder="#AI #Marketing #SocialMedia"
                    className="min-h-[60px]"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-3 block">Select Platforms</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {PLATFORMS.map(platform => {
                      const Icon = platform.icon;
                      const isSelected = selectedPlatforms.includes(platform.id);
                      return (
                        <button
                          key={platform.id}
                          onClick={() => togglePlatform(platform.id)}
                          className={`p-3 rounded-lg border-2 transition-all ${
                            isSelected 
                              ? 'border-primary bg-primary/10' 
                              : 'border-gray-600 hover:border-gray-500'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <div className={`p-1 rounded ${platform.color}`}>
                              <Icon className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-sm">{platform.name}</span>
                            {isSelected && (
                              <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Button 
                  onClick={postToSocial}
                  className="w-full"
                  size="lg"
                  disabled={loading || !content || selectedPlatforms.length === 0}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Posting to {selectedPlatforms.length} platform(s)...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Post to {selectedPlatforms.length} Platform(s)
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Results */}
            {results && (
              <Card>
                <CardHeader>
                  <CardTitle>Posting Results</CardTitle>
                </CardHeader>
                <CardContent>
                  {results.success ? (
                    <Alert className="border-green-500 bg-green-50">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        Successfully posted to all selected platforms!
                      </AlertDescription>
                    </Alert>
                  ) : results.error ? (
                    <Alert className="border-red-500 bg-red-50">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-800">
                        {results.error}
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  {results.results && results.results.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {results.results.map((result: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-gray-800 rounded">
                          <div className="flex items-center space-x-2">
                            {PLATFORMS.find(p => p.id === result.platform)?.icon && (
                              <div className={`p-1 rounded ${PLATFORMS.find(p => p.id === result.platform)?.color}`}>
                                {(() => {
                                  const Icon = PLATFORMS.find(p => p.id === result.platform)?.icon;
                                  return Icon ? <Icon className="w-4 h-4 text-white" /> : null;
                                })()}
                              </div>
                            )}
                            <span>{result.platform}</span>
                          </div>
                          {result.success ? (
                            <Badge variant="default" className="bg-green-600">
                              Posted
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              Failed
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {results.errors && results.errors.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <h4 className="text-sm font-medium text-red-500">Errors:</h4>
                      {results.errors.map((error: any, i: number) => (
                        <div key={i} className="text-sm text-red-400">
                          {error.platform}: {error.error}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Post History */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Posts</CardTitle>
              </CardHeader>
              <CardContent>
                {postHistory.length > 0 ? (
                  <div className="space-y-3">
                    {postHistory.map((post, i) => (
                      <div key={i} className="p-3 bg-gray-800 rounded">
                        <p className="text-sm text-gray-300 mb-1">{post.content}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex gap-1">
                            {post.platforms.map((p: string) => (
                              <Badge key={p} variant="secondary" className="text-xs">
                                {p}
                              </Badge>
                            ))}
                          </div>
                          <span className="text-xs text-gray-500">{post.timestamp}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No posts yet</p>
                )}
              </CardContent>
            </Card>

            {/* Platform Info */}
            <Card>
              <CardHeader>
                <CardTitle>Platform Limits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {PLATFORMS.map(platform => {
                    const Icon = platform.icon;
                    return (
                      <div key={platform.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Icon className="w-4 h-4" />
                          <span className="text-sm">{platform.name}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {platform.maxLength.toLocaleString()} chars
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Tips */}
            <Card>
              <CardHeader>
                <CardTitle>Pro Tips</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li>• Use 3-5 relevant hashtags for best reach</li>
                  <li>• Post during peak hours (9-10am, 7-9pm)</li>
                  <li>• Include a call-to-action</li>
                  <li>• Keep Twitter posts under 200 chars for retweets</li>
                  <li>• Use emojis to increase engagement by 25%</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}