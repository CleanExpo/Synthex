'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Hash, 
  TrendingUp, 
  Sparkles, 
  Copy, 
  Check,
  Filter,
  Loader2,
  Search,
  Target,
  BarChart,
  Users,
  Zap,
  RefreshCw
} from '@/components/icons';
import { notify } from '@/lib/notifications';
import { fadeInUp, staggerContainer, staggerItem } from '@/lib/animations';

interface Hashtag {
  tag: string;
  relevance: number;
  popularity: 'high' | 'medium' | 'low';
  trending: boolean;
  reach: number;
  competition: 'high' | 'medium' | 'low';
  category: string;
}

interface HashtagGeneratorProps {
  content?: string;
  platform?: string;
  onHashtagsSelected?: (hashtags: string[]) => void;
}

export function AIHashtagGenerator({
  content = '',
  platform = 'all',
  onHashtagsSelected
}: HashtagGeneratorProps) {
  const [input, setInput] = useState(content);
  const [hashtags, setHashtags] = useState<Hashtag[]>([]);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState<'all' | 'trending' | 'niche'>('all');
  
  // Generate hashtags using AI
  const generateHashtags = async () => {
    if (!input.trim()) {
      notify.error('Please enter content or keywords');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/ai-content/hashtags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: input,
          platform: platform === 'all' ? undefined : platform,
          count: 30
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate hashtags');
      }

      const data = await response.json();

      // Map API response to component's Hashtag interface
      const generated: Hashtag[] = data.detailed || [];
      setHashtags(generated);
      notify.success(`Generated ${generated.length} hashtags`);
    } catch (error) {
      notify.error('Failed to generate hashtags. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Toggle hashtag selection
  const toggleHashtag = (tag: string) => {
    const newSelection = new Set(selectedTags);
    if (newSelection.has(tag)) {
      newSelection.delete(tag);
    } else {
      if (newSelection.size >= 30) {
        notify.error('Maximum 30 hashtags allowed');
        return;
      }
      newSelection.add(tag);
    }
    setSelectedTags(newSelection);
  };
  
  // Copy selected hashtags
  const copyHashtags = () => {
    const tags = Array.from(selectedTags).map(tag => `#${tag}`).join(' ');
    navigator.clipboard.writeText(tags);
    setCopied(true);
    notify.success('Hashtags copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
    
    if (onHashtagsSelected) {
      onHashtagsSelected(Array.from(selectedTags));
    }
  };
  
  // Filter hashtags
  const filteredHashtags = hashtags.filter(tag => {
    if (filter === 'trending') return tag.trending;
    if (filter === 'niche') return tag.competition === 'low';
    return true;
  });
  
  // Get hashtag color based on metrics
  const getHashtagColor = (tag: Hashtag) => {
    if (tag.trending) return 'bg-gradient-to-r from-orange-500 to-red-500';
    if (tag.popularity === 'high') return 'bg-gradient-to-r from-blue-500 to-cyan-500';
    if (tag.competition === 'low') return 'bg-gradient-to-r from-green-500 to-teal-500';
    return 'bg-gray-600';
  };
  
  return (
    <Card variant="glass">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-500/20">
            <Hash className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <CardTitle>AI Hashtag Generator</CardTitle>
            <CardDescription>Generate relevant hashtags for maximum reach</CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Input Section */}
        <div className="space-y-4">
          <Textarea
            placeholder="Enter your content or keywords..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-[100px] bg-white/5 border-white/10"
          />
          
          <div className="flex gap-2">
            <Button 
              className="flex-1 gradient-primary"
              onClick={generateHashtags}
              disabled={loading || !input.trim()}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Generate Hashtags
            </Button>
            
            {hashtags.length > 0 && (
              <Button
                variant="outline"
                onClick={() => generateHashtags()}
                className="bg-white/5 border-white/10"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Filter Tabs */}
        {hashtags.length > 0 && (
          <div className="flex gap-2">
            {(['all', 'trending', 'niche'] as const).map(f => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? 'default' : 'outline'}
                onClick={() => setFilter(f)}
                className={filter === f ? '' : 'bg-white/5 border-white/10'}
              >
                {f === 'trending' && <TrendingUp className="h-3 w-3 mr-1" />}
                {f === 'niche' && <Target className="h-3 w-3 mr-1" />}
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Button>
            ))}
          </div>
        )}
        
        {/* Generated Hashtags */}
        {filteredHashtags.length > 0 && (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="space-y-4"
          >
            {/* Selected Count */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">
                {selectedTags.size} hashtags selected
              </span>
              {selectedTags.size > 0 && (
                <Button
                  size="sm"
                  onClick={copyHashtags}
                  className="gradient-primary"
                >
                  {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  Copy Selected
                </Button>
              )}
            </div>
            
            {/* Hashtag Grid */}
            <div className="grid gap-3">
              {filteredHashtags.map((tag, index) => (
                <motion.div
                  key={tag.tag}
                  variants={staggerItem}
                  className={`
                    p-3 rounded-lg border cursor-pointer transition-all
                    ${selectedTags.has(tag.tag) 
                      ? 'bg-cyan-500/20 border-cyan-500' 
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }
                  `}
                  onClick={() => toggleHashtag(tag.tag)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${getHashtagColor(tag)}`} />
                      <span className="font-medium text-white">#{tag.tag}</span>
                      {tag.trending && (
                        <Badge className="bg-orange-500/20 text-orange-400 text-xs">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          Trending
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {(tag.reach / 1000).toFixed(0)}K
                      </div>
                      <div className="flex items-center gap-1">
                        <BarChart className="h-3 w-3" />
                        {tag.competition}
                      </div>
                      <div className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        {tag.relevance.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            
            {/* Insights */}
            <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-cyan-400" />
                <span className="text-sm font-medium text-white">AI Insights</span>
              </div>
              <ul className="space-y-1 text-sm text-gray-300">
                <li>• Mix high-reach and niche hashtags for best results</li>
                <li>• {hashtags.filter(t => t.trending).length} trending hashtags found</li>
                <li>• Optimal mix: 10 popular, 10 medium, 10 niche tags</li>
              </ul>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}