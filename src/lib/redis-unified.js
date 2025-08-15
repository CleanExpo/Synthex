/**
 * Unified Redis Service
 * Automatically selects the best Redis implementation based on environment
 * 
 * Priority:
 * 1. Redis Cloud (if configured) for Vercel
 * 2. Upstash (if configured) for Edge Runtime
 * 3. Standard Redis for local development
 * 4. Memory fallback as last resort
 */

// Detect runtime environment
const isVercel = process.env.VERCEL === '1';
const isEdgeRuntime = typeof EdgeRuntime !== 'undefined';
const isDevelopment = process.env.NODE_ENV === 'development';

// Check available Redis configurations
const hasRedisCloud = !!(process.env.REDIS_URL || process.env.REDIS_HOST);
const hasUpstash = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

// Select appropriate Redis implementation
let redisService;
let implementationType;

async function initializeRedisService() {
  // For Vercel production, prefer Redis Cloud with Vercel-optimized client
  if (isVercel && hasRedisCloud && !isEdgeRuntime) {
    try {
      const { default: redisCloudVercel } = await import('./redis-cloud-vercel.js');
      redisService = redisCloudVercel;
      implementationType = 'redis-cloud-vercel';
      console.log('✅ Using Redis Cloud (Vercel-optimized)');
    } catch (error) {
      console.error('Failed to load Redis Cloud Vercel:', error);
    }
  }
  
  // For Edge Runtime or if Redis Cloud fails, use Upstash
  if (!redisService && hasUpstash) {
    try {
      const { default: upstashRedis } = await import('./redis-upstash.js');
      redisService = upstashRedis;
      implementationType = 'upstash';
      console.log('✅ Using Upstash Redis (REST API)');
    } catch (error) {
      console.error('Failed to load Upstash Redis:', error);
    }
  }
  
  // For local development or non-Vercel, use standard Redis
  if (!redisService && !isVercel && hasRedisCloud) {
    try {
      const { default: standardRedis } = await import('./redis.js');
      redisService = standardRedis;
      implementationType = 'redis-standard';
      console.log('✅ Using Standard Redis');
    } catch (error) {
      console.error('Failed to load standard Redis:', error);
    }
  }
  
  // Last resort: Memory-only implementation
  if (!redisService) {
    console.warn('⚠️ No Redis configuration found - using memory-only fallback');
    redisService = createMemoryOnlyService();
    implementationType = 'memory-only';
  }
  
  return redisService;
}

// Memory-only service implementation
function createMemoryOnlyService() {
  const memoryStore = new Map();
  
  const cleanupExpired = () => {
    const now = Date.now();
    for (const [key, value] of memoryStore.entries()) {
      if (value.expires && value.expires < now) {
        memoryStore.delete(key);
      }
    }
  };
  
  return {
    async set(key, value, ttl = 3600) {
      if (Math.random() < 0.1) cleanupExpired(); // Periodic cleanup
      
      memoryStore.set(key, {
        data: value,
        expires: ttl ? Date.now() + ttl * 1000 : null
      });
      return 'OK';
    },
    
    async get(key) {
      const stored = memoryStore.get(key);
      if (!stored) return null;
      
      if (stored.expires && stored.expires < Date.now()) {
        memoryStore.delete(key);
        return null;
      }
      
      return stored.data;
    },
    
    async del(key) {
      return memoryStore.delete(key) ? 1 : 0;
    },
    
    async exists(key) {
      const stored = memoryStore.get(key);
      if (!stored) return 0;
      
      if (stored.expires && stored.expires < Date.now()) {
        memoryStore.delete(key);
        return 0;
      }
      
      return 1;
    },
    
    async expire(key, seconds) {
      const stored = memoryStore.get(key);
      if (!stored) return 0;
      
      stored.expires = Date.now() + seconds * 1000;
      return 1;
    },
    
    async ttl(key) {
      const stored = memoryStore.get(key);
      if (!stored) return -2;
      if (!stored.expires) return -1;
      
      const remaining = Math.ceil((stored.expires - Date.now()) / 1000);
      return remaining > 0 ? remaining : -2;
    },
    
    async createSession(userId, sessionData, ttl = 86400) {
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await this.set(`session:${sessionId}`, { id: sessionId, userId, ...sessionData }, ttl);
      return sessionId;
    },
    
    async getSession(sessionId) {
      return await this.get(`session:${sessionId}`);
    },
    
    async updateSession(sessionId, updateData) {
      const session = await this.getSession(sessionId);
      if (!session) return null;
      
      const updated = { ...session, ...updateData };
      await this.set(`session:${sessionId}`, updated);
      return updated;
    },
    
    async deleteSession(sessionId) {
      return await this.del(`session:${sessionId}`);
    },
    
    async getUserSessions(userId) {
      const sessions = [];
      for (const [key, value] of memoryStore.entries()) {
        if (key.startsWith('session:') && value.data?.userId === userId) {
          sessions.push(value.data);
        }
      }
      return sessions;
    },
    
    async checkRateLimit(key, limit, windowMs) {
      const rateLimitKey = `ratelimit:${key}`;
      const current = await this.get(rateLimitKey) || { count: 0, resetTime: 0 };
      const now = Date.now();
      
      if (current.resetTime < now) {
        current.count = 1;
        current.resetTime = now + windowMs;
      } else {
        current.count++;
      }
      
      await this.set(rateLimitKey, current, Math.ceil(windowMs / 1000));
      
      return {
        allowed: current.count <= limit,
        count: current.count,
        limit,
        resetTime: current.resetTime
      };
    },
    
    async healthCheck() {
      return { 
        status: 'degraded', 
        connection: 'memory-only',
        message: 'Redis not configured - using in-memory storage'
      };
    },
    
    async getStats() {
      return {
        connected: false,
        mode: 'memory-only',
        memoryStoreSize: memoryStore.size,
        implementation: 'memory-only'
      };
    }
  };
}

// Initialize and export the service
const servicePromise = initializeRedisService();

// Create proxy that waits for initialization
const unifiedRedisService = new Proxy({}, {
  get(target, prop) {
    return async (...args) => {
      const service = await servicePromise;
      if (typeof service[prop] === 'function') {
        return service[prop](...args);
      }
      return service[prop];
    };
  }
});

// Export unified service
export default unifiedRedisService;

// Export convenience methods that auto-initialize
export const set = (...args) => unifiedRedisService.set(...args);
export const get = (...args) => unifiedRedisService.get(...args);
export const del = (...args) => unifiedRedisService.del(...args);
export const exists = (...args) => unifiedRedisService.exists(...args);
export const expire = (...args) => unifiedRedisService.expire(...args);
export const ttl = (...args) => unifiedRedisService.ttl(...args);
export const createSession = (...args) => unifiedRedisService.createSession(...args);
export const getSession = (...args) => unifiedRedisService.getSession(...args);
export const updateSession = (...args) => unifiedRedisService.updateSession(...args);
export const deleteSession = (...args) => unifiedRedisService.deleteSession(...args);
export const getUserSessions = (...args) => unifiedRedisService.getUserSessions(...args);
export const checkRateLimit = (...args) => unifiedRedisService.checkRateLimit(...args);
export const healthCheck = (...args) => unifiedRedisService.healthCheck(...args);
export const getStats = (...args) => unifiedRedisService.getStats(...args);

// Export implementation type for debugging
export const getImplementationType = async () => {
  await servicePromise;
  return implementationType;
};