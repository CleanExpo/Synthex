'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { 
  Sparkles, 
  Wand2, 
  RefreshCw, 
  Copy, 
  Check,
  TrendingUp,
  Lightbulb,
  Zap,
  Target,
  Palette,
  Type,
  Hash,
  Smile,
  AlertCircle,
  ChevronRight,
  Settings,
  Loader2
} from 'lucide-react';
import {
  generateContent,
  rewriteWithTone,
  enhanceContent,
  generateVariations,
  adjustLength,
  checkToneConsistency,
  type WritingTone,
  type ContentLength,
  type WritingStyle,
  type AIWritingRequest,
  type AIWritingResponse
} from '@/lib/ai-writing-assistant';
import { notify } from '@/lib/notifications';
import { fadeInUp, scaleIn } from '@/lib/animations';

interface AIWritingAssistantProps {
  initialContent?: string;
  onContentGenerated?: (content: string) => void;
  platform?: string;
  compact?: boolean;
}

export function AIWritingAssistant({
  initialContent = '',
  onContentGenerated,
  platform = 'general',
  compact = false
}: AIWritingAssistantProps) {
  const [content, setContent] = useState(initialContent);
  const [prompt, setPrompt] = useState('');
  const [tone, setTone] = useState<WritingTone>('professional');
  const [length, setLength] = useState<ContentLength>('medium');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AIWritingResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [useEmojis, setUseEmojis] = useState(true);
  const [useHashtags, setUseHashtags] = useState(true);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [audience, setAudience] = useState('general');
  
  const tones: { value: WritingTone; label: string; icon: React.ElementType }[] = [
    { value: 'professional', label: 'Professional', icon: Target },
    { value: 'casual', label: 'Casual', icon: Smile },
    { value: 'friendly', label: 'Friendly', icon: Heart },
    { value: 'formal', label: 'Formal', icon: Type },
    { value: 'humorous', label: 'Humorous', icon: Smile },
    { value: 'inspirational', label: 'Inspirational', icon: Sparkles },
    { value: 'educational', label: 'Educational', icon: BookOpen },
    { value: 'persuasive', label: 'Persuasive', icon: TrendingUp },
    { value: 'empathetic', label: 'Empathetic', icon: Heart },
    { value: 'confident', label: 'Confident', icon: Zap }
  ];
  
  const lengths: { value: ContentLength; label: string; words: string }[] = [
    { value: 'short', label: 'Short', words: '~50 words' },
    { value: 'medium', label: 'Medium', words: '~150 words' },
    { value: 'long', label: 'Long', words: '~300 words' }
  ];
  
  // Generate content
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      notify.error('Please enter a prompt');
      return;
    }
    
    setLoading(true);
    
    try {
      const request: AIWritingRequest = {
        prompt,
        style: {
          tone,
          length,
          keywords,
          audience,
          emojis: useEmojis,
          hashtags: useHashtags
        },
        platform
      };
      
      const result = await generateContent(request);
      setResponse(result);
      setContent(result.content);
      
      if (onContentGenerated) {
        onContentGenerated(result.content);
      }
      
      notify.success('Content generated successfully!');
    } catch (error) {
      notify.error('Failed to generate content');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  
  // Rewrite with different tone
  const handleRewrite = async (newTone: WritingTone) => {
    if (!content) return;
    
    setLoading(true);
    try {
      const rewritten = rewriteWithTone(content, tone, newTone);
      setContent(rewritten);
      setTone(newTone);
      notify.success(`Rewritten with ${newTone} tone`);
    } catch (error) {
      notify.error('Failed to rewrite content');
    } finally {
      setLoading(false);
    }
  };
  
  // Copy content
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    notify.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };
  
  // Generate variations
  const handleVariations = async () => {
    if (!content) return;
    
    setLoading(true);
    try {
      const variations = generateVariations(content, 3);
      setResponse(prev => ({
        ...prev!,
        alternatives: variations
      }));
      notify.success('Generated 3 variations');
    } catch (error) {
      notify.error('Failed to generate variations');
    } finally {
      setLoading(false);
    }
  };
  
  // Check tone consistency
  const checkTone = () => {
    if (!content) return null;
    
    const check = checkToneConsistency(content, tone);
    return check;
  };
  
  const toneCheck = checkTone();
  
  if (compact) {
    return <CompactAIAssistant content={content} onGenerate={handleGenerate} />;
  }
  
  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
              <Wand2 className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <CardTitle>AI Writing Assistant</CardTitle>
              <CardDescription>Generate and optimize content with AI</CardDescription>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 bg-white/5 rounded-lg space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Use Emojis</span>
                    <Switch checked={useEmojis} onCheckedChange={setUseEmojis} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Use Hashtags</span>
                    <Switch checked={useHashtags} onCheckedChange={setUseHashtags} />
                  </div>
                </div>
                
                <div>
                  <label className="text-sm text-gray-400">Target Audience</label>
                  <Select value={audience} onValueChange={setAudience}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="professionals">Professionals</SelectItem>
                      <SelectItem value="students">Students</SelectItem>
                      <SelectItem value="entrepreneurs">Entrepreneurs</SelectItem>
                      <SelectItem value="developers">Developers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Input Section */}
        <div className="space-y-4">
          <Textarea
            placeholder="Enter your content idea or prompt..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[100px] bg-white/5 border-white/10"
          />
          
          {/* Tone Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Tone</label>
              <Select value={tone} onValueChange={(v) => setTone(v as WritingTone)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tones.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      <div className="flex items-center gap-2">
                        <t.icon className="h-4 w-4" />
                        {t.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Length</label>
              <Select value={length} onValueChange={(v) => setLength(v as ContentLength)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {lengths.map(l => (
                    <SelectItem key={l.value} value={l.value}>
                      <div className="flex items-center justify-between w-full">
                        <span>{l.label}</span>
                        <span className="text-xs text-gray-400">{l.words}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Generate Button */}
          <Button 
            className="w-full gradient-primary"
            onClick={handleGenerate}
            disabled={loading || !prompt}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Generate Content
          </Button>
        </div>
        
        {/* Generated Content */}
        {content && (
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="space-y-4"
          >
            <div className="p-4 bg-white/5 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-300">Generated Content</span>
                <div className="flex items-center gap-2">
                  {toneCheck && (
                    <Badge 
                      variant={toneCheck.score > 80 ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {toneCheck.score}% tone match
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCopy}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[150px] bg-black/20 border-white/10"
              />
              
              {/* Content Metrics */}
              {response && (
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                  <span>Score: {response.score}/100</span>
                  <span>Readability: {response.readability}/100</span>
                  <span>Sentiment: {response.sentiment}</span>
                  <span>{content.split(' ').length} words</span>
                </div>
              )}
            </div>
            
            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleVariations}
                className="bg-white/5 border-white/10"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Generate Variations
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const enhanced = enhanceContent(content, {
                    tone,
                    length,
                    keywords,
                    audience,
                    emojis: useEmojis,
                    hashtags: useHashtags
                  });
                  setResponse(prev => ({
                    ...prev!,
                    suggestions: enhanced
                  }));
                }}
                className="bg-white/5 border-white/10"
              >
                <Lightbulb className="h-4 w-4 mr-2" />
                Get Suggestions
              </Button>
            </div>
            
            {/* Suggestions */}
            {response?.suggestions && response.suggestions.length > 0 && (
              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-300">Suggestions</span>
                {response.suggestions.map((suggestion, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 bg-yellow-500/10 rounded">
                    <Lightbulb className="h-4 w-4 text-yellow-400 mt-0.5" />
                    <span className="text-sm text-gray-300">{suggestion}</span>
                  </div>
                ))}
              </div>
            )}
            
            {/* Alternatives */}
            {response?.alternatives && response.alternatives.length > 0 && (
              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-300">Alternative Versions</span>
                {response.alternatives.map((alt, i) => (
                  <div 
                    key={i} 
                    className="p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors"
                    onClick={() => {
                      setContent(alt);
                      notify.success('Alternative selected');
                    }}
                  >
                    <p className="text-sm text-gray-300">{alt}</p>
                  </div>
                ))}
              </div>
            )}
            
            {/* Tone Issues */}
            {toneCheck && toneCheck.issues.length > 0 && (
              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-300">Tone Issues</span>
                {toneCheck.issues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 bg-red-500/10 rounded">
                    <AlertCircle className="h-4 w-4 text-red-400 mt-0.5" />
                    <span className="text-sm text-gray-300">{issue}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}

// Compact version for inline use
function CompactAIAssistant({ 
  content, 
  onGenerate 
}: { 
  content: string;
  onGenerate: () => void;
}) {
  return (
    <div className="flex items-center gap-2 p-2 glass-card rounded-lg">
      <Wand2 className="h-4 w-4 text-purple-400" />
      <span className="text-sm text-gray-400">AI Assistant</span>
      <Button
        size="sm"
        variant="ghost"
        onClick={onGenerate}
        className="ml-auto"
      >
        <Sparkles className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Import required icons
import { Heart, BookOpen } from 'lucide-react';