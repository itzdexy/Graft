/**
 * Command Files with IDs
 * Inspired by OpenCode's command file system with unique IDs for tracking
 * Provides persistent command storage, execution tracking, and history management
 */

export interface CommandFileManager {
  id: string;
  name: string;
  config: CommandConfig;
  commands: Map<string, CommandFile>;
  history: Map<string, CommandExecution>;
  aliases: Map<string, string>;
  statistics: CommandStatistics;
  metadata: ManagerMetadata;
}

export interface CommandConfig {
  maxHistorySize: number;
  enableAutoSave: boolean;
  enableAliases: boolean;
  enableValidation: boolean;
  timeout: number;
  maxRetries: number;
}

export interface CommandFile {
  id: string;
  name: string;
  description: string;
  command: string;
  parameters: CommandParameter[];
  environment: Record<string, string>;
  workingDirectory?: string;
  timeout?: number;
  retryOnFailure: boolean;
  enabled: boolean;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  executionCount: number;
}

export interface CommandParameter {
  name: string;
  type: ParameterType;
  required: boolean;
  defaultValue?: unknown;
  description: string;
  validation?: ValidationRule;
}

export type ParameterType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'file';

export interface ValidationRule {
  pattern?: string;
  min?: number;
  max?: number;
  enum?: unknown[];
}

export interface CommandExecution {
  id: string;
  commandId: string;
  parameters: Record<string, unknown>;
  status: ExecutionStatus;
  output: string;
  error?: string;
  exitCode?: number;
  duration: number;
  startedAt: number;
  completedAt: number;
  retryCount: number;
}

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';

export interface CommandStatistics {
  totalCommands: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  totalAliases: number;
}

export interface ManagerMetadata {
  version: string;
  createdAt: number;
  updatedAt: number;
  totalOperations: number;
}

export interface CommandResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode?: number;
  duration: number;
}

class CommandFileManagerImpl {
  private managers: Map<string, CommandFileManager> = new Map();

  /**
   * Create a command file manager
   */
  createManager(name: string, config?: Partial<CommandConfig>): CommandFileManager {
    const manager: CommandFileManager = {
      id: this.generateManagerId(),
      name,
      config: {
        maxHistorySize: config?.maxHistorySize || 1000,
        enableAutoSave: config?.enableAutoSave ?? true,
        enableAliases: config?.enableAliases ?? true,
        enableValidation: config?.enableValidation ?? true,
        timeout: config?.timeout || 300000, // 5 minutes
        maxRetries: config?.maxRetries || 3,
      },
      commands: new Map(),
      history: new Map(),
      aliases: new Map(),
      statistics: {
        totalCommands: 0,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTime: 0,
        totalAliases: 0,
      },
      metadata: {
        version: '1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        totalOperations: 0,
      },
    };

    this.managers.set(manager.id, manager);
    return manager;
  }

  /**
   * Get a manager
   */
  getManager(managerId: string): CommandFileManager | undefined {
    return this.managers.get(managerId);
  }

  /**
   * Get all managers
   */
  getAllManagers(): CommandFileManager[] {
    return Array.from(this.managers.values());
  }

  /**
   * Delete a manager
   */
  deleteManager(managerId: string): boolean {
    return this.managers.delete(managerId);
  }

  /**
   * Add a command
   */
  addCommand(managerId: string, command: CommandFile): boolean {
    const manager = this.managers.get(managerId);
    if (!manager) return false;

    manager.commands.set(command.id, command);
    manager.statistics.totalCommands++;
    manager.metadata.updatedAt = Date.now();

    return true;
  }

  /**
   * Get a command by ID
   */
  getCommand(managerId: string, commandId: string): CommandFile | undefined {
    const manager = this.managers.get(managerId);
    if (!manager) return undefined;

    return manager.commands.get(commandId);
  }

  /**
   * Get a command by name or alias
   */
  getCommandByName(managerId: string, name: string): CommandFile | undefined {
    const manager = this.managers.get(managerId);
    if (!manager) return undefined;

    // Check direct name
    for (const command of manager.commands.values()) {
      if (command.name === name) return command;
    }

    // Check aliases
    const commandId = manager.aliases.get(name);
    if (commandId) {
      return manager.commands.get(commandId);
    }

    return undefined;
  }

