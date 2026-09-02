/**
 * Context compression and compaction system
 * Inspired by Crush and OpenHands for cost reduction and performance optimization
 */

export interface ContextWindow {
  messages: ContextMessage[];
  totalTokens: number;
  maxTokens: number;
  compressionRatio: number;
}

export interface ContextMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens: number;
  timestamp: number;
  importance: number;
  compressed: boolean;
  summary?: string;
}

export interface CompressionStrategy {
  name: string;
  description: string;
  compress: (context: ContextWindow) => Promise<ContextWindow>;
}

export interface CompressionResult {
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
  timeElapsed: number;
  strategy: string;
}

export interface TokenUsage {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  timestamp: number;
}

export interface PromptCacheEntry {
  key: string;
  messages: ContextMessage[];
  tokens: number;
  timestamp: number;
  hitCount: number;
}

class ContextCompressor {
  private strategies: Map<string, CompressionStrategy> = new Map();
  private tokenUsage: TokenUsage[] = [];
  private promptCache: Map<string, PromptCacheEntry> = new Map();
  private maxCacheSize = 1000;
  private cacheTTL = 30 * 60 * 1000; // 30 minutes

  constructor() {
    this.initializeStrategies();
  }

  /**
   * Initialize compression strategies
   */
  private initializeStrategies(): void {
    // Strategy 1: Remove low-importance messages
    this.strategies.set('importance', {
      name: 'Importance-based pruning',
      description: 'Remove messages with low importance scores',
      compress: async (context) => this.compressByImportance(context),
    });

    // Strategy 2: Summarize old messages
    this.strategies.set('summarization', {
      name: 'Summarization',
      description: 'Summarize older messages to reduce token count',
      compress: async (context) => this.compressBySummarization(context),
    });

    // Strategy 3: Remove duplicates
    this.strategies.set('deduplication', {
      name: 'Deduplication',
      description: 'Remove duplicate or similar messages',
      compress: async (context) => this.compressByDeduplication(context),
    });

    // Strategy 4: Temporal pruning
    this.strategies.set('temporal', {
      name: 'Temporal pruning',
      description: 'Remove very old messages',
      compress: async (context) => this.compressByTemporal(context),
    });

    // Strategy 5: Hybrid approach
    this.strategies.set('hybrid', {
      name: 'Hybrid compression',
      description: 'Combine multiple strategies for optimal compression',
      compress: async (context) => this.compressHybrid(context),
    });
  }

  /**
   * Compress context using a specific strategy
   */
  async compress(
    context: ContextWindow,
    strategyName: string = 'hybrid'
  ): Promise<CompressionResult> {
    const strategy = this.strategies.get(strategyName);
    if (!strategy) {
      throw new Error(`Strategy ${strategyName} not found`);
    }

    const startTime = Date.now();
    const originalTokens = context.totalTokens;

    const compressed = await strategy.compress(context);
    const timeElapsed = Date.now() - startTime;

    const result: CompressionResult = {
      originalTokens,
      compressedTokens: compressed.totalTokens,
      compressionRatio: originalTokens > 0 ? compressed.totalTokens / originalTokens : 1,
      timeElapsed,
      strategy: strategyName,
    };

    return result;
  }

  /**
   * Estimate token count for text
   */
  estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate importance of a message
   */
  calculateImportance(message: ContextMessage): number {
    let importance = 0.5; // Base importance

    // System messages are important
    if (message.role === 'system') {
      importance += 0.3;
    }

    // Recent messages are more important
    const age = Date.now() - message.timestamp;
    const ageScore = Math.max(0, 1 - age / (24 * 60 * 60 * 1000)); // Decay over 24 hours
    importance += ageScore * 0.2;

    // Longer messages might be more important
    const lengthScore = Math.min(1, message.tokens / 1000);
    importance += lengthScore * 0.1;

    // Messages with tool calls are important
    if (message.content.includes('tool') || message.content.includes('function')) {
      importance += 0.2;
    }

    return Math.min(1, importance);
  }

  /**
   * Strategy: Compress by importance
   */
  private async compressByImportance(context: ContextWindow): Promise<ContextWindow> {
    const messages = [...context.messages];
    const targetTokens = context.maxTokens * 0.8; // Target 80% of max

    // Sort by importance (ascending)
    messages.sort((a, b) => a.importance - b.importance);

    // Remove low-importance messages until under target
    let currentTokens = messages.reduce((sum, m) => sum + m.tokens, 0);
    while (currentTokens > targetTokens && messages.length > 1) {
      const removed = messages.shift();
      if (removed) {
        currentTokens -= removed.tokens;
      }
    }

    // Sort back by timestamp
    messages.sort((a, b) => a.timestamp - b.timestamp);

    return {
      messages,
      totalTokens: currentTokens,
      maxTokens: context.maxTokens,
      compressionRatio: currentTokens / context.totalTokens,
    };
  }

