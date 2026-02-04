/**
 * Metrics API Endpoint
 * Provides real-time system and user metrics for monitoring dashboard
 */

import { db } from '../src/lib/supabase.js';
import { authService } from '../src/lib/auth.js';

// Cache for metrics to reduce database load
const metricsCache = new Map();
const CACHE_DURATION = 60000; // 1 minute

// System metrics collection
let systemMetrics = {
  startTime: Date.now(),
  requestCount: 0,
  errorCount: 0,
  activeUsers: new Set(),
  apiCalls: {
    optimize: 0,
    ai: 0,
    auth: 0
  },
  platformUsage: {
    instagram: 0,
    facebook: 0,
    twitter: 0,
    linkedin: 0,
    tiktok: 0,
    pinterest: 0,
    youtube: 0,
    reddit: 0
  },
  performanceMetrics: {
    avgResponseTime: 0,
    maxResponseTime: 0,
    responseTimes: []
  }
};

// Middleware to track metrics
export function trackMetrics(req, res, next) {
  const startTime = Date.now();
  systemMetrics.requestCount++;
  
  // Track user activity
  const userId = authService.getUserIdFromRequest(req);
  if (userId) {
    systemMetrics.activeUsers.add(userId);
  }
  
  // Track API endpoint usage
  const path = req.url.split('?')[0];
  if (path.includes('/optimize')) systemMetrics.apiCalls.optimize++;
  if (path.includes('/ai')) systemMetrics.apiCalls.ai++;
  if (path.includes('/auth')) systemMetrics.apiCalls.auth++;
  
  // Override res.end to track response time
  const originalEnd = res.end;
  res.end = function(...args) {
    const responseTime = Date.now() - startTime;
    
    // Update performance metrics
    systemMetrics.performanceMetrics.responseTimes.push(responseTime);
    if (systemMetrics.performanceMetrics.responseTimes.length > 100) {
      systemMetrics.performanceMetrics.responseTimes.shift();
    }
    
    const avgTime = systemMetrics.performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) / 
                   systemMetrics.performanceMetrics.responseTimes.length;
    systemMetrics.performanceMetrics.avgResponseTime = Math.round(avgTime);
    systemMetrics.performanceMetrics.maxResponseTime = Math.max(
      systemMetrics.performanceMetrics.maxResponseTime, 
      responseTime
    );
    
    // Track errors
    if (res.statusCode >= 400) {
      systemMetrics.errorCount++;
    }
    
    originalEnd.apply(res, args);
  };
  
  if (next) next();
}

