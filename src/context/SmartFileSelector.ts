/**
 * Smart file selection system
 * Inspired by Aider and OpenCode for intelligent context building
 */

export interface FileMetadata {
  path: string;
  size: number;
  lastModified: number;
  language: string;
  lines: number;
  functions: number;
  classes: number;
  imports: string[];
  exports: string[];
  dependencies: string[];
  relevanceScore: number;
}

export interface SelectionCriteria {
  query: string;
  maxFiles: number;
  maxTotalTokens: number;
  includeTests: boolean;
  includeDocs: boolean;
  includeConfig: boolean;
  excludePatterns: string[];
  includePatterns: string[];
}

export interface SelectionResult {
  files: FileMetadata[];
  totalTokens: number;
  selectionReason: string;
  excludedFiles: string[];
}

export interface DependencyGraph {
  nodes: Map<string, FileMetadata>;
  edges: Map<string, Set<string>>;
}

class SmartFileSelector {
  private fileCache: Map<string, FileMetadata> = new Map();
  private dependencyGraph: DependencyGraph = {
    nodes: new Map(),
    edges: new Map(),
  };
  private languageMap: Map<string, string> = new Map();

  constructor() {
    this.initializeLanguageMap();
  }

  /**
   * Initialize language map based on file extensions
   */
  private initializeLanguageMap(): void {
    this.languageMap.set('.ts', 'typescript');
    this.languageMap.set('.tsx', 'typescript');
    this.languageMap.set('.js', 'javascript');
    this.languageMap.set('.jsx', 'javascript');
    this.languageMap.set('.py', 'python');
    this.languageMap.set('.go', 'go');
    this.languageMap.set('.rs', 'rust');
    this.languageMap.set('.java', 'java');
    this.languageMap.set('.cpp', 'cpp');
    this.languageMap.set('.c', 'c');
    this.languageMap.set('.h', 'c');
    this.languageMap.set('.hpp', 'cpp');
    this.languageMap.set('.cs', 'csharp');
    this.languageMap.set('.php', 'php');
    this.languageMap.set('.rb', 'ruby');
    this.languageMap.set('.swift', 'swift');
    this.languageMap.set('.kt', 'kotlin');
    this.languageMap.set('.scala', 'scala');
    this.languageMap.set('.sh', 'shell');
    this.languageMap.set('.bash', 'shell');
    this.languageMap.set('.zsh', 'shell');
    this.languageMap.set('.ps1', 'powershell');
    this.languageMap.set('.json', 'json');
    this.languageMap.set('.yaml', 'yaml');
    this.languageMap.set('.yml', 'yaml');
    this.languageMap.set('.toml', 'toml');
    this.languageMap.set('.xml', 'xml');
    this.languageMap.set('.md', 'markdown');
    this.languageMap.set('.txt', 'text');
    this.languageMap.set('.html', 'html');
    this.languageMap.set('.css', 'css');
    this.languageMap.set('.scss', 'scss');
    this.languageMap.set('.less', 'less');
    this.languageMap.set('.sql', 'sql');
  }

  /**
   * Scan directory and build file metadata
   */
  async scanDirectory(
    directory: string,
    recursive: boolean = true
  ): Promise<FileMetadata[]> {
    // In a real implementation, this would use fs to scan the directory
    const files: FileMetadata[] = [];

    // Mock implementation
    const mockFiles = [
      'src/index.ts',
      'src/utils/helpers.ts',
      'src/components/App.tsx',
      'src/services/api.ts',
      'tests/unit/test.ts',
      'docs/README.md',
      'config/settings.json',
    ];

    for (const file of mockFiles) {
      const metadata = await this.getFileMetadata(file);
      files.push(metadata);
      this.fileCache.set(file, metadata);
    }

    return files;
  }

  /**
   * Get metadata for a single file
   */
  async getFileMetadata(path: string): Promise<FileMetadata> {
    // Check cache first
    const cached = this.fileCache.get(path);
    if (cached) return cached;

    // In a real implementation, this would read the file and analyze it
    const ext = this.getExtension(path);
    const language = this.languageMap.get(ext) || 'text';

    const metadata: FileMetadata = {
      path,
      size: Math.floor(Math.random() * 10000),
      lastModified: Date.now(),
      language,
      lines: Math.floor(Math.random() * 500),
      functions: Math.floor(Math.random() * 20),
      classes: Math.floor(Math.random() * 5),
      imports: [],
      exports: [],
      dependencies: [],
      relevanceScore: 0,
    };

    this.fileCache.set(path, metadata);
    return metadata;
  }

