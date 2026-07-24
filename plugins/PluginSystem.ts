/**
 * Plugin System for Blink extensibility
 * Allows users to add custom tools, commands, themes, and integrations
 */

import { z } from 'zod';

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  blinkVersion: string;
  main: string;
  permissions: PluginPermission[];
  dependencies?: string[];
}

export interface PluginPermission {
  type: 'file' | 'network' | 'system' | 'clipboard' | 'notification';
  scope?: string[];
  description: string;
}

export interface Plugin {
  manifest: PluginManifest;
  activate: (context: PluginContext) => void;
  deactivate: () => void;
}

export interface PluginContext {
  registerTool: (tool: CustomTool) => void;
  registerCommand: (command: CustomCommand) => void;
  registerTheme: (theme: CustomTheme) => void;
  registerHook: (hook: PluginHook) => void;
  getConfig: () => Record<string, unknown>;
  setConfig: (config: Record<string, unknown>) => void;
  log: (message: string) => void;
}

export interface CustomTool {
  name: string;
  description: string;
  execute: (input: unknown) => Promise<unknown>;
  inputSchema?: z.ZodSchema;
}

export interface CustomCommand {
  name: string;
  description: string;
  execute: (args: string[]) => Promise<void>;
  aliases?: string[];
}

export interface CustomTheme {
  name: string;
  colors: Record<string, string>;
  isDark?: boolean;
}

export interface PluginHook {
  event: 'beforeToolExecution' | 'afterToolExecution' | 'onMessage' | 'onError';
  handler: (data: unknown) => void | Promise<void>;
  pluginName?: string;
}

