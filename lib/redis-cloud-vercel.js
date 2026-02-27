/**
 * Redis Cloud Adapter for Vercel Serverless
 * Compatible with Redis Cloud using standard Redis protocol
 * Handles connection pooling and serverless lifecycle
 */

import { createClient } from 'redis';

// Global cache for Redis client
let cachedClient = null;
let connectionPromise = null;

// Redis Cloud configuration
const REDIS_CONFIG = {
  url: process.env.REDIS_URL,
  password: process.env.REDIS_PASSWORD,
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '10795'),
};

// Session configuration
const SESSION_CONFIG = {
  prefix: 'synthex:session:',
  userPrefix: 'synthex:user:',
  cachePrefix: 'synthex:cache:',
  defaultTTL: 24 * 60 * 60, // 24 hours
  shortTTL: 5 * 60, // 5 minutes for cache
  longTTL: 7 * 24 * 60 * 60 // 7 days for persistent data
};

class RedisCloudVercelService {
  constructor() {
    this.memoryStore = new Map();
    this.isEdgeRuntime = typeof EdgeRuntime !== 'undefined';
  }

  // Get or create Redis client (singleton pattern for serverless)
  async getClient() {
    // Use memory fallback in Edge Runtime
    if (this.isEdgeRuntime) {
      return null;
    }

    // Return cached client if available
    if (cachedClient && cachedClient.isOpen) {
      return cachedClient;
    }

    // Return existing connection promise if connecting
    if (connectionPromise) {
      return connectionPromise;
    }

    // Create new connection
    connectionPromise = this.createConnection();
    cachedClient = await connectionPromise;
    connectionPromise = null;
    
    return cachedClient;
  }

  // Create Redis connection with proper configuration
  async createConnection() {
    if (!REDIS_CONFIG.url) {
      console.warn('Redis Cloud not configured - using memory fallback');
      return null;
    }

    try {
      const client = createClient({
        url: REDIS_CONFIG.url,
        socket: {
          connectTimeout: 5000,
          keepAlive: 1000,
          reconnectStrategy: (retries) => {
            if (retries > 2) return null; // Fail fast in serverless
            return Math.min(retries * 100, 500);
          }
        },
        // Disable command queue for serverless
        disableOfflineQueue: true,
        // Use lazy connect for better serverless performance
        lazyConnect: true
      });

      // Set up error handlers
      client.on('error', (err) => {
        console.error('Redis Cloud Error:', err.message);
        // Don't throw - let it fall back to memory
      });

      client.on('connect', () => {
        // Connected to Redis Cloud
      });

      // Connect to Redis
      await client.connect();
      
      // Verify connection
      await client.ping();
      
      return client;
    } catch (error) {
      console.error('Failed to connect to Redis Cloud:', error.message);
      return null;
    }
  }

  // Execute Redis operation with fallback
  async execute(operation) {
    try {
      const client = await this.getClient();
      
      if (client && client.isOpen) {
        return await operation(client);
      } else {
        // Fall back to memory store
        return this.memoryFallback(operation);
      }
    } catch (error) {
      console.error('Redis operation failed:', error.message);
      // Fall back to memory store
      return this.memoryFallback(operation);
    }
  }

  // Memory fallback for when Redis is unavailable
  memoryFallback(operation) {
    // Clean up expired entries periodically
    if (Math.random() < 0.1) { // 10% chance
      this.cleanupMemoryStore();
    }
    
    // This is a simplified fallback - you can expand as needed
    return null;
  }

  // Clean up expired entries from memory store
  cleanupMemoryStore() {
    const now = Date.now();
    for (const [key, value] of this.memoryStore.entries()) {
      if (value.expires && value.expires < now) {
        this.memoryStore.delete(key);
      }
    }
  }

  // Core Redis operations with fallback
  async set(key, value, ttl = SESSION_CONFIG.shortTTL) {
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    
    return this.execute(async (client) => {
      if (client) {
        return await client.setEx(key, ttl, stringValue);
      } else {
        // Memory fallback
        this.memoryStore.set(key, {
          data: value,
          expires: Date.now() + ttl * 1000
        });
        return 'OK';
      }
    });
  }

  async get(key) {
    return this.execute(async (client) => {
      if (client) {
        const value = await client.get(key);
        if (!value) return null;
        
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      } else {
        // Memory fallback
        const stored = this.memoryStore.get(key);
        if (stored && (!stored.expires || stored.expires > Date.now())) {
          return stored.data;
        }
        return null;
      }
    });
  }

  async del(key) {
    return this.execute(async (client) => {
      if (client) {
        return await client.del(key);
      } else {
        // Memory fallback
        return this.memoryStore.delete(key) ? 1 : 0;
      }
    });
  }

