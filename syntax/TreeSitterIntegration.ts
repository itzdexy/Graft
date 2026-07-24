/**
 * Tree-Sitter Integration
 * Inspired by Aider's tree-sitter integration for code understanding and manipulation
 * Provides syntax-aware code parsing, analysis, and transformation
 */

export interface TreeSitterParser {
  id: string;
  name: string;
  language: Language;
  parser: Parser;
  queries: Map<string, Query>;
  config: ParserConfig;
  statistics: ParserStatistics;
  metadata: ParserMetadata;
}

export interface Language {
  id: string;
  name: string;
  fileExtensions: string[];
  highlights?: string;
  injections?: string;
  locals?: string;
}

export interface Parser {
  parse: (source: string) => SyntaxTree;
  parseWithOffset: (source: string, offset: number) => SyntaxTree;
  getIncludedRanges: () => Range[];
  reset: () => void;
}

export interface SyntaxTree {
  rootNode: SyntaxNode;
  source: string;
  language: string;
  includedRanges: Range[];
}

export interface SyntaxNode {
  id: string;
  type: string;
  startPosition: Position;
  endPosition: Position;
  children: SyntaxNode[];
  parent: SyntaxNode | null;
  named: boolean;
  isMissing: boolean;
  isExtra: boolean;
  fieldNames: string[];
  text: string;
}

export interface Position {
  row: number;
  column: number;
}

export interface Range {
  startPosition: Position;
  endPosition: Position;
}

export interface Query {
  id: string;
  pattern: string;
  captures: Capture[];
  match: (tree: SyntaxTree) => QueryMatch[];
}

export interface Capture {
  name: string;
  index: number;
}

export interface QueryMatch {
  id: string;
  pattern: number;
  captures: CaptureMatch[];
}

export interface CaptureMatch {
  name: string;
  node: SyntaxNode;
}

export interface ParserConfig {
  enableCaching: boolean;
  enableErrorRecovery: boolean;
  maxTreeDepth: number;
  timeout: number;
}

export interface ParserStatistics {
  totalParses: number;
  successfulParses: number;
  failedParses: number;
  averageParseTime: number;
  cacheHits: number;
  cacheMisses: number;
  totalNodes: number;
}

export interface ParserMetadata {
  version: string;
  createdAt: number;
  updatedAt: number;
  totalOperations: number;
}

export interface CodeEdit {
  range: Range;
  newText: string;
  oldText: string;
}

export interface CodeTransformation {
  edits: CodeEdit[];
  summary: string;
}

class TreeSitterManager {
  private parsers: Map<string, TreeSitterParser> = new Map();
  private cache: Map<string, SyntaxTree> = new Map();

  /**
   * Create a tree-sitter parser
   */
  createParser(language: Language, config?: Partial<ParserConfig>): TreeSitterParser {
    const parser: TreeSitterParser = {
      id: this.generateParserId(),
      name: language.name,
      language,
      parser: this.createMockParser(language),
      queries: new Map(),
      config: {
        enableCaching: config?.enableCaching ?? true,
        enableErrorRecovery: config?.enableErrorRecovery ?? true,
        maxTreeDepth: config?.maxTreeDepth || 1000,
        timeout: config?.timeout || 5000,
      },
      statistics: {
        totalParses: 0,
        successfulParses: 0,
        failedParses: 0,
        averageParseTime: 0,
        cacheHits: 0,
        cacheMisses: 0,
        totalNodes: 0,
      },
      metadata: {
        version: '1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        totalOperations: 0,
      },
    };

    this.parsers.set(parser.id, parser);
    return parser;
  }

  /**
   * Get a parser
   */
  getParser(parserId: string): TreeSitterParser | undefined {
    return this.parsers.get(parserId);
  }

  /**
   * Get all parsers
   */
  getAllParsers(): TreeSitterParser[] {
    return Array.from(this.parsers.values());
  }

  /**
   * Delete a parser
   */
  deleteParser(parserId: string): boolean {
    return this.parsers.delete(parserId);
  }