  /**
   * Get all commands
   */
  getCommands(managerId: string): CommandFile[] {
    const manager = this.managers.get(managerId);
    if (!manager) return [];

    return Array.from(manager.commands.values());
  }

  /**
   * Update a command
   */
  updateCommand(managerId: string, commandId: string, updates: Partial<CommandFile>): boolean {
    const manager = this.managers.get(managerId);
    if (!manager) return false;

    const command = manager.commands.get(commandId);
    if (!command) return false;

    Object.assign(command, updates, { updatedAt: Date.now() });
    manager.metadata.updatedAt = Date.now();

    return true;
  }

  /**
   * Delete a command
   */
  deleteCommand(managerId: string, commandId: string): boolean {
    const manager = this.managers.get(managerId);
    if (!manager) return false;

    const removed = manager.commands.delete(commandId);
    if (removed) {
      // Remove associated aliases
      for (const [alias, cmdId] of manager.aliases) {
        if (cmdId === commandId) {
          manager.aliases.delete(alias);
        }
      }
      manager.statistics.totalCommands--;
      manager.metadata.updatedAt = Date.now();
    }

    return removed;
  }

  /**
   * Add an alias for a command
   */
  addAlias(managerId: string, commandId: string, alias: string): boolean {
    const manager = this.managers.get(managerId);
    if (!manager) return false;

    if (!manager.commands.has(commandId)) return false;

    manager.aliases.set(alias, commandId);
    manager.statistics.totalAliases++;
    manager.metadata.updatedAt = Date.now();

    return true;
  }

  /**
   * Remove an alias
   */
  removeAlias(managerId: string, alias: string): boolean {
    const manager = this.managers.get(managerId);
    if (!manager) return false;

    const removed = manager.aliases.delete(alias);
    if (removed) {
      manager.statistics.totalAliases--;
      manager.metadata.updatedAt = Date.now();
    }

    return removed;
  }

  /**
   * Execute a command
   */
  async executeCommand(
    managerId: string,
    commandId: string,
    parameters?: Record<string, unknown>
  ): Promise<CommandResult> {
    const manager = this.managers.get(managerId);
    if (!manager) {
      throw new Error(`Manager ${managerId} not found`);
    }

    const command = manager.commands.get(commandId);
    if (!command) {
      throw new Error(`Command ${commandId} not found`);
    }

    if (!command.enabled) {
      throw new Error(`Command ${commandId} is disabled`);
    }

    // Validate parameters if enabled
    if (manager.config.enableValidation) {
      this.validateParameters(command, parameters || {});
    }

    const execution: CommandExecution = {
      id: this.generateExecutionId(),
      commandId,
      parameters: parameters || {},
      status: 'pending',
      output: '',
      startedAt: Date.now(),
      completedAt: 0,
      duration: 0,
      retryCount: 0,
    };

    manager.history.set(execution.id, execution);

    let retryCount = 0;
    const maxRetries = command.retryOnFailure ? manager.config.maxRetries : 0;

    while (retryCount <= maxRetries) {
      execution.retryCount = retryCount;
      execution.status = 'running';
      execution.startedAt = Date.now();

      try {
        const result = await this.executeCommandInternal(command, parameters);

        execution.status = 'completed';
        execution.output = result.output;
        execution.exitCode = result.exitCode;
        execution.completedAt = Date.now();
        execution.duration = execution.completedAt - execution.startedAt;

        command.executionCount++;
        command.updatedAt = Date.now();

        manager.statistics.totalExecutions++;
        manager.statistics.successfulExecutions++;
        manager.statistics.averageExecutionTime =
          this.updateAverage(manager.statistics.averageExecutionTime, manager.statistics.totalExecutions, execution.duration);

        manager.metadata.totalOperations++;
        manager.metadata.updatedAt = Date.now();

        // Trim history if needed
        this.trimHistory(manager);

        return result;

      } catch (error) {
        execution.status = 'failed';
        execution.error = String(error);
        execution.completedAt = Date.now();
        execution.duration = execution.completedAt - execution.startedAt;

        retryCount++;

        if (retryCount > maxRetries) {
          command.executionCount++;
          command.updatedAt = Date.now();

          manager.statistics.totalExecutions++;
          manager.statistics.failedExecutions++;

          manager.metadata.totalOperations++;
          manager.metadata.updatedAt = Date.now();

          this.trimHistory(manager);

          return {
            success: false,
            output: execution.output,
            error: execution.error,
            duration: execution.duration,
          };
        }
      }
    }

    throw new Error('Execution failed after retries');
  }

