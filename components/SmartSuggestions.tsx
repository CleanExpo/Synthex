'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Sparkles, 
  TrendingUp, 
  Calendar, 
  Target,
  Clock,
  AlertCircle,
  ChevronRight,
  RefreshCw,
  Lightbulb,
  Zap,
  Award,
  Brain,
  Rocket,
  Filter,
  ThumbsUp,
  BarChart
} from 'lucide-react';
import { 
  getContentSuggestions, 
  getTimeBasedSuggestions,
  scoreContentIdea,
  type ContentSuggestion 
} from '@/lib/content-suggestions';
import { notify } from '@/lib/notifications';
import { useRouter } from 'next/navigation';

interface SmartSuggestionsProps {
  context?: any;
  onSelectSuggestion?: (suggestion: ContentSuggestion) => void;
  compact?: boolean;
}

export function SmartSuggestions({ 
  context, 
  onSelectSuggestion,
  compact = false 
}: SmartSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<ContentSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>('all');
  const router = useRouter();
  
  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      const newSuggestions = getContentSuggestions(context, 8);
      setSuggestions(newSuggestions);
      setLoading(false);
    }, 500);
  }, [context]);

  // Load suggestions
  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);
  
  const handleSelectSuggestion = (suggestion: ContentSuggestion) => {
    if (onSelectSuggestion) {
      onSelectSuggestion(suggestion);
    } else {
      // Navigate to create page with suggestion
      router.push(`/create?suggestion=${suggestion.id}`);
    }
    notify.custom(`💡 Loading suggestion: ${suggestion.title}`);
  };
  
  const getTypeIcon = (type: ContentSuggestion['type']) => {
    const icons = {
      trending: TrendingUp,
      seasonal: Calendar,
      performance: BarChart,
      gap: AlertCircle,
      viral: Rocket,
      evergreen: Award
    };
    return icons[type] || Sparkles;
  };
  
  const getTypeColor = (type: ContentSuggestion['type']) => {
    const colors = {
      trending: 'text-orange-400',
      seasonal: 'text-green-400',
      performance: 'text-blue-400',
      gap: 'text-yellow-400',
      viral: 'text-pink-400',
      evergreen: 'text-purple-400'
    };
    return colors[type] || 'text-gray-400';
  };
  
  const getUrgencyColor = (urgency: string) => {
    const colors = {
      high: 'bg-red-500/20 text-red-400',
      medium: 'bg-yellow-500/20 text-yellow-400',
      low: 'bg-green-500/20 text-green-400'
    };
    return colors[urgency as keyof typeof colors] || colors.low;
  };
  
  // Filter suggestions by type
  const filteredSuggestions = selectedType === 'all' 
    ? suggestions 
    : suggestions.filter(s => s.type === selectedType);
  
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 glass-card animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }
  
  if (compact) {
    return <CompactSuggestions suggestions={suggestions.slice(0, 3)} onSelect={handleSelectSuggestion} />;
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-purple-400" />
          <div>
            <h2 className="text-xl font-semibold text-white">Smart Suggestions</h2>
            <p className="text-sm text-gray-400">AI-powered content recommendations</p>
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={loadSuggestions}
          className="text-gray-400"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
      
      {/* Type Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-400">Filter:</span>
        {['all', 'trending', 'seasonal', 'performance', 'viral'].map(type => (
          <Badge
            key={type}
            variant={selectedType === type ? 'default' : 'secondary'}
            className="cursor-pointer capitalize"
            onClick={() => setSelectedType(type)}
          >
            {type}
          </Badge>
        ))}
      </div>
      
      {/* Suggestions Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredSuggestions.map((suggestion) => {
          const Icon = getTypeIcon(suggestion.type);
          const typeColor = getTypeColor(suggestion.type);
          
          return (
            <Card
              key={suggestion.id}
              className="glass-card hover:scale-[1.02] transition-all cursor-pointer"
              onClick={() => handleSelectSuggestion(suggestion)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-white/5 ${typeColor}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{suggestion.title}</CardTitle>
                      <CardDescription className="text-sm">
                        {suggestion.description}
                      </CardDescription>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Confidence Score */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Confidence</span>
                    <span className="text-white font-medium">{suggestion.confidence}%</span>
                  </div>
                  <Progress value={suggestion.confidence} className="h-2" />
                </div>
                
                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-white/5 rounded">
                    <p className="text-xs text-gray-400">Engagement</p>
                    <p className="text-sm font-semibold text-white">
                      {(suggestion.metrics.expectedEngagement / 1000).toFixed(1)}K
                    </p>
                  </div>
                  <div className="p-2 bg-white/5 rounded">
                    <p className="text-xs text-gray-400">Reach</p>
                    <p className="text-sm font-semibold text-white">
                      {(suggestion.metrics.expectedReach / 1000).toFixed(1)}K
                    </p>
                  </div>
                  <div className="p-2 bg-white/5 rounded">
                    <p className="text-xs text-gray-400">Viral</p>
                    <p className="text-sm font-semibold text-white">
                      {suggestion.metrics.viralPotential}%
                    </p>
                  </div>
                </div>
                
                {/* Timing */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-300">
                      Best at {suggestion.timing.bestTime}
                    </span>
                  </div>
                  <Badge className={getUrgencyColor(suggestion.timing.urgency)}>
                    {suggestion.timing.urgency} priority
                  </Badge>
                </div>
                
                {/* Reasoning */}
                <div className="space-y-1">
                  {suggestion.reasoning.slice(0, 2).map((reason, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-purple-400 text-xs">•</span>
                      <span className="text-xs text-gray-400">{reason}</span>
                    </div>
                  ))}
                </div>
                
                {/* Hashtags */}
                {suggestion.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {suggestion.hashtags.slice(0, 3).map(tag => (
                      <span key={tag} className="text-xs text-purple-400">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {/* Empty State */}
      {filteredSuggestions.length === 0 && (
        <div className="text-center py-12">
          <Lightbulb className="h-12 w-12 text-gray-400 mx-auto mb-4 opacity-50" />
          <p className="text-gray-400">No suggestions available</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={loadSuggestions}
          >
            Generate New Suggestions
          </Button>
        </div>
      )}
    </div>
  );
}

// Compact version for dashboard
function CompactSuggestions({ 
  suggestions, 
  onSelect 
}: { 
  suggestions: ContentSuggestion[];
  onSelect: (s: ContentSuggestion) => void;
}) {
  return (
    <div className="space-y-2">
      {suggestions.map(suggestion => {
        const Icon = suggestion.type === 'trending' ? TrendingUp :
                     suggestion.type === 'seasonal' ? Calendar :
                     suggestion.type === 'viral' ? Rocket :
                     Sparkles;
        
        return (
          <button
            key={suggestion.id}
            onClick={() => onSelect(suggestion)}
            className="w-full p-3 glass-card hover:bg-white/5 rounded-lg transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Icon className="h-4 w-4 text-purple-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {suggestion.title}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {suggestion.confidence}% confidence • {suggestion.timing.urgency} priority
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
            </div>
          </button>
        );
      })}
    </div>
  );
}

// Suggestion Cards for Create Page
export function SuggestionCards() {
  const timeSuggestion = getTimeBasedSuggestions();
  const allSuggestions = getContentSuggestions({}, 4);
  
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Time-based suggestion */}
      <Card className="glass-card border-purple-500/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-purple-400" />
            <CardTitle className="text-base">Perfect Timing</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-white mb-2">{timeSuggestion.title}</p>
          <p className="text-xs text-gray-400">{timeSuggestion.description}</p>
          <div className="flex flex-wrap gap-1 mt-3">
            {timeSuggestion.hashtags.slice(0, 3).map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Other suggestions */}
      {allSuggestions.slice(0, 2).map(suggestion => (
        <Card key={suggestion.id} className="glass-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-400" />
              <CardTitle className="text-base">
                {suggestion.confidence}% Match
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-white mb-2">{suggestion.title}</p>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span>{suggestion.metrics.viralPotential}% viral</span>
              <span>{suggestion.timing.urgency} priority</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Content Idea Scorer
export function IdeaScorer({ idea }: { idea: string }) {
  const [score, setScore] = useState(0);
  
  useEffect(() => {
    if (idea) {
      const newScore = scoreContentIdea(idea);
      setScore(newScore);
    }
  }, [idea]);
  
  if (!idea) return null;
  
  const getScoreColor = () => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };
  
  const getScoreMessage = () => {
    if (score >= 80) return 'Excellent idea! High potential';
    if (score >= 60) return 'Good idea with solid potential';
    if (score >= 40) return 'Average idea, consider improvements';
    return 'Low potential, try a different angle';
  };
  
  return (
    <div className="p-3 glass-card rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400">Idea Score</span>
        <span className={`text-2xl font-bold ${getScoreColor()}`}>
          {score}
        </span>
      </div>
      <Progress value={score} className="h-2 mb-2" />
      <p className="text-xs text-gray-400">{getScoreMessage()}</p>
    </div>
  );
}
