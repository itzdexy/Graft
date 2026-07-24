/**
 * Observational Memory
 * Inspired by Mastra's human-like working memory system
 * Provides semantic recall across conversations, context-aware memory retrieval,
 * and memory consolidation for more coherent agent behavior over time
 */

export interface Memory {
  id: string;
  content: string;
  type: MemoryType;
  importance: number;
  timestamp: number;
  source: MemorySource;
  context: MemoryContext;
  embeddings?: number[];
  associations: MemoryAssociation[];
  accessCount: number;
  lastAccessed?: number;
  consolidationLevel: number;
  metadata: MemoryMetadata;
}

export type MemoryType =
  | 'fact'
  | 'preference'
  | 'pattern'
  | 'relationship'
  | 'event'
  | 'conversation'
  | 'code'
  | 'project'
  | 'user_behavior'
  | 'system_state';

export type MemorySource =
  | 'user_input'
  | 'agent_output'
  | 'tool_result'
  | 'file_analysis'
  | 'code_change'
  | 'conversation_history'
  | 'external_api'
  | 'system_event';

export interface MemoryContext {
  sessionId: string;
  userId?: string;
  projectId?: string;
  fileContext?: string[];
  language?: string;
  tags: string[];
}

export interface MemoryAssociation {
  memoryId: string;
  strength: number;
  type: AssociationType;
}

export type AssociationType =
  | 'causal'
  | 'temporal'
  | 'semantic'
  | 'spatial'
  | 'hierarchical'
  | 'related';

export interface MemoryMetadata {
  confidence: number;
  verified: boolean;
  expiresAt?: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  sourceDetails?: Record<string, unknown>;
}

export interface MemoryQuery {
  query: string;
  context?: MemoryContext;
  type?: MemoryType;
  minImportance?: number;
  maxResults?: number;
  timeRange?: TimeRange;
  includeAssociations?: boolean;
}

export interface TimeRange {
  start?: number;
  end?: number;
}

export interface MemorySearchResult {
  memory: Memory;
  relevanceScore: number;
  associations?: Memory[];
}

export interface MemoryConsolidationResult {
  consolidatedMemories: Memory[];
  mergedMemories: Memory[];
  deletedMemories: Memory[];
  statistics: ConsolidationStatistics;
}

export interface ConsolidationStatistics {
  totalProcessed: number;
  totalConsolidated: number;
  totalMerged: number;
  totalDeleted: number;
  timeTaken: number;
}

export interface MemoryRetrievalResult {
  memories: Memory[];
  query: string;
  context: MemoryContext;
  totalFound: number;
  retrievalTime: number;
  metadata: RetrievalMetadata;
}

export interface RetrievalMetadata {
  usedCache: boolean;
  usedEmbeddings: boolean;
  filtersApplied: string[];
}

class ObservationalMemory {
  private memories: Map<string, Memory> = new Map();
  private associations: Map<string, MemoryAssociation[]> = new Map();
  private embeddings: Map<string, number[]> = new Map();
  private consolidationThreshold: number = 0.7;
  private maxMemories: number = 10000;
  private embeddingModel: EmbeddingModel;

  constructor(embeddingModel?: EmbeddingModel) {
    this.embeddingModel = embeddingModel || new SimpleEmbeddingModel();
  }

  /**
   * Add a memory
   */
  async addMemory(memory: Memory): Promise<void> {
    // Generate embedding
    if (!memory.embeddings) {
      memory.embeddings = await this.embeddingModel.embed(memory.content);
    }

    this.memories.set(memory.id, memory);

    // Check for similar memories and create associations
    await this.createAssociations(memory);

    // Check if we need to consolidate
    if (this.memories.size > this.maxMemories) {
      await this.consolidateMemories();
    }
  }

  /**
   * Get a memory by ID
   */
  getMemory(memoryId: string): Memory | undefined {
    const memory = this.memories.get(memoryId);
    if (memory) {
      memory.accessCount++;
      memory.lastAccessed = Date.now();
    }
    return memory;
  }

  /**
   * Get all memories
   */
  getAllMemories(): Memory[] {
    return Array.from(this.memories.values());
  }

  /**
   * Get memories by type
   */
  getMemoriesByType(type: MemoryType): Memory[] {
    return this.getAllMemories().filter(m => m.type === type);
  }

