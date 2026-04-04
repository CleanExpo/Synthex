/**
 * Upstash Redis Adapter for Vercel Edge Runtime
 * Provides Redis functionality using REST API (compatible with serverless)
 */

// Upstash Redis REST API configuration
const UPSTASH_CONFIG = {
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
  enableTelemetry: false
};

class UpstashRedisService {
  constructor() {
    this.baseUrl = UPSTASH_CONFIG.url;
    this.token = UPSTASH_CONFIG.token;
    this.isConfigured = !!(this.baseUrl && this.token);
    
    if (!this.isConfigured) {
      console.warn('Upstash Redis not configured - using memory fallback');
      this.memoryStore = new Map();
    }
  }

  // Execute Redis command via REST API
  async execute(command) {
    if (!this.isConfigured) {
      return this.memoryFallback(command);
    }

    try {
      const response = await fetch(`${this.baseUrl}/${command.join('/')}`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Redis command failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.result;
    } catch (error) {
      console.error('Upstash Redis error:', error);
      // Fallback to memory on error
      return this.memoryFallback(command);
    }
  }

  // Memory fallback for when Redis is unavailable
  memoryFallback(command) {
    const [cmd, ...args] = command;
    
    switch (cmd.toUpperCase()) {
      case 'SET':
        const [key, value] = args;
        this.memoryStore.set(key, value);
        return 'OK';
      
      case 'SETEX':
        const [keyEx, ttl, valueEx] = args;
        this.memoryStore.set(keyEx, {
          value: valueEx,
          expires: Date.now() + (parseInt(ttl) * 1000)
        });
        return 'OK';
      
      case 'GET':
        const stored = this.memoryStore.get(args[0]);
        if (!stored) return null;
        if (typeof stored === 'object' && stored.expires) {
          if (stored.expires < Date.now()) {
            this.memoryStore.delete(args[0]);
            return null;
          }
          return stored.value;
        }
        return stored;
      
      case 'DEL':
        const deleted = this.memoryStore.delete(args[0]);
        return deleted ? 1 : 0;
      
      case 'EXISTS':
        return this.memoryStore.has(args[0]) ? 1 : 0;
      
      case 'EXPIRE':
        const [expKey, expTtl] = args;
        const existing = this.memoryStore.get(expKey);
        if (existing) {
          this.memoryStore.set(expKey, {
            value: typeof existing === 'object' ? existing.value : existing,
            expires: Date.now() + (parseInt(expTtl) * 1000)
          });
          return 1;
        }
        return 0;
      
      case 'TTL':
        const ttlStored = this.memoryStore.get(args[0]);
        if (!ttlStored) return -2;
        if (typeof ttlStored === 'object' && ttlStored.expires) {
          const remaining = Math.ceil((ttlStored.expires - Date.now()) / 1000);
          return remaining > 0 ? remaining : -2;
        }
        return -1;
      
      case 'INCR':
        const current = parseInt(this.memoryStore.get(args[0]) || 0);
        const newVal = current + 1;
        this.memoryStore.set(args[0], newVal.toString());
        return newVal;
      
      case 'DECR':
        const currentDec = parseInt(this.memoryStore.get(args[0]) || 0);
        const newValDec = currentDec - 1;
        this.memoryStore.set(args[0], newValDec.toString());
        return newValDec;
      
      default:
        console.warn(`Memory fallback: Unsupported command ${cmd}`);
        return null;
    }
  }

  // High-level methods
  async set(key, value, options = {}) {
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : value;
    
    if (options.ex) {
      return await this.execute(['SETEX', key, options.ex, stringValue]);
    }
    return await this.execute(['SET', key, stringValue]);
  }

  async get(key) {
    const value = await this.execute(['GET', key]);
    if (!value) return null;
    
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  async del(key) {
    return await this.execute(['DEL', key]);
  }

  async exists(key) {
    const result = await this.execute(['EXISTS', key]);
    return result === 1;
  }

  async expire(key, seconds) {
    return await this.execute(['EXPIRE', key, seconds]);
  }

  async ttl(key) {
    return await this.execute(['TTL', key]);
  }

  async incr(key) {
    return await this.execute(['INCR', key]);
  }

  async decr(key) {
    return await this.execute(['DECR', key]);
  }

  // Rate limiting specific methods
  async getRateLimit(key) {
    const data = await this.get(`ratelimit:${key}`);
    return data || { count: 0, resetTime: 0 };
  }

  async setRateLimit(key, data, windowMs) {
    const ttl = Math.ceil(windowMs / 1000);
    return await this.set(`ratelimit:${key}`, data, { ex: ttl });
  }

  async incrementRateLimit(key, windowMs) {
    const current = await this.getRateLimit(key);
    const now = Date.now();
    
    if (current.resetTime < now) {
      // Reset window
      const newData = {
        count: 1,
        resetTime: now + windowMs
      };
      await this.setRateLimit(key, newData, windowMs);
      return newData;
    } else {
      // Increment count
      current.count++;
      await this.setRateLimit(key, current, windowMs);
      return current;
    }
  }

  // Session management methods
  async createSession(userId, sessionData, ttl = 86400) {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sessionKey = `session:${sessionId}`;
    
    const session = {
      id: sessionId,
      userId,
      ...sessionData,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString()
    };
    
    await this.set(sessionKey, session, { ex: ttl });
    
    // Add to user's session list
    const userKey = `user:sessions:${userId}`;
    const sessions = await this.get(userKey) || [];
    sessions.push(sessionId);
    await this.set(userKey, sessions, { ex: ttl });
    
    return sessionId;
  }

  async getSession(sessionId) {
    return await this.get(`session:${sessionId}`);
  }

  async updateSession(sessionId, updateData, extendTTL = false) {
    const session = await this.getSession(sessionId);
    if (!session) return null;
    
    const updated = {
      ...session,
      ...updateData,
      lastActivity: new Date().toISOString()
    };
    
    const ttl = extendTTL ? 86400 : await this.ttl(`session:${sessionId}`);
    await this.set(`session:${sessionId}`, updated, { ex: Math.max(ttl, 300) });
    
    return updated;
  }

  async deleteSession(sessionId) {
    const session = await this.getSession(sessionId);
    if (!session) return false;
    
    await this.del(`session:${sessionId}`);
    
    // Remove from user's session list
    if (session.userId) {
      const userKey = `user:sessions:${session.userId}`;
      const sessions = await this.get(userKey) || [];
      const filtered = sessions.filter(id => id !== sessionId);
      await this.set(userKey, filtered);
    }
    
    return true;
  }

  // Health check
  async healthCheck() {
    if (!this.isConfigured) {
      return { status: 'degraded', mode: 'memory', message: 'Redis not configured' };
    }
    
    try {
      await this.execute(['PING']);
      return { status: 'healthy', mode: 'redis' };
    } catch (error) {
      return { status: 'unhealthy', mode: 'memory', error: error.message };
    }
  }
}

// Create singleton instance
const upstashRedis = new UpstashRedisService();

// Export service
export default upstashRedis;

// Export convenience methods
export const {
  set,
  get,
  del,
  exists,
  expire,
  ttl,
  incr,
  decr,
  getRateLimit,
  setRateLimit,
  incrementRateLimit,
  createSession,
  getSession,
  updateSession,
  deleteSession,
  healthCheck
} = upstashRedis;