  /**
   * Execute a command by name or alias
   */
  async executeByName(managerId: string, name: string, parameters?: Record<string, unknown>): Promise<CommandResult> {
    const manager = this.managers.get(managerId);
    if (!manager) {
      throw new Error(`Manager ${managerId} not found`);
    }

    const command = this.getCommandByName(managerId, name);
    if (!command) {
      throw new Error(`Command ${name} not found`);
    }

    return this.executeCommand(managerId, command.id, parameters);
  }

  /**
   * Get execution history
   */
  getHistory(managerId: string, limit?: number): CommandExecution[] {
    const manager = this.managers.get(managerId);
    if (!manager) return [];

    const history = Array.from(manager.history.values())
      .sort((a, b) => b.startedAt - a.startedAt);

    if (limit) {
      return history.slice(0, limit);
    }

    return history;
  }

  /**
   * Get execution by ID
   */
  getExecution(managerId: string, executionId: string): CommandExecution | undefined {
    const manager = this.managers.get(managerId);
    if (!manager) return undefined;

    return manager.history.get(executionId);
  }

  /**
   * Search commands by tag
   */
  searchByTag(managerId: string, tag: string): CommandFile[] {
    const manager = this.managers.get(managerId);
    if (!manager) return [];

    return Array.from(manager.commands.values())
      .filter(cmd => cmd.tags.includes(tag));
  }

  /**
   * Search commands by name
   */
  searchByName(managerId: string, query: string): CommandFile[] {
    const manager = this.managers.get(managerId);
    if (!manager) return [];

    const lowerQuery = query.toLowerCase();
    return Array.from(manager.commands.values())
      .filter(cmd => cmd.name.toLowerCase().includes(lowerQuery));
  }

  /**
   * Get statistics for a manager
   */
  getStatistics(managerId: string): CommandStatistics | undefined {
    const manager = this.managers.get(managerId);
    if (!manager) return undefined;

    return { ...manager.statistics };
  }

  /**
   * Reset statistics for a manager
   */
  resetStatistics(managerId: string): boolean {
    const manager = this.managers.get(managerId);
    if (!manager) return false;

    manager.statistics = {
      totalCommands: manager.commands.size,
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      totalAliases: manager.aliases.size,
    };

    manager.metadata.updatedAt = Date.now();

    return true;
  }

  // Private methods

