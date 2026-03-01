'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Brain, RefreshCw, Download, ArrowUp, ArrowDown,
} from '@/components/icons';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar,
} from 'recharts';
import { notify } from '@/lib/notifications';
import type {
  SentimentData, EmotionScore, SentimentTrend, TopicSentiment,
  AnalyticsResponse, AnalysisResponse, SingleAnalysisResponse,
} from './types';
import { getSentimentColor } from './helpers';
import { OverviewTab } from './OverviewTab';
import { TopicsTab } from './TopicsTab';
import { MentionsTab } from './MentionsTab';
import { AnalyzerTab } from './AnalyzerTab';

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
    score: 0, positive: 0, negative: 0, neutral: 0, trend: 0
  });

  const loadSentimentData = useCallback(async () => {
    setLoading(true);

    try {
      const [analyticsRes, analysesRes] = await Promise.all([
        fetch(`/api/analytics/sentiment?days=${selectedTimeRange === '7d' ? 7 : selectedTimeRange === '30d' ? 30 : 90}${selectedPlatform !== 'all' ? `&platform=${selectedPlatform}` : ''}`),
        fetch(`/api/ai-content/sentiment?limit=50${selectedPlatform !== 'all' ? `&platform=${selectedPlatform}` : ''}`)
      ]);

      if (!analyticsRes.ok || !analysesRes.ok) {
        throw new Error('Failed to fetch sentiment data');
      }

      const analyticsData: AnalyticsResponse = await analyticsRes.json();
      const analysesData: AnalysisResponse = await analysesRes.json();

      // Transform API analyses to component's SentimentData format
      const transformedData: SentimentData[] = analysesData.analyses.map((analysis, i) => ({
        id: analysis.id || `sent-${i}`,
        content: '',
        platform: analysis.platform || 'Unknown',
        author: 'User',
        timestamp: new Date(analysis.analyzedAt),
        sentiment: analysis.sentiment === 'mixed' ? 'neutral' : analysis.sentiment,
        score: analysis.score / 100,
        confidence: analysis.confidence * 100,
        emotions: analysis.emotions.map(e => ({
          emotion: e.emotion as EmotionScore['emotion'],
          score: e.intensity
        })),
        topics: [],
        entities: [],
        engagement: { likes: 0, comments: 0, shares: 0, reach: 0 },
        actionable: false,
        priority: 'low'
      }));

      setSentimentData(transformedData);

      const transformedTrends: SentimentTrend[] = analyticsData.trends.map(t => ({
        date: new Date(t.date),
        positive: t.positive,
        negative: t.negative,
        neutral: t.neutral,
        volume: t.count
      }));
      setTrends(transformedTrends);

      const topicSentimentData: TopicSentiment[] = analyticsData.topEmotions.map(e => ({
        topic: e.emotion,
        mentions: e.count,
        sentiment: e.percentage / 100 - 0.5,
        trend: 'stable' as const
      }));
      setTopicSentiments(topicSentimentData);

      if (analyticsData.overall.total > 0) {
        setOverallSentiment({
          score: analyticsData.overall.avgScore / 100,
          positive: (analyticsData.overall.positive / analyticsData.overall.total) * 100,
          negative: (analyticsData.overall.negative / analyticsData.overall.total) * 100,
          neutral: (analyticsData.overall.neutral / analyticsData.overall.total) * 100,
          trend: 0
        });
      }
    } catch (error) {
      notify.error('Failed to load sentiment data');
      setSentimentData([]);
      setTrends([]);
      setTopicSentiments([]);
    } finally {
      setLoading(false);
    }
  }, [selectedPlatform, selectedTimeRange]);

  useEffect(() => {
    loadSentimentData();
  }, [loadSentimentData, selectedPlatform, selectedTimeRange]);

  const analyzeSentiment = async () => {
    if (!testText.trim()) {
      notify.error('Please enter text to analyze');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/ai-content/sentiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: testText,
          contentType: 'text',
          predictEngagement: false
        })
      });

      if (!response.ok) {
        throw new Error('Failed to analyze sentiment');
      }

      const data: SingleAnalysisResponse = await response.json();
      const analysis = data.analysis;

      setTestResult({
        sentiment: analysis.sentiment === 'mixed' ? 'neutral' : analysis.sentiment,
        score: analysis.score / 100,
        confidence: analysis.confidence * 100,
        emotions: analysis.emotions.map(e => ({
          emotion: e.emotion,
          score: e.intensity
        })),
        topics: analysis.toneIndicators || [],
        keyPhrases: analysis.keyPhrases || []
      });

      notify.success('Sentiment analysis complete!');
    } catch (error) {
      notify.error('Failed to analyze sentiment. Please try again.');
    } finally {
      setLoading(false);
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
    }, [] as Array<{ emotion: string; score: number; count: number }>)
    .map(e => ({ emotion: e.emotion, score: e.score / e.count }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-500/20">
            <Brain className="h-6 w-6 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Sentiment Analysis</h2>
            <p className="text-gray-400">AI-powered emotional intelligence</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={loadSentimentData} className="bg-white/5 border-white/10">
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
      <Card variant="glass">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Main Score */}
            <div className="text-center">
              <div className="relative inline-flex items-center justify-center">
                <div className="w-32 h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                      cx="50%" cy="50%" innerRadius="60%" outerRadius="100%"
                      data={[{ value: Math.abs(overallSentiment.score) * 100, fill: overallSentiment.score > 0 ? '#10b981' : '#ef4444' }]}
                      startAngle={90} endAngle={-270}
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
                    cx="50%" cy="50%"
                    innerRadius={40} outerRadius={60}
                    paddingAngle={5} dataKey="value"
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
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }} />
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
                  {sentimentData.length > 0
                    ? (sentimentData.reduce((sum, d) => sum + d.confidence, 0) / sentimentData.length).toFixed(0)
                    : 0}%
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
          <OverviewTab trends={trends} emotionRadarData={emotionRadarData} />
        </TabsContent>

        <TabsContent value="topics" className="space-y-4">
          <TopicsTab topicSentiments={topicSentiments} />
        </TabsContent>

        <TabsContent value="mentions" className="space-y-4">
          <MentionsTab sentimentData={sentimentData} />
        </TabsContent>

        <TabsContent value="analyzer" className="space-y-4">
          <AnalyzerTab
            testText={testText}
            setTestText={setTestText}
            testResult={testResult}
            loading={loading}
            onAnalyze={analyzeSentiment}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
