/**
 * Database Query Optimizer
 * Advanced query optimization, indexing strategies, and performance monitoring
 */

import { db } from '../../src/lib/supabase.js';
import { logger } from '../../src/lib/logger.js';
import { redisService } from '../../src/lib/redis.js';

// Query optimization configuration
const OPTIMIZATION_CONFIG = {
  // Query caching
  cache: {
    enabled: process.env.QUERY_CACHE_ENABLED !== 'false',
    ttl: {
      short: 300,      // 5 minutes for frequently changing data
      medium: 1800,    // 30 minutes for moderate data
      long: 3600,      // 1 hour for stable data
      static: 86400    // 24 hours for static data
    },
    keyPrefix: 'query_cache:',
    maxSize: 1000 // Maximum cached queries
  },

  // Query monitoring
  monitoring: {
    enabled: true,
    slowQueryThreshold: 1000, // ms
    logSlowQueries: true,
    alertOnSlowQueries: true,
    trackQueryPatterns: true
  },

  // Query batching
  batching: {
    enabled: true,
    batchSize: 100,
    timeout: 50 // ms to wait before executing batch
  },

  // Connection pooling
  pool: {
    min: 2,
    max: 20,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200
  }
};

// Database indexes configuration
const INDEX_DEFINITIONS = {
  // User-related indexes
  profiles: [
    { columns: ['email'], unique: true, name: 'idx_profiles_email' },
    { columns: ['created_at'], name: 'idx_profiles_created_at' },
    { columns: ['plan'], name: 'idx_profiles_plan' },
    { columns: ['last_login_at'], name: 'idx_profiles_last_login' }
  ],

  // Content optimization indexes
  optimized_content: [
    { columns: ['user_id'], name: 'idx_content_user_id' },
    { columns: ['platform'], name: 'idx_content_platform' },
    { columns: ['created_at'], name: 'idx_content_created_at' },
    { columns: ['score'], name: 'idx_content_score' },
    { columns: ['user_id', 'platform'], name: 'idx_content_user_platform' },
    { columns: ['user_id', 'created_at'], name: 'idx_content_user_date' },
    { columns: ['platform', 'score'], name: 'idx_content_platform_score' }
  ],

  // Analytics indexes
  analytics: [
    { columns: ['user_id'], name: 'idx_analytics_user_id' },
    { columns: ['platform'], name: 'idx_analytics_platform' },
    { columns: ['timestamp'], name: 'idx_analytics_timestamp' },
    { columns: ['user_id', 'timestamp'], name: 'idx_analytics_user_time' },
    { columns: ['platform', 'timestamp'], name: 'idx_analytics_platform_time' }
  ],

  // Campaign indexes
  campaigns: [
    { columns: ['user_id'], name: 'idx_campaigns_user_id' },
    { columns: ['status'], name: 'idx_campaigns_status' },
    { columns: ['created_at'], name: 'idx_campaigns_created_at' },
    { columns: ['scheduled_at'], name: 'idx_campaigns_scheduled_at' },
    { columns: ['user_id', 'status'], name: 'idx_campaigns_user_status' }
  ],

  // Session indexes
  user_sessions: [
    { columns: ['user_id'], name: 'idx_sessions_user_id' },
    { columns: ['expires_at'], name: 'idx_sessions_expires_at' },
    { columns: ['created_at'], name: 'idx_sessions_created_at' }
  ],

  // Feature usage tracking
  feature_usage: [
    { columns: ['user_id'], name: 'idx_feature_usage_user_id' },
    { columns: ['feature_name'], name: 'idx_feature_usage_feature' },
    { columns: ['timestamp'], name: 'idx_feature_usage_timestamp' },
    { columns: ['user_id', 'feature_name'], name: 'idx_feature_usage_user_feature' }
  ],

  // API usage tracking
  api_usage: [
    { columns: ['user_id'], name: 'idx_api_usage_user_id' },
    { columns: ['endpoint'], name: 'idx_api_usage_endpoint' },
    { columns: ['timestamp'], name: 'idx_api_usage_timestamp' },
    { columns: ['user_id', 'timestamp'], name: 'idx_api_usage_user_time' }
  ],

  // Notifications
  notifications: [
    { columns: ['user_id'], name: 'idx_notifications_user_id' },
    { columns: ['read'], name: 'idx_notifications_read' },
    { columns: ['created_at'], name: 'idx_notifications_created_at' },
    { columns: ['user_id', 'read'], name: 'idx_notifications_user_read' }
  ]
};

