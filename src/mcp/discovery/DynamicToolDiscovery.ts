/**
 * Dynamic Tool Discovery
 * Inspired by GitHub MCP Server's dynamic toolset discovery
 * Allows MCP hosts to list and enable toolsets in response to user prompts
 * Reduces context size by only loading relevant tools
 */

export interface Toolset {
  id: string;
  name: string;
  description: string;
  tools: Tool[];
  enabled: boolean;
  category: ToolsetCategory;
  dependencies: string[];
  metadata: ToolsetMetadata;
}

export type ToolsetCategory =
  | 'filesystem'
  | 'git'
  | 'github'
  | 'database'
  | 'web'
  | 'testing'
  | 'documentation'
  | 'custom';

export interface Tool {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  category: string;
  enabled: boolean;
}

export interface ToolsetMetadata {
  version: string;
  author: string;
  createdAt: number;
  updatedAt: number;
  usageCount: number;
  lastUsed?: number;
  tags: string[];
}

export interface Toolset {
  id: string;
  name: string;
  description: string;
  tools: Tool[];
  enabled: boolean;
  category: ToolsetCategory;
  dependencies: string[];
  metadata: ToolsetMetadata;
  tags: string[];
}

export interface DiscoveryRequest {
  query: string;
  context: DiscoveryContext;
  maxResults?: number;
}

export interface DiscoveryContext {
  projectId?: string;
  sessionId?: string;
  userId?: string;
  currentFile?: string;
  language?: string;
}

export interface DiscoveryResult {
  toolsets: Toolset[];
  relevanceScores: Map<string, number>;
  suggestions: string[];
}

export interface ToolsetEnableResult {
  success: boolean;
  toolset: Toolset;
  error?: string;
}

class DynamicToolDiscovery {
  private toolsets: Map<string, Toolset> = new Map();
  private enabledToolsets: Set<string> = new Set();
  private discoveryHistory: DiscoveryRequest[] = [];
  private relevanceCache: Map<string, number> = new Map();

  /**
   * Register a toolset
   */
  registerToolset(toolset: Toolset): void {
    this.toolsets.set(toolset.id, toolset);
  }

  /**
   * Unregister a toolset
   */
  unregisterToolset(toolsetId: string): boolean {
    return this.toolsets.delete(toolsetId);
  }

  /**
   * Get a toolset
   */
  getToolset(toolsetId: string): Toolset | undefined {
    return this.toolsets.get(toolsetId);
  }

  /**
   * Get all toolsets
   */
  getAllToolsets(): Toolset[] {
    return Array.from(this.toolsets.values());
  }

  /**
   * Get toolsets by category
   */
  getToolsetsByCategory(category: ToolsetCategory): Toolset[] {
    return this.getAllToolsets().filter(t => t.category === category);
  }

  /**
   * Get enabled toolsets
   */
  getEnabledToolsets(): Toolset[] {
    return Array.from(this.enabledToolsets)
      .map(id => this.toolsets.get(id))
      .filter((t): t is Toolset => t !== undefined);
  }

  /**
   * Enable a toolset
   */
  async enableToolset(toolsetId: string): Promise<ToolsetEnableResult> {
    const toolset = this.toolsets.get(toolsetId);
    if (!toolset) {
      return {
        success: false,
        toolset: {} as Toolset,
        error: `Toolset ${toolsetId} not found`,
      };
    }

    // Check dependencies
    for (const dep of toolset.dependencies) {
      if (!this.enabledToolsets.has(dep)) {
        return {
          success: false,
          toolset,
          error: `Dependency ${dep} is not enabled`,
        };
      }
    }

    toolset.enabled = true;
    this.enabledToolsets.add(toolsetId);
    toolset.metadata.lastUsed = Date.now();
    toolset.metadata.usageCount++;

    return {
      success: true,
      toolset,
    };
  }