  /**
   * Build dependency graph
   */
  async buildDependencyGraph(files: FileMetadata[]): Promise<DependencyGraph> {
    const graph: DependencyGraph = {
      nodes: new Map(),
      edges: new Map(),
    };

    // Add nodes
    for (const file of files) {
      graph.nodes.set(file.path, file);
      graph.edges.set(file.path, new Set());
    }

    // Build edges based on imports
    for (const file of files) {
      for (const imp of file.imports) {
        const importedFile = this.resolveImport(imp, files);
        if (importedFile && graph.edges.has(importedFile.path)) {
          graph.edges.get(file.path)!.add(importedFile.path);
        }
      }
    }

    this.dependencyGraph = graph;
    return graph;
  }

  /**
   * Select files based on criteria
   */
  async selectFiles(criteria: SelectionCriteria): Promise<SelectionResult> {
    const allFiles = Array.from(this.fileCache.values());

    // Filter by patterns
    let filteredFiles = this.filterByPatterns(allFiles, criteria);

    // Calculate relevance scores
    filteredFiles = this.calculateRelevance(filteredFiles, criteria.query);

    // Sort by relevance
    filteredFiles.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Select top files within token limit
    const selectedFiles: FileMetadata[] = [];
    let totalTokens = 0;

    for (const file of filteredFiles) {
      const fileTokens = this.estimateTokens(file);
      if (totalTokens + fileTokens <= criteria.maxTotalTokens && selectedFiles.length < criteria.maxFiles) {
        selectedFiles.push(file);
        totalTokens += fileTokens;
      }
    }

    const excludedFiles = filteredFiles
      .slice(selectedFiles.length)
      .map(f => f.path);

    return {
      files: selectedFiles,
      totalTokens,
      selectionReason: `Selected ${selectedFiles.length} files based on query "${criteria.query}"`,
      excludedFiles,
    };
  }

  /**
   * Select files by dependency impact
   */
  async selectByImpact(
    changedFiles: string[],
    maxFiles: number = 10
  ): Promise<SelectionResult> {
    const impacted = new Set<string>();

    // Add direct dependencies
    for (const file of changedFiles) {
      const deps = this.dependencyGraph.edges.get(file);
      if (deps) {
        deps.forEach(dep => impacted.add(dep));
      }
    }

    // Add dependents (files that depend on changed files)
    for (const [file, deps] of this.dependencyGraph.edges) {
      if (deps.has(changedFiles[0])) {
        impacted.add(file);
      }
    }

    // Convert to metadata
    const impactedFiles = Array.from(impacted)
      .map(path => this.fileCache.get(path))
      .filter((f): f is FileMetadata => f !== undefined);

    // Sort by impact score
    impactedFiles.sort((a, b) => b.relevanceScore - a.relevanceScore);

    const selected = impactedFiles.slice(0, maxFiles);
    const totalTokens = selected.reduce((sum, f) => sum + this.estimateTokens(f), 0);

    return {
      files: selected,
      totalTokens,
      selectionReason: `Selected ${selected.length} files impacted by changes`,
      excludedFiles: impactedFiles.slice(maxFiles).map(f => f.path),
    };
  }

  /**
   * Select files by semantic similarity
   */
  async selectBySimilarity(
    query: string,
    maxFiles: number = 10
  ): Promise<SelectionResult> {
    const allFiles = Array.from(this.fileCache.values());

    // Calculate similarity scores
    const scored = allFiles.map(file => ({
      file,
      score: this.calculateSimilarity(query, file),
    }));

    // Sort by similarity
    scored.sort((a, b) => b.score - a.score);

    const selected = scored.slice(0, maxFiles).map(s => s.file);
    const totalTokens = selected.reduce((sum, f) => sum + this.estimateTokens(f), 0);

    return {
      files: selected,
      totalTokens,
      selectionReason: `Selected ${selected.length} files similar to query`,
      excludedFiles: scored.slice(maxFiles).map(s => s.file.path),
    };
  }

  /**
   * Filter files by patterns
   */
  private filterByPatterns(files: FileMetadata[], criteria: SelectionCriteria): FileMetadata[] {
    let filtered = files;

    // Exclude patterns
    if (criteria.excludePatterns.length > 0) {
      filtered = filtered.filter(file =>
        !criteria.excludePatterns.some(pattern => this.matchPattern(file.path, pattern))
      );
    }

    // Include patterns
    if (criteria.includePatterns.length > 0) {
      filtered = filtered.filter(file =>
        criteria.includePatterns.some(pattern => this.matchPattern(file.path, pattern))
      );
    }

    // Exclude tests if not included
    if (!criteria.includeTests) {
      filtered = filtered.filter(file => !file.path.includes('test') && !file.path.includes('spec'));
    }

    // Exclude docs if not included
    if (!criteria.includeDocs) {
      filtered = filtered.filter(file => !file.path.includes('docs') && !file.path.endsWith('.md'));
    }

    // Exclude config if not included
    if (!criteria.includeConfig) {
      filtered = filtered.filter(file => !file.path.includes('config') && !file.path.includes('.json'));
    }

    return filtered;
  }