class DatabaseOptimizer {
  constructor() {
    this.queryCache = new Map();
    this.queryStats = new Map();
    this.batchQueue = new Map();
    this.connectionPool = null;
    this.init();
  }

  async init() {
    logger.info('Initializing database optimizer', { category: 'database' });
    
    // Start query monitoring
    this.startQueryMonitoring();
    
    // Setup batch processing
    this.setupBatchProcessing();
    
    // Initialize query cache cleanup
    this.startCacheCleanup();
    
    logger.info('Database optimizer initialized', { category: 'database' });
  }

  // Create optimized indexes
  async createOptimizedIndexes() {
    logger.info('Creating database indexes for optimal performance', { category: 'database' });
    
    const results = {
      created: 0,
      exists: 0,
      failed: 0,
      errors: []
    };

    for (const [tableName, indexes] of Object.entries(INDEX_DEFINITIONS)) {
      logger.info(`Creating indexes for table: ${tableName}`, { category: 'database' });
      
      for (const index of indexes) {
        try {
          const indexName = index.name;
          const columns = index.columns.join(', ');
          const unique = index.unique ? 'UNIQUE' : '';
          
          // Check if index already exists
          const existsQuery = `
            SELECT COUNT(*) as count 
            FROM pg_indexes 
            WHERE indexname = '${indexName}'
          `;
          
          const { data: existsResult } = await db.supabase.rpc('execute_sql', { 
            sql: existsQuery 
          });
          
          if (existsResult && existsResult[0]?.count > 0) {
            logger.debug(`Index already exists: ${indexName}`, { category: 'database' });
            results.exists++;
            continue;
          }
          
          // Create index
          const createIndexSQL = `
            CREATE ${unique} INDEX CONCURRENTLY IF NOT EXISTS ${indexName} 
            ON ${tableName} (${columns})
          `;
          
          await db.supabase.rpc('execute_sql', { sql: createIndexSQL });
          
          logger.info(`Created index: ${indexName} on ${tableName}(${columns})`, { 
            category: 'database' 
          });
          results.created++;
          
        } catch (error) {
          logger.error(`Failed to create index: ${index.name}`, error, { 
            category: 'database',
            table: tableName,
            index: index.name
          });
          results.failed++;
          results.errors.push(`${index.name}: ${error.message}`);
        }
      }
    }
    
    logger.info('Index creation completed', { 
      category: 'database',
      results 
    });
    
    return results;
  }

  // Analyze table statistics and suggest optimizations
  async analyzeTableStatistics() {
    logger.info('Analyzing table statistics', { category: 'database' });
    
    const analysis = {
      tables: {},
      recommendations: [],
      timestamp: new Date().toISOString()
    };

    const tables = Object.keys(INDEX_DEFINITIONS);
    
    for (const tableName of tables) {
      try {
        // Get table size and row count
        const statsQuery = `
          SELECT 
            schemaname,
            tablename,
            attname,
            n_distinct,
            correlation
          FROM pg_stats 
          WHERE tablename = '${tableName}'
        `;
        
        const sizeQuery = `
          SELECT 
            pg_size_pretty(pg_total_relation_size('${tableName}')) as total_size,
            pg_size_pretty(pg_relation_size('${tableName}')) as table_size,
            (SELECT COUNT(*) FROM ${tableName}) as row_count
        `;
        
        const [statsResult, sizeResult] = await Promise.all([
          db.supabase.rpc('execute_sql', { sql: statsQuery }),
          db.supabase.rpc('execute_sql', { sql: sizeQuery })
        ]);
        
        analysis.tables[tableName] = {
          stats: statsResult.data || [],
          size: sizeResult.data?.[0] || {},
          indexes: await this.getTableIndexes(tableName)
        };
        
        // Generate recommendations
        await this.generateTableRecommendations(tableName, analysis.tables[tableName], analysis.recommendations);
        
      } catch (error) {
        logger.warn(`Failed to analyze table: ${tableName}`, error, { category: 'database' });
      }
    }
    
    logger.info('Table analysis completed', { 
      category: 'database',
      tablesAnalyzed: Object.keys(analysis.tables).length,
      recommendations: analysis.recommendations.length
    });
    
    return analysis;
  }