  /**
   * Get memories by context
   */
  getMemoriesByContext(context: Partial<MemoryContext>): Memory[] {
    return this.getAllMemories().filter(m => {
      if (context.sessionId && m.context.sessionId !== context.sessionId) return false;
      if (context.userId && m.context.userId !== context.userId) return false;
      if (context.projectId && m.context.projectId !== context.projectId) return false;
      if (context.language && m.context.language !== context.language) return false;
      return true;
    });
  }

  /**
   * Search memories
   */
  async searchMemories(query: MemoryQuery): Promise<MemoryRetrievalResult> {
    const startTime = Date.now();
    const filtersApplied: string[] = [];

    let memories = this.getAllMemories();

    // Apply filters
    if (query.type) {
      memories = memories.filter(m => m.type === query.type);
      filtersApplied.push('type');
    }

    if (query.minImportance !== undefined) {
      memories = memories.filter(m => m.importance >= query.minImportance!);
      filtersApplied.push('importance');
    }

    if (query.timeRange) {
      memories = memories.filter(m => {
        if (query.timeRange!.start && m.timestamp < query.timeRange!.start) return false;
        if (query.timeRange!.end && m.timestamp > query.timeRange!.end) return false;
        return true;
      });
      filtersApplied.push('timeRange');
    }

    if (query.context) {
      memories = memories.filter(m => {
        if (query.context!.sessionId && m.context.sessionId !== query.context!.sessionId) return false;
        if (query.context!.userId && m.context.userId !== query.context!.userId) return false;
        if (query.context!.projectId && m.context.projectId !== query.context!.projectId) return false;
        return true;
      });
      filtersApplied.push('context');
    }

    // Calculate relevance scores
    const queryEmbedding = await this.embeddingModel.embed(query.query);
    const results: MemorySearchResult[] = [];

    for (const memory of memories) {
      let relevanceScore = 0;

      // Semantic similarity
      if (memory.embeddings) {
        const similarity = this.cosineSimilarity(queryEmbedding, memory.embeddings);
        relevanceScore += similarity * 0.5;
      }

      // Text similarity
      const textSimilarity = this.textSimilarity(query.query, memory.content);
      relevanceScore += textSimilarity * 0.3;

      // Importance boost
      relevanceScore += memory.importance * 0.2;

      // Recency boost
      const recency = Math.exp(-(Date.now() - memory.timestamp) / (30 * 24 * 60 * 60 * 1000));
      relevanceScore += recency * 0.1;

      results.push({
        memory,
        relevanceScore,
      });
    }

    // Sort by relevance
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Limit results
    const maxResults = query.maxResults || 10;
    const topResults = results.slice(0, maxResults);

    // Include associations if requested
    if (query.includeAssociations) {
      for (const result of topResults) {
        result.associations = await this.getAssociatedMemories(result.memory.id);
      }
    }

    const retrievalTime = Date.now() - startTime;

    return {
      memories: topResults.map(r => r.memory),
      query: query.query,
      context: query.context || { sessionId: '', tags: [] },
      totalFound: memories.length,
      retrievalTime,
      metadata: {
        usedCache: false,
        usedEmbeddings: true,
        filtersApplied,
      },
    };
  }

  /**
   * Update a memory
   */
  async updateMemory(memoryId: string, updates: Partial<Memory>): Promise<boolean> {
    const memory = this.memories.get(memoryId);
    if (!memory) return false;

    // Update fields
    Object.assign(memory, updates);

    // Re-generate embedding if content changed
    if (updates.content) {
      memory.embeddings = await this.embeddingModel.embed(updates.content);
    }

    return true;
  }

  /**
   * Delete a memory
   */
  deleteMemory(memoryId: string): boolean {
    const memory = this.memories.get(memoryId);
    if (!memory) return false;

    // Remove associations
    for (const association of memory.associations) {
      const otherMemory = this.memories.get(association.memoryId);
      if (otherMemory) {
        otherMemory.associations = otherMemory.associations.filter(
          a => a.memoryId !== memoryId
        );
      }
    }

    return this.memories.delete(memoryId);
  }

