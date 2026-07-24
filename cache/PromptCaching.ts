/**
 * Prompt Caching
 * Inspired by llama.cpp's prompt caching for efficient repeated prompt processing
 * Caches prompt prefixes and KV cache to avoid redundant computation
 */

export interface PromptCache {
  id: string;
  name: string;
  config: CacheConfig;
  entries: Map<string, CacheEntry>;
  statistics: CacheStatistics;
  metadata: CacheMetadata;
}

export interface CacheConfig {
  maxSize: number;
  maxEntries: number;
  ttl: number;
  enableCompression: boolean;
  enablePersistence: boolean;
  evictionPolicy: EvictionPolicy;
}

export type EvictionPolicy = 'lru' | 'lfu' | 'fifo' | 'ttl';

export interface CacheEntry {
  key: string;
  prompt: string;
  tokens: number[];
  kvCache: KVCacheData;
  timestamp: number;
  accessCount: number;
  lastAccess: number;
  size: number;
  compressed: boolean;
}

export interface KVCacheData {
  keys: Float32Array[];
  values: Float32Array[];
  metadata: KVCacheMetadata;
}

export interface KVCacheMetadata {
  layers: number;
  heads: number;
  seqLen: number;
  headDim: number;
}

export interface CacheStatistics {
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  totalSize: number;
  evictedEntries: number;
  averageAccessTime: number;
  totalSavedTime: number;
}

export interface CacheMetadata {
  createdAt: number;
  updatedAt: number;
  version: number;
  totalRequests: number;
}

export interface CacheResult {
  hit: boolean;
  tokens?: number[];
  kvCache?: KVCacheData;
  time: number;
  savedTime?: number;
}

export interface CacheKey {
  prompt: string;
  model: string;
  parameters: CacheParameters;
}

export interface CacheParameters {
  temperature: number;
  topP: number;
  topK: number;
}

class PromptCacheManager {
  private caches: Map<string, PromptCache> = new Map();

  /**
   * Create a prompt cache
   */
  createCache(name: string, config?: Partial<CacheConfig>): PromptCache {
    const cache: PromptCache = {
      id: this.generateCacheId(),
      name,
      config: {
        maxSize: config?.maxSize || 1024 * 1024 * 1024, // 1GB
        maxEntries: config?.maxEntries || 10000,
        ttl: config?.ttl || 3600000, // 1 hour
        enableCompression: config?.enableCompression ?? true,
        enablePersistence: config?.enablePersistence ?? false,
        evictionPolicy: config?.evictionPolicy || 'lru',
      },
      entries: new Map(),
      statistics: {
        totalHits: 0,
        totalMisses: 0,
        hitRate: 0,
        totalSize: 0,
        evictedEntries: 0,
        averageAccessTime: 0,
        totalSavedTime: 0,
      },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        totalRequests: 0,
      },
    };

