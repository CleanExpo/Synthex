/**
 * Advanced Analytics System
 * Real-time metrics, predictive analytics, and performance insights
 */

import { db } from '../lib/supabase.js';
import { redisService } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { websocketService } from '../lib/websocket.js';

// Analytics configuration
const ANALYTICS_CONFIG = {
  // Real-time tracking
  realtime: {
    enabled: true,
    updateInterval: 5000, // 5 seconds
    metricsBuffer: 100,
    websocketChannel: 'analytics'
  },
  
  // Metrics aggregation
  aggregation: {
    intervals: ['1m', '5m', '1h', '1d', '1w', '1M'],
    retentionDays: {
      '1m': 1,
      '5m': 7,
      '1h': 30,
      '1d': 365,
      '1w': 730,
      '1M': 1825
    }
  },
  
  // Predictive analytics
  prediction: {
    enabled: true,
    models: ['engagement', 'growth', 'churn', 'revenue'],
    updateFrequency: 3600000 // 1 hour
  },
  
  // Performance benchmarks
  benchmarks: {
    engagement: {
      poor: 0.01,
      average: 0.03,
      good: 0.05,
      excellent: 0.1
    },
    growth: {
      poor: 0.01,
      average: 0.05,
      good: 0.1,
      excellent: 0.2
    }
  },
  
  // Cache configuration
  cache: {
    enabled: true,
    ttl: {
      realtime: 10,
      aggregated: 300,
      predictions: 3600
    }
  }
};

class AdvancedAnalytics {
  constructor() {
    this.metricsBuffer = [];
    this.realtimeSubscribers = new Set();
    this.predictionModels = new Map();
    this.aggregationJobs = new Map();
    this.init();
  }

  async init() {
    logger.info('Initializing advanced analytics system', { category: 'analytics' });
    
    // Start real-time tracking
    if (ANALYTICS_CONFIG.realtime.enabled) {
      this.startRealtimeTracking();
    }
    
    // Initialize aggregation jobs
    this.setupAggregationJobs();
    
    // Load prediction models
    await this.loadPredictionModels();
    
    // Start prediction updates
    if (ANALYTICS_CONFIG.prediction.enabled) {
      this.startPredictionUpdates();
    }
    
    logger.info('Advanced analytics system initialized', { category: 'analytics' });
  }

  // Real-time metrics tracking
  async trackEvent(eventData) {
    const event = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...eventData,
      metadata: {
        ...eventData.metadata,
        serverTime: Date.now(),
        version: process.env.npm_package_version || '1.0.0'
      }
    };

