/**
 * Cache Service
 * Redis-based caching implementation
 */

class CacheService {
  constructor() {
    this.cache = new Map(); // In-memory cache for development
    this.ttlTimers = new Map();
  }

  /**
   * Get value from cache
   */
  async get(key) {
    try {
      const value = this.cache.get(key);
      if (value) {
        console.log(`Cache hit: ${key}`);
        return JSON.parse(value);
      }
      console.log(`Cache miss: ${key}`);
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key, value, ttl = 3600) {
    try {
      // Clear existing timer if any
      if (this.ttlTimers.has(key)) {
        clearTimeout(this.ttlTimers.get(key));
      }

      // Store value
      this.cache.set(key, JSON.stringify(value));

      // Set TTL
      const timer = setTimeout(() => {
        this.cache.delete(key);
        this.ttlTimers.delete(key);
        console.log(`Cache expired: ${key}`);
      }, ttl * 1000);

      this.ttlTimers.set(key, timer);
      console.log(`Cache set: ${key} (TTL: ${ttl}s)`);
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async del(key) {
    try {
      // Clear timer
      if (this.ttlTimers.has(key)) {
        clearTimeout(this.ttlTimers.get(key));
        this.ttlTimers.delete(key);
      }

      // Delete value
      this.cache.delete(key);
      console.log(`Cache deleted: ${key}`);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Clear all cache
   */
  async flush() {
    try {
      // Clear all timers
      for (const timer of this.ttlTimers.values()) {
        clearTimeout(timer);
      }
      this.ttlTimers.clear();

      // Clear cache
      this.cache.clear();
      console.log('Cache flushed');
      return true;
    } catch (error) {
      console.error('Cache flush error:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      memoryUsage: process.memoryUsage().heapUsed
    };
  }
}

module.exports = new CacheService();