'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Brain,
  Sparkles,
  Target,
  Heart,
  Zap,
  Shield,
  TrendingUp,
  MessageSquare,
  Lightbulb,
  BarChart3,
  RefreshCw,
  Loader2,
  Copy,
  Check
} from '@/components/icons';
import toast, { Toaster } from 'react-hot-toast';

interface PsychologyPrinciple {
  name: string;
  score: number;
  description: string;
  recommendation: string;
}

interface AnalysisResult {
  overallScore: number;
  principles: PsychologyPrinciple[];
  emotionalTone: {
    primary: string;
    secondary: string[];
    score: number;
  };
  readability: {
    score: number;
    level: string;
    wordCount: number;
    avgSentenceLength: number;
  };
  persuasionMetrics: {
    clarity: number;
    urgency: number;
    credibility: number;
    engagement: number;
  };
  recommendations: string[];
}

const PLATFORMS = [
  { id: 'twitter', name: 'Twitter/X', maxLength: 280 },
  { id: 'linkedin', name: 'LinkedIn', maxLength: 3000 },
  { id: 'instagram', name: 'Instagram', maxLength: 2200 },
  { id: 'facebook', name: 'Facebook', maxLength: 63206 },
  { id: 'tiktok', name: 'TikTok', maxLength: 2200 },
  { id: 'email', name: 'Email', maxLength: 10000 },
  { id: 'web', name: 'Website', maxLength: 10000 },
];

const CONTENT_TYPES = [
  { id: 'post', name: 'Social Post' },
  { id: 'ad', name: 'Advertisement' },
  { id: 'email', name: 'Email' },
  { id: 'landing', name: 'Landing Page' },
  { id: 'tagline', name: 'Tagline' },
  { id: 'headline', name: 'Headline' },
];

const PRINCIPLE_ICONS: Record<string, React.ElementType> = {
  'Social Proof': Target,
  'Scarcity': Zap,
  'Reciprocity': Heart,
  'Authority': Shield,
  'Commitment': Check,
  'Liking': Sparkles,
};

