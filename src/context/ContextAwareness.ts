/**
 * Smart context awareness and project understanding system
 * Learns from project structure, user behavior, and code patterns to provide intelligent assistance
 */

export interface ProjectContext {
  path: string;
  name: string;
  type: ProjectType;
  language: string;
  framework?: string;
  buildSystem: string;
  packageManager: string;
  testFramework?: string;
  entryPoints: string[];
  configFiles: string[];
  environment: 'development' | 'staging' | 'production';
}

export interface UserContext {
  preferences: UserPreferences;
  recentFiles: string[];
  recentCommands: string[];
  workingHours: { start: number; end: number };
  expertise: Map<string, number>; // language -> expertise level (0-1)
  patterns: UserPattern[];
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  editor: string;
  terminal: string;
  autoSave: boolean;
  tabSize: number;
  indentStyle: 'spaces' | 'tabs';
  lineEnding: 'lf' | 'crlf';
}

export interface UserPattern {
  type: 'file' | 'command' | 'edit' | 'navigation';
  pattern: string;
  frequency: number;
  lastUsed: number;
  context: string[];
}

export interface CodeContext {
  file: string;
  language: string;
  symbols: SymbolInfo[];
  imports: ImportInfo[];
  exports: ExportInfo[];
  dependencies: string[];
  relatedFiles: string[];
  testFiles: string[];
  documentation: string[];
}

export interface SymbolInfo {
  name: string;
  type: 'function' | 'class' | 'variable' | 'type' | 'interface';
  line: number;
  column: number;
  scope: string;
  isExported: boolean;
  isDeprecated: boolean;
  documentation?: string;
}

export interface ImportInfo {
  module: string;
  imports: string[];
  line: number;
  isDefault: boolean;
  isTypeOnly: boolean;
}

export interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'variable' | 'type';
  line: number;
  isDefault: boolean;
}

export type ProjectType = 'web' | 'mobile' | 'desktop' | 'cli' | 'library' | 'server' | 'unknown';

class ContextAwarenessEngine {
  private projectContext: ProjectContext | null = null;
  private userContext: UserContext;
  private codeContexts: Map<string, CodeContext> = new Map();
  private contextHistory: Array<{ timestamp: number; context: any }> = [];
  private maxHistorySize = 1000;

  constructor() {
    this.userContext = this.initializeUserContext();
  }

  /**
   * Initialize project context from directory
   */
  async initializeProjectContext(projectPath: string): Promise<ProjectContext> {
    const context: ProjectContext = {
      path: projectPath,
      name: this.extractProjectName(projectPath),
      type: this.detectProjectType(projectPath),
      language: this.detectPrimaryLanguage(projectPath),
      framework: this.detectFramework(projectPath),
      buildSystem: this.detectBuildSystem(projectPath),
      packageManager: this.detectPackageManager(projectPath),
      testFramework: this.detectTestFramework(projectPath),
      entryPoints: this.findEntryPoints(projectPath),
      configFiles: this.findConfigFiles(projectPath),
      environment: this.detectEnvironment(projectPath),
    };

    this.projectContext = context;
    this.recordContextHistory('project', context);

    return context;
  }

  /**
   * Update user context based on behavior
   */
  updateUserContext(action: string, data: any): void {
    switch (action) {
      case 'file_opened':
        this.updateRecentFiles(data.file);
        break;
      case 'command_executed':
        this.updateRecentCommands(data.command);
        break;
      case 'edit_made':
        this.recordEditPattern(data);
        break;
      case 'navigation':
        this.recordNavigationPattern(data);
        break;
    }

    this.recordContextHistory('user', this.userContext);
  }

