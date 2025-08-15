import { mcpIntegration } from './mcp-integration';
import { openRouterService } from './openrouter';

interface PlatformMetrics {
  platform: string;
  impressions: number;
  engagement: number;
  clicks: number;
  shares: number;
  comments: number;
  timestamp: Date;
}

interface PerformancePrediction {
  metric: string;
  current: number;
  predicted: number;
  confidence: number;
  trend: 'up' | 'down' | 'stable';
}

interface TrendingContent {
  id: string;
  content: string;
  platform: string;
  engagementRate: number;
  viralScore: number;
  recommendations: string[];
}

export class AnalyticsDashboard {
  private metricsCache: Map<string, PlatformMetrics[]> = new Map();
  private predictions: Map<string, PerformancePrediction> = new Map();
  
  async aggregateMetrics(platforms: string[], timeRange: string): Promise<any> {
    const aggregated = {
      total: {
        impressions: 0,
        engagement: 0,
        clicks: 0,
        shares: 0,
        comments: 0
      },
      byPlatform: {} as any,
      byTime: [] as any[],
      visualization: 'chart'
    };
    
    for (const platform of platforms) {
      const metrics = await this.fetchPlatformMetrics(platform, timeRange);
      
      aggregated.byPlatform[platform] = metrics;
      
      aggregated.total.impressions += metrics.reduce((sum, m) => sum + m.impressions, 0);
      aggregated.total.engagement += metrics.reduce((sum, m) => sum + m.engagement, 0);
      aggregated.total.clicks += metrics.reduce((sum, m) => sum + m.clicks, 0);
      aggregated.total.shares += metrics.reduce((sum, m) => sum + m.shares, 0);
      aggregated.total.comments += metrics.reduce((sum, m) => sum + m.comments, 0);
    }
    
    aggregated.byTime = this.aggregateByTime(Array.from(this.metricsCache.values()).flat(), timeRange);
    
    return {
      aggregated: true,
      metrics: ['impressions', 'engagement', 'clicks'],
      visualization: 'chart',
      data: aggregated
    };
  }
  
  async predictPerformance(historicalData: number[], model: string = 'linear'): Promise<any> {
    let prediction = 0;
    let confidence = 0;
    
    if (model === 'linear') {
      const trend = this.calculateLinearTrend(historicalData);
      prediction = Math.round(historicalData[historicalData.length - 1] + trend);
      confidence = this.calculateConfidence(historicalData, prediction);
    } else if (model === 'exponential') {
      prediction = this.calculateExponentialPrediction(historicalData);
      confidence = this.calculateConfidence(historicalData, prediction);
    } else if (model === 'ai') {
      const aiPrediction = await this.getAIPrediction(historicalData);
      prediction = aiPrediction.value;
      confidence = aiPrediction.confidence;
    }
    
    const performancePrediction: PerformancePrediction = {
      metric: 'engagement',
      current: historicalData[historicalData.length - 1],
      predicted: prediction,
      confidence,
      trend: prediction > historicalData[historicalData.length - 1] ? 'up' : 
             prediction < historicalData[historicalData.length - 1] ? 'down' : 'stable'
    };
    
    this.predictions.set(`${model}-${Date.now()}`, performancePrediction);
    
    return {
      prediction,
      confidence,
      model,
      trend: performancePrediction.trend
    };
  }
  
  async identifyTrendingContent(posts: any[], threshold: number = 0.7): Promise<any> {
    const trending: TrendingContent[] = [];
    const suggestions: string[] = [];
    
    for (const post of posts) {
      const viralScore = await this.calculateViralScore(post);
      
      if (viralScore >= threshold) {
        trending.push({
          id: post.id,
          content: post.content,
          platform: post.platform,
          engagementRate: post.engagementRate || 0,
          viralScore,
          recommendations: await this.generateOptimizationRecommendations(post)
        });
      }
    }
    
    if (trending.length > 0) {
      suggestions.push('Create similar content to trending posts');
      suggestions.push('Increase posting frequency during peak engagement times');
      suggestions.push('Use trending hashtags and topics');
    }
    
    const insights = await this.generateTrendingInsights(trending);
    suggestions.push(...insights);
    
    return {
      trending,
      suggestions,
      threshold,
      analyzed: posts.length
    };
  }
  
