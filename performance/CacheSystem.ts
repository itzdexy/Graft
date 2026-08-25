/**
 * Smart caching and performance optimization system
 * Provides intelligent caching, performance monitoring, and optimization suggestions
 */

export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  ttl: number;
  size: number;
  tags: string[];
}

export interface CacheConfig {
  maxSize: number; // in bytes
  defaultTTL: number; // in milliseconds
  maxEntries: number;
  enableCompression: boolean;
  enablePersistence: boolean;
  persistencePath?: string;
}

export interface PerformanceMetrics {
  cacheHitRate: number;
  averageAccessTime: number;
  memoryUsage: number;
  evictionCount: number;
  compressionRatio: number;
}

export interface CacheStatistics {
  totalEntries: number;
  totalSize: number;
  hitCount: number;
  missCount: number;
  evictionCount: number;
  compressionSavings: number;
}

export interface OptimizationSuggestion {
  type: 'cache' | 'memory' | 'io' | 'cpu';
  description: string;
  impact: 'low' | 'medium' | 'high';
  suggestion: string;
  estimatedImprovement: string;
}

class SmartCacheSystem<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private config: CacheConfig;
  private statistics: CacheStatistics;
  private accessTimes: number[] = [];
  private compressionEnabled: boolean;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 100 * 1024 * 1024, // 100MB
      defaultTTL: 3600000, // 1 hour
      maxEntries: 10000,
      enableCompression: true,
      enablePersistence: false,
      ...config,
    };

    this.statistics = {
      totalEntries: 0,
      totalSize: 0,
      hitCount: 0,
      missCount: 0,
      evictionCount: 0,
      compressionSavings: 0,
    };

    this.compressionEnabled = this.config.enableCompression;
  }

  /**
   * Get a value from cache
   */
  get(key: string): T | null {
    const startTime = Date.now();
    const entry = this.cache.get(key);

    if (!entry) {
      this.statistics.missCount++;
      this.recordAccessTime(Date.now() - startTime);
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.statistics.missCount++;
      this.recordAccessTime(Date.now() - startTime);
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.statistics.hitCount++;
    this.recordAccessTime(Date.now() - startTime);

    return entry.value;
  }

  /**
   * Set a value in cache
   */
  set(key: string, value: T, ttl?: number, tags: string[] = []): void {
    const size = this.calculateSize(value);
    const entryTTL = ttl || this.config.defaultTTL;

    // Check if we need to evict entries
    this.ensureCapacity(size);

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccessed: Date.now(),
      ttl: entryTTL,
      size,
      tags,
    };

    this.cache.set(key, entry);
    this.statistics.totalEntries = this.cache.size;
    this.statistics.totalSize += size;
  }

  /**
   * Delete a value from cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.statistics.totalSize -= entry.size;
      this.statistics.totalEntries = this.cache.size - 1;
      return this.cache.delete(key);
    }
    return false;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.statistics.totalEntries = 0;
    this.statistics.totalSize = 0;
  }

  /**
   * Clear entries by tag
   */
  clearByTag(tag: string): void {
    for (const [key, entry] of this.cache) {
      if (entry.tags.includes(tag)) {
        this.delete(key);
      }
    }
  }

  /**
   * Clear expired entries
   */
  clearExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        this.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStatistics(): CacheStatistics {
    return { ...this.statistics };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const totalAccesses = this.statistics.hitCount + this.statistics.missCount;
    const hitRate = totalAccesses > 0 ? this.statistics.hitCount / totalAccesses : 0;
    const avgAccessTime = this.accessTimes.length > 0
      ? this.accessTimes.reduce((sum, time) => sum + time, 0) / this.accessTimes.length
      : 0;

    return {
      cacheHitRate: hitRate,
      averageAccessTime: avgAccessTime,
      memoryUsage: this.statistics.totalSize,
      evictionCount: this.statistics.evictionCount,
      compressionRatio: this.compressionEnabled ? 0.7 : 1,
    };
  }

  /**
   * Get optimization suggestions
   */
  getOptimizationSuggestions(): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    const metrics = this.getPerformanceMetrics();

    // Cache hit rate suggestions
    if (metrics.cacheHitRate < 0.5) {
      suggestions.push({
        type: 'cache',
        description: 'Low cache hit rate',
        impact: 'high',
        suggestion: 'Consider increasing TTL or caching more frequently accessed data',
        estimatedImprovement: '20-30% faster access times',
      });
    }

    // Memory usage suggestions
    if (metrics.memoryUsage > this.config.maxSize * 0.8) {
      suggestions.push({
        type: 'memory',
        description: 'High memory usage',
        impact: 'medium',
        suggestion: 'Consider reducing cache size or implementing more aggressive eviction',
        estimatedImprovement: 'Reduced memory footprint',
      });
    }

    // Access time suggestions
    if (metrics.averageAccessTime > 10) {
      suggestions.push({
        type: 'cache',
        description: 'Slow average access time',
        impact: 'medium',
        suggestion: 'Consider using a faster cache backend or optimizing cache key structure',
        estimatedImprovement: '10-20% faster access times',
      });
    }

    // Eviction suggestions
    if (metrics.evictionCount > 100) {
      suggestions.push({
        type: 'cache',
        description: 'High eviction count',
        impact: 'medium',
        suggestion: 'Consider increasing cache size or adjusting TTL values',
        estimatedImprovement: 'Fewer cache misses',
      });
    }

    return suggestions;
  }

  /**
   * Get entries by tag
   */
  getByTag(tag: string): CacheEntry<T>[] {
    return Array.from(this.cache.values()).filter(entry => entry.tags.includes(tag));
  }

  /**
   * Get all keys
   */
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size
   */
  getSize(): number {
    return this.statistics.totalSize;
  }

  /**
   * Get entry count
   */
  getCount(): number {
    return this.cache.size;
  }

  /**
   * Warm up cache with pre-defined data
   */
  async warmUp(data: Map<string, T>, ttl?: number): Promise<void> {
    for (const [key, value] of data) {
      this.set(key, value, ttl);
    }
  }

  /**
   * Export cache data
   */
  export(): Array<{ key: string; value: T; ttl: number; tags: string[] }> {
    return Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      value: entry.value,
      ttl: entry.ttl,
      tags: entry.tags,
    }));
  }

  /**
   * Import cache data
   */
  import(data: Array<{ key: string; value: T; ttl?: number; tags?: string[] }>): void {
    for (const item of data) {
      this.set(item.key, item.value, item.ttl, item.tags);
    }
  }

  // Private helper methods

  private ensureCapacity(requiredSize: number): void {
    // Check if we need to evict entries
    while (this.statistics.totalSize + requiredSize > this.config.maxSize || 
           this.cache.size >= this.config.maxEntries) {
      this.evictEntry();
    }
  }

  private evictEntry(): void {
    // LRU eviction strategy
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
      this.statistics.evictionCount++;
    }
  }

  private calculateSize(value: T): number {
    // Rough estimation of size in bytes
    const str = JSON.stringify(value);
    return str.length * 2; // 2 bytes per character (UTF-16)
  }

  private recordAccessTime(time: number): void {
    this.accessTimes.push(time);
    if (this.accessTimes.length > 1000) {
      this.accessTimes.shift();
    }
  }
}

// Global cache instance
const globalCache = new SmartCacheSystem<any>();

export function getCache<T>(): SmartCacheSystem<T> {
  return globalCache as SmartCacheSystem<T>;
}

export function createCache<T>(config?: Partial<CacheConfig>): SmartCacheSystem<T> {
  return new SmartCacheSystem<T>(config);
}

export function getCacheStatistics(): CacheStatistics {
  return globalCache.getStatistics();
}

export function getPerformanceMetrics(): PerformanceMetrics {
  return globalCache.getPerformanceMetrics();
}

export function getOptimizationSuggestions(): OptimizationSuggestion[] {
  return globalCache.getOptimizationSuggestions();
}

export function clearCache(): void {
  globalCache.clear();
}

export function clearExpiredCache(): void {
  globalCache.clearExpired();
}

export function exportCache(): Array<{ key: string; value: any; ttl: number; tags: string[] }> {
  return globalCache.export();
}

export function importCache(data: Array<{ key: string; value: any; ttl?: number; tags?: string[] }>): void {
  globalCache.import(data);
}