  /**
   * Parse source code
   */
  async parse(parserId: string, source: string): Promise<SyntaxTree> {
    const parser = this.parsers.get(parserId);
    if (!parser) {
      throw new Error(`Parser ${parserId} not found`);
    }

    // Check cache
    const cacheKey = this.generateCacheKey(parserId, source);
    if (parser.config.enableCaching && this.cache.has(cacheKey)) {
      parser.statistics.cacheHits++;
      return this.cache.get(cacheKey)!;
    }

    const startTime = Date.now();

    try {
      const tree = parser.parser.parse(source);

      // Count nodes
      const nodeCount = this.countNodes(tree.rootNode);
      parser.statistics.totalNodes += nodeCount;

      // Cache result
      if (parser.config.enableCaching) {
        this.cache.set(cacheKey, tree);
        parser.statistics.cacheMisses++;
      }

      parser.statistics.totalParses++;
      parser.statistics.successfulParses++;
      parser.statistics.averageParseTime =
        this.updateAverage(parser.statistics.averageParseTime, parser.statistics.totalParses, Date.now() - startTime);

      parser.metadata.totalOperations++;
      parser.metadata.updatedAt = Date.now();

      return tree;

    } catch (error) {
      parser.statistics.totalParses++;
      parser.statistics.failedParses++;
      throw error;
    }
  }

  /**
   * Add a query to a parser
   */
  addQuery(parserId: string, query: Query): boolean {
    const parser = this.parsers.get(parserId);
    if (!parser) return false;

    parser.queries.set(query.id, query);
    parser.metadata.updatedAt = Date.now();

    return true;
  }

  /**
   * Execute a query on a tree
   */
  executeQuery(parserId: string, queryId: string, tree: SyntaxTree): QueryMatch[] {
    const parser = this.parsers.get(parserId);
    if (!parser) {
      throw new Error(`Parser ${parserId} not found`);
    }

    const query = parser.queries.get(queryId);
    if (!query) {
      throw new Error(`Query ${queryId} not found`);
    }

    return query.match(tree);
  }

  /**
   * Find nodes by type
   */
  findNodesByType(tree: SyntaxTree, nodeType: string): SyntaxNode[] {
    const results: SyntaxNode[] = [];
    this.traverseTree(tree.rootNode, node => {
      if (node.type === nodeType) {
        results.push(node);
      }
    });
    return results;
  }

  /**
   * Find node at position
   */
  findNodeAtPosition(tree: SyntaxTree, position: Position): SyntaxNode | null {
    return this.findNodeAt(tree.rootNode, position);
  }

  /**
   * Get node text
   */
  getNodeText(node: SyntaxNode, source: string): string {
    return source.substring(
      this.positionToOffset(node.startPosition, source),
      this.positionToOffset(node.endPosition, source)
    );
  }

  /**
   * Apply code transformation
   */
  applyTransformation(source: string, transformation: CodeTransformation): string {
    let result = source;

    // Sort edits by position (reverse order to avoid offset issues)
    const sortedEdits = [...transformation.edits].sort((a, b) => {
      const aOffset = this.positionToOffset(a.range.startPosition, source);
      const bOffset = this.positionToOffset(b.range.startPosition, source);
      return bOffset - aOffset;
    });

    for (const edit of sortedEdits) {
      const startOffset = this.positionToOffset(edit.range.startPosition, source);
      const endOffset = this.positionToOffset(edit.range.endPosition, source);

      result = result.substring(0, startOffset) + edit.newText + result.substring(endOffset);
    }

    return result;
  }

  /**
   * Get syntax highlighting
   */
  getHighlights(tree: SyntaxTree): Array<{ range: Range; type: string }> {
    const highlights: Array<{ range: Range; type: string }> = [];

    this.traverseTree(tree.rootNode, node => {
      if (node.named) {
        highlights.push({
          range: {
            startPosition: node.startPosition,
            endPosition: node.endPosition,
          },
          type: node.type,
        });
      }
    });

    return highlights;
  }

  /**
   * Get function definitions
   */
  getFunctionDefinitions(tree: SyntaxTree): SyntaxNode[] {
    const functionTypes = ['function_definition', 'function_declaration', 'method_definition'];
    const functions: SyntaxNode[] = [];

    for (const type of functionTypes) {
      functions.push(...this.findNodesByType(tree, type));
    }

    return functions;
  }