  /**
   * Disable a toolset
   */
  disableToolset(toolsetId: string): boolean {
    const toolset = this.toolsets.get(toolsetId);
    if (!toolset) return false;

    toolset.enabled = false;
    this.enabledToolsets.delete(toolsetId);

    // Disable toolsets that depend on this one
    for (const ts of this.getAllToolsets()) {
      if (ts.dependencies.includes(toolsetId) && ts.enabled) {
        this.disableToolset(ts.id);
      }
    }

    return true;
  }

  /**
   * Discover relevant toolsets based on query
   */
  async discoverToolsets(request: DiscoveryRequest): Promise<DiscoveryResult> {
    this.discoveryHistory.push(request);

    const relevanceScores = new Map<string, number>();
    const suggestions: string[] = [];

    // Calculate relevance scores for each toolset
    for (const toolset of this.getAllToolsets()) {
      const score = this.calculateRelevance(toolset, request);
      relevanceScores.set(toolset.id, score);
      this.relevanceCache.set(`${toolset.id}:${request.query}`, score);
    }

    // Sort by relevance
    const sortedToolsets = this.getAllToolsets().sort(
      (a, b) => (relevanceScores.get(b.id) || 0) - (relevanceScores.get(a.id) || 0)
    );

    // Limit results
    const maxResults = request.maxResults || 10;
    const topToolsets = sortedToolsets.slice(0, maxResults);

    // Generate suggestions
    for (const toolset of topToolsets) {
      if (relevanceScores.get(toolset.id)! > 0.5) {
        suggestions.push(`Consider enabling ${toolset.name} for ${request.query}`);
      }
    }

    return {
      toolsets: topToolsets,
      relevanceScores,
      suggestions,
    };
  }

  /**
   * Auto-enable toolsets based on context
   */
  async autoEnableToolsets(context: DiscoveryContext): Promise<string[]> {
    const enabled: string[] = [];

    // Enable based on language
    if (context.language) {
      const languageToolsets = this.getToolsetsByCategory('custom')
        .filter(t => t.tags.includes(context.language!));

      for (const toolset of languageToolsets) {
        const result = await this.enableToolset(toolset.id);
        if (result.success) {
          enabled.push(toolset.id);
        }
      }
    }

    // Enable based on project type
    if (context.projectId) {
      const projectToolsets = this.getToolsetsByCategory('filesystem');
      for (const toolset of projectToolsets) {
        const result = await this.enableToolset(toolset.id);
        if (result.success) {
          enabled.push(toolset.id);
        }
      }
    }

    return enabled;
  }

  /**
   * Get tools from enabled toolsets
   */
  getEnabledTools(): Tool[] {
    const enabledToolsets = this.getEnabledToolsets();
    const tools: Tool[] = [];

    for (const toolset of enabledToolsets) {
      tools.push(...toolset.tools.filter(t => t.enabled));
    }

    return tools;
  }