// Main metrics handler
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type = 'all', timeframe = '24h' } = req.query;
    
    // Check cache first
    const cacheKey = `${type}-${timeframe}`;
    const cachedData = metricsCache.get(cacheKey);
    
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
      return res.json(cachedData.data);
    }

    let metrics = {};

    switch (type) {
      case 'system':
        metrics = await getSystemMetrics();
        break;
      case 'users':
        metrics = await getUserMetrics(timeframe);
        break;
      case 'content':
        metrics = await getContentMetrics(timeframe);
        break;
      case 'performance':
        metrics = await getPerformanceMetrics(timeframe);
        break;
      case 'all':
      default:
        metrics = await getAllMetrics(timeframe);
        break;
    }

    // Cache the result
    metricsCache.set(cacheKey, {
      data: metrics,
      timestamp: Date.now()
    });

    res.json(metrics);

  } catch (error) {
    console.error('Metrics API error:', error);
    res.status(500).json({
      error: 'Failed to fetch metrics',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

// Get system metrics
async function getSystemMetrics() {
  const uptime = Date.now() - systemMetrics.startTime;
  const errorRate = systemMetrics.requestCount > 0 ? 
    (systemMetrics.errorCount / systemMetrics.requestCount) * 100 : 0;

  return {
    system: {
      uptime: Math.round(uptime / 1000), // seconds
      uptimeFormatted: formatUptime(uptime),
      requestCount: systemMetrics.requestCount,
      errorCount: systemMetrics.errorCount,
      errorRate: Math.round(errorRate * 100) / 100,
      activeUsers: systemMetrics.activeUsers.size,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development'
    },
    apis: systemMetrics.apiCalls,
    platforms: systemMetrics.platformUsage,
    performance: {
      ...systemMetrics.performanceMetrics,
      uptime: Math.round(uptime / 1000)
    }
  };
}

// Get user metrics from database
async function getUserMetrics(timeframe) {
  try {
    const timeFilter = getTimeFilter(timeframe);
    
    // Get user statistics
    const [
      totalUsers,
      activeUsers,
      newUsers,
      userGrowth
    ] = await Promise.all([
      getTotalUsers(),
      getActiveUsers(timeFilter),
      getNewUsers(timeFilter),
      getUserGrowth(timeframe)
    ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        new: newUsers,
        growth: userGrowth,
        retention: await getUserRetention(timeframe)
      }
    };
  } catch (error) {
    console.error('User metrics error:', error);
    return { users: { total: 0, active: 0, new: 0, growth: 0, retention: 0 } };
  }
}

// Get content metrics from database
async function getContentMetrics(timeframe) {
  try {
    const timeFilter = getTimeFilter(timeframe);
    
    const [
      totalContent,
      contentByPlatform,
      topPerformingContent,
      averageScore
    ] = await Promise.all([
      getTotalContent(timeFilter),
      getContentByPlatform(timeFilter),
      getTopPerformingContent(timeFilter),
      getAverageOptimizationScore(timeFilter)
    ]);

    return {
      content: {
        total: totalContent,
        byPlatform: contentByPlatform,
        topPerforming: topPerformingContent,
        averageScore: Math.round(averageScore * 10) / 10
      }
    };
  } catch (error) {
    console.error('Content metrics error:', error);
    return { content: { total: 0, byPlatform: {}, topPerforming: [], averageScore: 0 } };
  }
}

// Get performance metrics
async function getPerformanceMetrics(timeframe) {
  const timeFilter = getTimeFilter(timeframe);
  
  try {
    const [
      apiLatency,
      errorRates,
      throughput
    ] = await Promise.all([
      getAPILatency(timeFilter),
      getErrorRates(timeFilter),
      getThroughput(timeFilter)
    ]);

    return {
      performance: {
        ...systemMetrics.performanceMetrics,
        apiLatency,
        errorRates,
        throughput,
        timestamp: Date.now()
      }
    };
  } catch (error) {
    console.error('Performance metrics error:', error);
    return { performance: systemMetrics.performanceMetrics };
  }
}

// Get all metrics combined
async function getAllMetrics(timeframe) {
  const [system, users, content, performance] = await Promise.all([
    getSystemMetrics(),
    getUserMetrics(timeframe),
    getContentMetrics(timeframe),
    getPerformanceMetrics(timeframe)
  ]);

  return {
    ...system,
    ...users,
    ...content,
    ...performance,
    timestamp: Date.now(),
    timeframe
  };
}

// Database query helpers
async function getTotalUsers() {
  try {
    const { count, error } = await db.supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    
    return error ? 0 : count;
  } catch (error) {
    return 0;
  }
}

async function getActiveUsers(timeFilter) {
  try {
    const { count, error } = await db.supabase
      .from('analytics')
      .select('user_id', { count: 'exact', head: true })
      .gte('timestamp', timeFilter);
    
    return error ? systemMetrics.activeUsers.size : count;
  } catch (error) {
    return systemMetrics.activeUsers.size;
  }
}

async function getNewUsers(timeFilter) {
  try {
    const { count, error } = await db.supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', timeFilter);
    
    return error ? 0 : count;
  } catch (error) {
    return 0;
  }
}

async function getUserGrowth(timeframe) {
  try {
    const now = new Date();
    const current = getTimeFilter(timeframe);
    const previous = new Date(current.getTime() - (now.getTime() - current.getTime()));
    
    const [currentUsers, previousUsers] = await Promise.all([
      getNewUsers(current),
      getNewUsers(previous)
    ]);
    
    if (previousUsers === 0) return 100;
    return Math.round(((currentUsers - previousUsers) / previousUsers) * 100);
  } catch (error) {
    return 0;
  }
}

async function getUserRetention(timeframe) {
  // Simplified retention calculation
  try {
    const activeUsers = await getActiveUsers(getTimeFilter(timeframe));
    const totalUsers = await getTotalUsers();
    
    return totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0;
  } catch (error) {
    return 0;
  }
}

async function getTotalContent(timeFilter) {
  try {
    const { count, error } = await db.supabase
      .from('optimized_content')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', timeFilter);
    
    return error ? 0 : count;
  } catch (error) {
    return 0;
  }
}

async function getContentByPlatform(timeFilter) {
  try {
    const { data, error } = await db.supabase
      .from('optimized_content')
      .select('platform')
      .gte('created_at', timeFilter);
    
    if (error) return {};
    
    const platformCounts = {};
    data.forEach(item => {
      platformCounts[item.platform] = (platformCounts[item.platform] || 0) + 1;
    });
    
    return platformCounts;
  } catch (error) {
    return {};
  }
}

async function getTopPerformingContent(timeFilter) {
  try {
    const { data, error } = await db.supabase
      .from('optimized_content')
      .select('platform, score, optimized_content')
      .gte('created_at', timeFilter)
      .order('score', { ascending: false })
      .limit(5);
    
    return error ? [] : data;
  } catch (error) {
    return [];
  }
}

async function getAverageOptimizationScore(timeFilter) {
  try {
    const { data, error } = await db.supabase
      .from('optimized_content')
      .select('score')
      .gte('created_at', timeFilter);
    
    if (error || !data.length) return 0;
    
    const total = data.reduce((sum, item) => sum + (item.score || 0), 0);
    return total / data.length;
  } catch (error) {
    return 0;
  }
}

async function getAPILatency(timeFilter) {
  // Return current performance metrics since we don't store historical API latency
  return {
    average: systemMetrics.performanceMetrics.avgResponseTime,
    max: systemMetrics.performanceMetrics.maxResponseTime,
    current: systemMetrics.performanceMetrics.responseTimes.slice(-1)[0] || 0
  };
}

async function getErrorRates(timeFilter) {
  const total = systemMetrics.requestCount;
  const errors = systemMetrics.errorCount;
  
  return {
    total: errors,
    rate: total > 0 ? Math.round((errors / total) * 10000) / 100 : 0,
    by4xx: Math.round(errors * 0.7), // Approximate
    by5xx: Math.round(errors * 0.3)  // Approximate
  };
}

async function getThroughput(timeFilter) {
  const uptime = (Date.now() - systemMetrics.startTime) / 1000; // seconds
  
  return {
    requestsPerSecond: uptime > 0 ? Math.round((systemMetrics.requestCount / uptime) * 100) / 100 : 0,
    requestsPerMinute: uptime > 0 ? Math.round((systemMetrics.requestCount / uptime) * 60 * 100) / 100 : 0,
    totalRequests: systemMetrics.requestCount
  };
}

// Utility functions
function getTimeFilter(timeframe) {
  const now = new Date();
  
  switch (timeframe) {
    case '1h':
      return new Date(now.getTime() - 60 * 60 * 1000);
    case '6h':
      return new Date(now.getTime() - 6 * 60 * 60 * 1000);
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
}

function formatUptime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// Track platform usage
export function trackPlatformUsage(platform) {
  if (systemMetrics.platformUsage[platform] !== undefined) {
    systemMetrics.platformUsage[platform]++;
  }
}

// Clean up old metrics periodically
setInterval(() => {
  // Clear old cache entries
  for (const [key, value] of metricsCache.entries()) {
    if (Date.now() - value.timestamp > CACHE_DURATION * 2) {
      metricsCache.delete(key);
    }
  }
  
  // Reset active users set every hour
  systemMetrics.activeUsers.clear();
}, 60 * 60 * 1000);