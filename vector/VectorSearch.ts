/**
 * Vector search system for code - Semantic search using embeddings
 * Inspired by industry best practices for RAG and code understanding
 */

export interface CodeEmbedding {
  id: string;
  filePath: string;
  content: string;
  embedding: number[];
  language: string;
  type: EmbeddingType;
  metadata: EmbeddingMetadata;
  timestamp: number;
}

export type EmbeddingType = 
  | 'function'
  | 'class'
  | 'variable'
  | 'comment'
  | 'docstring'
  | 'import'
  | 'full-file';

export interface EmbeddingMetadata {
  lineStart: number;
  lineEnd: number;
  functionName?: string;
  className?: string;
  parameters?: string[];
  returnType?: string;
  tags: string[];
}

export interface SearchResult {
  embedding: CodeEmbedding;
  score: number;
  relevance: string;
}

export interface SearchQuery {
  query: string;
  language?: string;
  type?: EmbeddingType;
  limit?: number;
  threshold?: number;
}

export interface EmbeddingConfig {
  model: string;
  dimensions: number;
  batchSize: number;
  cacheEnabled: boolean;
}

class VectorSearchEngine {
  private embeddings: Map<string, CodeEmbedding> = new Map();
  private index: VectorIndex | null = null;
  private config: EmbeddingConfig;
  private cache: Map<string, number[]> = new Map();

  constructor(config?: Partial<EmbeddingConfig>) {
    this.config = {
      model: 'text-embedding-3-small',
      dimensions: 1536,
      batchSize: 100,
      cacheEnabled: true,
      ...config,
    };

    this.index = new VectorIndex(this.config.dimensions);
  }

  /**
   * Generate embedding for text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    // Check cache
    if (this.config.cacheEnabled) {
      const cached = this.cache.get(text);
      if (cached) return cached;
    }

    // In a real implementation, this would call an embedding API
    // For now, generate a mock embedding
    const embedding = this.generateMockEmbedding(text);

    // Cache result
    if (this.config.cacheEnabled) {
      this.cache.set(text, embedding);
    }

    return embedding;
  }

  /**
   * Generate embeddings for code
   */
  async generateCodeEmbeddings(
    filePath: string,
    content: string,
    language: string
  ): Promise<CodeEmbedding[]> {
    const embeddings: CodeEmbedding[] = [];

    // Extract different code elements
    const functions = this.extractFunctions(content, language);
    const classes = this.extractClasses(content, language);
    const comments = this.extractComments(content, language);
    const imports = this.extractImports(content, language);

    // Generate embeddings for functions
    for (const func of functions) {
      const embeddingVector = await this.generateEmbedding(func.content);
      const embedding: CodeEmbedding = {
        id: this.generateId(),
        filePath,
        content: func.content,
        embedding: embeddingVector,
        language,
        type: 'function',
        metadata: {
          lineStart: func.lineStart,
          lineEnd: func.lineEnd,
          functionName: func.name,
          parameters: func.parameters,
          returnType: func.returnType,
          tags: ['function', func.name],
        },
        timestamp: Date.now(),
      };
      embeddings.push(embedding);
    }

    // Generate embeddings for classes
    for (const cls of classes) {
      const embeddingVector = await this.generateEmbedding(cls.content);
      const embedding: CodeEmbedding = {
        id: this.generateId(),
        filePath,
        content: cls.content,
        embedding: embeddingVector,
        language,
        type: 'class',
        metadata: {
          lineStart: cls.lineStart,
          lineEnd: cls.lineEnd,
          className: cls.name,
          tags: ['class', cls.name],
        },
        timestamp: Date.now(),
      };
      embeddings.push(embedding);
    }

    // Generate embedding for full file
    const fileEmbeddingVector = await this.generateEmbedding(content);
    const fileEmbedding: CodeEmbedding = {
      id: this.generateId(),
      filePath,
      content,
      embedding: fileEmbeddingVector,
      language,
      type: 'full-file',
      metadata: {
        lineStart: 1,
        lineEnd: content.split('\n').length,
        tags: ['file', filePath],
      },
      timestamp: Date.now(),
    };
    embeddings.push(fileEmbedding);

    return embeddings;
  }

  /**
   * Add embedding to index
   */
  addEmbedding(embedding: CodeEmbedding): void {
    this.embeddings.set(embedding.id, embedding);
    this.index?.add(embedding.id, embedding.embedding);
  }

  /**
   * Add multiple embeddings
   */
  addEmbeddings(embeddings: CodeEmbedding[]): void {
    for (const embedding of embeddings) {
      this.addEmbedding(embedding);
    }
  }

