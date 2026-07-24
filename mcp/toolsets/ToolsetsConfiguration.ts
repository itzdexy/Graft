/**
 * Toolsets Configuration
 * Inspired by GitHub MCP Server's toolset configuration system
 * Allows enabling/disabling specific groups of functionalities via toolsets
 * Provides fine-grained control over which tools are available to the AI
 */

export interface ToolsetConfig {
  id: string;
  name: string;
  description: string;
  tools: string[];
  enabled: boolean;
  permissions: PermissionConfig;
  dependencies: string[];
  metadata: ToolsetConfigMetadata;
}

export interface PermissionConfig {
  requireApproval: boolean;
  allowedUsers?: string[];
  allowedRoles?: string[];
  rateLimit?: RateLimitConfig;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface ToolsetConfigMetadata {
  version: string;
  createdAt: number;
  updatedAt: number;
  author: string;
  category: ToolsetCategory;
  tags: string[];
}

export type ToolsetCategory =
  | 'filesystem'
  | 'git'
  | 'github'
  | 'issues'
  | 'pull_requests'
  | 'users'
  | 'code_security'
  | 'experiments'
  | 'custom';

export interface ToolConfig {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  toolsetId: string;
  enabled: boolean;
  dangerous: boolean;
}

export interface ToolsetEnableResult {
  success: boolean;
  toolset: ToolsetConfig;
  error?: string;
  warnings?: string[];
}

export interface ToolsetDisableResult {
  success: boolean;
  toolset: ToolsetConfig;
  disabledDependents: string[];
  error?: string;
}

export interface ToolsetValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

class ToolsetConfigurationManager {
  private toolsets: Map<string, ToolsetConfig> = new Map();
  private tools: Map<string, ToolConfig> = new Map();
  private configPath: string;
  private autoSave: boolean;

  constructor(configPath: string = '~/.blink/toolsets.json', autoSave: boolean = true) {
    this.configPath = configPath;
    this.autoSave = autoSave;
  }

  /**
   * Load configuration from file
   */
  async loadConfig(): Promise<void> {
    // In a real implementation, this would load from the config file
    console.log(`Loading toolset configuration from ${this.configPath}`);
  }

  /**
   * Save configuration to file
   */
  async saveConfig(): Promise<void> {
    if (!this.autoSave) return;

    // In a real implementation, this would save to the config file
    console.log(`Saving toolset configuration to ${this.configPath}`);
  }