  private async executeCommandInternal(command: CommandFile, parameters?: Record<string, unknown>): Promise<CommandResult> {
    // Simulate command execution
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 100));

    // Substitute parameters into command
    let commandString = command.command;
    if (parameters) {
      for (const [key, value] of Object.entries(parameters)) {
        commandString = commandString.replace(`\${${key}}`, String(value));
      }
    }

    return {
      success: true,
      output: `Executed: ${commandString}`,
      exitCode: 0,
      duration: Math.random() * 500 + 100,
    };
  }

  private validateParameters(command: CommandFile, parameters: Record<string, unknown>): void {
    for (const param of command.parameters) {
      const value = parameters[param.name];

      if (param.required && value === undefined) {
        throw new Error(`Required parameter ${param.name} is missing`);
      }

      if (value !== undefined && param.validation) {
        this.validateValue(value, param.validation);
      }
    }
  }

  private validateValue(value: unknown, validation: ValidationRule): void {
    if (validation.pattern && typeof value === 'string') {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value)) {
        throw new Error(`Value ${value} does not match pattern ${validation.pattern}`);
      }
    }

    if (validation.enum !== undefined && !validation.enum.includes(value)) {
      throw new Error(`Value ${value} is not in allowed values`);
    }

    if (typeof value === 'number') {
      if (validation.min !== undefined && value < validation.min) {
        throw new Error(`Value ${value} is below minimum ${validation.min}`);
      }
      if (validation.max !== undefined && value > validation.max) {
        throw new Error(`Value ${value} is above maximum ${validation.max}`);
      }
    }
  }

  private trimHistory(manager: CommandFileManager): void {
    while (manager.history.size > manager.config.maxHistorySize) {
      const oldest = Array.from(manager.history.values())
        .sort((a, b) => a.startedAt - b.startedAt)[0];
      manager.history.delete(oldest.id);
    }
  }

  private updateAverage(current: number, count: number, newValue: number): number {
    if (count === 1) return newValue;
    return (current * (count - 1) + newValue) / count;
  }

  private generateManagerId(): string {
    return `manager-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Helper functions to create commands
export function createCommandFile(
  id: string,
  name: string,
  description: string,
  command: string,
  parameters: CommandParameter[],
  tags: string[] = []
): CommandFile {
  return {
    id,
    name,
    description,
    command,
    parameters,
    environment: {},
    retryOnFailure: false,
    enabled: true,
    tags,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    executionCount: 0,
  };
}

export function createCommandParameter(
  name: string,
  type: ParameterType,
  required: boolean,
  description: string,
  defaultValue?: unknown,
  validation?: ValidationRule
): CommandParameter {
  return { name, type, required, description, defaultValue, validation };
}

// Global command file manager instance
const commandFileManager = new CommandFileManagerImpl();

export function createManager(name: string, config?: Partial<CommandConfig>): CommandFileManager {
  return commandFileManager.createManager(name, config);
}

export function getManager(managerId: string): CommandFileManager | undefined {
  return commandFileManager.getManager(managerId);
}

export function getAllManagers(): CommandFileManager[] {
  return commandFileManager.getAllManagers();
}

export function deleteManager(managerId: string): boolean {
  return commandFileManager.deleteManager(managerId);
}

export function addCommand(managerId: string, command: CommandFile): boolean {
  return commandFileManager.addCommand(managerId, command);
}

export function getCommand(managerId: string, commandId: string): CommandFile | undefined {
  return commandFileManager.getCommand(managerId, commandId);
}

export function getCommandByName(managerId: string, name: string): CommandFile | undefined {
  return commandFileManager.getCommandByName(managerId, name);
}

export function getCommands(managerId: string): CommandFile[] {
  return commandFileManager.getCommands(managerId);
}

export function updateCommand(managerId: string, commandId: string, updates: Partial<CommandFile>): boolean {
  return commandFileManager.updateCommand(managerId, commandId, updates);
}

export function deleteCommand(managerId: string, commandId: string): boolean {
  return commandFileManager.deleteCommand(managerId, commandId);
}

export function addAlias(managerId: string, commandId: string, alias: string): boolean {
  return commandFileManager.addAlias(managerId, commandId, alias);
}

export function removeAlias(managerId: string, alias: string): boolean {
  return commandFileManager.removeAlias(managerId, alias);
}

export async function executeCommand(managerId: string, commandId: string, parameters?: Record<string, unknown>): Promise<CommandResult> {
  return commandFileManager.executeCommand(managerId, commandId, parameters);
}

export async function executeByName(managerId: string, name: string, parameters?: Record<string, unknown>): Promise<CommandResult> {
  return commandFileManager.executeByName(managerId, name, parameters);
}

export function getHistory(managerId: string, limit?: number): CommandExecution[] {
  return commandFileManager.getHistory(managerId, limit);
}

export function getExecution(managerId: string, executionId: string): CommandExecution | undefined {
  return commandFileManager.getExecution(managerId, executionId);
}

export function searchByTag(managerId: string, tag: string): CommandFile[] {
  return commandFileManager.searchByTag(managerId, tag);
}

export function searchByName(managerId: string, query: string): CommandFile[] {
  return commandFileManager.searchByName(managerId, query);
}

export function getStatistics(managerId: string): CommandStatistics | undefined {
  return commandFileManager.getStatistics(managerId);
}

export function resetStatistics(managerId: string): boolean {
  return commandFileManager.resetStatistics(managerId);
}