  /**
   * Search for similar code
   */
  async search(query: SearchQuery): Promise<SearchResult[]> {
    const queryEmbedding = await this.generateEmbedding(query.query);
    
    if (!this.index) {
      return [];
    }

    const results = this.index.search(queryEmbedding, query.limit || 10);

    // Filter by language if specified
    let filtered = results;
    if (query.language) {
      filtered = results.filter(r => {
        const embedding = this.embeddings.get(r.id);
        return embedding?.language === query.language;
      });
    }

    // Filter by type if specified
    if (query.type) {
      filtered = filtered.filter(r => {
        const embedding = this.embeddings.get(r.id);
        return embedding?.type === query.type;
      });
    }

    // Filter by threshold if specified
    if (query.threshold) {
      filtered = filtered.filter(r => r.score >= query.threshold!);
    }

    // Convert to search results
    return filtered.map(r => {
      const embedding = this.embeddings.get(r.id);
      if (!embedding) {
        throw new Error(`Embedding ${r.id} not found`);
      }

      return {
        embedding,
        score: r.score,
        relevance: this.calculateRelevance(r.score),
      };
    });
  }

  /**
   * Search by file path
   */
  searchByPath(filePath: string, limit: number = 10): SearchResult[] {
    const results: SearchResult[] = [];

    for (const embedding of this.embeddings.values()) {
      if (embedding.filePath === filePath) {
        results.push({
          embedding,
          score: 1.0,
          relevance: 'exact match',
        });
      }
    }

    return results.slice(0, limit);
  }

  /**
   * Get embedding by ID
   */
  getEmbedding(id: string): CodeEmbedding | undefined {
    return this.embeddings.get(id);
  }

  /**
   * Get all embeddings
   */
  getAllEmbeddings(): CodeEmbedding[] {
    return Array.from(this.embeddings.values());
  }

  /**
   * Get embeddings by file path
   */
  getEmbeddingsByPath(filePath: string): CodeEmbedding[] {
    return Array.from(this.embeddings.values()).filter(e => e.filePath === filePath);
  }

  /**
   * Get embeddings by language
   */
  getEmbeddingsByLanguage(language: string): CodeEmbedding[] {
    return Array.from(this.embeddings.values()).filter(e => e.language === language);
  }

  /**
   * Get embeddings by type
   */
  getEmbeddingsByType(type: EmbeddingType): CodeEmbedding[] {
    return Array.from(this.embeddings.values()).filter(e => e.type === type);
  }

  /**
   * Delete embedding
   */
  deleteEmbedding(id: string): boolean {
    this.index?.remove(id);
    return this.embeddings.delete(id);
  }