    this.caches.set(cache.id, cache);
    return cache;
  }

  /**
   * Get a cache
   */
  getCache(cacheId: string): PromptCache | undefined {
    return this.caches.get(cacheId);
  }

  /**
   * Get all caches
   */
  getAllCaches(): PromptCache[] {
    return Array.from(this.caches.values());
  }

  /**
   * Delete a cache
   */
  deleteCache(cacheId: string): boolean {
    return this.caches.delete(cacheId);
  }

  /**
   * Get or create cache entry
   */
  async getOrCreate(
    cacheId: string,
    key: CacheKey,
    computeHandler: () => Promise<{ tokens: number[]; kvCache: KVCacheData }>
  ): Promise<CacheResult> {
    const cache = this.caches.get(cacheId);
    if (!cache) {
      throw new Error(`Cache ${cacheId} not found`);
    }

    const cacheKey = this.generateCacheKey(key);
    const startTime = Date.now();

    // Check for cache hit
    const entry = cache.entries.get(cacheKey);

    if (entry && !this.isEntryExpired(entry, cache.config.ttl)) {
      // Cache hit
      entry.accessCount++;
      entry.lastAccess = Date.now();

      cache.statistics.totalHits++;
      cache.statistics.hitRate =
        cache.statistics.totalHits / (cache.statistics.totalHits + cache.statistics.totalMisses);

      const time = Date.now() - startTime;
      cache.statistics.averageAccessTime =
        this.updateAverage(cache.statistics.averageAccessTime, cache.metadata.totalRequests, time);

      cache.metadata.totalRequests++;
      cache.metadata.updatedAt = Date.now();

      return {
        hit: true,
        tokens: entry.tokens,
        kvCache: entry.kvCache,
        time,
        savedTime: this.estimateSavedTime(entry.size),
      };
    }

    // Cache miss - compute and store
    const computeStartTime = Date.now();
    const result = await computeHandler();
    const computeTime = Date.now() - computeStartTime;

    const newEntry: CacheEntry = {
      key: cacheKey,
      prompt: key.prompt,
      tokens: result.tokens,
      kvCache: result.kvCache,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccess: Date.now(),
      size: this.calculateEntrySize(result),
      compressed: cache.config.enableCompression,
    };

    // Evict entries if necessary
    this.evictIfNeeded(cache, newEntry.size);

    // Store entry
    cache.entries.set(cacheKey, newEntry);
    cache.statistics.totalSize += newEntry.size;

    cache.statistics.totalMisses++;
    cache.statistics.hitRate =
      cache.statistics.totalHits / (cache.statistics.totalHits + cache.statistics.totalMisses);

    const totalTime = Date.now() - startTime;
    cache.statistics.averageAccessTime =
      this.updateAverage(cache.statistics.averageAccessTime, cache.metadata.totalRequests, totalTime);

    cache.metadata.totalRequests++;
    cache.metadata.updatedAt = Date.now();

    return {
      hit: false,
      tokens: result.tokens,
      kvCache: result.kvCache,
      time: totalTime,
    };
  }

  /**
   * Invalidate cache entry
   */
  invalidate(cacheId: string, key: CacheKey): boolean {
    const cache = this.caches.get(cacheId);
    if (!cache) return false;

    const cacheKey = this.generateCacheKey(key);
    const entry = cache.entries.get(cacheKey);

    if (entry) {
      cache.statistics.totalSize -= entry.size;
      cache.entries.delete(cacheKey);
      cache.metadata.updatedAt = Date.now();
      return true;
    }

    return false;
  }

  /**
   * Clear all cache entries
   */
  clearCache(cacheId: string): boolean {
    const cache = this.caches.get(cacheId);
    if (!cache) return false;

    cache.entries.clear();
    cache.statistics.totalSize = 0;
    cache.metadata.updatedAt = Date.now();

    return true;
  }

  /**
   * Get statistics for a cache
   */
  getStatistics(cacheId: string): CacheStatistics | undefined {
    const cache = this.caches.get(cacheId);
    if (!cache) return undefined;

    return { ...cache.statistics };
  }

  /**
   * Reset statistics for a cache
   */
  resetStatistics(cacheId: string): boolean {
    const cache = this.caches.get(cacheId);
    if (!cache) return false;

    cache.statistics = {
      totalHits: 0,
      totalMisses: 0,
      hitRate: 0,
      totalSize: cache.statistics.totalSize,
      evictedEntries: 0,
      averageAccessTime: 0,
      totalSavedTime: 0,
    };

    cache.metadata.updatedAt = Date.now();

    return true;
  }

  /**
   * Get cache entries
   */
  getEntries(cacheId: string, limit?: number): CacheEntry[] {
    const cache = this.caches.get(cacheId);
    if (!cache) return [];

    const entries = Array.from(cache.entries.values());

    if (limit) {
      return entries.slice(0, limit);
    }

    return entries;
  }

  // Private methods

  private generateCacheKey(key: CacheKey): string {
    const params = JSON.stringify(key.parameters);
    return `${key.model}:${params}:${this.hashString(key.prompt)}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  private isEntryExpired(entry: CacheEntry, ttl: number): boolean {
    return Date.now() - entry.timestamp > ttl;
  }

  private calculateEntrySize(result: { tokens: number[]; kvCache: KVCacheData }): number {
    const tokensSize = result.tokens.length * 4; // Int32 = 4 bytes
    const kvSize = result.kvCache.keys.reduce((sum, arr) => sum + arr.length * 4, 0);
    const kvSizeValues = result.kvCache.values.reduce((sum, arr) => sum + arr.length * 4, 0);
    return tokensSize + kvSize + kvSizeValues;
  }

  private evictIfNeeded(cache: PromptCache, newSize: number): void {
    while (
      (cache.entries.size >= cache.config.maxEntries ||
        cache.statistics.totalSize + newSize > cache.config.maxSize) &&
      cache.entries.size > 0
    ) {
      this.evictEntry(cache);
    }
  }

  private evictEntry(cache: PromptCache): void {
    let keyToEvict: string | null = null;

    switch (cache.config.evictionPolicy) {
      case 'lru':
        keyToEvict = this.findLRUEntry(cache);
        break;
      case 'lfu':
        keyToEvict = this.findLFUEntry(cache);
        break;
      case 'fifo':
        keyToEvict = this.findFIFOEntry(cache);
        break;
      case 'ttl':
        keyToEvict = this.findExpiredEntry(cache);
        break;
    }

    if (keyToEvict) {
      const entry = cache.entries.get(keyToEvict)!;
      cache.statistics.totalSize -= entry.size;
      cache.statistics.evictedEntries++;
      cache.entries.delete(keyToEvict);
    }
  }

  private findLRUEntry(cache: PromptCache): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of cache.entries) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  private findLFUEntry(cache: PromptCache): string | null {
    let leastUsedKey: string | null = null;
    let leastUsedCount = Infinity;

    for (const [key, entry] of cache.entries) {
      if (entry.accessCount < leastUsedCount) {
        leastUsedCount = entry.accessCount;
        leastUsedKey = key;
      }
    }

    return leastUsedKey;
  }

  private findFIFOEntry(cache: PromptCache): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of cache.entries) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  private findExpiredEntry(cache: PromptCache): string | null {
    for (const [key, entry] of cache.entries) {
      if (this.isEntryExpired(entry, cache.config.ttl)) {
        return key;
      }
    }
    return this.findLRUEntry(cache); // Fallback to LRU if no expired entries
  }

  private estimateSavedTime(size: number): number {
    // Estimate saved time based on size (rough approximation)
    return size / 1000; // Assume 1ms per KB
  }

  private updateAverage(current: number, count: number, newValue: number): number {
    if (count === 1) return newValue;
    return (current * (count - 1) + newValue) / count;
  }

  private generateCacheId(): string {
    return `cache-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Helper functions to create cache keys
export function createCacheKey(prompt: string, model: string, parameters?: Partial<CacheParameters>): CacheKey {
  return {
    prompt,
    model,
    parameters: {
      temperature: parameters?.temperature || 0.7,
      topP: parameters?.topP || 0.9,
      topK: parameters?.topK || 40,
    },
  };
}

// Global prompt cache manager instance
const promptCacheManager = new PromptCacheManager();

export function createCache(name: string, config?: Partial<CacheConfig>): PromptCache {
  return promptCacheManager.createCache(name, config);
}

export function getCache(cacheId: string): PromptCache | undefined {
  return promptCacheManager.getCache(cacheId);
}

export function getAllCaches(): PromptCache[] {
  return promptCacheManager.getAllCaches();
}

export function deleteCache(cacheId: string): boolean {
  return promptCacheManager.deleteCache(cacheId);
}

export async function getOrCreate(
  cacheId: string,
  key: CacheKey,
  computeHandler: () => Promise<{ tokens: number[]; kvCache: KVCacheData }>
): Promise<CacheResult> {
  return promptCacheManager.getOrCreate(cacheId, key, computeHandler);
}

export function invalidate(cacheId: string, key: CacheKey): boolean {
  return promptCacheManager.invalidate(cacheId, key);
}

export function clearCache(cacheId: string): boolean {
  return promptCacheManager.clearCache(cacheId);
}

export function getStatistics(cacheId: string): CacheStatistics | undefined {
  return promptCacheManager.getStatistics(cacheId);
}

export function resetStatistics(cacheId: string): boolean {
  return promptCacheManager.resetStatistics(cacheId);
}

export function getEntries(cacheId: string, limit?: number): CacheEntry[] {
  return promptCacheManager.getEntries(cacheId, limit);
}