  /**
   * Register a toolset
   */
  registerToolset(toolset: ToolsetConfig): void {
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
  getToolset(toolsetId: string): ToolsetConfig | undefined {
    return this.toolsets.get(toolsetId);
  }

  /**
   * Get all toolsets
   */
  getAllToolsets(): ToolsetConfig[] {
    return Array.from(this.toolsets.values());
  }

  /**
   * Get toolsets by category
   */
  getToolsetsByCategory(category: ToolsetCategory): ToolsetConfig[] {
    return this.getAllToolsets().filter(t => t.metadata.category === category);
  }

  /**
   * Get enabled toolsets
   */
  getEnabledToolsets(): ToolsetConfig[] {
    return this.getAllToolsets().filter(t => t.enabled);
  }

  /**
   * Enable a toolset
   */
  async enableToolset(toolsetId: string): Promise<ToolsetEnableResult> {
    const toolset = this.toolsets.get(toolsetId);
    if (!toolset) {
      return {
        success: false,
        toolset: {} as ToolsetConfig,
        error: `Toolset ${toolsetId} not found`,
      };
    }

    const warnings: string[] = [];

    // Check dependencies
    for (const dep of toolset.dependencies) {
      const depToolset = this.toolsets.get(dep);
      if (!depToolset) {
        return {
          success: false,
          toolset,
          error: `Dependency ${dep} not found`,
        };
      }

      if (!depToolset.enabled) {
        warnings.push(`Dependency ${dep} is not enabled. Enabling it now.`);
        await this.enableToolset(dep);
      }
    }

    toolset.enabled = true;
    toolset.metadata.updatedAt = Date.now();

    // Enable all tools in the toolset
    for (const toolId of toolset.tools) {
      const tool = this.tools.get(toolId);
      if (tool) {
        tool.enabled = true;
      }
    }

    if (this.autoSave) {
      await this.saveConfig();
    }

    return {
      success: true,
      toolset,
      warnings,
    };
  }

  /**
   * Disable a toolset
   */
  async disableToolset(toolsetId: string): Promise<ToolsetDisableResult> {
    const toolset = this.toolsets.get(toolsetId);
    if (!toolset) {
      return {
        success: false,
        toolset: {} as ToolsetConfig,
        disabledDependents: [],
        error: `Toolset ${toolsetId} not found`,
      };
    }

    toolset.enabled = false;
    toolset.metadata.updatedAt = Date.now();

    // Disable all tools in the toolset
    for (const toolId of toolset.tools) {
      const tool = this.tools.get(toolId);
      if (tool) {
        tool.enabled = false;
      }
    }

    // Find and disable dependents
    const disabledDependents: string[] = [];
    for (const ts of this.getAllToolsets()) {
      if (ts.dependencies.includes(toolsetId) && ts.enabled) {
        await this.disableToolset(ts.id);
        disabledDependents.push(ts.id);
      }
    }

    if (this.autoSave) {
      await this.saveConfig();
    }

    return {
      success: true,
      toolset,
      disabledDependents,
    };
  }

  /**
   * Validate toolset configuration
   */
  validateToolset(toolset: ToolsetConfig): ToolsetValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if toolset has tools
    if (toolset.tools.length === 0) {
      warnings.push('Toolset has no tools');
    }

    // Check dependencies
    for (const dep of toolset.dependencies) {
      if (!this.toolsets.has(dep)) {
        errors.push(`Dependency ${dep} does not exist`);
      }
    }

    // Check for circular dependencies
    if (this.hasCircularDependency(toolset.id, toolset.dependencies, new Set())) {
      errors.push('Circular dependency detected');
    }

    // Check permissions
    if (toolset.permissions.requireApproval && !toolset.permissions.allowedUsers?.length && !toolset.permissions.allowedRoles?.length) {
      warnings.push('Toolset requires approval but no users or roles are allowed');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Register a tool
   */
  registerTool(tool: ToolConfig): void {
    this.tools.set(tool.id, tool);
  }

  /**
   * Unregister a tool
   */
  unregisterTool(toolId: string): boolean {
    return this.tools.delete(toolId);
  }

  /**
   * Get a tool
   */
  getTool(toolId: string): ToolConfig | undefined {
    return this.tools.get(toolId);
  }

  /**
   * Get all tools
   */
  getAllTools(): ToolConfig[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get enabled tools
   */
  getEnabledTools(): ToolConfig[] {
    return this.getAllTools().filter(t => t.enabled);
  }

  /**
   * Get tools by toolset
   */
  getToolsByToolset(toolsetId: string): ToolConfig[] {
    const toolset = this.toolsets.get(toolsetId);
    if (!toolset) return [];

    return toolset.tools
      .map(id => this.tools.get(id))
      .filter((t): t is ToolConfig => t !== undefined);
  }

  /**
   * Get dangerous tools
   */
  getDangerousTools(): ToolConfig[] {
    return this.getAllTools().filter(t => t.dangerous);
  }

  /**
   * Check if a tool requires approval
   */
  requiresApproval(toolId: string): boolean {
    const tool = this.tools.get(toolId);
    if (!tool) return false;

    const toolset = this.toolsets.get(tool.toolsetId);
    if (!toolset) return false;

    return toolset.permissions.requireApproval;
  }

  /**
   * Check rate limit for a toolset
   */
  checkRateLimit(toolsetId: string): boolean {
    const toolset = this.toolsets.get(toolsetId);
    if (!toolset || !toolset.permissions.rateLimit) return true;

    // In a real implementation, this would check actual rate limits
    return true;
  }

  /**
   * Get configuration statistics
   */
  getStatistics(): {
    totalToolsets: number;
    enabledToolsets: number;
    totalTools: number;
    enabledTools: number;
    dangerousTools: number;
    toolsetsByCategory: Record<ToolsetCategory, number>;
  } {
    const toolsets = this.getAllToolsets();
    const enabled = this.getEnabledToolsets();
    const tools = this.getAllTools();
    const enabledToolsCount = this.getEnabledTools().length;
    const dangerous = this.getDangerousTools().length;

    const toolsetsByCategory: Record<ToolsetCategory, number> = {} as any;
    for (const toolset of toolsets) {
      toolsetsByCategory[toolset.metadata.category] = (toolsetsByCategory[toolset.metadata.category] || 0) + 1;
    }

    return {
      totalToolsets: toolsets.length,
      enabledToolsets: enabled.length,
      totalTools: tools.length,
      enabledTools: enabledToolsCount,
      dangerousTools: dangerous,
      toolsetsByCategory,
    };
  }

  /**
   * Export configuration
   */
  exportConfig(): string {
    const config = {
      toolsets: Array.from(this.toolsets.values()),
      tools: Array.from(this.tools.values()),
    };

    return JSON.stringify(config, null, 2);
  }

  /**
   * Import configuration
   */
  async importConfig(configJson: string): Promise<void> {
    const config = JSON.parse(configJson);

    for (const toolset of config.toolsets) {
      this.registerToolset(toolset);
    }

    for (const tool of config.tools) {
      this.registerTool(tool);
    }

    if (this.autoSave) {
      await this.saveConfig();
    }
  }

  /**
   * Reset to default configuration
   */
  async resetToDefaults(): Promise<void> {
    this.toolsets.clear();
    this.tools.clear();

    // Register default toolsets
    this.registerDefaultToolsets();

    if (this.autoSave) {
      await this.saveConfig();
    }
  }

  // Private methods

  private hasCircularDependency(toolsetId: string, dependencies: string[], visited: Set<string>): boolean {
    if (visited.has(toolsetId)) return true;

    visited.add(toolsetId);

    for (const dep of dependencies) {
      const depToolset = this.toolsets.get(dep);
      if (depToolset && this.hasCircularDependency(dep, depToolset.dependencies, new Set(visited))) {
        return true;
      }
    }

    return false;
  }

  private registerDefaultToolsets(): void {
    // Register default filesystem toolset
    this.registerToolset({
      id: 'filesystem',
      name: 'Filesystem',
      description: 'File system operations',
      tools: ['read_file', 'write_file', 'list_directory', 'delete_file'],
      enabled: true,
      permissions: {
        requireApproval: false,
      },
      dependencies: [],
      metadata: {
        version: '1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        author: 'Blink',
        category: 'filesystem',
        tags: ['default'],
      },
    });

    // Register default git toolset
    this.registerToolset({
      id: 'git',
      name: 'Git',
      description: 'Git version control operations',
      tools: ['git_status', 'git_diff', 'git_commit', 'git_branch'],
      enabled: true,
      permissions: {
        requireApproval: false,
      },
      dependencies: [],
      metadata: {
        version: '1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        author: 'Blink',
        category: 'git',
        tags: ['default'],
      },
    });
  }
}

// Global toolset configuration manager instance
const toolsetConfigManager = new ToolsetConfigurationManager();

export async function loadConfig(): Promise<void> {
  return toolsetConfigManager.loadConfig();
}

export async function saveConfig(): Promise<void> {
  return toolsetConfigManager.saveConfig();
}

export function registerToolset(toolset: ToolsetConfig): void {
  toolsetConfigManager.registerToolset(toolset);
}

export function unregisterToolset(toolsetId: string): boolean {
  return toolsetConfigManager.unregisterToolset(toolsetId);
}

export function getToolset(toolsetId: string): ToolsetConfig | undefined {
  return toolsetConfigManager.getToolset(toolsetId);
}

export function getAllToolsets(): ToolsetConfig[] {
  return toolsetConfigManager.getAllToolsets();
}

export function getToolsetsByCategory(category: ToolsetCategory): ToolsetConfig[] {
  return toolsetConfigManager.getToolsetsByCategory(category);
}

export function getEnabledToolsets(): ToolsetConfig[] {
  return toolsetConfigManager.getEnabledToolsets();
}

export async function enableToolset(toolsetId: string): Promise<ToolsetEnableResult> {
  return toolsetConfigManager.enableToolset(toolsetId);
}

export async function disableToolset(toolsetId: string): Promise<ToolsetDisableResult> {
  return toolsetConfigManager.disableToolset(toolsetId);
}

export function validateToolset(toolset: ToolsetConfig): ToolsetValidationResult {
  return toolsetConfigManager.validateToolset(toolset);
}

export function registerTool(tool: ToolConfig): void {
  toolsetConfigManager.registerTool(tool);
}

export function unregisterTool(toolId: string): boolean {
  return toolsetConfigManager.unregisterTool(toolId);
}

export function getTool(toolId: string): ToolConfig | undefined {
  return toolsetConfigManager.getTool(toolId);
}

export function getAllTools(): ToolConfig[] {
  return toolsetConfigManager.getAllTools();
}

export function getEnabledTools(): ToolConfig[] {
  return toolsetConfigManager.getEnabledTools();
}

export function getToolsByToolset(toolsetId: string): ToolConfig[] {
  return toolsetConfigManager.getToolsByToolset(toolsetId);
}

export function getDangerousTools(): ToolConfig[] {
  return toolsetConfigManager.getDangerousTools();
}

export function requiresApproval(toolId: string): boolean {
  return toolsetConfigManager.requiresApproval(toolId);
}

export function checkRateLimit(toolsetId: string): boolean {
  return toolsetConfigManager.checkRateLimit(toolsetId);
}

export function getStatistics(): {
  totalToolsets: number;
  enabledToolsets: number;
  totalTools: number;
  enabledTools: number;
  dangerousTools: number;
  toolsetsByCategory: Record<ToolsetCategory, number>;
} {
  return toolsetConfigManager.getStatistics();
}

export function exportConfig(): string {
  return toolsetConfigManager.exportConfig();
}

export async function importConfig(configJson: string): Promise<void> {
  return toolsetConfigManager.importConfig(configJson);
}

export async function resetToDefaults(): Promise<void> {
  return toolsetConfigManager.resetToDefaults();
}
