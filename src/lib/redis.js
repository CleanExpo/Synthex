/**
 * Redis Connection and Session Management
 * Handles caching, session storage, and real-time data
 */

import { createClient } from 'redis';

// Redis configuration
const REDIS_CONFIG = {
  url: process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL,
  password: process.env.REDIS_PASSWORD || process.env.UPSTASH_REDIS_REST_TOKEN,
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  retryDelayOnFailover: 100,
  retryDelayOnClusterDown: 300,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: null,
  lazyConnect: true
};

// Session management settings
const SESSION_CONFIG = {
  prefix: 'synthex:session:',
  userPrefix: 'synthex:user:',
  cachePrefix: 'synthex:cache:',
  defaultTTL: 24 * 60 * 60, // 24 hours in seconds
  shortTTL: 5 * 60, // 5 minutes for cache
  longTTL: 7 * 24 * 60 * 60 // 7 days for persistent data
};

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.init();
  }

  // Initialize Redis connection
  async init() {
    if (!REDIS_CONFIG.url && !REDIS_CONFIG.host) {
      console.warn('Redis not configured - session management will use memory fallback');
      this.setupMemoryFallback();
      return;
    }

    try {
      // Create Redis client
      if (REDIS_CONFIG.url) {
        // Use URL connection (for services like Upstash, Redis Cloud)
        this.client = createClient({
          url: REDIS_CONFIG.url,
          password: REDIS_CONFIG.password
        });
      } else {
        // Use host/port connection
        this.client = createClient({
          socket: {
            host: REDIS_CONFIG.host,
            port: REDIS_CONFIG.port
          },
          password: REDIS_CONFIG.password
        });
      }

      // Error handling
      this.client.on('error', (error) => {
        console.error('Redis connection error:', error);
        this.isConnected = false;
        this.handleConnectionError(error);
      });

      this.client.on('connect', () => {
        console.log('Redis connected successfully');
        this.isConnected = true;
        this.retryCount = 0;
      });

      this.client.on('ready', () => {
        console.log('Redis client ready');
        this.isConnected = true;
      });

      this.client.on('end', () => {
        console.log('Redis connection ended');
        this.isConnected = false;
      });

      // Connect to Redis
      await this.client.connect();

    } catch (error) {
      console.error('Failed to initialize Redis:', error);
      this.setupMemoryFallback();
    }
  }

  // Handle connection errors with retry logic
  async handleConnectionError(error) {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      console.log(`Retrying Redis connection (${this.retryCount}/${this.maxRetries})...`);
      
      setTimeout(() => {
        this.init();
      }, 2000 * this.retryCount); // Exponential backoff
    } else {
      console.error('Max Redis retry attempts reached, falling back to memory storage');
      this.setupMemoryFallback();
    }
  }

  // Memory fallback for when Redis is unavailable
  setupMemoryFallback() {
    this.memoryStore = new Map();
    this.isConnected = false;
    
    // Clean up memory store every 30 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.memoryStore.entries()) {
        if (value.expires && value.expires < now) {
          this.memoryStore.delete(key);
        }
      }
    }, 30 * 60 * 1000);
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

    try {
      if (this.isConnected) {
        await this.client.setEx(sessionKey, ttl, JSON.stringify(session));
        
        // Also store user -> session mapping
        const userKey = SESSION_CONFIG.userPrefix + userId;
        await this.client.sAdd(userKey, sessionId);
        await this.client.expire(userKey, ttl);
      } else {
        // Memory fallback
        this.memoryStore.set(sessionKey, {
          data: session,
          expires: Date.now() + ttl * 1000
        });
      }

      return sessionId;
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  }

  async getSession(sessionId) {
    const sessionKey = SESSION_CONFIG.prefix + sessionId;

    try {
      if (this.isConnected) {
        const sessionData = await this.client.get(sessionKey);
        return sessionData ? JSON.parse(sessionData) : null;
      } else {
        // Memory fallback
        const stored = this.memoryStore.get(sessionKey);
        if (stored && (!stored.expires || stored.expires > Date.now())) {
          return stored.data;
        }
        return null;
      }
    } catch (error) {
      console.error('Failed to get session:', error);
      return null;
    }
  }

  async updateSession(sessionId, updateData, extendTTL = false) {
    const sessionKey = SESSION_CONFIG.prefix + sessionId;

    try {
      const existingSession = await this.getSession(sessionId);
      if (!existingSession) {
        throw new Error('Session not found');
      }

      const updatedSession = {
        ...existingSession,
        ...updateData,
        lastActivity: new Date().toISOString()
      };

      if (this.isConnected) {
        const ttl = extendTTL ? SESSION_CONFIG.defaultTTL : await this.client.ttl(sessionKey);
        await this.client.setEx(sessionKey, Math.max(ttl, 300), JSON.stringify(updatedSession));
      } else {
        // Memory fallback
        const stored = this.memoryStore.get(sessionKey);
        if (stored) {
          this.memoryStore.set(sessionKey, {
            ...stored,
            data: updatedSession
          });
        }
      }

      return updatedSession;
    } catch (error) {
      console.error('Failed to update session:', error);
      throw error;
    }
  }

  async deleteSession(sessionId) {
    const sessionKey = SESSION_CONFIG.prefix + sessionId;

    try {
      const session = await this.getSession(sessionId);
      
      if (this.isConnected) {
        await this.client.del(sessionKey);
        
        // Remove from user sessions
        if (session?.userId) {
          const userKey = SESSION_CONFIG.userPrefix + session.userId;
          await this.client.sRem(userKey, sessionId);
        }
      } else {
        // Memory fallback
        this.memoryStore.delete(sessionKey);
      }

      return true;
    } catch (error) {
      console.error('Failed to delete session:', error);
      return false;
    }
  }

  async getUserSessions(userId) {
    const userKey = SESSION_CONFIG.userPrefix + userId;

    try {
      if (this.isConnected) {
        const sessionIds = await this.client.sMembers(userKey);
        const sessions = await Promise.all(
          sessionIds.map(id => this.getSession(id))
        );
        return sessions.filter(session => session !== null);
      } else {
        // Memory fallback - slower but works
        const sessions = [];
        for (const [key, value] of this.memoryStore.entries()) {
          if (key.startsWith(SESSION_CONFIG.prefix) && 
              value.data?.userId === userId &&
              (!value.expires || value.expires > Date.now())) {
            sessions.push(value.data);
          }
        }
        return sessions;
      }
    } catch (error) {
      console.error('Failed to get user sessions:', error);
      return [];
    }
  }

  // Caching Methods
  async set(key, value, ttl = SESSION_CONFIG.shortTTL) {
    const cacheKey = SESSION_CONFIG.cachePrefix + key;

    try {
      if (this.isConnected) {
        await this.client.setEx(cacheKey, ttl, JSON.stringify(value));
      } else {
        this.memoryStore.set(cacheKey, {
          data: value,
          expires: Date.now() + ttl * 1000
        });
      }
      return true;
    } catch (error) {
      console.error('Failed to set cache:', error);
      return false;
    }
  }

  async get(key) {
    const cacheKey = SESSION_CONFIG.cachePrefix + key;

    try {
      if (this.isConnected) {
        const data = await this.client.get(cacheKey);
        return data ? JSON.parse(data) : null;
      } else {
        const stored = this.memoryStore.get(cacheKey);
        if (stored && (!stored.expires || stored.expires > Date.now())) {
          return stored.data;
        }
        return null;
      }
    } catch (error) {
      console.error('Failed to get cache:', error);
      return null;
    }
  }

  async del(key) {
    const cacheKey = SESSION_CONFIG.cachePrefix + key;

    try {
      if (this.isConnected) {
        await this.client.del(cacheKey);
      } else {
        this.memoryStore.delete(cacheKey);
      }
      return true;
    } catch (error) {
      console.error('Failed to delete cache:', error);
      return false;
    }
  }

  // Real-time data methods
  async publish(channel, message) {
    if (!this.isConnected) {
      console.warn('Redis not connected - cannot publish message');
      return false;
    }

    try {
      await this.client.publish(channel, JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Failed to publish message:', error);
      return false;
    }
  }

  async subscribe(channel, callback) {
    if (!this.isConnected) {
      console.warn('Redis not connected - cannot subscribe to channel');
      return null;
    }

    try {
      const subscriber = this.client.duplicate();
      await subscriber.connect();
      
      await subscriber.subscribe(channel, (message) => {
        try {
          const parsedMessage = JSON.parse(message);
          callback(parsedMessage);
        } catch (error) {
          callback(message);
        }
      });

      return subscriber;
    } catch (error) {
      console.error('Failed to subscribe:', error);
      return null;
    }
  }

  // Health check
  async healthCheck() {
    try {
      if (this.isConnected && this.client) {
        await this.client.ping();
        return { status: 'healthy', connection: 'redis' };
      } else {
        return { status: 'healthy', connection: 'memory' };
      }
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }

  // Statistics
  getStats() {
    return {
      connected: this.isConnected,
      retryCount: this.retryCount,
      memoryFallback: !this.isConnected,
      memoryStoreSize: this.memoryStore ? this.memoryStore.size : 0
    };
  }

  // Graceful shutdown
  async close() {
    try {
      if (this.client && this.isConnected) {
        await this.client.quit();
      }
      this.isConnected = false;
      console.log('Redis connection closed');
    } catch (error) {
      console.error('Error closing Redis connection:', error);
    }
  }
}

// Create singleton instance
export const redisService = new RedisService();

// Export convenience methods
export const {
  createSession,
  getSession,
  updateSession,
  deleteSession,
  getUserSessions,
  set,
  get,
  del,
  publish,
  subscribe,
  healthCheck,
  getStats
} = redisService;

export default redisService;