  // Get existing indexes for a table
  async getTableIndexes(tableName) {
    try {
      const query = `
        SELECT 
          indexname,
          indexdef,
          schemaname
        FROM pg_indexes 
        WHERE tablename = '${tableName}'
        AND schemaname = 'public'
      `;
      
      const { data } = await db.supabase.rpc('execute_sql', { sql: query });
      return data || [];
    } catch (error) {
      logger.warn(`Failed to get indexes for table: ${tableName}`, error, { category: 'database' });
      return [];
    }
  }

  // Generate optimization recommendations
  async generateTableRecommendations(tableName, tableData, recommendations) {
    const rowCount = parseInt(tableData.size.row_count) || 0;
    
    // Large table without proper indexing
    if (rowCount > 10000 && tableData.indexes.length < 2) {
      recommendations.push({
        type: 'indexing',
        priority: 'high',
        table: tableName,
        message: `Table ${tableName} has ${rowCount} rows but only ${tableData.indexes.length} indexes. Consider adding more indexes for frequently queried columns.`
      });
    }
    
    // Check for columns with high cardinality that might need indexes
    for (const stat of tableData.stats) {
      if (stat.n_distinct && stat.n_distinct > 100) {
        const hasIndex = tableData.indexes.some(idx => 
          idx.indexdef.includes(stat.attname)
        );
        
        if (!hasIndex) {
          recommendations.push({
            type: 'indexing',
            priority: 'medium',
            table: tableName,
            column: stat.attname,
            message: `Column ${stat.attname} in ${tableName} has high cardinality (${stat.n_distinct} distinct values) and might benefit from an index.`
          });
        }
      }
    }
  }

  // Optimized query execution with caching
  async executeOptimizedQuery(query, params = [], options = {}) {
    const startTime = Date.now();
    const queryHash = this.generateQueryHash(query, params);
    const cacheKey = `${OPTIMIZATION_CONFIG.cache.keyPrefix}${queryHash}`;
    
    try {
      // Check cache first
      if (OPTIMIZATION_CONFIG.cache.enabled && options.cache !== false) {
        const cachedResult = await this.getCachedQuery(cacheKey);
        if (cachedResult) {
          this.recordQueryStats(query, Date.now() - startTime, true);
          return cachedResult;
        }
      }
      
      // Execute query
      const result = await this.executeQuery(query, params);
      const duration = Date.now() - startTime;
      
      // Cache result if caching is enabled
      if (OPTIMIZATION_CONFIG.cache.enabled && options.cache !== false && result) {
        const ttl = options.cacheTTL || OPTIMIZATION_CONFIG.cache.ttl.medium;
        await this.setCachedQuery(cacheKey, result, ttl);
      }
      
      // Record stats
      this.recordQueryStats(query, duration, false);
      
      // Log slow queries
      if (duration > OPTIMIZATION_CONFIG.monitoring.slowQueryThreshold) {
        logger.warn('Slow query detected', {
          category: 'database',
          query: query.substring(0, 200),
          duration,
          params: params.length
        });
      }
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordQueryStats(query, duration, false, error);
      throw error;
    }
  }