  /**
   * Search tools by query
   */
  searchTools(query: string): Tool[] {
    const tools = this.getEnabledTools();
    const lowerQuery = query.toLowerCase();

    return tools.filter(
      t =>
        t.name.toLowerCase().includes(lowerQuery) ||
        t.description.toLowerCase().includes(lowerQuery) ||
        t.category.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get discovery history
   */
  getDiscoveryHistory(): DiscoveryRequest[] {
    return [...this.discoveryHistory];
  }

  /**
   * Clear discovery history
   */
  clearDiscoveryHistory(): void {
    this.discoveryHistory = [];
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalToolsets: number;
    enabledToolsets: number;
    totalTools: number;
    enabledTools: number;
    toolsetsByCategory: Record<ToolsetCategory, number>;
    mostUsedToolsets: Toolset[];
    discoveryCount: number;
  } {
    const toolsets = this.getAllToolsets();
    const enabled = this.getEnabledToolsets();
    const tools = this.getEnabledTools();

    const toolsetsByCategory: Record<ToolsetCategory, number> = {} as any;
    for (const toolset of toolsets) {
      toolsetsByCategory[toolset.category] = (toolsetsByCategory[toolset.category] || 0) + 1;
    }

    const mostUsedToolsets = [...toolsets].sort((a, b) => b.metadata.usageCount - a.metadata.usageCount).slice(0, 5);

    return {
      totalToolsets: toolsets.length,
      enabledToolsets: enabled.length,
      totalTools: toolsets.reduce((sum, t) => sum + t.tools.length, 0),
      enabledTools: tools.length,
      toolsetsByCategory,
      mostUsedToolsets,
      discoveryCount: this.discoveryHistory.length,
    };
  }

  /**
   * Clear relevance cache
   */
  clearRelevanceCache(): void {
    this.relevanceCache.clear();
  }

  // Private methods

  private calculateRelevance(toolset: Toolset, request: DiscoveryRequest): number {
    let score = 0;
    const query = request.query.toLowerCase();

    // Name match
    if (toolset.name.toLowerCase().includes(query)) {
      score += 0.5;
    }

    // Description match
    if (toolset.description.toLowerCase().includes(query)) {
      score += 0.3;
    }

    // Tag match
    for (const tag of toolset.metadata.tags) {
      if (tag.toLowerCase().includes(query)) {
        score += 0.2;
      }
    }

    // Tool match
    for (const tool of toolset.tools) {
      if (tool.name.toLowerCase().includes(query) || tool.description.toLowerCase().includes(query)) {
        score += 0.1;
      }
    }

    // Context match
    if (request.context.language && toolset.tags.includes(request.context.language)) {
      score += 0.3;
    }

    // Usage boost
    if (toolset.metadata.usageCount > 0) {
      score += Math.min(0.2, toolset.metadata.usageCount * 0.01);
    }

    // Cap at 1.0
    return Math.min(1.0, score);
  }
}

// Global dynamic tool discovery instance
const dynamicToolDiscovery = new DynamicToolDiscovery();

export function registerToolset(toolset: Toolset): void {
  dynamicToolDiscovery.registerToolset(toolset);
}

export function unregisterToolset(toolsetId: string): boolean {
  return dynamicToolDiscovery.unregisterToolset(toolsetId);
}

export function getToolset(toolsetId: string): Toolset | undefined {
  return dynamicToolDiscovery.getToolset(toolsetId);
}

export function getAllToolsets(): Toolset[] {
  return dynamicToolDiscovery.getAllToolsets();
}

export function getToolsetsByCategory(category: ToolsetCategory): Toolset[] {
  return dynamicToolDiscovery.getToolsetsByCategory(category);
}

export function getEnabledToolsets(): Toolset[] {
  return dynamicToolDiscovery.getEnabledToolsets();
}

export async function enableToolset(toolsetId: string): Promise<ToolsetEnableResult> {
  return dynamicToolDiscovery.enableToolset(toolsetId);
}

export function disableToolset(toolsetId: string): boolean {
  return dynamicToolDiscovery.disableToolset(toolsetId);
}

export async function discoverToolsets(request: DiscoveryRequest): Promise<DiscoveryResult> {
  return dynamicToolDiscovery.discoverToolsets(request);
}

export async function autoEnableToolsets(context: DiscoveryContext): Promise<string[]> {
  return dynamicToolDiscovery.autoEnableToolsets(context);
}

export function getEnabledTools(): Tool[] {
  return dynamicToolDiscovery.getEnabledTools();
}

export function searchTools(query: string): Tool[] {
  return dynamicToolDiscovery.searchTools(query);
}

export function getDiscoveryHistory(): DiscoveryRequest[] {
  return dynamicToolDiscovery.getDiscoveryHistory();
}

export function clearDiscoveryHistory(): void {
  dynamicToolDiscovery.clearDiscoveryHistory();
}

export function getStatistics(): {
  totalToolsets: number;
  enabledToolsets: number;
  totalTools: number;
  enabledTools: number;
  toolsetsByCategory: Record<ToolsetCategory, number>;
  mostUsedToolsets: Toolset[];
  discoveryCount: number;
} {
  return dynamicToolDiscovery.getStatistics();
}

export function clearRelevanceCache(): void {
  dynamicToolDiscovery.clearRelevanceCache();
}