  /**
   * Calculate relevance score for files
   */
  private calculateRelevance(files: FileMetadata[], query: string): FileMetadata[] {
    const queryLower = query.toLowerCase();

    return files.map(file => {
      let score = 0;

      // Path match
      if (file.path.toLowerCase().includes(queryLower)) {
        score += 0.5;
      }

      // Language match (if query contains language name)
      if (queryLower.includes(file.language)) {
        score += 0.3;
      }

      // Recent files get higher score
      const age = Date.now() - file.lastModified;
      const ageScore = Math.max(0, 1 - age / (7 * 24 * 60 * 60 * 1000)); // Decay over 7 days
      score += ageScore * 0.2;

      // Larger files might be more important
      const sizeScore = Math.min(1, file.size / 5000);
      score += sizeScore * 0.1;

      // Files with more functions/classes might be more important
      const complexityScore = Math.min(1, (file.functions + file.classes) / 20);
      score += complexityScore * 0.1;

      file.relevanceScore = score;
      return file;
    });
  }

  /**
   * Calculate similarity score
   */
  private calculateSimilarity(query: string, file: FileMetadata): number {
    const queryLower = query.toLowerCase();
    const pathLower = file.path.toLowerCase();
    let score = 0;

    // Exact path match
    if (pathLower === queryLower) {
      score += 1.0;
    }

    // Partial path match
    if (pathLower.includes(queryLower)) {
      score += 0.7;
    }

    // File name match
    const fileName = pathLower.split('/').pop() || '';
    if (fileName === queryLower) {
      score += 0.5;
    }

    // Extension match
    if (queryLower.startsWith('.')) {
      if (fileName.endsWith(queryLower)) {
        score += 0.3;
      }
    }

    return score;
  }

  /**
   * Estimate tokens for a file
   */
  private estimateTokens(file: FileMetadata): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(file.size / 4);
  }

  /**
   * Get file extension
   */
  private getExtension(path: string): string {
    const parts = path.split('.');
    if (parts.length > 1) {
      return '.' + parts.pop();
    }
    return '';
  }

  /**
   * Resolve import to file path
   */
  private resolveImport(imp: string, files: FileMetadata[]): FileMetadata | undefined {
    // Simple implementation - in real code, this would handle relative paths, node_modules, etc.
    const matchingFile = files.find(f => f.path.endsWith(imp) || f.path.endsWith(imp + '.ts') || f.path.endsWith(imp + '.js'));
    return matchingFile;
  }

  /**
   * Match pattern against path
   */
  private matchPattern(path: string, pattern: string): boolean {
    // Simple glob matching
    const regex = new RegExp(
      pattern.replace(/\*/g, '.*').replace(/\?/g, '.'),
      'i'
    );
    return regex.test(path);
  }

  /**
   * Get file cache statistics
   */
  getCacheStats(): {
    totalFiles: number;
    filesByLanguage: Record<string, number>;
    totalSize: number;
    averageFileSize: number;
  } {
    const files = Array.from(this.fileCache.values());
    const filesByLanguage: Record<string, number> = {};
    let totalSize = 0;

    for (const file of files) {
      filesByLanguage[file.language] = (filesByLanguage[file.language] || 0) + 1;
      totalSize += file.size;
    }

    return {
      totalFiles: files.length,
      filesByLanguage,
      totalSize,
      averageFileSize: files.length > 0 ? totalSize / files.length : 0,
    };
  }

  /**
   * Clear file cache
   */
  clearCache(): void {
    this.fileCache.clear();
    this.dependencyGraph = {
      nodes: new Map(),
      edges: new Map(),
    };
  }
}

// Global smart file selector instance
const smartFileSelector = new SmartFileSelector();

export async function scanDirectory(directory: string, recursive?: boolean): Promise<FileMetadata[]> {
  return smartFileSelector.scanDirectory(directory, recursive);
}

export async function getFileMetadata(path: string): Promise<FileMetadata> {
  return smartFileSelector.getFileMetadata(path);
}

export async function buildDependencyGraph(files: FileMetadata[]): Promise<DependencyGraph> {
  return smartFileSelector.buildDependencyGraph(files);
}

export async function selectFiles(criteria: SelectionCriteria): Promise<SelectionResult> {
  return smartFileSelector.selectFiles(criteria);
}

export async function selectByImpact(changedFiles: string[], maxFiles?: number): Promise<SelectionResult> {
  return smartFileSelector.selectByImpact(changedFiles, maxFiles);
}

export async function selectBySimilarity(query: string, maxFiles?: number): Promise<SelectionResult> {
  return smartFileSelector.selectBySimilarity(query, maxFiles);
}

export function getCacheStats(): {
  totalFiles: number;
  filesByLanguage: Record<string, number>;
  totalSize: number;
  averageFileSize: number;
} {
  return smartFileSelector.getCacheStats();
}

export function clearFileCache(): void {
  smartFileSelector.clearCache();
}