  // Batch query execution
  async executeBatch(queries, options = {}) {
    if (!OPTIMIZATION_CONFIG.batching.enabled) {
      return Promise.all(queries.map(q => this.executeOptimizedQuery(q.query, q.params, q.options)));
    }
    
    const batchId = Date.now().toString();
    const results = [];
    
    // Process queries in batches
    for (let i = 0; i < queries.length; i += OPTIMIZATION_CONFIG.batching.batchSize) {
      const batch = queries.slice(i, i + OPTIMIZATION_CONFIG.batching.batchSize);
      
      const batchPromises = batch.map(async (q, index) => {
        try {
          return await this.executeOptimizedQuery(q.query, q.params, q.options);
        } catch (error) {
          logger.error(`Batch query failed`, error, {
            category: 'database',
            batchId,
            queryIndex: i + index
          });
          return { error: error.message };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches to prevent overwhelming the database
      if (i + OPTIMIZATION_CONFIG.batching.batchSize < queries.length) {
        await new Promise(resolve => setTimeout(resolve, OPTIMIZATION_CONFIG.batching.timeout));
      }
    }
    
    return results;
  }

  // Query execution with proper error handling
  async executeQuery(query, params = []) {
    try {
      // Use parameterized queries for security
      if (params.length > 0) {
        const { data, error } = await db.supabase.rpc('execute_sql', {
          sql: query,
          params: params
        });
        
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await db.supabase.rpc('execute_sql', {
          sql: query
        });
        
        if (error) throw error;
        return data;
      }
    } catch (error) {
      logger.error('Query execution failed', error, {
        category: 'database',
        query: query.substring(0, 200)
      });
      throw error;
    }
  }

  // Cache management
  async getCachedQuery(cacheKey) {
    try {
      if (redisService.isConnected) {
        const cached = await redisService.get(cacheKey);
        return cached ? JSON.parse(cached) : null;
      } else {
        return this.queryCache.get(cacheKey)?.data || null;
      }
    } catch (error) {
      logger.warn('Cache retrieval failed', error, { category: 'database' });
      return null;
    }
  }

  async setCachedQuery(cacheKey, data, ttl) {
    try {
      if (redisService.isConnected) {
        await redisService.set(cacheKey, JSON.stringify(data), ttl);
      } else {
        // Memory cache with expiration
        this.queryCache.set(cacheKey, {
          data,
          expires: Date.now() + (ttl * 1000)
        });
        
        // Prevent memory cache from growing too large
        if (this.queryCache.size > OPTIMIZATION_CONFIG.cache.maxSize) {
          const oldestKey = this.queryCache.keys().next().value;
          this.queryCache.delete(oldestKey);
        }
      }
    } catch (error) {
      logger.warn('Cache storage failed', error, { category: 'database' });
    }
  }

  // Query monitoring and statistics
  recordQueryStats(query, duration, cached, error = null) {
    const queryType = this.getQueryType(query);
    const stats = this.queryStats.get(queryType) || {
      count: 0,
      totalDuration: 0,
      avgDuration: 0,
      maxDuration: 0,
      cachedHits: 0,
      errors: 0,
      lastExecuted: null
    };
    
    stats.count++;
    stats.totalDuration += duration;
    stats.avgDuration = Math.round(stats.totalDuration / stats.count);
    stats.maxDuration = Math.max(stats.maxDuration, duration);
    stats.lastExecuted = new Date().toISOString();
    
    if (cached) stats.cachedHits++;
    if (error) stats.errors++;
    
    this.queryStats.set(queryType, stats);
    
    // Send metrics to monitoring system
    if (redisService.isConnected) {
      redisService.publish('database_metrics', {
        type: 'query_stats',
        queryType,
        duration,
        cached,
        error: !!error,
        timestamp: Date.now()
      });
    }
  }

  getQueryType(query) {
    const normalized = query.trim().toUpperCase();
    if (normalized.startsWith('SELECT')) return 'SELECT';
    if (normalized.startsWith('INSERT')) return 'INSERT';
    if (normalized.startsWith('UPDATE')) return 'UPDATE';
    if (normalized.startsWith('DELETE')) return 'DELETE';
    if (normalized.startsWith('CREATE')) return 'CREATE';
    return 'OTHER';
  }

  generateQueryHash(query, params) {
    const crypto = require('crypto');
    const combined = query + JSON.stringify(params);
    return crypto.createHash('md5').update(combined).digest('hex');
  }

  // Monitoring and maintenance
  startQueryMonitoring() {
    if (!OPTIMIZATION_CONFIG.monitoring.enabled) return;
    
    setInterval(() => {
      this.reportQueryStats();
    }, 60000); // Every minute
  }

  reportQueryStats() {
    const stats = Object.fromEntries(this.queryStats);
    logger.debug('Query statistics', { 
      category: 'database',
      stats,
      cacheSize: this.queryCache.size
    });
    
    // Check for performance issues
    for (const [queryType, stat] of this.queryStats.entries()) {
      if (stat.avgDuration > OPTIMIZATION_CONFIG.monitoring.slowQueryThreshold) {
        logger.warn('Slow query type detected', {
          category: 'database',
          queryType,
          avgDuration: stat.avgDuration,
          count: stat.count
        });
      }
    }
  }

  setupBatchProcessing() {
    if (!OPTIMIZATION_CONFIG.batching.enabled) return;
    
    // Process batch queue every timeout interval
    setInterval(() => {
      this.processBatchQueue();
    }, OPTIMIZATION_CONFIG.batching.timeout);
  }

  async processBatchQueue() {
    // Implementation for processing queued batch operations
    // This would handle deferred operations that can be batched together
  }

  startCacheCleanup() {
    setInterval(() => {
      this.cleanupExpiredCache();
    }, 60000); // Every minute
  }

  cleanupExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.queryCache.entries()) {
      if (value.expires && value.expires < now) {
        this.queryCache.delete(key);
      }
    }
  }

  // Performance analysis and recommendations
  async generatePerformanceReport() {
    const report = {
      timestamp: new Date().toISOString(),
      queryStats: Object.fromEntries(this.queryStats),
      cacheStats: {
        size: this.queryCache.size,
        maxSize: OPTIMIZATION_CONFIG.cache.maxSize,
        hitRate: this.calculateCacheHitRate()
      },
      tableAnalysis: await this.analyzeTableStatistics(),
      recommendations: [],
      healthScore: 0
    };
    
    // Calculate health score
    report.healthScore = this.calculateDatabaseHealthScore(report);
    
    // Generate recommendations
    report.recommendations = this.generatePerformanceRecommendations(report);
    
    return report;
  }

  calculateCacheHitRate() {
    const totalQueries = Array.from(this.queryStats.values()).reduce((sum, stat) => sum + stat.count, 0);
    const cachedQueries = Array.from(this.queryStats.values()).reduce((sum, stat) => sum + stat.cachedHits, 0);
    return totalQueries > 0 ? Math.round((cachedQueries / totalQueries) * 100) : 0;
  }

  calculateDatabaseHealthScore(report) {
    let score = 100;
    
    // Deduct for slow queries
    const avgDuration = Object.values(report.queryStats).reduce((sum, stat) => sum + stat.avgDuration, 0) / Object.keys(report.queryStats).length || 0;
    if (avgDuration > 1000) score -= 30;
    else if (avgDuration > 500) score -= 15;
    
    // Deduct for low cache hit rate
    if (report.cacheStats.hitRate < 50) score -= 20;
    else if (report.cacheStats.hitRate < 70) score -= 10;
    
    // Deduct for errors
    const errorRate = Object.values(report.queryStats).reduce((sum, stat) => sum + stat.errors, 0);
    if (errorRate > 0) score -= Math.min(errorRate * 5, 25);
    
    return Math.max(score, 0);
  }

  generatePerformanceRecommendations(report) {
    const recommendations = [];
    
    // Cache recommendations
    if (report.cacheStats.hitRate < 70) {
      recommendations.push({
        type: 'caching',
        priority: 'medium',
        message: `Cache hit rate is ${report.cacheStats.hitRate}%. Consider increasing cache TTL or caching more queries.`
      });
    }
    
    // Query performance recommendations
    for (const [queryType, stats] of Object.entries(report.queryStats)) {
      if (stats.avgDuration > 1000) {
        recommendations.push({
          type: 'performance',
          priority: 'high',
          message: `${queryType} queries are slow (avg: ${stats.avgDuration}ms). Consider optimizing or adding indexes.`
        });
      }
    }
    
    return recommendations;
  }

  // Health check
  async healthCheck() {
    try {
      const startTime = Date.now();
      
      // Test basic connectivity
      await db.supabase.rpc('execute_sql', { sql: 'SELECT 1 as test' });
      
      const duration = Date.now() - startTime;
      
      return {
        status: 'healthy',
        responseTime: duration,
        cacheEnabled: OPTIMIZATION_CONFIG.cache.enabled,
        cacheSize: this.queryCache.size,
        queryStats: Object.fromEntries(this.queryStats)
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

// Create singleton instance
export const dbOptimizer = new DatabaseOptimizer();

// Export convenience methods
export const {
  executeOptimizedQuery,
  executeBatch,
  createOptimizedIndexes,
  analyzeTableStatistics,
  generatePerformanceReport,
  healthCheck
} = dbOptimizer;

export default dbOptimizer;