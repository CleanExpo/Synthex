/**
 * Redis Client for Next.js
 * Simple Redis client that works with Next.js and Vercel
 */

const { createClient } = require('redis');

let cachedClient = null;
let connectionPromise = null;

// Memory fallback store
const memoryStore = new Map();

async function getRedisClient() {
  // Return cached client if available
  if (cachedClient?.isOpen) {
    return cachedClient;
  }

  // Return existing connection promise if connecting
  if (connectionPromise) {
    return connectionPromise;
  }

  // Check if Redis is configured
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('Redis not configured - using memory fallback');
    return null;
  }

  // Create new connection
  connectionPromise = createConnection(redisUrl);
  
  try {
    cachedClient = await connectionPromise;
    connectionPromise = null;
    return cachedClient;
  } catch (error) {
    console.error('Failed to connect to Redis:', error.message);
    connectionPromise = null;
    return null;
  }
}

async function createConnection(url) {
  const client = createClient({
    url,
    socket: {
      connectTimeout: 5000,
      reconnectStrategy: (retries) => {
        if (retries > 2) return null;
        return Math.min(retries * 100, 500);
      }
    }
  });

  client.on('error', (err) => {
    console.error('Redis Error:', err.message);
  });

  await client.connect();
  return client;
}

// Helper to clean expired items from memory store
function cleanMemoryStore() {
  const now = Date.now();
  for (const [key, value] of memoryStore.entries()) {
    if (value.expires && value.expires < now) {
      memoryStore.delete(key);
    }
  }
}

// Main Redis operations
async function set(key, value, ttlSeconds = 3600) {
  try {
    const client = await getRedisClient();
    
    if (client) {
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      await client.setEx(key, ttlSeconds, stringValue);
      return 'OK';
    }
    
    // Memory fallback
    memoryStore.set(key, {
      data: value,
      expires: Date.now() + ttlSeconds * 1000
    });
    return 'OK';
  } catch (error) {
    console.error('Redis set error:', error);
    // Fallback to memory
    memoryStore.set(key, {
      data: value,
      expires: Date.now() + ttlSeconds * 1000
    });
    return 'OK';
  }
}

async function get(key) {
  try {
    const client = await getRedisClient();
    
    if (client) {
      const value = await client.get(key);
      if (!value) return null;
      
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    
    // Memory fallback
    cleanMemoryStore();
    const stored = memoryStore.get(key);
    if (stored && (!stored.expires || stored.expires > Date.now())) {
      return stored.data;
    }
    return null;
  } catch (error) {
    console.error('Redis get error:', error);
    // Fallback to memory
    const stored = memoryStore.get(key);
    if (stored && (!stored.expires || stored.expires > Date.now())) {
      return stored.data;
    }
    return null;
  }
}

async function del(key) {
  try {
    const client = await getRedisClient();
    
    if (client) {
      await client.del(key);
      return 1;
    }
    
    // Memory fallback
    return memoryStore.delete(key) ? 1 : 0;
  } catch (error) {
    console.error('Redis del error:', error);
    return memoryStore.delete(key) ? 1 : 0;
  }
}

async function exists(key) {
  try {
    const client = await getRedisClient();
    
    if (client) {
      return await client.exists(key);
    }
    
    // Memory fallback
    const stored = memoryStore.get(key);
    return stored && (!stored.expires || stored.expires > Date.now()) ? 1 : 0;
  } catch (error) {
    console.error('Redis exists error:', error);
    const stored = memoryStore.get(key);
    return stored && (!stored.expires || stored.expires > Date.now()) ? 1 : 0;
  }
}

// Session management
async function createSession(userId, data, ttl = 86400) {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const session = {
    id: sessionId,
    userId,
    ...data,
    createdAt: new Date().toISOString()
  };
  
  await set(`session:${sessionId}`, session, ttl);
  return sessionId;
}

async function getSession(sessionId) {
  return await get(`session:${sessionId}`);
}

async function updateSession(sessionId, data) {
  const session = await getSession(sessionId);
  if (!session) return null;
  
  const updated = { ...session, ...data, lastActivity: new Date().toISOString() };
  await set(`session:${sessionId}`, updated, 86400);
  return updated;
}

async function deleteSession(sessionId) {
  return await del(`session:${sessionId}`);
}

// Rate limiting
async function checkRateLimit(key, limit, windowMs) {
  const now = Date.now();
  const windowStart = now - windowMs;
  const rateLimitKey = `ratelimit:${key}`;
  
  const current = await get(rateLimitKey) || { count: 0, resetTime: 0 };
  
  if (current.resetTime < now) {
    // New window
    current.count = 1;
    current.resetTime = now + windowMs;
  } else {
    // Increment count
    current.count++;
  }
  
  await set(rateLimitKey, current, Math.ceil(windowMs / 1000));
  
  return {
    allowed: current.count <= limit,
    count: current.count,
    limit,
    resetTime: current.resetTime
  };
}

// Health check
async function healthCheck() {
  try {
    const client = await getRedisClient();
    
    if (client?.isOpen) {
      await client.ping();
      return { status: 'healthy', connection: 'redis-cloud' };
    }
    
    return { status: 'degraded', connection: 'memory' };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}

async function getStats() {
  const client = await getRedisClient();
  
  return {
    connected: !!client?.isOpen,
    mode: client ? 'redis-cloud' : 'memory',
    memoryStoreSize: memoryStore.size
  };
}

// Export functions
module.exports = {
  set,
  get,
  del,
  exists,
  createSession,
  getSession,
  updateSession,
  deleteSession,
  checkRateLimit,
  healthCheck,
  getStats,
  getRedisClient
};