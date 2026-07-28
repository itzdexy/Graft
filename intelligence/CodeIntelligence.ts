/**
 * Advanced code intelligence and project analysis system
 * Provides deep code understanding, pattern detection, and intelligent insights
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'
import {
  parseSymbols,
  parseImports,
  detectLanguageFromPath,
} from './treeSitter.js'

export interface CodeFile {
  path: string;
  language: string;
  size: number;
  lines: number;
  functions: FunctionInfo[];
  classes: ClassInfo[];
  imports: ImportInfo[];
  exports: ExportInfo[];
  complexity: number;
  dependencies: string[];
}

export interface FunctionInfo {
  name: string;
  line: number;
  parameters: ParameterInfo[];
  returnType?: string;
  complexity: number;
  isAsync: boolean;
  isExported: boolean;
  docstring?: string;
}

export interface ParameterInfo {
  name: string;
  type?: string;
  defaultValue?: string;
  isOptional: boolean;
}

export interface ClassInfo {
  name: string;
  line: number;
  methods: FunctionInfo[];
  properties: PropertyInfo[];
  extends?: string;
  implements?: string[];
  isExported: boolean;
}

export interface PropertyInfo {
  name: string;
  type?: string;
  isPrivate: boolean;
  isStatic: boolean;
  isReadonly: boolean;
}

export interface ImportInfo {
  module: string;
  imports: string[];
  line: number;
  isDefault: boolean;
  isDynamic: boolean;
}

export interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'variable' | 'type';
  line: number;
  isDefault: boolean;
}

export interface ProjectAnalysis {
  name: string;
  path: string;
  type: ProjectType;
  files: CodeFile[];
  totalLines: number;
  totalSize: number;
  languages: Map<string, number>;
  dependencies: ProjectDependency[];
  structure: ProjectStructure;
  patterns: CodePattern[];
  metrics: ProjectMetrics;
  issues: CodeIssue[];
}

export type ProjectType = 'javascript' | 'typescript' | 'python' | 'rust' | 'go' | 'java' | 'unknown';

export interface ProjectDependency {
  name: string;
  version: string;
  type: 'runtime' | 'dev' | 'peer';
  files: string[];
}

export interface ProjectStructure {
  directories: string[];
  entryPoints: string[];
  configFiles: string[];
  testFiles: string[];
  documentation: string[];
}

export interface CodePattern {
  name: string;
  description: string;
  occurrences: PatternOccurrence[];
  severity: 'info' | 'warning' | 'error';
  suggestion?: string;
}

export interface PatternOccurrence {
  file: string;
  line: number;
  context: string;
}

export interface CodeIssue {
  type: 'security' | 'performance' | 'maintainability' | 'bug' | 'style';
  severity: 'low' | 'medium' | 'high' | 'critical';
  file: string;
  line: number;
  message: string;
  suggestion?: string;
}

export interface ProjectMetrics {
  cyclomaticComplexity: number;
  maintainabilityIndex: number;
  codeDuplication: number;
  testCoverage: number;
  technicalDebt: number;
}

class CodeIntelligenceEngine {
  private projectCache: Map<string, ProjectAnalysis> = new Map();
  private fileCache: Map<string, CodeFile> = new Map();

  /**
   * Analyze a project directory
   */
  async analyzeProject(projectPath: string): Promise<ProjectAnalysis> {
    // Check cache first
    if (this.projectCache.has(projectPath)) {
      return this.projectCache.get(projectPath)!;
    }

    const analysis: ProjectAnalysis = {
      name: this.getProjectName(projectPath),
      path: projectPath,
      type: this.detectProjectType(projectPath),
      files: [],
      totalLines: 0,
      totalSize: 0,
      languages: new Map(),
      dependencies: [],
      structure: this.analyzeStructure(projectPath),
      patterns: [],
      metrics: this.calculateMetrics(),
      issues: [],
    };

    // Analyze files
    const files = await this.scanProjectFiles(projectPath);
    for (const file of files) {
      const codeFile = await this.analyzeFile(file);
      analysis.files.push(codeFile);
      analysis.totalLines += codeFile.lines;
      analysis.totalSize += codeFile.size;

      // Track languages
      const langCount = analysis.languages.get(codeFile.language) || 0;
      analysis.languages.set(codeFile.language, langCount + 1);
    }

    // Detect dependencies
    analysis.dependencies = await this.detectDependencies(projectPath);

    // Detect patterns
    analysis.patterns = this.detectPatterns(analysis.files);

    // Detect issues
    analysis.issues = this.detectIssues(analysis.files);

    // Calculate metrics
    analysis.metrics = this.calculateProjectMetrics(analysis);

    // Cache result
    this.projectCache.set(projectPath, analysis);

    return analysis;
  }

  /**
   * Analyze a single file
   */
  async analyzeFile(filePath: string): Promise<CodeFile> {
    // Check cache
    if (this.fileCache.has(filePath)) {
      return this.fileCache.get(filePath)!;
    }

    const language = this.detectLanguage(filePath);
    const content = await this.readFileContent(filePath);
    const lines = content.split('\n').length;

    const codeFile: CodeFile = {
      path: filePath,
      language,
      size: content.length,
      lines,
      functions: this.extractFunctions(content, language),
      classes: this.extractClasses(content, language),
      imports: this.extractImports(content, language),
      exports: this.extractExports(content, language),
      complexity: this.calculateComplexity(content, language),
      dependencies: this.extractFileDependencies(content, language),
    };

    // Cache result
    this.fileCache.set(filePath, codeFile);

    return codeFile;
  }

  /**
   * Search for code patterns across the project
   */
  searchPattern(pattern: string, projectPath: string): PatternOccurrence[] {
    const occurrences: PatternOccurrence[] = [];
    const analysis = this.projectCache.get(projectPath);

    if (!analysis) {
      return occurrences;
    }

    for (const file of analysis.files) {
      const matches = this.searchInFile(file.path, pattern);
      occurrences.push(...matches);
    }

    return occurrences;
  }

  /**
   * Find similar code (potential refactoring opportunities)
   */
  findSimilarCode(projectPath: string, threshold: number = 0.8): Array<{
    file1: string;
    file2: string;
    similarity: number;
    lines: number[];
  }> {
    const similarities: Array<{
      file1: string;
      file2: string;
      similarity: number;
      lines: number[];
    }> = [];

    const analysis = this.projectCache.get(projectPath);
    if (!analysis) return similarities;

    // Compare all pairs of files
    for (let i = 0; i < analysis.files.length; i++) {
      for (let j = i + 1; j < analysis.files.length; j++) {
        const file1 = analysis.files[i];
        const file2 = analysis.files[j];
        const similarity = this.calculateSimilarity(file1, file2);

        if (similarity >= threshold) {
          similarities.push({
            file1: file1.path,
            file2: file2.path,
            similarity,
            lines: this.findSimilarLines(file1, file2),
          });
        }
      }
    }

    return similarities;
  }

  /**
   * Get code suggestions for a specific location
   */
  getCodeSuggestions(filePath: string, line: number, column: number): string[] {
    const suggestions: string[] = [];
    const codeFile = this.fileCache.get(filePath);

    if (!codeFile) return suggestions;

    // Context-aware suggestions
    const context = this.getContextAtPosition(codeFile, line, column);

    if (context.type === 'function') {
      suggestions.push(...this.getFunctionSuggestions(context));
    } else if (context.type === 'class') {
      suggestions.push(...this.getClassSuggestions(context));
    } else if (context.type === 'import') {
      suggestions.push(...this.getImportSuggestions(context));
    }

    return suggestions;
  }

  /**
   * Generate project documentation
   */
  generateDocumentation(projectPath: string): string {
    const analysis = this.projectCache.get(projectPath);
    if (!analysis) return '';

    let doc = `# ${analysis.name}\n\n`;
    doc += `## Project Overview\n\n`;
    doc += `- **Type**: ${analysis.type}\n`;
    doc += `- **Files**: ${analysis.files.length}\n`;
    doc += `- **Total Lines**: ${analysis.totalLines}\n`;
    doc += `- **Languages**: ${Array.from(analysis.languages.entries()).map(([lang, count]) => `${lang} (${count})`).join(', ')}\n\n`;

    doc += `## Structure\n\n`;
    doc += `### Directories\n`;
    analysis.structure.directories.forEach(dir => {
      doc += `- ${dir}\n`;
    });

    doc += `\n### Entry Points\n`;
    analysis.structure.entryPoints.forEach(entry => {
      doc += `- ${entry}\n`;
    });

    doc += `\n## Dependencies\n\n`;
    analysis.dependencies.forEach(dep => {
      doc += `- ${dep.name}@${dep.version} (${dep.type})\n`;
    });

    doc += `\n## Code Metrics\n\n`;
    doc += `- **Cyclomatic Complexity**: ${analysis.metrics.cyclomaticComplexity.toFixed(2)}\n`;
    doc += `- **Maintainability Index**: ${analysis.metrics.maintainabilityIndex.toFixed(2)}\n`;
    doc += `- **Code Duplication**: ${(analysis.metrics.codeDuplication * 100).toFixed(1)}%\n`;
    doc += `- **Test Coverage**: ${(analysis.metrics.testCoverage * 100).toFixed(1)}%\n`;
    doc += `- **Technical Debt**: ${analysis.metrics.technicalDebt.toFixed(2)} hours\n`;

    doc += `\n## Issues\n\n`;
    analysis.issues.forEach(issue => {
      doc += `- [${issue.severity.toUpperCase()}] ${issue.type}: ${issue.message} (${issue.file}:${issue.line})\n`;
    });

    return doc;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.projectCache.clear();
    this.fileCache.clear();
  }

  // Private helper methods

  private getProjectName(path: string): string {
    return path.split(/[/\\]/).pop() || 'unknown';
  }

  private detectProjectType(path: string): ProjectType {
    if (existsSync(join(path, 'tsconfig.json'))) return 'typescript'
    if (existsSync(join(path, 'package.json'))) return 'javascript'
    if (existsSync(join(path, 'requirements.txt'))) return 'python'
    if (existsSync(join(path, 'Cargo.toml'))) return 'rust'
    if (existsSync(join(path, 'go.mod'))) return 'go'
    if (existsSync(join(path, 'pom.xml'))) return 'java'
    return 'unknown'
  }

  private async scanProjectFiles(path: string): Promise<string[]> {
    const skip = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage'])
    const exts = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java'])
    const out: string[] = []
    const walk = (dir: string): void => {
      if (out.length >= 400) return
      let entries: string[]
      try {
        entries = readdirSync(dir)
      } catch {
        return
      }
      for (const name of entries) {
        if (out.length >= 400) break
        if (skip.has(name)) continue
        const full = join(dir, name)
        try {
          const st = statSync(full)
          if (st.isDirectory()) walk(full)
          else if (exts.has(extname(name).toLowerCase())) out.push(full)
        } catch {
          // skip
        }
      }
    }
    walk(path)
    return out
  }

  private analyzeStructure(path: string): ProjectStructure {
    const dirs: string[] = []
    const entryPoints: string[] = []
    const configFiles: string[] = []
    const testFiles: string[] = []
    const documentation: string[] = []
    const candidates = ['package.json', 'tsconfig.json', 'README.md', 'tovyr.md']
    for (const c of candidates) {
      const p = join(path, c)
      if (existsSync(p)) {
        if (c.endsWith('.md')) documentation.push(p)
        else configFiles.push(p)
      }
    }
    for (const ep of ['src/index.ts', 'index.ts', 'main.ts', 'entrypoints/cli.tsx']) {
      const p = join(path, ep)
      if (existsSync(p)) entryPoints.push(p)
    }
    return { directories: dirs, entryPoints, configFiles, testFiles, documentation }
  }

  private detectLanguage(filePath: string): string {
    return detectLanguageFromPath(filePath)
  }

  private async readFileContent(filePath: string): Promise<string> {
    try {
      return readFileSync(filePath, 'utf8')
    } catch {
      return ''
    }
  }

  private extractFunctions(content: string, language: string): FunctionInfo[] {
    return parseSymbols(content, language)
      .filter(s => s.kind === 'function' || s.kind === 'method')
      .map(s => ({
        name: s.name,
        line: s.line,
        parameters: [],
        complexity: 1,
        isAsync: content.includes(`async function ${s.name}`) || content.includes(`async ${s.name}(`),
        isExported: content.includes(`export function ${s.name}`) || content.includes(`export const ${s.name}`),
      }))
  }

  private extractClasses(content: string, language: string): ClassInfo[] {
    return parseSymbols(content, language)
      .filter(s => s.kind === 'class' || s.kind === 'interface')
      .map(s => ({
        name: s.name,
        line: s.line,
        methods: [],
        properties: [],
        isExported: content.includes(`export class ${s.name}`) || content.includes(`export interface ${s.name}`),
      }))
  }

  private extractImports(content: string, language: string): ImportInfo[] {
    return parseImports(content, language).map(i => ({
      module: i.module,
      imports: i.names,
      line: i.line,
      isDefault: i.isDefault,
      isDynamic: false,
    }))
  }

  private extractExports(content: string, language: string): ExportInfo[] {
    const exports: ExportInfo[] = []
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i]!.match(/^export\s+(?:default\s+)?(?:function|class|const|type|interface)\s+(\w+)/)
      if (m) {
        exports.push({
          name: m[1]!,
          type: 'function',
          line: i + 1,
          isDefault: lines[i]!.includes('export default'),
        })
      }
    }
    return exports
  }

  private calculateComplexity(content: string, language: string): number {
    // Simplified complexity calculation
    const branches = (content.match(/if|else|for|while|case|catch/g) || []).length;
    return branches + 1;
  }

  private extractFileDependencies(content: string, language: string): string[] {
    // In a real implementation, this would extract import/require statements
    return [];
  }

  private async detectDependencies(projectPath: string): Promise<ProjectDependency[]> {
    const pkgPath = join(projectPath, 'package.json')
    if (!existsSync(pkgPath)) return []
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
        dependencies?: Record<string, string>
        devDependencies?: Record<string, string>
      }
      const deps: ProjectDependency[] = []
      for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
        deps.push({ name, version, type: 'runtime', files: [] })
      }
      for (const [name, version] of Object.entries(pkg.devDependencies ?? {})) {
        deps.push({ name, version, type: 'dev', files: [] })
      }
      return deps
    } catch {
      return []
    }
  }

  private detectPatterns(files: CodeFile[]): CodePattern[] {
    const patterns: CodePattern[] = []
    let anyCount = 0
    for (const f of files) {
      let content = ''
      try {
        content = readFileSync(f.path, 'utf8')
      } catch {
        continue
      }
      if (/\bany\b/.test(content)) anyCount++
    }
    if (anyCount > 3) {
      patterns.push({
        name: 'explicit-any',
        description: 'Multiple uses of `any` type',
        occurrences: [],
        severity: 'warning',
        suggestion: 'Prefer unknown or proper types',
      })
    }
    return patterns
  }

  private detectIssues(files: CodeFile[]): CodeIssue[] {
    const issues: CodeIssue[] = []
    for (const f of files) {
      if (f.complexity > 25) {
        issues.push({
          type: 'maintainability',
          severity: 'medium',
          file: f.path,
          line: 1,
          message: `High cyclomatic complexity (${f.complexity})`,
        })
      }
    }
    return issues
  }

  private calculateMetrics(): ProjectMetrics {
    return {
      cyclomaticComplexity: 0,
      maintainabilityIndex: 0,
      codeDuplication: 0,
      testCoverage: 0,
      technicalDebt: 0,
    };
  }

  private calculateProjectMetrics(analysis: ProjectAnalysis): ProjectMetrics {
    const avgComplexity = analysis.files.reduce((sum, f) => sum + f.complexity, 0) / analysis.files.length;
    
    return {
      cyclomaticComplexity: avgComplexity,
      maintainabilityIndex: Math.max(0, 171 - 5.2 * Math.log(avgComplexity) - 0.23 * avgComplexity),
      codeDuplication: 0,
      testCoverage: 0,
      technicalDebt: avgComplexity * 0.5,
    };
  }

  private searchInFile(filePath: string, pattern: string): PatternOccurrence[] {
    // In a real implementation, this would search the file content
    return [];
  }

  private calculateSimilarity(file1: CodeFile, file2: CodeFile): number {
    // In a real implementation, this would use a similarity algorithm
    return 0;
  }

  private findSimilarLines(file1: CodeFile, file2: CodeFile): number[] {
    // In a real implementation, this would find similar line ranges
    return [];
  }

  private getContextAtPosition(file: CodeFile, line: number, column: number): any {
    // In a real implementation, this would determine the context at the position
    return { type: 'unknown' };
  }

  private getFunctionSuggestions(context: any): string[] {
    return [];
  }

  private getClassSuggestions(context: any): string[] {
    return [];
  }

  private getImportSuggestions(context: any): string[] {
    return [];
  }
}

// Global code intelligence engine instance
const codeIntelligence = new CodeIntelligenceEngine();

export async function analyzeProject(projectPath: string): Promise<ProjectAnalysis> {
  return codeIntelligence.analyzeProject(projectPath);
}

export async function analyzeFile(filePath: string): Promise<CodeFile> {
  return codeIntelligence.analyzeFile(filePath);
}

export function searchPattern(pattern: string, projectPath: string): PatternOccurrence[] {
  return codeIntelligence.searchPattern(pattern, projectPath);
}

export function findSimilarCode(projectPath: string, threshold?: number): Array<{
  file1: string;
  file2: string;
  similarity: number;
  lines: number[];
}> {
  return codeIntelligence.findSimilarCode(projectPath, threshold);
}

export function getCodeSuggestions(filePath: string, line: number, column: number): string[] {
  return codeIntelligence.getCodeSuggestions(filePath, line, column);
}

export function generateDocumentation(projectPath: string): string {
  return codeIntelligence.generateDocumentation(projectPath);
}

export function clearCodeIntelligenceCache(): void {
  codeIntelligence.clearCache();
}