  /**
   * Get class definitions
   */
  getClassDefinitions(tree: SyntaxTree): SyntaxNode[] {
    const classTypes = ['class_definition', 'class_declaration', 'interface_definition'];
    const classes: SyntaxNode[] = [];

    for (const type of classTypes) {
      classes.push(...this.findNodesByType(tree, type));
    }

    return classes;
  }

  /**
   * Get imports
   */
  getImports(tree: SyntaxTree): SyntaxNode[] {
    const importTypes = ['import_statement', 'import_declaration', 'require'];
    const imports: SyntaxNode[] = [];

    for (const type of importTypes) {
      imports.push(...this.findNodesByType(tree, type));
    }

    return imports;
  }

  /**
   * Clear cache
   */
  clearCache(parserId?: string): void {
    if (parserId) {
      const parser = this.parsers.get(parserId);
      if (parser) {
        // Clear cache entries for this parser
        for (const [key] of this.cache) {
          if (key.startsWith(parserId + ':')) {
            this.cache.delete(key);
          }
        }
      }
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get statistics for a parser
   */
  getStatistics(parserId: string): ParserStatistics | undefined {
    const parser = this.parsers.get(parserId);
    if (!parser) return undefined;

    return { ...parser.statistics };
  }

  /**
   * Reset statistics for a parser
   */
  resetStatistics(parserId: string): boolean {
    const parser = this.parsers.get(parserId);
    if (!parser) return false;

    parser.statistics = {
      totalParses: 0,
      successfulParses: 0,
      failedParses: 0,
      averageParseTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalNodes: 0,
    };

    parser.metadata.updatedAt = Date.now();

    return true;
  }

  // Private methods

  private createMockParser(language: Language): Parser {
    return {
      parse: (source: string) => this.mockParse(source, language.name),
      parseWithOffset: (source: string, offset: number) => this.mockParse(source, language.name),
      getIncludedRanges: () => [],
      reset: () => {},
    };
  }

  private mockParse(source: string, language: string): SyntaxTree {
    // Mock parsing - in real implementation, this would use tree-sitter
    const lines = source.split('\n');
    const rootNode: SyntaxNode = {
      id: 'root',
      type: 'source_file',
      startPosition: { row: 0, column: 0 },
      endPosition: { row: lines.length - 1, column: lines[lines.length - 1].length },
      children: this.createMockChildren(source, lines),
      parent: null,
      named: true,
      isMissing: false,
      isExtra: false,
      fieldNames: [],
      text: source,
    };

    return {
      rootNode,
      source,
      language,
      includedRanges: [],
    };
  }

  private createMockChildren(source: string, lines: string[]): SyntaxNode[] {
    // Create mock children based on simple heuristics
    const children: SyntaxNode[] = [];
    let currentLine = 0;

    for (const line of lines) {
      if (line.trim().startsWith('function') || line.trim().startsWith('def ') || line.trim().startsWith('func ')) {
        children.push({
          id: `node-${currentLine}`,
          type: 'function_definition',
          startPosition: { row: currentLine, column: line.indexOf(line.trim()) },
          endPosition: { row: currentLine, column: line.length },
          children: [],
          parent: null,
          named: true,
          isMissing: false,
          isExtra: false,
          fieldNames: ['name', 'body'],
          text: line,
        });
      } else if (line.trim().startsWith('class ')) {
        children.push({
          id: `node-${currentLine}`,
          type: 'class_definition',
          startPosition: { row: currentLine, column: line.indexOf(line.trim()) },
          endPosition: { row: currentLine, column: line.length },
          children: [],
          parent: null,
          named: true,
          isMissing: false,
          isExtra: false,
          fieldNames: ['name', 'body'],
          text: line,
        });
      }
      currentLine++;
    }

    return children;
  }

  private traverseTree(node: SyntaxNode, callback: (node: SyntaxNode) => void): void {
    callback(node);
    for (const child of node.children) {
      this.traverseTree(child, callback);
    }
  }

  private findNodeAt(node: SyntaxNode, position: Position): SyntaxNode | null {
    if (this.positionInRange(position, node.startPosition, node.endPosition)) {
      // Check children first (more specific)
      for (const child of node.children) {
        const found = this.findNodeAt(child, position);
        if (found) return found;
      }
      return node;
    }
    return null;
  }

  private positionInRange(position: Position, start: Position, end: Position): boolean {
    if (position.row < start.row || position.row > end.row) return false;
    if (position.row === start.row && position.column < start.column) return false;
    if (position.row === end.row && position.column > end.column) return false;
    return true;
  }

  private positionToOffset(position: Position, source: string): number {
    const lines = source.split('\n');
    let offset = 0;

    for (let i = 0; i < position.row; i++) {
      offset += lines[i].length + 1; // +1 for newline
    }

    offset += position.column;
    return offset;
  }

  private countNodes(node: SyntaxNode): number {
    let count = 1;
    for (const child of node.children) {
      count += this.countNodes(child);
    }
    return count;
  }

  private generateCacheKey(parserId: string, source: string): string {
    return `${parserId}:${this.hashString(source)}`;
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

  private updateAverage(current: number, count: number, newValue: number): number {
    if (count === 1) return newValue;
    return (current * (count - 1) + newValue) / count;
  }

  private generateParserId(): string {
    return `parser-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Helper functions to create languages and queries
export function createLanguage(
  id: string,
  name: string,
  fileExtensions: string[],
  highlights?: string,
  injections?: string,
  locals?: string
): Language {
  return { id, name, fileExtensions, highlights, injections, locals };
}

export function createQuery(id: string, pattern: string, captures: Capture[]): Query {
  return {
    id,
    pattern,
    captures,
    match: (tree: SyntaxTree) => {
      // Mock query matching
      return [];
    },
  };
}

export function createCapture(name: string, index: number): Capture {
  return { name, index };
}

// Global tree-sitter manager instance
const treeSitterManager = new TreeSitterManager();

export function createParser(language: Language, config?: Partial<ParserConfig>): TreeSitterParser {
  return treeSitterManager.createParser(language, config);
}

export function getParser(parserId: string): TreeSitterParser | undefined {
  return treeSitterManager.getParser(parserId);
}

export function getAllParsers(): TreeSitterParser[] {
  return treeSitterManager.getAllParsers();
}

export function deleteParser(parserId: string): boolean {
  return treeSitterManager.deleteParser(parserId);
}

export async function parse(parserId: string, source: string): Promise<SyntaxTree> {
  return treeSitterManager.parse(parserId, source);
}

export function addQuery(parserId: string, query: Query): boolean {
  return treeSitterManager.addQuery(parserId, query);
}

export function executeQuery(parserId: string, queryId: string, tree: SyntaxTree): QueryMatch[] {
  return treeSitterManager.executeQuery(parserId, queryId, tree);
}

export function findNodesByType(tree: SyntaxTree, nodeType: string): SyntaxNode[] {
  return treeSitterManager.findNodesByType(tree, nodeType);
}

export function findNodeAtPosition(tree: SyntaxTree, position: Position): SyntaxNode | null {
  return treeSitterManager.findNodeAtPosition(tree, position);
}

export function getNodeText(node: SyntaxNode, source: string): string {
  return treeSitterManager.getNodeText(node, source);
}

export function applyTransformation(source: string, transformation: CodeTransformation): string {
  return treeSitterManager.applyTransformation(source, transformation);
}

export function getHighlights(tree: SyntaxTree): Array<{ range: Range; type: string }> {
  return treeSitterManager.getHighlights(tree);
}

export function getFunctionDefinitions(tree: SyntaxTree): SyntaxNode[] {
  return treeSitterManager.getFunctionDefinitions(tree);
}

export function getClassDefinitions(tree: SyntaxTree): SyntaxNode[] {
  return treeSitterManager.getClassDefinitions(tree);
}

export function getImports(tree: SyntaxTree): SyntaxNode[] {
  return treeSitterManager.getImports(tree);
}

export function clearCache(parserId?: string): void {
  treeSitterManager.clearCache(parserId);
}

export function getStatistics(parserId: string): ParserStatistics | undefined {
  return treeSitterManager.getStatistics(parserId);
}

export function resetStatistics(parserId: string): boolean {
  return treeSitterManager.resetStatistics(parserId);
}