  /**
   * Strategy: Compress by summarization
   */
  private async compressBySummarization(context: ContextWindow): Promise<ContextWindow> {
    const messages = [...context.messages];
    const targetTokens = context.maxTokens * 0.7;

    // Summarize older messages (first 50%)
    const splitIndex = Math.floor(messages.length / 2);
    const oldMessages = messages.slice(0, splitIndex);
    const recentMessages = messages.slice(splitIndex);

    for (const message of oldMessages) {
      if (!message.compressed && message.tokens > 100) {
        // Generate summary (in real implementation, use AI)
        message.summary = this.generateSummary(message.content);
        message.compressed = true;
        message.tokens = this.estimateTokens(message.summary);
      }
    }

    const totalTokens = oldMessages.reduce((sum, m) => sum + m.tokens, 0) +
                       recentMessages.reduce((sum, m) => sum + m.tokens, 0);

    return {
      messages: [...oldMessages, ...recentMessages],
      totalTokens,
      maxTokens: context.maxTokens,
      compressionRatio: totalTokens / context.totalTokens,
    };
  }

  /**
   * Strategy: Compress by deduplication
   */
  private async compressByDeduplication(context: ContextWindow): Promise<ContextWindow> {
    const messages = [...context.messages];
    const seen = new Set<string>();
    const uniqueMessages: ContextMessage[] = [];

    for (const message of messages) {
      const hash = this.hashContent(message.content);
      if (!seen.has(hash)) {
        seen.add(hash);
        uniqueMessages.push(message);
      }
    }

    const totalTokens = uniqueMessages.reduce((sum, m) => sum + m.tokens, 0);

    return {
      messages: uniqueMessages,
      totalTokens,
      maxTokens: context.maxTokens,
      compressionRatio: totalTokens / context.totalTokens,
    };
  }

  /**
   * Strategy: Compress by temporal pruning
   */
  private async compressByTemporal(context: ContextWindow): Promise<ContextWindow> {
    const messages = [...context.messages];
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago

    const recentMessages = messages.filter(m => m.timestamp > cutoff);
    const totalTokens = recentMessages.reduce((sum, m) => sum + m.tokens, 0);

    return {
      messages: recentMessages,
      totalTokens,
      maxTokens: context.maxTokens,
      compressionRatio: totalTokens / context.totalTokens,
    };
  }

  /**
   * Strategy: Hybrid compression
   */
  private async compressHybrid(context: ContextWindow): Promise<ContextWindow> {
    // Apply strategies in sequence
    let compressed = await this.compressByDeduplication(context);
    compressed = await this.compressByTemporal(compressed);
    compressed = await this.compressByImportance(compressed);

    return compressed;
  }

  /**
   * Generate a summary for content
   */
  private generateSummary(content: string): string {
    // In a real implementation, use AI to generate summary
    const lines = content.split('\n');
    if (lines.length <= 3) {
      return content;
    }
    return `[Summary: ${lines.length} lines of content]`;
  }

  /**
   * Hash content for deduplication
   */
  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  /**
   * Record token usage
   */
  recordTokenUsage(usage: TokenUsage): void {
    this.tokenUsage.push(usage);
  }

  /**
   * Get token usage statistics
   */
  getTokenUsageStats(provider?: string, model?: string): {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    totalCost: number;
    averageCostPerToken: number;
  } {
    let filtered = this.tokenUsage;

    if (provider) {
      filtered = filtered.filter(u => u.provider === provider);
    }

    if (model) {
      filtered = filtered.filter(u => u.model === model);
    }

    const totalInputTokens = filtered.reduce((sum, u) => sum + u.inputTokens, 0);
    const totalOutputTokens = filtered.reduce((sum, u) => sum + u.outputTokens, 0);
    const totalTokens = totalInputTokens + totalOutputTokens;
    const totalCost = filtered.reduce((sum, u) => sum + u.cost, 0);
    const averageCostPerToken = totalTokens > 0 ? totalCost / totalTokens : 0;

    return {
      totalInputTokens,
      totalOutputTokens,
      totalTokens,
      totalCost,
      averageCostPerToken,
    };
  }