  /**
   * Get code context for a file
   */
  async getCodeContext(filePath: string): Promise<CodeContext> {
    // Check cache
    if (this.codeContexts.has(filePath)) {
      return this.codeContexts.get(filePath)!;
    }

    const context: CodeContext = {
      file: filePath,
      language: this.detectLanguage(filePath),
      symbols: await this.extractSymbols(filePath),
      imports: await this.extractImports(filePath),
      exports: await this.extractExports(filePath),
      dependencies: await this.extractDependencies(filePath),
      relatedFiles: this.findRelatedFiles(filePath),
      testFiles: this.findTestFiles(filePath),
      documentation: this.findDocumentation(filePath),
    };

    this.codeContexts.set(filePath, context);
    return context;
  }

  /**
   * Get intelligent suggestions based on current context
   */
  getContextualSuggestions(): string[] {
    const suggestions: string[] = [];

    if (!this.projectContext) {
      return suggestions;
    }

    // Project-based suggestions
    if (this.projectContext.type === 'web') {
      suggestions.push('Run development server');
      suggestions.push('Build for production');
      suggestions.push('Run tests');
    }

    if (this.projectContext.framework === 'react') {
      suggestions.push('Create new component');
      suggestions.push('Add React Router');
    }

    // User pattern-based suggestions
    const recentPatterns = this.userContext.patterns
      .filter(p => Date.now() - p.lastUsed < 3600000) // Last hour
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 3);

    recentPatterns.forEach(pattern => {
      suggestions.push(pattern.pattern);
    });

