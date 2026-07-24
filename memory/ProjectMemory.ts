/**
 * Project memory system - Learn from project interactions and remember patterns
 * Inspired by OpenCode and Goose for project-specific intelligence
 */

export interface ProjectMemory {
  projectId: string;
  projectName: string;
  projectPath: string;
  createdAt: number;
  updatedAt: number;
  structure: ProjectStructure;
  patterns: Pattern[];
  interactions: Interaction[];
  preferences: ProjectPreferences;
  metadata: ProjectMetadata;
}

export interface ProjectStructure {
  files: FileRecord[];
  directories: DirectoryRecord[];
  dependencies: DependencyRecord[];
  gitInfo?: GitInfo;
}

export interface FileRecord {
  path: string;
  language: string;
  size: number;
  lastModified: number;
  lines: number;
  functions: string[];
  classes: string[];
  imports: string[];
  exports: string[];
}

export interface DirectoryRecord {
  path: string;
  type: 'src' | 'test' | 'docs' | 'config' | 'assets' | 'other';
  fileCount: number;
}

export interface DependencyRecord {
  name: string;
  version: string;
  type: 'runtime' | 'dev' | 'peer';
  manager: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'pip' | 'poetry' | 'cargo' | 'go';
}

export interface GitInfo {
  branch: string;
  commit: string;
  remote: string;
  lastCommitMessage: string;
  lastCommitDate: number;
}

export interface Pattern {
  id: string;
  type: PatternType;
  description: string;
  files: string[];
  confidence: number;
  lastSeen: number;
  frequency: number;
}

export type PatternType =
  | 'architecture'
  | 'naming-convention'
  | 'code-style'
  | 'error-handling'
  | 'testing-pattern'
  | 'import-pattern'
  | 'api-pattern'
  | 'state-management';

export interface Interaction {
  id: string;
  timestamp: number;
  type: InteractionType;
  query: string;
  response: string;
  filesModified: string[];
  toolsUsed: string[];
  success: boolean;
  duration: number;
}

export type InteractionType =
  | 'code-generation'
  | 'bug-fix'
  | 'refactor'
  | 'documentation'
  | 'testing'
  | 'debugging'
  | 'explanation';

export interface ProjectPreferences {
  preferredLanguage: string;
  codeStyle: CodeStyle;
  testingFramework?: string;
  buildTool?: string;
  packageManager?: string;
  linter?: string;
  formatter?: string;
}

export interface CodeStyle {
  indentation: 'spaces' | 'tabs';
  indentSize: number;
  quoteStyle: 'single' | 'double';
  semicolons: boolean;
  trailingCommas: boolean;
}

export interface ProjectMetadata {
  tags: string[];
  notes: string;
  isPinned: boolean;
  isArchived: boolean;
}

export interface MemoryQuery {
  query: string;
  type?: 'patterns' | 'interactions' | 'structure' | 'all';
  limit?: number;
}

export interface MemoryResult {
  type: 'pattern' | 'interaction' | 'structure';
  relevance: number;
  data: Pattern | Interaction | ProjectStructure;
}

class ProjectMemoryManager {
  private memories: Map<string, ProjectMemory> = new Map();
  private currentProject: string | null = null;
  private maxInteractions: number = 1000;
  private maxPatterns: number = 100;

  /**
   * Create or load project memory
   */
  async loadProject(projectPath: string, projectName?: string): Promise<ProjectMemory> {
    const projectId = this.generateProjectId(projectPath);

    let memory = this.memories.get(projectId);
    if (!memory) {
      memory = this.createMemory(projectId, projectPath, projectName);
      this.memories.set(projectId, memory);
    }

    this.currentProject = projectId;
    return memory;
  }

  /**
   * Create new project memory
   */
  private createMemory(projectId: string, projectPath: string, projectName?: string): ProjectMemory {
    return {
      projectId,
      projectName: projectName || projectPath.split('/').pop() || 'Unknown',
      projectPath,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      structure: {
        files: [],
        directories: [],
        dependencies: [],
      },
      patterns: [],
      interactions: [],
      preferences: {
        preferredLanguage: 'typescript',
        codeStyle: {
          indentation: 'spaces',
          indentSize: 2,
          quoteStyle: 'single',
          semicolons: true,
          trailingCommas: true,
        },
      },
      metadata: {
        tags: [],
        notes: '',
        isPinned: false,
        isArchived: false,
      },
    };
  }