  /**
   * Delete embeddings by file path
   */
  deleteEmbeddingsByPath(filePath: string): number {
    let deleted = 0;

    for (const [id, embedding] of this.embeddings) {
      if (embedding.filePath === filePath) {
        this.deleteEmbedding(id);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Clear all embeddings
   */
  clear(): void {
    this.embeddings.clear();
    this.index?.clear();
    this.cache.clear();
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalEmbeddings: number;
    embeddingsByLanguage: Record<string, number>;
    embeddingsByType: Record<EmbeddingType, number>;
    cacheSize: number;
    indexSize: number;
  } {
    const embeddingsByLanguage: Record<string, number> = {};
    const embeddingsByType: Record<EmbeddingType, number> = {} as any;

    for (const embedding of this.embeddings.values()) {
      embeddingsByLanguage[embedding.language] = (embeddingsByLanguage[embedding.language] || 0) + 1;
      embeddingsByType[embedding.type] = (embeddingsByType[embedding.type] || 0) + 1;
    }

    return {
      totalEmbeddings: this.embeddings.size,
      embeddingsByLanguage,
      embeddingsByType,
      cacheSize: this.cache.size,
      indexSize: this.index?.size() || 0,
    };
  }

  // Private methods

  private generateMockEmbedding(text: string): number[] {
    // Generate a deterministic mock embedding based on text
    const dimensions = this.config.dimensions;
    const embedding: number[] = [];

    for (let i = 0; i < dimensions; i++) {
      const charCode = text.charCodeAt(i % text.length);
      embedding.push((Math.sin(charCode + i) + 1) / 2);
    }

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return embedding.map(v => v / magnitude);
  }

  private extractFunctions(content: string, language: string): Array<{
    content: string;
    name: string;
    lineStart: number;
    lineEnd: number;
    parameters?: string[];
    returnType?: string;
  }> {
    // In a real implementation, this would use AST parsing
    // For now, return mock data
    const lines = content.split('\n');
    const functions: any[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('function ') || line.includes('def ') || line.includes('func ')) {
        functions.push({
          content: line,
          name: 'mock_function',
          lineStart: i + 1,
          lineEnd: i + 1,
          parameters: [],
          returnType: 'void',
        });
      }
    }

    return functions;
  }

  private extractClasses(content: string, language: string): Array<{
    content: string;
    name: string;
    lineStart: number;
    lineEnd: number;
  }> {
    // In a real implementation, this would use AST parsing
    const lines = content.split('\n');
    const classes: any[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('class ')) {
        classes.push({
          content: line,
          name: 'MockClass',
          lineStart: i + 1,
          lineEnd: i + 1,
        });
      }
    }

    return classes;
  }

  private extractComments(content: string, language: string): Array<{
    content: string;
    lineStart: number;
    lineEnd: number;
  }> {
    // In a real implementation, this would extract comments
    return [];
  }

  private extractImports(content: string, language: string): Array<{
    content: string;
    lineStart: number;
    lineEnd: number;
  }> {
    // In a real implementation, this would extract imports
    return [];
  }

  private calculateRelevance(score: number): string {
    if (score > 0.9) return 'very high';
    if (score > 0.7) return 'high';
    if (score > 0.5) return 'medium';
    if (score > 0.3) return 'low';
    return 'very low';
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

class VectorIndex {
  private vectors: Map<string, number[]> = new Map();
  private dimensions: number;

  constructor(dimensions: number) {
    this.dimensions = dimensions;
  }

  add(id: string, vector: number[]): void {
    if (vector.length !== this.dimensions) {
      throw new Error(`Vector dimension mismatch: expected ${this.dimensions}, got ${vector.length}`);
    }
    this.vectors.set(id, vector);
  }

  remove(id: string): void {
    this.vectors.delete(id);
  }

  search(query: number[], limit: number = 10): Array<{ id: string; score: number }> {
    const results: Array<{ id: string; score: number }> = [];

    for (const [id, vector] of this.vectors) {
      const score = this.cosineSimilarity(query, vector);
      results.push({ id, score });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  size(): number {
    return this.vectors.size;
  }

  clear(): void {
    this.vectors.clear();
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
  }
}

// Global vector search engine instance
const vectorSearchEngine = new VectorSearchEngine();

export async function generateEmbedding(text: string): Promise<number[]> {
  return vectorSearchEngine.generateEmbedding(text);
}

export async function generateCodeEmbeddings(
  filePath: string,
  content: string,
  language: string
): Promise<CodeEmbedding[]> {
  return vectorSearchEngine.generateCodeEmbeddings(filePath, content, language);
}

export function addEmbedding(embedding: CodeEmbedding): void {
  vectorSearchEngine.addEmbedding(embedding);
}

export function addEmbeddings(embeddings: CodeEmbedding[]): void {
  vectorSearchEngine.addEmbeddings(embeddings);
}

export async function search(query: SearchQuery): Promise<SearchResult[]> {
  return vectorSearchEngine.search(query);
}

export function searchByPath(filePath: string, limit?: number): SearchResult[] {
  return vectorSearchEngine.searchByPath(filePath, limit);
}

export function getEmbedding(id: string): CodeEmbedding | undefined {
  return vectorSearchEngine.getEmbedding(id);
}

export function getAllEmbeddings(): CodeEmbedding[] {
  return vectorSearchEngine.getAllEmbeddings();
}

export function getEmbeddingsByPath(filePath: string): CodeEmbedding[] {
  return vectorSearchEngine.getEmbeddingsByPath(filePath);
}

export function getEmbeddingsByLanguage(language: string): CodeEmbedding[] {
  return vectorSearchEngine.getEmbeddingsByLanguage(language);
}

export function getEmbeddingsByType(type: EmbeddingType): CodeEmbedding[] {
  return vectorSearchEngine.getEmbeddingsByType(type);
}

export function deleteEmbedding(id: string): boolean {
  return vectorSearchEngine.deleteEmbedding(id);
}

export function deleteEmbeddingsByPath(filePath: string): number {
  return vectorSearchEngine.deleteEmbeddingsByPath(filePath);
}

export function clear(): void {
  vectorSearchEngine.clear();
}

export function getStatistics(): {
  totalEmbeddings: number;
  embeddingsByLanguage: Record<string, number>;
  embeddingsByType: Record<EmbeddingType, number>;
  cacheSize: number;
  indexSize: number;
} {
  return vectorSearchEngine.getStatistics();
}