  /**
   * Consolidate memories
   */
  async consolidateMemories(): Promise<MemoryConsolidationResult> {
    const startTime = Date.now();
    const consolidatedMemories: Memory[] = [];
    const mergedMemories: Memory[] = [];
    const deletedMemories: Memory[] = [];

    const memories = this.getAllMemories();
    const toDelete: string[] = [];

    // Find similar memories to merge
    for (const memory of memories) {
      if (toDelete.includes(memory.id)) continue;

      const similar = await this.findSimilarMemories(memory, 0.9);
      if (similar.length > 0) {
        // Merge memories
        const merged = await this.mergeMemories([memory, ...similar]);
        mergedMemories.push(merged);

        // Mark originals for deletion
        toDelete.push(memory.id);
        for (const sim of similar) {
          toDelete.push(sim.id);
        }

        consolidatedMemories.push(merged);
      }
    }

    // Delete old memories
    for (const id of toDelete) {
      const memory = this.memories.get(id);
      if (memory) {
        deletedMemories.push(memory);
        this.deleteMemory(id);
      }
    }

    // Delete low-importance memories if over limit
    const sortedByImportance = this.getAllMemories().sort((a, b) => a.importance - b.importance);
    const toDeleteCount = this.memories.size - this.maxMemories;

    for (let i = 0; i < toDeleteCount; i++) {
      const memory = sortedByImportance[i];
      if (memory.importance < this.consolidationThreshold) {
        deletedMemories.push(memory);
        this.deleteMemory(memory.id);
      }
    }

    const timeTaken = Date.now() - startTime;

    return {
      consolidatedMemories,
      mergedMemories,
      deletedMemories,
      statistics: {
        totalProcessed: memories.length,
        totalConsolidated: consolidatedMemories.length,
        totalMerged: mergedMemories.length,
        totalDeleted: deletedMemories.length,
        timeTaken,
      },
    };
  }

  /**
   * Get associated memories
   */
  async getAssociatedMemories(memoryId: string): Promise<Memory[]> {
    const memory = this.memories.get(memoryId);
    if (!memory) return [];

    const associated: Memory[] = [];
    for (const association of memory.associations) {
      const assocMemory = this.memories.get(association.memoryId);
      if (assocMemory) {
        associated.push(assocMemory);
      }
    }

    return associated;
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalMemories: number;
    memoriesByType: Record<MemoryType, number>;
    memoriesBySource: Record<MemorySource, number>;
    averageImportance: number;
    totalAssociations: number;
    mostAccessedMemories: Memory[];
    consolidationThreshold: number;
  } {
    const memories = this.getAllMemories();

    const memoriesByType: Record<MemoryType, number> = {} as any;
    const memoriesBySource: Record<MemorySource, number> = {} as any;

    for (const memory of memories) {
      memoriesByType[memory.type] = (memoriesByType[memory.type] || 0) + 1;
      memoriesBySource[memory.source] = (memoriesBySource[memory.source] || 0) + 1;
    }

    const totalAssociations = Array.from(this.associations.values()).reduce(
      (sum, assocs) => sum + assocs.length,
      0
    );

    const averageImportance = memories.length > 0
      ? memories.reduce((sum, m) => sum + m.importance, 0) / memories.length
      : 0;

    const mostAccessedMemories = [...memories]
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 5);

