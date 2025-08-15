'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Brain,
  Smile,
  Frown,
  Meh,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  MessageSquare,
  Heart,
  ThumbsUp,
  ThumbsDown,
  Star,
  Zap,
  BarChart3,
  Activity,
  Filter,
  Download,
  RefreshCw,
  Clock,
  Users,
  Hash,
  Globe,
  Sparkles,
  ChevronRight,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar
} from 'recharts';
import { notify } from '@/lib/notifications';

interface SentimentData {
  id: string;
  content: string;
  platform: string;
  author: string;
  timestamp: Date;
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number; // -1 to 1
  confidence: number; // 0 to 100
  emotions: EmotionScore[];
  topics: string[];
  entities: Entity[];
  engagement: EngagementMetrics;
  actionable: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

interface EmotionScore {
  emotion: 'joy' | 'anger' | 'sadness' | 'fear' | 'surprise' | 'disgust';
  score: number;
}

interface Entity {
  text: string;
  type: 'person' | 'product' | 'brand' | 'location' | 'topic';
  sentiment: number;
}

interface EngagementMetrics {
  likes: number;
  comments: number;
  shares: number;
  reach: number;
}

interface SentimentTrend {
  date: Date;
  positive: number;
  negative: number;
  neutral: number;
  volume: number;
}

interface TopicSentiment {
  topic: string;
  mentions: number;
  sentiment: number;
  trend: 'rising' | 'falling' | 'stable';
}

export function SentimentAnalysis() {
  const [sentimentData, setSentimentData] = useState<SentimentData[]>([]);
  const [trends, setTrends] = useState<SentimentTrend[]>([]);
  const [topicSentiments, setTopicSentiments] = useState<TopicSentiment[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('7d');
  const [testText, setTestText] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Overall metrics
  const [overallSentiment, setOverallSentiment] = useState({
    score: 0,
    positive: 0,
    negative: 0,
    neutral: 0,
    trend: 0
  });
  
  useEffect(() => {
    loadSentimentData();
  }, [selectedPlatform, selectedTimeRange]);
  
  const loadSentimentData = () => {
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      const mockData = generateMockData();
      setSentimentData(mockData);
      setTrends(generateTrends());
      setTopicSentiments(generateTopicSentiments());
      calculateOverallSentiment(mockData);
      setLoading(false);
    }, 1000);
  };
  
  const generateMockData = (): SentimentData[] => {
    const platforms = ['Twitter', 'Instagram', 'LinkedIn', 'Facebook'];
    const sentiments: ('positive' | 'negative' | 'neutral')[] = ['positive', 'negative', 'neutral'];
    
    return Array.from({ length: 50 }, (_, i) => {
      const sentiment = sentiments[Math.floor(Math.random() * 3)];
      const score = sentiment === 'positive' ? 
        0.3 + Math.random() * 0.7 :
        sentiment === 'negative' ?
        -0.3 - Math.random() * 0.7 :
        -0.2 + Math.random() * 0.4;
      
      return {
        id: `sent-${i}`,
        content: generateSampleContent(sentiment),
        platform: platforms[Math.floor(Math.random() * platforms.length)],
        author: `User${Math.floor(Math.random() * 100)}`,
        timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        sentiment,
        score,
        confidence: 70 + Math.random() * 30,
        emotions: generateEmotions(sentiment),
        topics: generateTopics(),
        entities: generateEntities(),
        engagement: {
          likes: Math.floor(Math.random() * 1000),
          comments: Math.floor(Math.random() * 100),
          shares: Math.floor(Math.random() * 50),
          reach: Math.floor(Math.random() * 10000)
        },
        actionable: Math.random() > 0.7,
        priority: ['low', 'medium', 'high', 'urgent'][Math.floor(Math.random() * 4)] as any
      };
    });
  };
  
  const generateSampleContent = (sentiment: string): string => {
    const positive = [
      "Love this product! Best purchase ever!",
      "Amazing customer service, highly recommend!",
      "This completely exceeded my expectations!",
      "Fantastic experience from start to finish!"
    ];
    
    const negative = [
      "Very disappointed with the quality.",
      "Customer service was unhelpful and rude.",
      "Product broke after just one week.",
      "Would not recommend to anyone."
    ];
    
    const neutral = [
      "The product is okay, nothing special.",
      "Average experience overall.",
      "It works as described.",
      "Neither good nor bad, just standard."
    ];
    
    const options = sentiment === 'positive' ? positive :
                    sentiment === 'negative' ? negative : neutral;
    
    return options[Math.floor(Math.random() * options.length)];
  };
  