    return suggestions;
  }

  /**
   * Predict next action based on context
   */
  predictNextAction(): string {
    if (!this.projectContext) return '';

    // Analyze recent history
    const recentActions = this.contextHistory
      .slice(-10)
      .map(h => h.context);

    // Simple prediction based on patterns
    if (recentActions.some(a => a.type === 'file_opened')) {
      return 'edit';
    }

    if (recentActions.some(a => a.type === 'edit_made')) {
      return 'save';
    }

    if (recentActions.some(a => a.type === 'command_executed')) {
      return 'view_result';
    }

    return '';
  }

  /**
   * Get relevant files for current context
   */
  getRelevantFiles(limit: number = 10): string[] {
    if (!this.projectContext) return [];

    const files: string[] = [];

    // Add entry points
    files.push(...this.projectContext.entryPoints);

    // Add config files
    files.push(...this.projectContext.configFiles);

    // Add recently opened files
    files.push(...this.userContext.recentFiles.slice(0, 5));

    // Add test files
    if (this.projectContext.testFramework) {
      files.push(...this.findTestFiles('*'));
    }

    return [...new Set(files)].slice(0, limit);
  }

  /**
   * Get project summary
   */
  getProjectSummary(): string {
    if (!this.projectContext) return 'No project context available';

    let summary = `Project: ${this.projectContext.name}\n`;
    summary += `Type: ${this.projectContext.type}\n`;
    summary += `Language: ${this.projectContext.language}\n`;
    summary += `Build System: ${this.projectContext.buildSystem}\n`;
    summary += `Package Manager: ${this.projectContext.packageManager}\n`;

    if (this.projectContext.framework) {
      summary += `Framework: ${this.projectContext.framework}\n`;
    }

    if (this.projectContext.testFramework) {
      summary += `Test Framework: ${this.projectContext.testFramework}\n`;
    }

    summary += `Entry Points: ${this.projectContext.entryPoints.join(', ')}\n`;
    summary += `Environment: ${this.projectContext.environment}\n`;

    return summary;
  }

  /**
   * Clear context cache
   */
  clearCache(): void {
    this.codeContexts.clear();
    this.contextHistory = [];
  }

  // Private helper methods

  private initializeUserContext(): UserContext {
    return {
      preferences: {
        theme: 'dark',
        editor: 'vscode',
        terminal: 'powershell',
        autoSave: true,
        tabSize: 2,
        indentStyle: 'spaces',
        lineEnding: 'lf',
      },
      recentFiles: [],
      recentCommands: [],
      workingHours: { start: 9, end: 17 },
      expertise: new Map(),
      patterns: [],
    };
  }

  private extractProjectName(path: string): string {
    return path.split(/[/\\]/).pop() || 'unknown';
  }

  private detectProjectType(path: string): ProjectType {
    // In a real implementation, this would analyze project structure
    return 'unknown';
  }

  private detectPrimaryLanguage(path: string): string {
    // In a real implementation, this would analyze file extensions
    return 'typescript';
  }

  private detectFramework(path: string): string | undefined {
    // In a real implementation, this would check for framework-specific files
    return undefined;
  }

  private detectBuildSystem(path: string): string {
    // In a real implementation, this would check for build configuration
    return 'bun';
  }

  private detectPackageManager(path: string): string {
    // In a real implementation, this would check for lock files
    return 'bun';
  }

  private detectTestFramework(path: string): string | undefined {
    // In a real implementation, this would check for test configuration
    return undefined;
  }

  private findEntryPoints(path: string): string[] {
    // In a real implementation, this would find main entry files
    return [];
  }

  private findConfigFiles(path: string): string[] {
    // In a real implementation, this would find configuration files
    return [];
  }

  private detectEnvironment(path: string): 'development' | 'staging' | 'production' {
    // In a real implementation, this would check environment variables
    return 'development';
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop();
    const langMap: Record<string, string> = {
      js: 'javascript',
      ts: 'typescript',
      py: 'python',
      rs: 'rust',
      go: 'go',
      java: 'java',
    };
    return langMap[ext || ''] || 'unknown';
  }

  private async extractSymbols(filePath: string): Promise<SymbolInfo[]> {
    // In a real implementation, this would parse the AST
    return [];
  }

  private async extractImports(filePath: string): Promise<ImportInfo[]> {
    // In a real implementation, this would parse imports
    return [];
  }

  private async extractExports(filePath: string): Promise<ExportInfo[]> {
    // In a real implementation, this would parse exports
    return [];
  }

  private async extractDependencies(filePath: string): Promise<string[]> {
    // In a real implementation, this would extract dependencies
    return [];
  }

  private findRelatedFiles(filePath: string): string[] {
    // In a real implementation, this would find related files
    return [];
  }

  private findTestFiles(filePath: string): string[] {
    // In a real implementation, this would find test files
    return [];
  }

  private findDocumentation(filePath: string): string[] {
    // In a real implementation, this would find documentation
    return [];
  }

  private updateRecentFiles(file: string): void {
    const files = this.userContext.recentFiles.filter(f => f !== file);
    files.unshift(file);
    this.userContext.recentFiles = files.slice(0, 20);
  }

  private updateRecentCommands(command: string): void {
    const commands = this.userContext.recentCommands.filter(c => c !== command);
    commands.unshift(command);
    this.userContext.recentCommands = commands.slice(0, 20);
  }

  private recordEditPattern(data: any): void {
    // In a real implementation, this would record edit patterns
  }

  private recordNavigationPattern(data: any): void {
    // In a real implementation, this would record navigation patterns
  }

  private recordContextHistory(type: string, context: any): void {
    this.contextHistory.push({
      timestamp: Date.now(),
      context: { type, ...context },
    });

    // Keep history size manageable
    if (this.contextHistory.length > this.maxHistorySize) {
      this.contextHistory.shift();
    }
  }
}

// Global context awareness engine instance
const contextAwareness = new ContextAwarenessEngine();

export async function initializeProjectContext(projectPath: string): Promise<ProjectContext> {
  return contextAwareness.initializeProjectContext(projectPath);
}

export function updateUserContext(action: string, data: any): void {
  contextAwareness.updateUserContext(action, data);
}

export async function getCodeContext(filePath: string): Promise<CodeContext> {
  return contextAwareness.getCodeContext(filePath);
}

export function getContextualSuggestions(): string[] {
  return contextAwareness.getContextualSuggestions();
}

export function predictNextAction(): string {
  return contextAwareness.predictNextAction();
}

export function getRelevantFiles(limit?: number): string[] {
  return contextAwareness.getRelevantFiles(limit);
}

export function getProjectSummary(): string {
  return contextAwareness.getProjectSummary();
}

export function clearContextCache(): void {
  contextAwareness.clearCache();
}