  async exists(key) {
    return this.execute(async (client) => {
      if (client) {
        return await client.exists(key);
      } else {
        // Memory fallback
        const stored = this.memoryStore.get(key);
        return stored && (!stored.expires || stored.expires > Date.now()) ? 1 : 0;
      }
    });
  }

  async expire(key, seconds) {
    return this.execute(async (client) => {
      if (client) {
        return await client.expire(key, seconds);
      } else {
        // Memory fallback
        const stored = this.memoryStore.get(key);
        if (stored) {
          stored.expires = Date.now() + seconds * 1000;
          return 1;
        }
        return 0;
      }
    });
  }

  async ttl(key) {
    return this.execute(async (client) => {
      if (client) {
        return await client.ttl(key);
      } else {
        // Memory fallback
        const stored = this.memoryStore.get(key);
        if (!stored) return -2;
        if (!stored.expires) return -1;
        const remaining = Math.ceil((stored.expires - Date.now()) / 1000);
        return remaining > 0 ? remaining : -2;
      }
    });
  }

  // Session Management
  async createSession(userId, sessionData, ttl = SESSION_CONFIG.defaultTTL) {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sessionKey = SESSION_CONFIG.prefix + sessionId;

    const session = {
      id: sessionId,
      userId,
      ...sessionData,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString()
    };

    await this.set(sessionKey, session, ttl);
    
    // Also store user -> session mapping
    const userKey = SESSION_CONFIG.userPrefix + userId;
    const userSessions = await this.get(userKey) || [];
    userSessions.push(sessionId);
    await this.set(userKey, userSessions, ttl);
    
    return sessionId;
  }

  async getSession(sessionId) {
    const sessionKey = SESSION_CONFIG.prefix + sessionId;
    return await this.get(sessionKey);
  }

  async updateSession(sessionId, updateData, extendTTL = false) {
    const sessionKey = SESSION_CONFIG.prefix + sessionId;
    const existingSession = await this.getSession(sessionId);
    
    if (!existingSession) {
      throw new Error('Session not found');
    }

    const updatedSession = {
      ...existingSession,
      ...updateData,
      lastActivity: new Date().toISOString()
    };

    const ttl = extendTTL ? SESSION_CONFIG.defaultTTL : await this.ttl(sessionKey);
    await this.set(sessionKey, updatedSession, Math.max(ttl, 300));
    
    return updatedSession;
  }

  async deleteSession(sessionId) {
    const sessionKey = SESSION_CONFIG.prefix + sessionId;
    const session = await this.getSession(sessionId);
    
    if (session?.userId) {
      const userKey = SESSION_CONFIG.userPrefix + session.userId;
      const userSessions = await this.get(userKey) || [];
      const filtered = userSessions.filter(id => id !== sessionId);
      await this.set(userKey, filtered);
    }
    
    return await this.del(sessionKey);
  }

  async getUserSessions(userId) {
    const userKey = SESSION_CONFIG.userPrefix + userId;
    const sessionIds = await this.get(userKey) || [];
    
    const sessions = await Promise.all(
      sessionIds.map(id => this.getSession(id))
    );
    
    return sessions.filter(session => session !== null);
  }

  // Rate limiting
  async checkRateLimit(key, limit, windowMs) {
    const rateLimitKey = `ratelimit:${key}`;
    const current = await this.get(rateLimitKey) || { count: 0, resetTime: 0 };
    const now = Date.now();
    
    if (current.resetTime < now) {
      // New window
      current.count = 1;
      current.resetTime = now + windowMs;
    } else {
      // Increment count
      current.count++;
    }
    
    await this.set(rateLimitKey, current, Math.ceil(windowMs / 1000));
    
    return {
      allowed: current.count <= limit,
      count: current.count,
      limit,
      resetTime: current.resetTime
    };
  }

  // Health check
  async healthCheck() {
    try {
      const client = await this.getClient();
      
      if (client && client.isOpen) {
        await client.ping();
        return { status: 'healthy', connection: 'redis-cloud' };
      } else {
        return { status: 'degraded', connection: 'memory' };
      }
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }

  // Statistics
  async getStats() {
    const client = await this.getClient();
    
    return {
      connected: client && client.isOpen,
      mode: client ? 'redis-cloud' : 'memory',
      memoryStoreSize: this.memoryStore.size,
      isEdgeRuntime: this.isEdgeRuntime
    };
  }
}

// Create singleton instance
const redisCloudVercel = new RedisCloudVercelService();

// Export service and methods
export default redisCloudVercel;

export const {
  set,
  get,
  del,
  exists,
  expire,
  ttl,
  createSession,
  getSession,
  updateSession,
  deleteSession,
  getUserSessions,
  checkRateLimit,
  healthCheck,
  getStats
} = redisCloudVercel;