export default function PsychologyPage() {
  const [content, setContent] = useState('');
  const [platform, setPlatform] = useState('twitter');
  const [contentType, setContentType] = useState('post');
  const [targetAudience, setTargetAudience] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleAnalyze = async () => {
    if (!content.trim()) {
      toast.error('Please enter content to analyze');
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/psychology/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          platform,
          contentType,
          targetAudience: targetAudience || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const data = await response.json();

      if (data.success && data.data?.analysis) {
        setResult(data.data.analysis);
        toast.success('Analysis complete!');
      } else {
        throw new Error(data.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze content');

      // Show demo result for development
      setResult({
        overallScore: 78,
        principles: [
          { name: 'Social Proof', score: 85, description: 'Leverages social validation', recommendation: 'Add specific numbers or testimonials' },
          { name: 'Scarcity', score: 60, description: 'Creates urgency', recommendation: 'Emphasize limited availability' },
          { name: 'Reciprocity', score: 72, description: 'Offers value first', recommendation: 'Lead with a free resource or insight' },
          { name: 'Authority', score: 80, description: 'Establishes credibility', recommendation: 'Include credentials or data sources' },
        ],
        emotionalTone: {
          primary: 'Confident',
          secondary: ['Inspiring', 'Professional'],
          score: 75,
        },
        readability: {
          score: 82,
          level: 'Easy to read',
          wordCount: content.split(/\s+/).length,
          avgSentenceLength: 15,
        },
        persuasionMetrics: {
          clarity: 85,
          urgency: 65,
          credibility: 78,
          engagement: 72,
        },
        recommendations: [
          'Add a clear call-to-action to improve conversion',
          'Include specific numbers or statistics for credibility',
          'Create urgency with time-limited offers',
          'Use more power words to increase emotional impact',
        ],
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopyRecommendations = () => {
    if (!result) return;

    const text = result.recommendations.join('\n- ');
    navigator.clipboard.writeText(`Recommendations:\n- ${text}`);
    setCopied(true);
    toast.success('Recommendations copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const selectedPlatform = PLATFORMS.find(p => p.id === platform);

  return (
    <div className="p-6 space-y-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Psychology Analysis</h1>
          <p className="text-gray-400">Analyze content for psychological persuasion effectiveness</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="space-y-6">
          <Card variant="glass">
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageSquare className="w-5 h-5 mr-2 text-purple-400" />
                Content to Analyze
              </CardTitle>
              <CardDescription>
                Enter your marketing content for AI-powered psychology analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter your content here... (e.g., social media post, email subject line, ad copy)"
                  className="w-full h-48 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  maxLength={selectedPlatform?.maxLength || 5000}
                />
                <div className="flex justify-between mt-2 text-sm text-gray-400">
                  <span>{content.length} characters</span>
                  <span>Max: {selectedPlatform?.maxLength || 5000}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Platform
                  </label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p.id} value={p.id} className="bg-gray-800">
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Content Type
                  </label>
                  <select
                    value={contentType}
                    onChange={(e) => setContentType(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {CONTENT_TYPES.map((ct) => (
                      <option key={ct.id} value={ct.id} className="bg-gray-800">
                        {ct.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Target Audience (optional)
                </label>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="e.g., Tech professionals aged 25-45"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <Button
                className="w-full gradient-primary text-white"
                onClick={handleAnalyze}
                disabled={isAnalyzing || !content.trim()}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4 mr-2" />
                    Analyze Content
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Results Section */}
        <div className="space-y-6">
          {result ? (
            <>
              {/* Overall Score */}
              <Card variant="glass">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center">
                      <BarChart3 className="w-5 h-5 mr-2 text-purple-400" />
                      Overall Score
                    </span>
                    <span className={`text-4xl font-bold ${getScoreColor(result.overallScore)}`}>
                      {result.overallScore}%
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Progress value={result.overallScore} className={`h-3 ${getScoreBg(result.overallScore)}`} />
                  <p className="text-sm text-gray-400 mt-2">
                    {result.overallScore >= 80
                      ? 'Excellent! Your content is highly persuasive.'
                      : result.overallScore >= 60
                      ? 'Good foundation with room for improvement.'
                      : 'Consider applying more psychology principles.'}
                  </p>
                </CardContent>
              </Card>

              {/* Psychology Principles */}
              <Card variant="glass">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Brain className="w-5 h-5 mr-2 text-purple-400" />
                    Psychology Principles
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {result.principles.map((principle, index) => {
                    const Icon = PRINCIPLE_ICONS[principle.name] || Lightbulb;
                    return (
                      <div key={index} className="p-3 bg-white/5 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4 text-purple-400" />
                            <span className="font-medium text-white">{principle.name}</span>
                          </div>
                          <span className={`font-bold ${getScoreColor(principle.score)}`}>
                            {principle.score}%
                          </span>
                        </div>
                        <Progress value={principle.score} className="h-2 mb-2" />
                        <p className="text-xs text-gray-400">{principle.description}</p>
                        <p className="text-xs text-purple-300 mt-1">
                          <Lightbulb className="w-3 h-3 inline mr-1" />
                          {principle.recommendation}
                        </p>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Persuasion Metrics */}
              <Card variant="glass">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2 text-purple-400" />
                    Persuasion Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(result.persuasionMetrics).map(([key, value]) => (
                      <div key={key} className="p-3 bg-white/5 rounded-lg">
                        <p className="text-sm text-gray-400 capitalize mb-1">{key}</p>
                        <div className="flex items-center gap-2">
                          <Progress value={value} className="h-2 flex-1" />
                          <span className={`text-sm font-bold ${getScoreColor(value)}`}>
                            {value}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recommendations */}
              <Card variant="glass">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center">
                      <Lightbulb className="w-5 h-5 mr-2 text-yellow-400" />
                      Recommendations
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCopyRecommendations}
                    >
                      {copied ? (
                        <Check className="w-4 h-4 mr-1" />
                      ) : (
                        <Copy className="w-4 h-4 mr-1" />
                      )}
                      Copy
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {result.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <Sparkles className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-300">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card variant="glass">
              <CardContent className="py-12 text-center">
                <Brain className="w-16 h-16 mx-auto text-gray-500 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  Ready to Analyze
                </h3>
                <p className="text-gray-400">
                  Enter your content and click Analyze to get AI-powered psychology insights
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