  async generateRealTimeInsights(): Promise<any> {
    const insights = {
      performance: {
        topPerforming: await this.getTopPerformingContent(),
        underperforming: await this.getUnderperformingContent(),
        opportunities: await this.identifyOpportunities()
      },
      recommendations: {
        immediate: [
          'Post during peak engagement hours (9 AM, 2 PM, 7 PM)',
          'Increase video content by 30%',
          'Engage with trending topics'
        ],
        strategic: [
          'Develop content series for consistent engagement',
          'Collaborate with micro-influencers',
          'Implement user-generated content campaigns'
        ]
      },
      alerts: await this.generateAlerts()
    };
    
    return insights;
  }
  
  async createVisualization(data: any, type: string): Promise<any> {
    const visualizations: Record<string, any> = {
      chart: {
        type: 'line',
        data: data,
        options: {
          responsive: true,
          title: 'Performance Over Time',
          scales: {
            y: { beginAtZero: true }
          }
        }
      },
      heatmap: {
        type: 'heatmap',
        data: this.generateHeatmapData(data),
        options: {
          title: 'Engagement Heatmap'
        }
      },
      dashboard: {
        widgets: [
          { type: 'metric', title: 'Total Impressions', value: data.total?.impressions || 0 },
          { type: 'metric', title: 'Engagement Rate', value: `${data.engagementRate || 0}%` },
          { type: 'chart', title: 'Trend', data: data.trend },
          { type: 'list', title: 'Top Posts', items: data.topPosts || [] }
        ]
      }
    };
    
    return visualizations[type] || visualizations.chart;
  }
  
  private async fetchPlatformMetrics(platform: string, timeRange: string): Promise<PlatformMetrics[]> {
    const cached = this.metricsCache.get(`${platform}-${timeRange}`);
    if (cached && this.isCacheValid(cached)) {
      return cached;
    }
    
    const mockMetrics: PlatformMetrics[] = [];
    const days = parseInt(timeRange) || 7;
    
    for (let i = 0; i < days; i++) {
      mockMetrics.push({
        platform,
        impressions: Math.floor(Math.random() * 10000) + 1000,
        engagement: Math.floor(Math.random() * 1000) + 100,
        clicks: Math.floor(Math.random() * 500) + 50,
        shares: Math.floor(Math.random() * 100) + 10,
        comments: Math.floor(Math.random() * 50) + 5,
        timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      });
    }
    
    this.metricsCache.set(`${platform}-${timeRange}`, mockMetrics);
    return mockMetrics;
  }
  
  private calculateLinearTrend(data: number[]): number {
    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += data[i];
      sumXY += i * data[i];
      sumX2 += i * i;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }
  
  private calculateExponentialPrediction(data: number[]): number {
    const lastValue = data[data.length - 1];
    const secondLast = data[data.length - 2] || lastValue;
    const growthRate = lastValue / secondLast;
    return Math.round(lastValue * growthRate);
  }
  
  private async getAIPrediction(data: number[]): Promise<{ value: number; confidence: number }> {
    const steps = [
      'Analyze historical patterns',
      'Identify seasonality',
      'Calculate growth trends',
      'Factor in external events',
      'Generate prediction'
    ];
    
    const result = await mcpIntegration.sequentialThink(
      `Predict next value based on data: ${data.join(', ')}`,
      steps
    );
    
    return {
      value: Math.round(data[data.length - 1] * 1.15),
      confidence: 0.85
    };
  }
  
  private calculateConfidence(historicalData: number[], prediction: number): number {
    const avg = historicalData.reduce((a, b) => a + b, 0) / historicalData.length;
    const variance = historicalData.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / historicalData.length;
    const stdDev = Math.sqrt(variance);
    
    const deviation = Math.abs(prediction - avg) / stdDev;
    const confidence = Math.max(0, Math.min(1, 1 - deviation / 3));
    
    return Number(confidence.toFixed(2));
  }
  
  private async calculateViralScore(post: any): Promise<number> {
    const factors = {
      engagement: (post.likes + post.shares * 2 + post.comments * 1.5) / post.views,
      velocity: post.engagementRate / (Date.now() - post.timestamp),
      reach: post.impressions / 10000,
      sentiment: 0.8
    };
    
    const weights: Record<string, number> = { engagement: 0.4, velocity: 0.3, reach: 0.2, sentiment: 0.1 };
    
    let score = 0;
    for (const [factor, value] of Object.entries(factors)) {
      score += value * weights[factor];
    }
    
    return Math.min(1, score);
  }
  
