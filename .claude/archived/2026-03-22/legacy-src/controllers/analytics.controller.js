/**
 * Analytics Controller
 * Handles analytics data processing and metrics
 */

const analyticsService = require('../services/analytics.service');
const cache = require('../services/cache.service');

class AnalyticsController {
  /**
   * Get real-time metrics
   */
  async getRealTimeMetrics(req, res) {
    try {
      const { userId } = req.user;
      
      // Check cache first
      const cacheKey = `realtime:metrics:${userId}`;
      const cached = await cache.get(cacheKey);
      
      if (cached) {
        return res.json({
          success: true,
          data: cached,
          source: 'cache'
        });
      }
      
      // Get real-time data
      const metrics = await analyticsService.getRealTimeMetrics(userId);
      
      // Cache for 30 seconds
      await cache.set(cacheKey, metrics, 30);
      
      res.json({
        success: true,
        data: metrics,
        source: 'live'
      });
    } catch (error) {
      console.error('Error fetching real-time metrics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch real-time metrics'
      });
    }
  }

  /**
   * Get historical metrics
   */
  async getHistoricalMetrics(req, res) {
    try {
      const { userId } = req.user;
      const { startDate, endDate, metrics, interval = 'day' } = req.query;
      
      const data = await analyticsService.getHistoricalMetrics({
        userId,
        startDate,
        endDate,
        metrics,
        interval
      });
      
      res.json({
        success: true,
        data,
        period: { startDate, endDate },
        interval
      });
    } catch (error) {
      console.error('Error fetching historical metrics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch historical metrics'
      });
    }
  }

  /**
   * Get platform-specific analytics
   */
  async getPlatformMetrics(req, res) {
    try {
      const { userId } = req.user;
      const { platform } = req.params;
      const { period = 'week' } = req.query;
      
      const metrics = await analyticsService.getPlatformMetrics({
        userId,
        platform,
        period
      });
      
      res.json({
        success: true,
        data: metrics,
        platform,
        period
      });
    } catch (error) {
      console.error('Error fetching platform metrics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch platform metrics'
      });
    }
  }

  /**
   * Get engagement analytics
   */
  async getEngagementAnalytics(req, res) {
    try {
      const { userId } = req.user;
      const { contentId, period = 'week' } = req.query;
      
      const analytics = await analyticsService.getEngagementAnalytics({
        userId,
        contentId,
        period
      });
      
      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Error fetching engagement analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch engagement analytics'
      });
    }
  }

  /**
   * Get audience insights
   */
  async getAudienceInsights(req, res) {
    try {
      const { userId } = req.user;
      
      const insights = await analyticsService.getAudienceInsights(userId);
      
      res.json({
        success: true,
        data: insights
      });
    } catch (error) {
      console.error('Error fetching audience insights:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch audience insights'
      });
    }
  }

  /**
   * Track custom event
   */
  async trackEvent(req, res) {
    try {
      const { userId } = req.user;
      const { eventType, eventData, platform } = req.body;
      
      const event = await analyticsService.trackEvent({
        userId,
        eventType,
        eventData,
        platform
      });
      
      res.status(201).json({
        success: true,
        data: event,
        message: 'Event tracked successfully'
      });
    } catch (error) {
      console.error('Error tracking event:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to track event'
      });
    }
  }

  /**
   * Generate analytics report
   */
  async generateReport(req, res) {
    try {
      const { userId } = req.user;
      const { 
        reportType,
        startDate,
        endDate,
        format = 'json',
        includeCharts = false
      } = req.body;
      
      const report = await analyticsService.generateReport({
        userId,
        reportType,
        startDate,
        endDate,
        format,
        includeCharts
      });
      
      // Set appropriate headers based on format
      if (format === 'pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=analytics-report-${Date.now()}.pdf`);
        res.send(report);
      } else if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=analytics-report-${Date.now()}.csv`);
        res.send(report);
      } else {
        res.json({
          success: true,
          data: report
        });
      }
    } catch (error) {
      console.error('Error generating report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate report'
      });
    }
  }

  /**
   * Export analytics data
   */
  async exportData(req, res) {
    try {
      const { userId } = req.user;
      const { format = 'json', dateRange } = req.query;
      
      const exportData = await analyticsService.exportData({
        userId,
        format,
        dateRange
      });
      
      res.json({
        success: true,
        data: exportData,
        message: 'Data exported successfully'
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export data'
      });
    }
  }
}

module.exports = new AnalyticsController();