  const generateEmotions = (sentiment: string): EmotionScore[] => {
    const emotions: EmotionScore[] = [
      { emotion: 'joy', score: sentiment === 'positive' ? 0.7 + Math.random() * 0.3 : Math.random() * 0.3 },
      { emotion: 'anger', score: sentiment === 'negative' ? 0.5 + Math.random() * 0.5 : Math.random() * 0.2 },
      { emotion: 'sadness', score: sentiment === 'negative' ? 0.3 + Math.random() * 0.4 : Math.random() * 0.2 },
      { emotion: 'fear', score: Math.random() * 0.3 },
      { emotion: 'surprise', score: Math.random() * 0.4 },
      { emotion: 'disgust', score: sentiment === 'negative' ? Math.random() * 0.5 : Math.random() * 0.1 }
    ];
    
    return emotions.sort((a, b) => b.score - a.score).slice(0, 3);
  };
  
  const generateTopics = (): string[] => {
    const allTopics = [
      'product quality', 'customer service', 'pricing', 'shipping',
      'user experience', 'features', 'performance', 'design'
    ];
    
    const numTopics = 1 + Math.floor(Math.random() * 3);
    const topics: string[] = [];
    
    for (let i = 0; i < numTopics; i++) {
      const topic = allTopics[Math.floor(Math.random() * allTopics.length)];
      if (!topics.includes(topic)) {
        topics.push(topic);
      }
    }
    
    return topics;
  };
  
  const generateEntities = (): Entity[] => {
    return [
      {
        text: 'Your Brand',
        type: 'brand',
        sentiment: -0.5 + Math.random()
      },
      {
        text: 'Product X',
        type: 'product',
        sentiment: -0.5 + Math.random()
      }
    ];
  };
  