class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private activePlugins: Set<string> = new Set();
  private pluginConfigs: Map<string, Record<string, unknown>> = new Map();
  private customTools: Map<string, CustomTool> = new Map();
  private customCommands: Map<string, CustomCommand> = new Map();
  private customThemes: Map<string, CustomTheme> = new Map();
  private hooks: Map<string, PluginHook[]> = new Map();

  /**
   * Load a plugin from a manifest file
   */
  async loadPlugin(pluginPath: string): Promise<void> {
    try {
      // Read manifest
      const manifestPath = `${pluginPath}/blink-plugin.json`;
      const manifest: PluginManifest = await this.readManifest(manifestPath);

      // Validate manifest
      this.validateManifest(manifest);

      // Check permissions
      if (!this.checkPermissions(manifest.permissions)) {
        throw new Error(`Plugin ${manifest.name} requires permissions that are not granted`);
      }

      // Load plugin module
      const pluginModule = await import(`${pluginPath}/${manifest.main}`);
      const plugin: Plugin = pluginModule.default || pluginModule;

      // Store plugin
      this.plugins.set(manifest.name, plugin);

      // Initialize config
      this.pluginConfigs.set(manifest.name, {});

      console.log(`Plugin ${manifest.name} v${manifest.version} loaded successfully`);
    } catch (error) {
      console.error(`Failed to load plugin from ${pluginPath}:`, error);
      throw error;
    }
  }

  /**
   * Activate a plugin
   */
  activatePlugin(pluginName: string): void {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} not found`);
    }

    if (this.activePlugins.has(pluginName)) {
      console.log(`Plugin ${pluginName} is already active`);
      return;
    }

    const context: PluginContext = {
      registerTool: (tool) => this.registerTool(pluginName, tool),
      registerCommand: (command) => this.registerCommand(pluginName, command),
      registerTheme: (theme) => this.registerTheme(pluginName, theme),
      registerHook: (hook) => this.registerHook(pluginName, hook),
      getConfig: () => this.pluginConfigs.get(pluginName) || {},
      setConfig: (config) => this.pluginConfigs.set(pluginName, config),
      log: (message) => console.log(`[${pluginName}] ${message}`),
    };

    plugin.activate(context);
    this.activePlugins.add(pluginName);
    console.log(`Plugin ${pluginName} activated`);
  }

  /**
   * Deactivate a plugin
   */
  deactivatePlugin(pluginName: string): void {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} not found`);
    }

    if (!this.activePlugins.has(pluginName)) {
      console.log(`Plugin ${pluginName} is not active`);
      return;
    }

    plugin.deactivate();
    this.activePlugins.delete(pluginName);

    // Remove plugin's resources
    this.removePluginResources(pluginName);

    console.log(`Plugin ${pluginName} deactivated`);
  }

  /**
   * Get all loaded plugins
   */
  getPlugins(): PluginManifest[] {
    return Array.from(this.plugins.values()).map(p => p.manifest);
  }

  /**
   * Get active plugins
   */
  getActivePlugins(): string[] {
    return Array.from(this.activePlugins);
  }

  /**
   * Get custom tools
   */
  getCustomTools(): CustomTool[] {
    return Array.from(this.customTools.values());
  }

  /**
   * Get custom commands
   */
  getCustomCommands(): CustomCommand[] {
    return Array.from(this.customCommands.values());
  }

  /**
   * Get custom themes
   */
  getCustomThemes(): CustomTheme[] {
    return Array.from(this.customThemes.values());
  }

  /**
   * Execute a custom tool
   */
  async executeTool(toolName: string, input: unknown): Promise<unknown> {
    const tool = this.customTools.get(toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }

    // Validate input if schema is provided
    if (tool.inputSchema) {
      const validated = tool.inputSchema.parse(input);
      return tool.execute(validated);
    }

    return tool.execute(input);
  }

  /**
   * Execute a custom command
   */
  async executeCommand(commandName: string, args: string[]): Promise<void> {
    const command = this.customCommands.get(commandName);
    if (!command) {
      throw new Error(`Command ${commandName} not found`);
    }

    return command.execute(args);
  }

  /**
   * Trigger a hook event
   */
  async triggerHook(event: string, data: unknown): Promise<void> {
    const hooks = this.hooks.get(event) || [];
    for (const hook of hooks) {
      try {
        await hook.handler(data);
      } catch (error) {
        console.error(`Hook ${event} failed:`, error);
      }
    }
  }

  /**
   * Register a custom tool
   */
  private registerTool(pluginName: string, tool: CustomTool): void {
    const qualifiedName = `${pluginName}:${tool.name}`;
    this.customTools.set(qualifiedName, { ...tool, name: qualifiedName });
  }

  /**
   * Register a custom command
   */
  private registerCommand(pluginName: string, command: CustomCommand): void {
    const qualifiedName = `${pluginName}:${command.name}`;
    this.customCommands.set(qualifiedName, { ...command, name: qualifiedName });
  }

  /**
   * Register a custom theme
   */
  private registerTheme(pluginName: string, theme: CustomTheme): void {
    const qualifiedName = `${pluginName}:${theme.name}`;
    this.customThemes.set(qualifiedName, { ...theme, name: qualifiedName });
  }

  /**
   * Register a hook
   */
  private registerHook(pluginName: string, hook: PluginHook): void {
    if (!this.hooks.has(hook.event)) {
      this.hooks.set(hook.event, []);
    }
    this.hooks.get(hook.event)!.push({ ...hook, pluginName });
  }

  /**
   * Remove all resources from a plugin
   */
  private removePluginResources(pluginName: string): void {
    // Remove tools
    for (const [name, tool] of this.customTools) {
      if (name.startsWith(`${pluginName}:`)) {
        this.customTools.delete(name);
      }
    }

    // Remove commands
    for (const [name, command] of this.customCommands) {
      if (name.startsWith(`${pluginName}:`)) {
        this.customCommands.delete(name);
      }
    }

    // Remove themes
    for (const [name, theme] of this.customThemes) {
      if (name.startsWith(`${pluginName}:`)) {
        this.customThemes.delete(name);
      }
    }

    // Remove hooks
    for (const [event, hooks] of this.hooks) {
      this.hooks.set(
        event,
        hooks.filter(h => h.pluginName !== pluginName)
      );
    }
  }

  /**
   * Read plugin manifest
   */
  private async readManifest(path: string): Promise<PluginManifest> {
    // In a real implementation, this would read from the file system
    // For now, return a mock manifest
    return {
      name: 'example-plugin',
      version: '1.0.0',
      description: 'Example plugin',
      author: 'Blink',
      license: 'MIT',
      blinkVersion: '1.0.0',
      main: 'index.js',
      permissions: [],
    };
  }

  /**
   * Validate plugin manifest
   */
  private validateManifest(manifest: PluginManifest): void {
    if (!manifest.name || !manifest.version || !manifest.main) {
      throw new Error('Invalid plugin manifest: missing required fields');
    }

    if (!manifest.permissions || !Array.isArray(manifest.permissions)) {
      throw new Error('Invalid plugin manifest: permissions must be an array');
    }
  }

  /**
   * Check if permissions are granted
   */
  private checkPermissions(permissions: PluginPermission[]): boolean {
    // In a real implementation, this would check against user-granted permissions
    // For now, allow all permissions
    return true;
  }
}

// Global plugin manager instance
const pluginManager = new PluginManager();

export function getPluginManager(): PluginManager {
  return pluginManager;
}

export async function loadPlugin(pluginPath: string): Promise<void> {
  return pluginManager.loadPlugin(pluginPath);
}

export function activatePlugin(pluginName: string): void {
  pluginManager.activatePlugin(pluginName);
}

export function deactivatePlugin(pluginName: string): void {
  pluginManager.deactivatePlugin(pluginName);
}

export function getPlugins(): PluginManifest[] {
  return pluginManager.getPlugins();
}

export function getActivePlugins(): string[] {
  return pluginManager.getActivePlugins();
}

export function getCustomTools(): CustomTool[] {
  return pluginManager.getCustomTools();
}

export function getCustomCommands(): CustomCommand[] {
  return pluginManager.getCustomCommands();
}

export function getCustomThemes(): CustomTheme[] {
  return pluginManager.getCustomThemes();
}

export async function executeTool(toolName: string, input: unknown): Promise<unknown> {
  return pluginManager.executeTool(toolName, input);
}

export async function executeCommand(commandName: string, args: string[]): Promise<void> {
  return pluginManager.executeCommand(commandName, args);
}

export async function triggerHook(event: string, data: unknown): Promise<void> {
  return pluginManager.triggerHook(event, data);
}