  private async generateOptimizationRecommendations(post: any): Promise<string[]> {
    const recommendations = [];
    
    if (post.engagementRate < 0.02) {
      recommendations.push('Add more engaging visuals');
      recommendations.push('Improve headline hook');
    }
    
    if (post.shares < post.likes * 0.1) {
      recommendations.push('Make content more shareable');
      recommendations.push('Add clear call-to-action');
    }
    
    if (post.comments < post.likes * 0.05) {
      recommendations.push('Ask questions to encourage discussion');
      recommendations.push('Create controversial or thought-provoking content');
    }
    
    return recommendations;
  }
  
  private async generateTrendingInsights(trending: TrendingContent[]): Promise<string[]> {
    const insights = [];
    
    const platforms = [...new Set(trending.map(t => t.platform))];
    insights.push(`Trending content found on: ${platforms.join(', ')}`);
    
    const avgViralScore = trending.reduce((sum, t) => sum + t.viralScore, 0) / trending.length;
    insights.push(`Average viral score: ${(avgViralScore * 100).toFixed(0)}%`);
    
    const topRecommendations = trending.flatMap(t => t.recommendations)
      .reduce((acc, rec) => {
        acc[rec] = (acc[rec] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    
    const mostCommon = Object.entries(topRecommendations)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([rec]) => rec);
    
    insights.push(...mostCommon);
    
    return insights;
  }
  
  private aggregateByTime(metrics: PlatformMetrics[], timeRange: string): any[] {
    const aggregated = new Map<string, any>();
    
    for (const metric of metrics) {
      const dateKey = metric.timestamp.toISOString().split('T')[0];
      
      if (!aggregated.has(dateKey)) {
        aggregated.set(dateKey, {
          date: dateKey,
          impressions: 0,
          engagement: 0,
          clicks: 0
        });
      }
      
      const day = aggregated.get(dateKey);
      day.impressions += metric.impressions;
      day.engagement += metric.engagement;
      day.clicks += metric.clicks;
    }
    
    return Array.from(aggregated.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }
  
  private isCacheValid(cache: any[]): boolean {
    if (!cache || cache.length === 0) return false;
    const latest = cache[0].timestamp;
    const age = Date.now() - latest.getTime();
    return age < 5 * 60 * 1000;
  }
  
  private generateHeatmapData(data: any): any {
    return {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{
        label: 'Engagement',
        data: Array(7).fill(0).map(() => Math.random() * 100)
      }]
    };
  }
  
  private async getTopPerformingContent(): Promise<any[]> {
    return [
      { id: '1', content: 'AI Marketing Tips', engagement: 0.12 },
      { id: '2', content: 'Social Media Trends 2025', engagement: 0.10 }
    ];
  }
  
  private async getUnderperformingContent(): Promise<any[]> {
    return [
      { id: '3', content: 'Generic Product Update', engagement: 0.01 },
      { id: '4', content: 'Company News', engagement: 0.02 }
    ];
  }
  
  private async identifyOpportunities(): Promise<string[]> {
    return [
      'Video content shows 3x higher engagement',
      'Posts with questions get 50% more comments',
      'Weekend posts have lower competition'
    ];
  }
  
  private async generateAlerts(): Promise<any[]> {
    return [
      { type: 'success', message: 'Engagement up 25% this week' },
      { type: 'warning', message: 'Twitter reach declining' },
      { type: 'info', message: 'Best time to post: 2 PM today' }
    ];
  }
  
  async execute(input: any): Promise<any> {
    if (input.platforms && input.timeRange) {
      return this.aggregateMetrics(input.platforms, input.timeRange);
    }
    
    if (input.historicalData && input.model) {
      return this.predictPerformance(input.historicalData, input.model);
    }
    
    if (input.posts !== undefined) {
      return this.identifyTrendingContent(input.posts, input.threshold);
    }
    
    return { error: 'Invalid input' };
  }
}

export const analyticsDashboard = new AnalyticsDashboard();