  const generateTrends = (): SentimentTrend[] => {
    return Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000),
      positive: 30 + Math.random() * 40,
      negative: 10 + Math.random() * 30,
      neutral: 20 + Math.random() * 30,
      volume: 100 + Math.floor(Math.random() * 200)
    }));
  };
  
  const generateTopicSentiments = (): TopicSentiment[] => {
    const topics = [
      'product quality', 'customer service', 'pricing', 'shipping',
      'user experience', 'features', 'performance', 'design'
    ];
    
    return topics.map(topic => ({
      topic,
      mentions: Math.floor(Math.random() * 100) + 20,
      sentiment: -0.5 + Math.random(),
      trend: ['rising', 'falling', 'stable'][Math.floor(Math.random() * 3)] as any
    }));
  };
  
  const calculateOverallSentiment = (data: SentimentData[]) => {
    const positive = data.filter(d => d.sentiment === 'positive').length;
    const negative = data.filter(d => d.sentiment === 'negative').length;
    const neutral = data.filter(d => d.sentiment === 'neutral').length;
    const total = data.length;
    
    const avgScore = data.reduce((sum, d) => sum + d.score, 0) / total;
    
    setOverallSentiment({
      score: avgScore,
      positive: (positive / total) * 100,
      negative: (negative / total) * 100,
      neutral: (neutral / total) * 100,
      trend: Math.random() * 20 - 10 // -10 to +10
    });
  };
  
  const analyzeSentiment = () => {
    if (!testText.trim()) {
      notify.error('Please enter text to analyze');
      return;
    }
    
    setLoading(true);
    
    // Simulate AI analysis
    setTimeout(() => {
      const sentiment = testText.toLowerCase().includes('good') || 
                       testText.toLowerCase().includes('great') ||
                       testText.toLowerCase().includes('love') ? 'positive' :
                       testText.toLowerCase().includes('bad') ||
                       testText.toLowerCase().includes('terrible') ||
                       testText.toLowerCase().includes('hate') ? 'negative' : 'neutral';
      
      const score = sentiment === 'positive' ? 0.7 :
                   sentiment === 'negative' ? -0.7 : 0;
      
      setTestResult({
        sentiment,
        score,
        confidence: 85 + Math.random() * 15,
        emotions: generateEmotions(sentiment),
        topics: generateTopics(),
        keyPhrases: extractKeyPhrases(testText)
      });
      
      setLoading(false);
      notify.success('Sentiment analysis complete!');
    }, 1000);
  };
  
  const extractKeyPhrases = (text: string): string[] => {
    const words = text.split(' ');
    const phrases: string[] = [];
    
    for (let i = 0; i < words.length - 1; i++) {
      if (Math.random() > 0.7) {
        phrases.push(`${words[i]} ${words[i + 1]}`);
      }
    }
    
    return phrases.slice(0, 3);
  };
  
  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return <Smile className="h-5 w-5 text-green-400" />;
      case 'negative': return <Frown className="h-5 w-5 text-red-400" />;
      default: return <Meh className="h-5 w-5 text-yellow-400" />;
    }
  };
  
  const getSentimentColor = (score: number) => {
    if (score > 0.3) return 'text-green-400';
    if (score < -0.3) return 'text-red-400';
    return 'text-yellow-400';
  };
  
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };
  
  // Prepare chart data
  const sentimentDistribution = [
    { name: 'Positive', value: overallSentiment.positive, fill: '#10b981' },
    { name: 'Negative', value: overallSentiment.negative, fill: '#ef4444' },
    { name: 'Neutral', value: overallSentiment.neutral, fill: '#f59e0b' }
  ];
  
  const emotionRadarData = sentimentData.slice(0, 10).flatMap(d => d.emotions)
    .reduce((acc, emotion) => {
      const existing = acc.find(e => e.emotion === emotion.emotion);
      if (existing) {
        existing.score += emotion.score;
        existing.count++;
      } else {
        acc.push({ ...emotion, count: 1 });
      }
      return acc;
    }, [] as any[])
    .map(e => ({ emotion: e.emotion, score: e.score / e.count }));
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
            <Brain className="h-6 w-6 text-purple-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Sentiment Analysis</h2>
            <p className="text-gray-400">AI-powered emotional intelligence</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={loadSentimentData}
            className="bg-white/5 border-white/10"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button className="gradient-primary">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>
      
      {/* Overall Sentiment Score */}
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Main Score */}
            <div className="text-center">
              <div className="relative inline-flex items-center justify-center">
                <div className="w-32 h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                      cx="50%"
                      cy="50%"
                      innerRadius="60%"
                      outerRadius="100%"
                      data={[{ value: Math.abs(overallSentiment.score) * 100, fill: overallSentiment.score > 0 ? '#10b981' : '#ef4444' }]}
                      startAngle={90}
                      endAngle={-270}
                    >
                      <RadialBar dataKey="value" cornerRadius={10} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-3xl font-bold ${getSentimentColor(overallSentiment.score)}`}>
                      {(overallSentiment.score * 100).toFixed(0)}
                    </span>
                    <span className="text-xs text-gray-400">Score</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-400 mt-2">Overall Sentiment</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                {overallSentiment.trend > 0 ? (
                  <ArrowUp className="h-4 w-4 text-green-400" />
                ) : (
                  <ArrowDown className="h-4 w-4 text-red-400" />
                )}
                <span className="text-sm text-white">
                  {Math.abs(overallSentiment.trend).toFixed(1)}%
                </span>
              </div>
            </div>
            
            {/* Distribution */}
            <div className="md:col-span-2">
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie
                    data={sentimentDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {sentimentDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2">
                {sentimentDistribution.map(item => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: item.fill }} />
                    <span className="text-xs text-gray-400">
                      {item.name}: {item.value.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Key Metrics */}
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-400">Total Mentions</p>
                <p className="text-2xl font-bold text-white">{sentimentData.length}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Response Rate</p>
                <p className="text-2xl font-bold text-white">78%</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Avg. Confidence</p>
                <p className="text-2xl font-bold text-white">
                  {(sentimentData.reduce((sum, d) => sum + d.confidence, 0) / sentimentData.length).toFixed(0)}%
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 bg-white/5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="topics">Topics</TabsTrigger>
          <TabsTrigger value="mentions">Mentions</TabsTrigger>
          <TabsTrigger value="analyzer">Analyzer</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          {/* Sentiment Trend */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Sentiment Trend</CardTitle>
              <CardDescription>Track emotional patterns over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#666"
                    tickFormatter={(date) => new Date(date).toLocaleDateString()}
                  />
                  <YAxis stroke="#666" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(0,0,0,0.8)',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="positive" stackId="1" fill="#10b981" stroke="#10b981" />
                  <Area type="monotone" dataKey="neutral" stackId="1" fill="#f59e0b" stroke="#f59e0b" />
                  <Area type="monotone" dataKey="negative" stackId="1" fill="#ef4444" stroke="#ef4444" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          
          {/* Emotion Analysis */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Emotion Breakdown</CardTitle>
              <CardDescription>Detailed emotional analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={emotionRadarData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="emotion" stroke="#666" />
                  <YAxis stroke="#666" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(0,0,0,0.8)',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="score" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="topics" className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Topic Sentiment</CardTitle>
              <CardDescription>Sentiment analysis by topic</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topicSentiments.sort((a, b) => b.mentions - a.mentions).map(topic => (
                  <div key={topic.topic} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Hash className="h-4 w-4 text-gray-400" />
                        <span className="font-medium text-white capitalize">{topic.topic}</span>
                        <Badge variant="secondary" className="text-xs">
                          {topic.mentions} mentions
                        </Badge>
                        {topic.trend === 'rising' && <TrendingUp className="h-4 w-4 text-green-400" />}
                        {topic.trend === 'falling' && <TrendingDown className="h-4 w-4 text-red-400" />}
                      </div>
                      <div className="flex items-center gap-4">
                        <Progress 
                          value={(topic.sentiment + 1) * 50} 
                          className="flex-1 h-2"
                        />
                        <span className={`text-sm font-medium ${getSentimentColor(topic.sentiment)}`}>
                          {(topic.sentiment * 100).toFixed(0)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="mentions" className="space-y-4">
          {/* Recent Mentions */}
          <div className="space-y-3">
            {sentimentData.slice(0, 10).map(item => (
              <Card key={item.id} className="glass-card">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getSentimentIcon(item.sentiment)}
                      <Badge variant="secondary">{item.platform}</Badge>
                      <span className="text-xs text-gray-400">
                        @{item.author} • {new Date(item.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${getPriorityColor(item.priority)}`} />
                  </div>
                  
                  <p className="text-sm text-gray-300 mb-3">{item.content}</p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        {item.engagement.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {item.engagement.comments}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {item.engagement.reach}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={item.actionable ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {item.actionable ? 'Action Required' : 'Monitor'}
                      </Badge>
                      <span className="text-xs text-gray-400">
                        {(item.confidence).toFixed(0)}% confidence
                      </span>
                    </div>
                  </div>
                  
                  {item.topics.length > 0 && (
                    <div className="flex gap-2 mt-3">
                      {item.topics.map(topic => (
                        <Badge key={topic} className="bg-purple-500/20 text-purple-400 text-xs">
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="analyzer" className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Real-time Sentiment Analyzer</CardTitle>
              <CardDescription>Test sentiment analysis on any text</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Enter text to analyze sentiment..."
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                className="bg-white/5 border-white/10 min-h-[100px]"
              />
              
              <Button 
                onClick={analyzeSentiment}
                disabled={loading}
                className="gradient-primary"
              >
                <Brain className="h-4 w-4 mr-2" />
                Analyze Sentiment
              </Button>
              
              {testResult && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-white/5 rounded-lg space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getSentimentIcon(testResult.sentiment)}
                      <span className="font-medium text-white capitalize">
                        {testResult.sentiment} Sentiment
                      </span>
                    </div>
                    <Badge className={getSentimentColor(testResult.score)}>
                      Score: {(testResult.score * 100).toFixed(0)}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Confidence</span>
                    <span className="text-white">{testResult.confidence.toFixed(1)}%</span>
                  </div>
                  
                  {testResult.emotions.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-400 mb-2">Detected Emotions</p>
                      <div className="flex gap-2">
                        {testResult.emotions.map((emotion: EmotionScore) => (
                          <Badge key={emotion.emotion} variant="secondary" className="text-xs">
                            {emotion.emotion}: {(emotion.score * 100).toFixed(0)}%
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {testResult.keyPhrases?.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-400 mb-2">Key Phrases</p>
                      <div className="flex flex-wrap gap-2">
                        {testResult.keyPhrases.map((phrase: string, i: number) => (
                          <Badge key={i} className="bg-purple-500/20 text-purple-400 text-xs">
                            {phrase}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}