  /**
   * Cache prompt
   */
  cachePrompt(key: string, messages: ContextMessage[]): void {
    const tokens = messages.reduce((sum, m) => sum + m.tokens, 0);

    // Remove oldest if cache is full
    if (this.promptCache.size >= this.maxCacheSize) {
      const oldest = Array.from(this.promptCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      this.promptCache.delete(oldest[0]);
    }

    this.promptCache.set(key, {
      key,
      messages,
      tokens,
      timestamp: Date.now(),
      hitCount: 0,
    });
  }

  /**
   * Get cached prompt
   */
  getCachedPrompt(key: string): ContextMessage[] | null {
    const entry = this.promptCache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.cacheTTL) {
      this.promptCache.delete(key);
      return null;
    }

    // Update hit count
    entry.hitCount++;

    return entry.messages;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    totalHits: number;
    totalTokensSaved: number;
  } {
    const entries = Array.from(this.promptCache.values());
    const totalHits = entries.reduce((sum, e) => sum + e.hitCount, 0);
    const totalTokens = entries.reduce((sum, e) => sum + e.tokens, 0);
    const hitRate = totalHits > 0 ? totalHits / (totalHits + this.promptCache.size) : 0;

    return {
      size: this.promptCache.size,
      hitRate,
      totalHits,
      totalTokensSaved: totalTokens * totalHits,
    };
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): number {
    const now = Date.now();
    let cleared = 0;

    for (const [key, entry] of this.promptCache) {
      if (now - entry.timestamp > this.cacheTTL) {
        this.promptCache.delete(key);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Get all compression strategies
   */
  getStrategies(): CompressionStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Optimize context window
   */
  optimizeContextWindow(
    messages: ContextMessage[],
    maxTokens: number
  ): ContextWindow {
    const totalTokens = messages.reduce((sum, m) => sum + m.tokens, 0);

    // Calculate importance for each message
    const messagesWithImportance = messages.map(m => ({
      ...m,
      importance: this.calculateImportance(m),
    }));

    return {
      messages: messagesWithImportance,
      totalTokens,
      maxTokens,
      compressionRatio: totalTokens / maxTokens,
    };
  }

  /**
   * Get compression statistics
   */
  getCompressionStats(): {
    totalCompressions: number;
    averageCompressionRatio: number;
    averageTimeElapsed: number;
    strategyUsage: Record<string, number>;
  } {
    // In a real implementation, track compression history
    return {
      totalCompressions: 0,
      averageCompressionRatio: 0,
      averageTimeElapsed: 0,
      strategyUsage: {},
    };
  }
}

// Global context compressor instance
const contextCompressor = new ContextCompressor();

export async function compress(
  context: ContextWindow,
  strategyName?: string
): Promise<CompressionResult> {
  return contextCompressor.compress(context, strategyName);
}

export function estimateTokens(text: string): number {
  return contextCompressor.estimateTokens(text);
}

export function calculateImportance(message: ContextMessage): number {
  return contextCompressor.calculateImportance(message);
}

export function recordTokenUsage(usage: TokenUsage): void {
  contextCompressor.recordTokenUsage(usage);
}

export function getTokenUsageStats(provider?: string, model?: string): {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  averageCostPerToken: number;
} {
  return contextCompressor.getTokenUsageStats(provider, model);
}

export function cachePrompt(key: string, messages: ContextMessage[]): void {
  contextCompressor.cachePrompt(key, messages);
}

export function getCachedPrompt(key: string): ContextMessage[] | null {
  return contextCompressor.getCachedPrompt(key);
}

export function getCacheStats(): {
  size: number;
  hitRate: number;
  totalHits: number;
  totalTokensSaved: number;
} {
  return contextCompressor.getCacheStats();
}

export function clearExpiredCache(): number {
  return contextCompressor.clearExpiredCache();
}

export function getStrategies(): CompressionStrategy[] {
  return contextCompressor.getStrategies();
}

export function optimizeContextWindow(
  messages: ContextMessage[],
  maxTokens: number
): ContextWindow {
  return contextCompressor.optimizeContextWindow(messages, maxTokens);
}

export function getCompressionStats(): {
  totalCompressions: number;
  averageCompressionRatio: number;
  averageTimeElapsed: number;
  strategyUsage: Record<string, number>;
} {
  return contextCompressor.getCompressionStats();
}
