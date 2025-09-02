
// middleware/executionCache.js - Address lack of result caching
const crypto = require('crypto');

class ExecutionCache {
  constructor() {
    // In-memory cache for development, Redis for production
    this.cache = new Map();
    this.ttl = 3600000; // 1 hour TTL
    this.maxSize = 1000; // Maximum cache entries
  }

  // Generate cache key from code and language
  generateKey(language, code, input = '') {
    const content = `${language}:${code}:${input}`;
    return crypto.createHash('md5').update(content).digest('hex');
  }

  // Check if result is cached
  async get(language, code, input = '') {
    const key = this.generateKey(language, code, input);
    
    if (this.cache.has(key)) {
      const cached = this.cache.get(key);
      
      // Check if expired
      if (Date.now() - cached.timestamp < this.ttl) {
        return {
          ...cached.result,
          fromCache: true
        };
      } else {
        this.cache.delete(key);
      }
    }
    
    return null;
  }

  // Cache execution result
  async set(language, code, input = '', result) {
    const key = this.generateKey(language, code, input);
    
    // Only cache successful results
    if (result.success) {
      // Implement LRU eviction if cache is full
      if (this.cache.size >= this.maxSize) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
      
      this.cache.set(key, {
        result,
        timestamp: Date.now()
      });
    }
  }

  // Get cache statistics
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.hitCount / (this.hitCount + this.missCount) || 0,
      hits: this.hitCount || 0,
      misses: this.missCount || 0
    };
  }

  // Clear expired entries
  cleanup() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp >= this.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

module.exports = new ExecutionCache();