  /**
   * Get current project memory
   */
  getCurrentMemory(): ProjectMemory | undefined {
    if (!this.currentProject) return undefined;
    return this.memories.get(this.currentProject);
  }

  /**
   * Get project memory by ID
   */
  getMemory(projectId: string): ProjectMemory | undefined {
    return this.memories.get(projectId);
  }

  /**
   * Get all project memories
   */
  getAllMemories(): ProjectMemory[] {
    return Array.from(this.memories.values())
      .filter(m => !m.metadata.isArchived)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Update project structure
   */
  updateStructure(projectId: string, structure: Partial<ProjectStructure>): void {
    const memory = this.memories.get(projectId);
    if (!memory) return;

    memory.structure = { ...memory.structure, ...structure };
    memory.updatedAt = Date.now();
  }

  /**
   * Add a file record
   */
  addFileRecord(projectId: string, file: FileRecord): void {
    const memory = this.memories.get(projectId);
    if (!memory) return;

    const existingIndex = memory.structure.files.findIndex(f => f.path === file.path);
    if (existingIndex >= 0) {
      memory.structure.files[existingIndex] = file;
    } else {
      memory.structure.files.push(file);
    }

    memory.updatedAt = Date.now();
  }

  /**
   * Add a directory record
   */
  addDirectoryRecord(projectId: string, directory: DirectoryRecord): void {
    const memory = this.memories.get(projectId);
    if (!memory) return;

    const existingIndex = memory.structure.directories.findIndex(d => d.path === directory.path);
    if (existingIndex >= 0) {
      memory.structure.directories[existingIndex] = directory;
    } else {
      memory.structure.directories.push(directory);
    }

    memory.updatedAt = Date.now();
  }

  /**
   * Add a dependency record
   */
  addDependencyRecord(projectId: string, dependency: DependencyRecord): void {
    const memory = this.memories.get(projectId);
    if (!memory) return;

    const existingIndex = memory.structure.dependencies.findIndex(d => d.name === dependency.name);
    if (existingIndex >= 0) {
      memory.structure.dependencies[existingIndex] = dependency;
    } else {
      memory.structure.dependencies.push(dependency);
    }

    memory.updatedAt = Date.now();
  }

  /**
   * Record an interaction
   */
  recordInteraction(interaction: Omit<Interaction, 'id'>): void {
    const memory = this.getCurrentMemory();
    if (!memory) return;

    const fullInteraction: Interaction = {
      ...interaction,
      id: this.generateId(),
    };

    memory.interactions.push(fullInteraction);

    // Limit interactions
    if (memory.interactions.length > this.maxInteractions) {
      memory.interactions.shift();
    }

    memory.updatedAt = Date.now();

    // Analyze interaction for patterns
    this.analyzeForPatterns(memory, fullInteraction);
  }

  /**
   * Add a pattern
   */
  addPattern(projectId: string, pattern: Omit<Pattern, 'id'>): void {
    const memory = this.memories.get(projectId);
    if (!memory) return;

    const fullPattern: Pattern = {
      ...pattern,
      id: this.generateId(),
    };

    // Check if similar pattern exists
    const existing = memory.patterns.find(p => p.type === pattern.type && p.description === pattern.description);
    if (existing) {
      existing.frequency++;
      existing.lastSeen = Date.now();
      existing.confidence = Math.min(1, existing.confidence + 0.1);
    } else {
      memory.patterns.push(fullPattern);
    }

    // Limit patterns
    if (memory.patterns.length > this.maxPatterns) {
      // Remove least frequent pattern
      memory.patterns.sort((a, b) => a.frequency - b.frequency);
      memory.patterns.shift();
    }

    memory.updatedAt = Date.now();
  }

  /**
   * Update project preferences
   */
  updatePreferences(projectId: string, preferences: Partial<ProjectPreferences>): void {
    const memory = this.memories.get(projectId);
    if (!memory) return;

    memory.preferences = { ...memory.preferences, ...preferences };
    memory.updatedAt = Date.now();
  }

  /**
   * Search project memory
   */
  search(query: MemoryQuery): MemoryResult[] {
    const memory = this.getCurrentMemory();
    if (!memory) return [];

    const results: MemoryResult[] = [];
    const queryLower = query.query.toLowerCase();

    if (query.type === 'patterns' || query.type === 'all') {
      for (const pattern of memory.patterns) {
        const relevance = this.calculateRelevance(queryLower, pattern.description);
        if (relevance > 0) {
          results.push({
            type: 'pattern',
            relevance,
            data: pattern,
          });
        }
      }
    }

    if (query.type === 'interactions' || query.type === 'all') {
      for (const interaction of memory.interactions) {
        const relevance = this.calculateRelevance(queryLower, interaction.query + ' ' + interaction.response);
        if (relevance > 0) {
          results.push({
            type: 'interaction',
            relevance,
            data: interaction,
          });
        }
      }
    }

    if (query.type === 'structure' || query.type === 'all') {
      for (const file of memory.structure.files) {
        const relevance = this.calculateRelevance(queryLower, file.path);
        if (relevance > 0) {
          results.push({
            type: 'structure',
            relevance,
            data: memory.structure,
          });
          break; // Only add structure once
        }
      }
    }

    // Sort by relevance and limit
    results.sort((a, b) => b.relevance - a.relevance);
    const limit = query.limit || 10;
    return results.slice(0, limit);
  }

  /**
   * Get similar interactions
   */
  getSimilarInteractions(query: string, limit: number = 5): Interaction[] {
    const memory = this.getCurrentMemory();
    if (!memory) return [];

    const queryLower = query.toLowerCase();
    const scored = memory.interactions.map(interaction => ({
      interaction,
      score: this.calculateRelevance(queryLower, interaction.query),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.interaction);
  }

  /**
   * Get patterns by type
   */
  getPatternsByType(type: PatternType): Pattern[] {
    const memory = this.getCurrentMemory();
    if (!memory) return [];

    return memory.patterns.filter(p => p.type === type);
  }

  /**
   * Get project statistics
   */
  getStatistics(projectId?: string): {
    totalFiles: number;
    totalDirectories: number;
    totalDependencies: number;
    totalInteractions: number;
    totalPatterns: number;
    successRate: number;
    averageDuration: number;
    mostUsedPatterns: Pattern[];
  } {
    const memory = projectId ? this.memories.get(projectId) : this.getCurrentMemory();
    if (!memory) {
      return {
        totalFiles: 0,
        totalDirectories: 0,
        totalDependencies: 0,
        totalInteractions: 0,
        totalPatterns: 0,
        successRate: 0,
        averageDuration: 0,
        mostUsedPatterns: [],
      };
    }

    const successfulInteractions = memory.interactions.filter(i => i.success).length;
    const successRate = memory.interactions.length > 0 ? successfulInteractions / memory.interactions.length : 0;
    const averageDuration = memory.interactions.length > 0 
      ? memory.interactions.reduce((sum, i) => sum + i.duration, 0) / memory.interactions.length 
      : 0;

    const mostUsedPatterns = [...memory.patterns].sort((a, b) => b.frequency - a.frequency).slice(0, 5);

    return {
      totalFiles: memory.structure.files.length,
      totalDirectories: memory.structure.directories.length,
      totalDependencies: memory.structure.dependencies.length,
      totalInteractions: memory.interactions.length,
      totalPatterns: memory.patterns.length,
      successRate,
      averageDuration,
      mostUsedPatterns,
    };
  }

  /**
   * Delete project memory
   */
  deleteMemory(projectId: string): boolean {
    return this.memories.delete(projectId);
  }

  /**
   * Archive project memory
   */
  archiveMemory(projectId: string): boolean {
    const memory = this.memories.get(projectId);
    if (!memory) return false;

    memory.metadata.isArchived = true;
    return true;
  }

  /**
   * Pin project memory
   */
  pinMemory(projectId: string, pinned: boolean): boolean {
    const memory = this.memories.get(projectId);
    if (!memory) return false;

    memory.metadata.isPinned = pinned;
    return true;
  }

  // Private methods

  private generateProjectId(path: string): string {
    // Simple hash of path
    let hash = 0;
    for (let i = 0; i < path.length; i++) {
      const char = path.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateRelevance(query: string, text: string): number {
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();

    // Exact match
    if (textLower === queryLower) return 1.0;

    // Contains match
    if (textLower.includes(queryLower)) return 0.8;

    // Word match
    const queryWords = queryLower.split(/\s+/);
    const textWords = textLower.split(/\s+/);
    const matches = queryWords.filter(word => textWords.includes(word));
    if (matches.length > 0) {
      return matches.length / queryWords.length * 0.5;
    }

    return 0;
  }

  private analyzeForPatterns(memory: ProjectMemory, interaction: Interaction): void {
    // Analyze for code patterns
    if (interaction.type === 'code-generation' || interaction.type === 'refactor') {
      // Check for naming conventions
      if (interaction.query.includes('create') || interaction.query.includes('add')) {
        this.addPattern(memory.projectId, {
          type: 'naming-convention',
          description: 'Uses create/add naming pattern',
          files: interaction.filesModified,
          confidence: 0.5,
          lastSeen: Date.now(),
          frequency: 1,
        });
      }

      // Check for error handling
      if (interaction.response.includes('try') || interaction.response.includes('catch')) {
        this.addPattern(memory.projectId, {
          type: 'error-handling',
          description: 'Uses try-catch error handling',
          files: interaction.filesModified,
          confidence: 0.7,
          lastSeen: Date.now(),
          frequency: 1,
        });
      }
    }

    // Analyze for import patterns
    if (interaction.filesModified.length > 0) {
      this.addPattern(memory.projectId, {
        type: 'import-pattern',
        description: `Modifies ${interaction.filesModified.length} files`,
        files: interaction.filesModified,
        confidence: 0.3,
        lastSeen: Date.now(),
        frequency: 1,
      });
    }
  }
}

// Global project memory manager instance
const projectMemoryManager = new ProjectMemoryManager();

export async function loadProject(projectPath: string, projectName?: string): Promise<ProjectMemory> {
  return projectMemoryManager.loadProject(projectPath, projectName);
}

export function getCurrentMemory(): ProjectMemory | undefined {
  return projectMemoryManager.getCurrentMemory();
}

export function getMemory(projectId: string): ProjectMemory | undefined {
  return projectMemoryManager.getMemory(projectId);
}

export function getAllMemories(): ProjectMemory[] {
  return projectMemoryManager.getAllMemories();
}

export function updateStructure(projectId: string, structure: Partial<ProjectStructure>): void {
  projectMemoryManager.updateStructure(projectId, structure);
}

export function addFileRecord(projectId: string, file: FileRecord): void {
  projectMemoryManager.addFileRecord(projectId, file);
}

export function addDirectoryRecord(projectId: string, directory: DirectoryRecord): void {
  projectMemoryManager.addDirectoryRecord(projectId, directory);
}

export function addDependencyRecord(projectId: string, dependency: DependencyRecord): void {
  projectMemoryManager.addDependencyRecord(projectId, dependency);
}

export function recordInteraction(interaction: Omit<Interaction, 'id'>): void {
  projectMemoryManager.recordInteraction(interaction);
}

export function addPattern(projectId: string, pattern: Omit<Pattern, 'id'>): void {
  projectMemoryManager.addPattern(projectId, pattern);
}

export function updatePreferences(projectId: string, preferences: Partial<ProjectPreferences>): void {
  projectMemoryManager.updatePreferences(projectId, preferences);
}

export function search(query: MemoryQuery): MemoryResult[] {
  return projectMemoryManager.search(query);
}

export function getSimilarInteractions(query: string, limit?: number): Interaction[] {
  return projectMemoryManager.getSimilarInteractions(query, limit);
}

export function getPatternsByType(type: PatternType): Pattern[] {
  return projectMemoryManager.getPatternsByType(type);
}

export function getStatistics(projectId?: string): {
  totalFiles: number;
  totalDirectories: number;
  totalDependencies: number;
  totalInteractions: number;
  totalPatterns: number;
  successRate: number;
  averageDuration: number;
  mostUsedPatterns: Pattern[];
} {
  return projectMemoryManager.getStatistics(projectId);
}

export function deleteMemory(projectId: string): boolean {
  return projectMemoryManager.deleteMemory(projectId);
}

export function archiveMemory(projectId: string): boolean {
  return projectMemoryManager.archiveMemory(projectId);
}

export function pinMemory(projectId: string, pinned: boolean): boolean {
  return projectMemoryManager.pinMemory(projectId, pinned);
}