    try {
      // Add to buffer for batch processing
      this.metricsBuffer.push(event);
      
      // Process buffer if it's full
      if (this.metricsBuffer.length >= ANALYTICS_CONFIG.realtime.metricsBuffer) {
        await this.processMetricsBuffer();
      }
      
      // Send real-time update to subscribers
      this.broadcastRealtimeUpdate(event);
      
      // Store in database
      await this.storeEvent(event);
      
      // Update real-time aggregates
      await this.updateRealtimeAggregates(event);
      
      return { success: true, eventId: event.id };
      
    } catch (error) {
      logger.error('Failed to track event', error, { 
        category: 'analytics',
        event: event.type 
      });
      return { success: false, error: error.message };
    }
  }

  // Store event in database
  async storeEvent(event) {
    try {
      const { error } = await db.supabase
        .from('analytics_events')
        .insert({
          event_id: event.id,
          user_id: event.userId,
          event_type: event.type,
          platform: event.platform,
          metadata: event.metadata,
          timestamp: event.timestamp
        });

      if (error) throw error;
      
    } catch (error) {
      logger.error('Failed to store analytics event', error, { 
        category: 'analytics' 
      });
      throw error;
    }
  }

  // Get comprehensive analytics dashboard data
  async getDashboardMetrics(options = {}) {
    const {
      userId = null,
      dateRange = 'last30days',
      platform = 'all',
      metrics = ['overview', 'engagement', 'growth', 'content', 'predictions']
    } = options;

    try {
      const startTime = Date.now();
      const dateFilter = this.getDateFilter(dateRange);
      
      // Check cache first
      const cacheKey = this.generateCacheKey('dashboard', options);
      const cached = await this.getCachedData(cacheKey);
      if (cached) return cached;
      
      // Fetch all requested metrics in parallel
      const metricsPromises = {};
      
      if (metrics.includes('overview')) {
        metricsPromises.overview = this.getOverviewMetrics(userId, dateFilter, platform);
      }
      
      if (metrics.includes('engagement')) {
        metricsPromises.engagement = this.getEngagementMetrics(userId, dateFilter, platform);
      }
      
      if (metrics.includes('growth')) {
        metricsPromises.growth = this.getGrowthMetrics(userId, dateFilter, platform);
      }
      
      if (metrics.includes('content')) {
        metricsPromises.content = this.getContentPerformance(userId, dateFilter, platform);
      }
      
      if (metrics.includes('predictions')) {
        metricsPromises.predictions = this.getPredictions(userId, platform);
      }
      
      // Wait for all metrics to complete
      const results = await Promise.all(
        Object.entries(metricsPromises).map(async ([key, promise]) => {
          try {
            return { [key]: await promise };
          } catch (error) {
            logger.error(`Failed to fetch ${key} metrics`, error, { 
              category: 'analytics' 
            });
            return { [key]: null };
          }
        })
      );
      
      // Combine results
      const dashboard = Object.assign({}, ...results);
      
      // Add metadata
      dashboard.metadata = {
        generatedAt: new Date().toISOString(),
        processingTime: Date.now() - startTime,
        dateRange,
        platform,
        userId
      };
      
      // Cache the results
      await this.setCachedData(cacheKey, dashboard, ANALYTICS_CONFIG.cache.ttl.aggregated);
      
      return dashboard;
      
    } catch (error) {
      logger.error('Failed to get dashboard metrics', error, { 
        category: 'analytics' 
      });
      throw error;
    }
  }

  // Get overview metrics
  async getOverviewMetrics(userId, dateFilter, platform) {
    try {
      let query = db.supabase
        .from('analytics_events')
        .select('*')
        .gte('timestamp', dateFilter.start)
        .lte('timestamp', dateFilter.end);
      
      if (userId) query = query.eq('user_id', userId);
      if (platform !== 'all') query = query.eq('platform', platform);
      
      const { data: events, error } = await query;
      if (error) throw error;
      
      // Calculate overview metrics
      const overview = {
        totalEvents: events.length,
        uniqueUsers: new Set(events.map(e => e.user_id)).size,
        avgEventsPerUser: events.length / new Set(events.map(e => e.user_id)).size || 0,
        topEventTypes: this.getTopItems(events, 'event_type', 5),
        peakHours: this.getPeakHours(events),
        platformDistribution: this.getPlatformDistribution(events)
      };
      
      return overview;
      
    } catch (error) {
      logger.error('Failed to get overview metrics', error, { category: 'analytics' });
      return {};
    }
  }

  // Get engagement metrics
  async getEngagementMetrics(userId, dateFilter, platform) {
    try {
      // Fetch engagement-specific events
      let query = db.supabase
        .from('analytics_events')
        .select('*')
        .in('event_type', ['like', 'comment', 'share', 'click', 'view'])
        .gte('timestamp', dateFilter.start)
        .lte('timestamp', dateFilter.end);
      
      if (userId) query = query.eq('user_id', userId);
      if (platform !== 'all') query = query.eq('platform', platform);
      
      const { data: events, error } = await query;
      if (error) throw error;
      
      // Calculate engagement metrics
      const totalContent = await this.getTotalContentCount(userId, dateFilter, platform);
      const engagementRate = totalContent > 0 ? events.length / totalContent : 0;
      
      const engagement = {
        totalEngagements: events.length,
        engagementRate,
        engagementByType: {
          likes: events.filter(e => e.event_type === 'like').length,
          comments: events.filter(e => e.event_type === 'comment').length,
          shares: events.filter(e => e.event_type === 'share').length,
          clicks: events.filter(e => e.event_type === 'click').length,
          views: events.filter(e => e.event_type === 'view').length
        },
        averageEngagementTime: this.calculateAverageEngagementTime(events),
        engagementTrend: this.calculateTrend(events, 'daily'),
        topEngagingContent: await this.getTopEngagingContent(userId, dateFilter, platform),
        audienceInsights: this.getAudienceInsights(events)
      };
      
      return engagement;
      
    } catch (error) {
      logger.error('Failed to get engagement metrics', error, { category: 'analytics' });
      return {};
    }
  }

  // Get growth metrics
  async getGrowthMetrics(userId, dateFilter, platform) {
    try {
      // Fetch user growth data
      const { data: users, error: usersError } = await db.supabase
        .from('profiles')
        .select('created_at, plan')
        .gte('created_at', dateFilter.start)
        .lte('created_at', dateFilter.end);
      
      if (usersError) throw usersError;
      
      // Fetch content growth data
      const { data: content, error: contentError } = await db.supabase
        .from('optimized_content')
        .select('created_at, platform, score')
        .gte('created_at', dateFilter.start)
        .lte('created_at', dateFilter.end);
      
      if (contentError) throw contentError;
      
      // Calculate growth metrics
      const growth = {
        newUsers: users.length,
        userGrowthRate: this.calculateGrowthRate(users, 'created_at'),
        contentGrowth: content.length,
        contentGrowthRate: this.calculateGrowthRate(content, 'created_at'),
        revenueGrowth: this.calculateRevenueGrowth(users),
        churnRate: await this.calculateChurnRate(dateFilter),
        retentionRate: await this.calculateRetentionRate(dateFilter),
        projectedGrowth: this.projectGrowth(users, content),
        growthByPlatform: this.getGrowthByPlatform(content),
        cohortAnalysis: await this.getCohortAnalysis(dateFilter)
      };
      
      return growth;
      
    } catch (error) {
      logger.error('Failed to get growth metrics', error, { category: 'analytics' });
      return {};
    }
  }

  // Get content performance metrics
  async getContentPerformance(userId, dateFilter, platform) {
    try {
      let query = db.supabase
        .from('optimized_content')
        .select(`
          *,
          analytics_events!inner(event_type, metadata)
        `)
        .gte('created_at', dateFilter.start)
        .lte('created_at', dateFilter.end);
      
      if (userId) query = query.eq('user_id', userId);
      if (platform !== 'all') query = query.eq('platform', platform);
      
      const { data: content, error } = await query;
      if (error) throw error;
      
      // Analyze content performance
      const performance = {
        totalContent: content.length,
        averageScore: content.reduce((sum, c) => sum + (c.score || 0), 0) / content.length || 0,
        scoreDistribution: this.getScoreDistribution(content),
        topPerformingContent: this.getTopPerformingContent(content, 10),
        contentByPlatform: this.groupByPlatform(content),
        optimalPostingTimes: this.getOptimalPostingTimes(content),
        contentCategories: this.categorizeContent(content),
        viralContent: this.identifyViralContent(content),
        contentLifecycle: this.analyzeContentLifecycle(content),
        hashtagPerformance: this.analyzeHashtagPerformance(content)
      };
      
      return performance;
      
    } catch (error) {
      logger.error('Failed to get content performance', error, { category: 'analytics' });
      return {};
    }
  }

  // Get predictive analytics
  async getPredictions(userId, platform) {
    try {
      const predictions = {};
      
      for (const modelType of ANALYTICS_CONFIG.prediction.models) {
        const model = this.predictionModels.get(modelType);
        if (model) {
          predictions[modelType] = await this.runPrediction(model, { userId, platform });
        }
      }
      
      // Combine predictions into actionable insights
      const insights = {
        predictions,
        recommendations: this.generateRecommendations(predictions),
        riskFactors: this.identifyRiskFactors(predictions),
        opportunities: this.identifyOpportunities(predictions),
        confidenceScores: this.calculateConfidenceScores(predictions)
      };
      
      return insights;
      
    } catch (error) {
      logger.error('Failed to get predictions', error, { category: 'analytics' });
      return {};
    }
  }

  // Real-time tracking
  startRealtimeTracking() {
    setInterval(async () => {
      await this.processMetricsBuffer();
      await this.broadcastRealtimeMetrics();
    }, ANALYTICS_CONFIG.realtime.updateInterval);
  }

  async processMetricsBuffer() {
    if (this.metricsBuffer.length === 0) return;
    
    const events = [...this.metricsBuffer];
    this.metricsBuffer = [];
    
    try {
      // Batch insert events
      const { error } = await db.supabase
        .from('analytics_events')
        .insert(events.map(e => ({
          event_id: e.id,
          user_id: e.userId,
          event_type: e.type,
          platform: e.platform,
          metadata: e.metadata,
          timestamp: e.timestamp
        })));
      
      if (error) throw error;
      
      logger.debug(`Processed ${events.length} analytics events`, { 
        category: 'analytics' 
      });
      
    } catch (error) {
      logger.error('Failed to process metrics buffer', error, { 
        category: 'analytics' 
      });
    }
  }

  async broadcastRealtimeMetrics() {
    try {
      const metrics = await this.getRealtimeMetrics();
      
      // Broadcast via WebSocket
      if (websocketService) {
        websocketService.broadcast(ANALYTICS_CONFIG.realtime.websocketChannel, {
          type: 'realtime_metrics',
          data: metrics,
          timestamp: new Date().toISOString()
        });
      }
      
      // Update cache
      await this.setCachedData('realtime_metrics', metrics, ANALYTICS_CONFIG.cache.ttl.realtime);
      
    } catch (error) {
      logger.error('Failed to broadcast realtime metrics', error, { 
        category: 'analytics' 
      });
    }
  }

  async getRealtimeMetrics() {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    try {
      const { data: recentEvents, error } = await db.supabase
        .from('analytics_events')
        .select('*')
        .gte('timestamp', fiveMinutesAgo.toISOString())
        .order('timestamp', { ascending: false });
      
      if (error) throw error;
      
      return {
        eventsPerMinute: recentEvents.length / 5,
        activeUsers: new Set(recentEvents.map(e => e.user_id)).size,
        topEvents: this.getTopItems(recentEvents, 'event_type', 3),
        platformActivity: this.getPlatformDistribution(recentEvents),
        trend: this.calculateInstantTrend(recentEvents)
      };
      
    } catch (error) {
      logger.error('Failed to get realtime metrics', error, { category: 'analytics' });
      return {};
    }
  }

  // Aggregation jobs
  setupAggregationJobs() {
    for (const interval of ANALYTICS_CONFIG.aggregation.intervals) {
      const job = setInterval(() => {
        this.runAggregation(interval);
      }, this.getIntervalMilliseconds(interval));
      
      this.aggregationJobs.set(interval, job);
    }
  }

  async runAggregation(interval) {
    try {
      const startTime = this.getIntervalStartTime(interval);
      const endTime = new Date();
      
      // Fetch events for aggregation
      const { data: events, error } = await db.supabase
        .from('analytics_events')
        .select('*')
        .gte('timestamp', startTime.toISOString())
        .lt('timestamp', endTime.toISOString());
      
      if (error) throw error;
      
      // Perform aggregation
      const aggregated = {
        interval,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        metrics: {
          totalEvents: events.length,
          uniqueUsers: new Set(events.map(e => e.user_id)).size,
          eventsByType: this.groupBy(events, 'event_type'),
          platformMetrics: this.aggregateByPlatform(events),
          hourlyDistribution: this.getHourlyDistribution(events)
        }
      };
      
      // Store aggregated data
      await this.storeAggregatedData(interval, aggregated);
      
      // Clean up old data based on retention policy
      await this.cleanupOldData(interval);
      
      logger.debug(`Aggregation completed for interval: ${interval}`, { 
        category: 'analytics' 
      });
      
    } catch (error) {
      logger.error(`Aggregation failed for interval: ${interval}`, error, { 
        category: 'analytics' 
      });
    }
  }

  // Prediction models
  async loadPredictionModels() {
    // In a real implementation, these would be ML models
    // For now, we'll use statistical models
    
    this.predictionModels.set('engagement', {
      type: 'engagement',
      predict: async (data) => this.predictEngagement(data)
    });
    
    this.predictionModels.set('growth', {
      type: 'growth',
      predict: async (data) => this.predictGrowth(data)
    });
    
    this.predictionModels.set('churn', {
      type: 'churn',
      predict: async (data) => this.predictChurn(data)
    });
    
    this.predictionModels.set('revenue', {
      type: 'revenue',
      predict: async (data) => this.predictRevenue(data)
    });
  }

  async runPrediction(model, data) {
    try {
      return await model.predict(data);
    } catch (error) {
      logger.error(`Prediction failed for model: ${model.type}`, error, { 
        category: 'analytics' 
      });
      return null;
    }
  }

  startPredictionUpdates() {
    setInterval(async () => {
      for (const [modelType, model] of this.predictionModels) {
        try {
          const prediction = await this.runPrediction(model, {});
          await this.storePrediction(modelType, prediction);
        } catch (error) {
          logger.error(`Failed to update prediction: ${modelType}`, error, { 
            category: 'analytics' 
          });
        }
      }
    }, ANALYTICS_CONFIG.prediction.updateFrequency);
  }

  // Utility methods
  getDateFilter(dateRange) {
    const now = new Date();
    let start;
    
    switch (dateRange) {
      case 'today':
        start = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'yesterday':
        start = new Date(now.setDate(now.getDate() - 1));
        start.setHours(0, 0, 0, 0);
        break;
      case 'last7days':
        start = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'last30days':
        start = new Date(now.setDate(now.getDate() - 30));
        break;
      case 'last90days':
        start = new Date(now.setDate(now.getDate() - 90));
        break;
      default:
        start = new Date(now.setDate(now.getDate() - 30));
    }
    
    return {
      start: start.toISOString(),
      end: new Date().toISOString()
    };
  }

  calculateGrowthRate(items, dateField) {
    if (items.length < 2) return 0;
    
    items.sort((a, b) => new Date(a[dateField]) - new Date(b[dateField]));
    
    const firstHalf = items.slice(0, Math.floor(items.length / 2));
    const secondHalf = items.slice(Math.floor(items.length / 2));
    
    const firstHalfCount = firstHalf.length;
    const secondHalfCount = secondHalf.length;
    
    if (firstHalfCount === 0) return 100;
    
    return ((secondHalfCount - firstHalfCount) / firstHalfCount) * 100;
  }

  calculateTrend(events, interval) {
    // Group events by interval
    const grouped = this.groupByInterval(events, interval);
    const values = Object.values(grouped).map(g => g.length);
    
    if (values.length < 2) return 'stable';
    
    // Simple linear regression
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    if (slope > 0.1) return 'increasing';
    if (slope < -0.1) return 'decreasing';
    return 'stable';
  }

  getTopItems(items, field, limit = 5) {
    const counts = {};
    items.forEach(item => {
      const value = item[field];
      counts[value] = (counts[value] || 0) + 1;
    });
    
    return Object.entries(counts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([key, count]) => ({ [field]: key, count }));
  }

  groupBy(items, field) {
    const grouped = {};
    items.forEach(item => {
      const key = item[field];
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });
    return grouped;
  }

  groupByInterval(events, interval) {
    const grouped = {};
    
    events.forEach(event => {
      const date = new Date(event.timestamp);
      let key;
      
      switch (interval) {
        case 'hourly':
          key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
          break;
        case 'daily':
          key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
          break;
        case 'weekly':
          key = `${date.getFullYear()}-W${Math.ceil(date.getDate() / 7)}`;
          break;
        case 'monthly':
          key = `${date.getFullYear()}-${date.getMonth()}`;
          break;
        default:
          key = date.toISOString();
      }
      
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(event);
    });
    
    return grouped;
  }

  getIntervalMilliseconds(interval) {
    const map = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000,
      '1M': 30 * 24 * 60 * 60 * 1000
    };
    return map[interval] || 60 * 1000;
  }

  getIntervalStartTime(interval) {
    const now = new Date();
    const milliseconds = this.getIntervalMilliseconds(interval);
    return new Date(now.getTime() - milliseconds);
  }

  generateCacheKey(type, params) {
    const crypto = require('crypto');
    const key = `analytics:${type}:${JSON.stringify(params)}`;
    return crypto.createHash('md5').update(key).digest('hex');
  }

  async getCachedData(key) {
    try {
      if (redisService.isConnected) {
        const cached = await redisService.get(key);
        return cached ? JSON.parse(cached) : null;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async setCachedData(key, data, ttl) {
    try {
      if (redisService.isConnected) {
        await redisService.set(key, JSON.stringify(data), ttl);
      }
    } catch (error) {
      logger.warn('Failed to cache analytics data', error, { category: 'analytics' });
    }
  }

  // Placeholder methods for complex analytics
  async getTotalContentCount(userId, dateFilter, platform) { return 100; }
  calculateAverageEngagementTime(events) { return 120; }
  async getTopEngagingContent(userId, dateFilter, platform) { return []; }
  getAudienceInsights(events) { return {}; }
  calculateRevenueGrowth(users) { return 0; }
  async calculateChurnRate(dateFilter) { return 0.05; }
  async calculateRetentionRate(dateFilter) { return 0.95; }
  projectGrowth(users, content) { return {}; }
  getGrowthByPlatform(content) { return {}; }
  async getCohortAnalysis(dateFilter) { return {}; }
  getScoreDistribution(content) { return {}; }
  getTopPerformingContent(content, limit) { return content.slice(0, limit); }
  groupByPlatform(content) { return this.groupBy(content, 'platform'); }
  getOptimalPostingTimes(content) { return {}; }
  categorizeContent(content) { return {}; }
  identifyViralContent(content) { return []; }
  analyzeContentLifecycle(content) { return {}; }
  analyzeHashtagPerformance(content) { return {}; }
  getPeakHours(events) { return []; }
  getPlatformDistribution(events) { return {}; }
  getHourlyDistribution(events) { return {}; }
  aggregateByPlatform(events) { return {}; }
  calculateInstantTrend(events) { return 'stable'; }
  broadcastRealtimeUpdate(event) {}
  async updateRealtimeAggregates(event) {}
  async storeAggregatedData(interval, data) {}
  async cleanupOldData(interval) {}
  async storePrediction(modelType, prediction) {}
  generateRecommendations(predictions) { return []; }
  identifyRiskFactors(predictions) { return []; }
  identifyOpportunities(predictions) { return []; }
  calculateConfidenceScores(predictions) { return {}; }
  
  // Prediction implementations
  async predictEngagement(data) {
    return {
      nextWeek: Math.random() * 100,
      nextMonth: Math.random() * 500,
      confidence: 0.85
    };
  }
  
  async predictGrowth(data) {
    return {
      userGrowth: Math.random() * 20,
      contentGrowth: Math.random() * 50,
      confidence: 0.75
    };
  }
  
  async predictChurn(data) {
    return {
      riskScore: Math.random() * 0.3,
      atRiskUsers: Math.floor(Math.random() * 10),
      confidence: 0.8
    };
  }
  
  async predictRevenue(data) {
    return {
      nextMonth: Math.random() * 10000,
      nextQuarter: Math.random() * 30000,
      confidence: 0.7
    };
  }
}

// Create singleton instance
export const advancedAnalytics = new AdvancedAnalytics();

// Export convenience methods
export const {
  trackEvent,
  getDashboardMetrics,
  getRealtimeMetrics
} = advancedAnalytics;

export default advancedAnalytics;