    return {
      totalMemories: memories.length,
      memoriesByType,
      memoriesBySource,
      averageImportance,
      totalAssociations,
      mostAccessedMemories,
      consolidationThreshold: this.consolidationThreshold,
    };
  }

  /**
   * Set consolidation threshold
   */
  setConsolidationThreshold(threshold: number): void {
    this.consolidationThreshold = Math.max(0, Math.min(1, threshold));
  }

  /**
   * Set max memories
   */
  setMaxMemories(max: number): void {
    this.maxMemories = max;
  }

  // Private methods

  private async createAssociations(memory: Memory): Promise<void> {
    const similar = await this.findSimilarMemories(memory, 0.7);

    for (const sim of similar) {
      const association: MemoryAssociation = {
        memoryId: sim.id,
        strength: 0.5,
        type: 'semantic',
      };

      memory.associations.push(association);

      // Create bidirectional association
      const reverseAssociation: MemoryAssociation = {
        memoryId: memory.id,
        strength: 0.5,
        type: 'semantic',
      };

      sim.associations.push(reverseAssociation);
    }
  }

  private async findSimilarMemories(memory: Memory, threshold: number): Promise<Memory[]> {
    if (!memory.embeddings) return [];

    const similar: Memory[] = [];

    for (const other of this.getAllMemories()) {
      if (other.id === memory.id) continue;
      if (!other.embeddings) continue;

      const similarity = this.cosineSimilarity(memory.embeddings, other.embeddings);
      if (similarity >= threshold) {
        similar.push(other);
      }
    }

    return similar;
  }

  private async mergeMemories(memories: Memory[]): Promise<Memory> {
    // Combine content
    const content = memories.map(m => m.content).join('\n\n');

    // Average importance
    const importance = memories.reduce((sum, m) => sum + m.importance, 0) / memories.length;

    // Combine associations
    const associations: MemoryAssociation[] = [];
    for (const memory of memories) {
      associations.push(...memory.associations);
    }

    // Remove self-associations
    const memoryIds = memories.map(m => m.id);
    const filteredAssociations = associations.filter(
      a => !memoryIds.includes(a.memoryId)
    );

    const merged: Memory = {
      id: this.generateMemoryId(),
      content,
      type: memories[0].type,
      importance,
      timestamp: Date.now(),
      source: memories[0].source,
      context: memories[0].context,
      embeddings: await this.embeddingModel.embed(content),
      associations: filteredAssociations,
      accessCount: 0,
      consolidationLevel: memories.reduce((sum, m) => sum + m.consolidationLevel, 0) + 1,
      metadata: {
        confidence: memories.reduce((sum, m) => sum + m.metadata.confidence, 0) / memories.length,
        verified: memories.every(m => m.metadata.verified),
        priority: memories[0].metadata.priority,
      },
    };

    return merged;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private textSimilarity(query: string, content: string): number {
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();

    // Exact match
    if (contentLower.includes(queryLower)) {
      return 1.0;
    }

    // Word overlap
    const queryWords = queryLower.split(/\s+/);
    const contentWords = contentLower.split(/\s+/);

    const overlap = queryWords.filter(word => contentWords.includes(word)).length;
    const similarity = overlap / Math.max(queryWords.length, 1);

    return similarity;
  }

  private generateMemoryId(): string {
    return `memory-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

interface EmbeddingModel {
  embed(text: string): Promise<number[]>;
}

class SimpleEmbeddingModel implements EmbeddingModel {
  private dimension: number = 128;

  async embed(text: string): Promise<number[]> {
    // Simple hash-based embedding for demonstration
    const embedding: number[] = [];
    const hash = this.hashString(text);

    for (let i = 0; i < this.dimension; i++) {
      embedding.push(Math.sin(hash + i) * 0.5 + 0.5);
    }

    return embedding;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

// Global observational memory instance
const observationalMemory = new ObservationalMemory();

export async function addMemory(memory: Memory): Promise<void> {
  return observationalMemory.addMemory(memory);
}

export function getMemory(memoryId: string): Memory | undefined {
  return observationalMemory.getMemory(memoryId);
}

export function getAllMemories(): Memory[] {
  return observationalMemory.getAllMemories();
}

export function getMemoriesByType(type: MemoryType): Memory[] {
  return observationalMemory.getMemoriesByType(type);
}

export function getMemoriesByContext(context: Partial<MemoryContext>): Memory[] {
  return observationalMemory.getMemoriesByContext(context);
}

export async function searchMemories(query: MemoryQuery): Promise<MemoryRetrievalResult> {
  return observationalMemory.searchMemories(query);
}

export async function updateMemory(memoryId: string, updates: Partial<Memory>): Promise<boolean> {
  return observationalMemory.updateMemory(memoryId, updates);
}

export function deleteMemory(memoryId: string): boolean {
  return observationalMemory.deleteMemory(memoryId);
}

export async function consolidateMemories(): Promise<MemoryConsolidationResult> {
  return observationalMemory.consolidateMemories();
}

export async function getAssociatedMemories(memoryId: string): Promise<Memory[]> {
  return observationalMemory.getAssociatedMemories(memoryId);
}

export function getStatistics(): {
  totalMemories: number;
  memoriesByType: Record<MemoryType, number>;
  memoriesBySource: Record<MemorySource, number>;
  averageImportance: number;
  totalAssociations: number;
  mostAccessedMemories: Memory[];
  consolidationThreshold: number;
} {
  return observationalMemory.getStatistics();
}

export function setConsolidationThreshold(threshold: number): void {
  observationalMemory.setConsolidationThreshold(threshold);
}

export function setMaxMemories(max: number): void {
  observationalMemory.setMaxMemories(max);
}
