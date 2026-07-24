/**
 * Software Agent SDK
 * Inspired by OpenHands' software agent SDK for building AI agents
 * Provides tools, APIs, and utilities for building software development agents
 */

export interface SoftwareAgentSDK {
  id: string;
  name: string;
  config: SDKConfig;
  tools: Map<string, AgentTool>;
  capabilities: AgentCapabilities;
  context: AgentContext;
  memory: AgentMemory;
  statistics: SDKStatistics;
  metadata: SDKMetadata;
}

export interface SDKConfig {
  enableAutoToolSelection: boolean;
  enableToolValidation: boolean;
  maxToolExecutionTime: number;
  enableMemory: boolean;
  enableContextPersistence: boolean;
  maxMemorySize: number;
}

export interface AgentTool {
  id: string;
  name: string;
  description: string;
  type: ToolType;
  parameters: ToolParameter[];
  handler: ToolHandler;
  enabled: boolean;
  permissions: ToolPermissions;
}

export type ToolType = 'file' | 'command' | 'api' | 'analysis' | 'custom';

export interface ToolParameter {
  name: string;
  type: ParameterType;
  required: boolean;
  description: string;
  defaultValue?: unknown;
}

export type ParameterType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'file';

export type ToolHandler = (input: ToolInput) => Promise<ToolOutput>;

export interface ToolInput {
  toolId: string;
  parameters: Record<string, unknown>;
  context: AgentContext;
}

export interface ToolOutput {
  success: boolean;
  result?: unknown;
  error?: string;
  data?: unknown;
  executionTime: number;
  continueOnError?: boolean;
}

export interface ToolPermissions {
  readFile: boolean;
  writeFile: boolean;
  executeCommand: boolean;
  networkAccess: boolean;
}

export interface AgentCapabilities {
  fileOperations: boolean;
  commandExecution: boolean;
  codeAnalysis: boolean;
  webAccess: boolean;
  gitOperations: boolean;
  testing: boolean;
}

export interface AgentContext {
  workingDirectory: string;
  environment: Record<string, string>;
  files: Map<string, FileContext>;
  gitContext?: GitContext;
  projectContext?: ProjectContext;
}

export interface FileContext {
  path: string;
  content: string;
  language: string;
  lastModified: number;
  size: number;
}

export interface GitContext {
  branch: string;
  commit: string;
  status: GitStatus;
  staged: string[];
  unstaged: string[];
}

export type GitStatus = 'clean' | 'modified' | 'conflict' | 'merge';

export interface ProjectContext {
  name: string;
  type: ProjectType;
  language: string;
  dependencies: Dependency[];
  buildSystem: BuildSystem;
}

export type ProjectType = 'application' | 'library' | 'service' | 'cli' | 'custom';

export interface Dependency {
  name: string;
  version: string;
  type: DependencyType;
}

export type DependencyType = 'runtime' | 'development' | 'peer' | 'optional';

export type BuildSystem = 'npm' | 'yarn' | 'pnpm' | 'cargo' | 'pip' | 'maven' | 'gradle' | 'custom';

export interface AgentMemory {
  id: string;
  entries: Map<string, MemoryEntry>;
  maxSize: number;
}

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: string;
  timestamp: number;
  importance: number;
  tags: string[];
}

export type MemoryType = 'fact' | 'observation' | 'decision' | 'result' | 'custom';

export interface SDKStatistics {
  totalToolExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  totalMemoryEntries: number;
  totalContextUpdates: number;
}

export interface SDKMetadata {
  version: string;
  createdAt: number;
  updatedAt: number;
  totalOperations: number;
}

export interface AgentTask {
  id: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  steps: TaskStep[];
  currentStep: number;
  startedAt: number;
  completedAt?: number;
  result?: unknown;
}

export type TaskType = 'code_generation' | 'bug_fix' | 'refactoring' | 'testing' | 'documentation' | 'custom';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export interface TaskStep {
  id: string;
  description: string;
  toolId: string;
  parameters: Record<string, unknown>;
  status: StepStatus;
  output?: ToolOutput;
}

export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

class SoftwareAgentSDKImpl {
  private sdks: Map<string, SoftwareAgentSDK> = new Map();

  /**
   * Create a software agent SDK
   */
  createSDK(name: string, config?: Partial<SDKConfig>): SoftwareAgentSDK {
    const sdk: SoftwareAgentSDK = {
      id: this.generateSDKId(),
      name,
      config: {
        enableAutoToolSelection: config?.enableAutoToolSelection ?? true,
        enableToolValidation: config?.enableToolValidation ?? true,
        maxToolExecutionTime: config?.maxToolExecutionTime || 300000, // 5 minutes
        enableMemory: config?.enableMemory ?? true,
        enableContextPersistence: config?.enableContextPersistence ?? true,
        maxMemorySize: config?.maxMemorySize || 10000,
      },
      tools: new Map(),
      capabilities: {
        fileOperations: true,
        commandExecution: true,
        codeAnalysis: false,
        webAccess: false,
        gitOperations: false,
        testing: false,
      },
      context: {
        workingDirectory: '',
        environment: {},
        files: new Map(),
      },
      memory: {
        id: this.generateMemoryId(),
        entries: new Map(),
        maxSize: config?.maxMemorySize || 10000,
      },
      statistics: {
        totalToolExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTime: 0,
        totalMemoryEntries: 0,
        totalContextUpdates: 0,
      },
      metadata: {
        version: '1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        totalOperations: 0,
      },
    };

    this.sdks.set(sdk.id, sdk);
    return sdk;
  }

  /**
   * Get an SDK
   */
  getSDK(sdkId: string): SoftwareAgentSDK | undefined {
    return this.sdks.get(sdkId);
  }

  /**
   * Get all SDKs
   */
  getAllSDKs(): SoftwareAgentSDK[] {
    return Array.from(this.sdks.values());
  }

  /**
   * Delete an SDK
   */
  deleteSDK(sdkId: string): boolean {
    return this.sdks.delete(sdkId);
  }

  /**
   * Register a tool
   */
  registerTool(sdkId: string, tool: AgentTool): boolean {
    const sdk = this.sdks.get(sdkId);
    if (!sdk) return false;

    sdk.tools.set(tool.id, tool);
    sdk.metadata.updatedAt = Date.now();

    return true;
  }

  /**
   * Unregister a tool
   */
  unregisterTool(sdkId: string, toolId: string): boolean {
    const sdk = this.sdks.get(sdkId);
    if (!sdk) return false;

    const removed = sdk.tools.delete(toolId);
    if (removed) {
      sdk.metadata.updatedAt = Date.now();
    }

    return removed;
  }

  /**
   * Execute a tool
   */
  async executeTool(sdkId: string, toolId: string, parameters: Record<string, unknown>): Promise<ToolOutput> {
    const sdk = this.sdks.get(sdkId);
    if (!sdk) {
      throw new Error(`SDK ${sdkId} not found`);
    }

    const tool = sdk.tools.get(toolId);
    if (!tool) {
      throw new Error(`Tool ${toolId} not found`);
    }

    if (!tool.enabled) {
      throw new Error(`Tool ${toolId} is disabled`);
    }

    // Validate parameters if enabled
    if (sdk.config.enableToolValidation) {
      this.validateParameters(tool, parameters);
    }

    const input: ToolInput = {
      toolId,
      parameters,
      context: sdk.context,
    };

    const startTime = Date.now();

    try {
      const output = await tool.handler(input);
      output.executionTime = Date.now() - startTime;

      sdk.statistics.totalToolExecutions++;
      sdk.statistics.successfulExecutions++;
      sdk.statistics.averageExecutionTime =
        this.updateAverage(sdk.statistics.averageExecutionTime, sdk.statistics.totalToolExecutions, output.executionTime);

      sdk.metadata.totalOperations++;
      sdk.metadata.updatedAt = Date.now();

      return output;

    } catch (error) {
      const output: ToolOutput = {
        success: false,
        error: String(error),
        executionTime: Date.now() - startTime,
      };

      sdk.statistics.totalToolExecutions++;
      sdk.statistics.failedExecutions++;

      sdk.metadata.totalOperations++;
      sdk.metadata.updatedAt = Date.now();

      return output;
    }
  }

  /**
   * Auto-select and execute a tool
   */
  async autoExecuteTool(sdkId: string, description: string, context?: AgentContext): Promise<ToolOutput> {
    const sdk = this.sdks.get(sdkId);
    if (!sdk) {
      throw new Error(`SDK ${sdkId} not found`);
    }

    if (!sdk.config.enableAutoToolSelection) {
      throw new Error('Auto tool selection is disabled');
    }

    // Simple tool selection based on description
    const tool = this.selectTool(sdk, description);
    if (!tool) {
      throw new Error('No suitable tool found');
    }

    const parameters = this.extractParameters(description, tool);

    return this.executeTool(sdkId, tool.id, parameters);
  }

  /**
   * Update context
   */
  updateContext(sdkId: string, context: Partial<AgentContext>): boolean {
    const sdk = this.sdks.get(sdkId);
    if (!sdk) return false;

    Object.assign(sdk.context, context);
    sdk.statistics.totalContextUpdates++;
    sdk.metadata.updatedAt = Date.now();

    return true;
  }

  /**
   * Add a file to context
   */
  addFileToContext(sdkId: string, filePath: string, content: string, language: string): boolean {
    const sdk = this.sdks.get(sdkId);
    if (!sdk) return false;

    const fileContext: FileContext = {
      path: filePath,
      content,
      language,
      lastModified: Date.now(),
      size: content.length,
    };

    sdk.context.files.set(filePath, fileContext);
    sdk.statistics.totalContextUpdates++;
    sdk.metadata.updatedAt = Date.now();

    return true;
  }

  /**
   * Add a memory entry
   */
  addMemoryEntry(sdkId: string, entry: MemoryEntry): boolean {
    const sdk = this.sdks.get(sdkId);
    if (!sdk) return false;

    if (!sdk.config.enableMemory) return false;

    // Trim memory if needed
    while (sdk.memory.entries.size >= sdk.memory.maxSize) {
      const oldest = Array.from(sdk.memory.entries.values())
        .sort((a, b) => a.timestamp - b.timestamp)[0];
      sdk.memory.entries.delete(oldest.id);
    }

    sdk.memory.entries.set(entry.id, entry);
    sdk.statistics.totalMemoryEntries++;
    sdk.metadata.updatedAt = Date.now();

    return true;
  }

  /**
   * Search memory
   */
  searchMemory(sdkId: string, query: string, tags?: string[]): MemoryEntry[] {
    const sdk = this.sdks.get(sdkId);
    if (!sdk) return [];

    const lowerQuery = query.toLowerCase();
    return Array.from(sdk.memory.entries.values())
      .filter(entry => {
        const matchesQuery = entry.content.toLowerCase().includes(lowerQuery) ||
          entry.tags.some(tag => tag.toLowerCase().includes(lowerQuery));
        const matchesTags = !tags || tags.every(tag => entry.tags.includes(tag));
        return matchesQuery && matchesTags;
      })
      .sort((a, b) => b.importance - a.importance);
  }

  /**
   * Execute a task
   */
  async executeTask(sdkId: string, task: AgentTask): Promise<AgentTask> {
    const sdk = this.sdks.get(sdkId);
    if (!sdk) {
      throw new Error(`SDK ${sdkId} not found`);
    }

    task.status = 'in_progress';
    task.startedAt = Date.now();

    try {
      for (let i = 0; i < task.steps.length; i++) {
        task.currentStep = i;
        const step = task.steps[i];
        step.status = 'in_progress';

        const output = await this.executeTool(sdkId, step.toolId, step.parameters);
        step.output = output;
        step.status = output.success ? 'completed' : 'failed';

        if (!output.success && !this.shouldContinueOnFailure(task, i)) {
          task.status = 'failed';
          return task;
        }
      }

      task.status = 'completed';
      task.completedAt = Date.now();

    } catch (error) {
      task.status = 'failed';
      task.completedAt = Date.now();
    }

    return task;
  }

  /**
   * Get statistics for an SDK
   */
  getStatistics(sdkId: string): SDKStatistics | undefined {
    const sdk = this.sdks.get(sdkId);
    if (!sdk) return undefined;

    return { ...sdk.statistics };
  }

  /**
   * Reset statistics for an SDK
   */
  resetStatistics(sdkId: string): boolean {
    const sdk = this.sdks.get(sdkId);
    if (!sdk) return false;

    sdk.statistics = {
      totalToolExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      totalMemoryEntries: sdk.memory.entries.size,
      totalContextUpdates: 0,
    };

    sdk.metadata.updatedAt = Date.now();

    return true;
  }

  // Private methods

  private validateParameters(tool: AgentTool, parameters: Record<string, unknown>): void {
    for (const param of tool.parameters) {
      const value = parameters[param.name];

      if (param.required && value === undefined) {
        throw new Error(`Required parameter ${param.name} is missing`);
      }
    }
  }

  private selectTool(sdk: SoftwareAgentSDK, description: string): AgentTool | undefined {
    const lowerDesc = description.toLowerCase();

    // Simple keyword-based tool selection
    for (const tool of sdk.tools.values()) {
      if (!tool.enabled) continue;

      const lowerName = tool.name.toLowerCase();
      const lowerDescTool = tool.description.toLowerCase();

      if (lowerDesc.includes(lowerName) || lowerDesc.includes(lowerDescTool)) {
        return tool;
      }
    }

    return undefined;
  }

  private extractParameters(description: string, tool: AgentTool): Record<string, unknown> {
    // Simple parameter extraction - in real implementation, use NLP
    const parameters: Record<string, unknown> = {};

    for (const param of tool.parameters) {
      if (param.defaultValue !== undefined) {
        parameters[param.name] = param.defaultValue;
      }
    }

    return parameters;
  }

  private shouldContinueOnFailure(task: AgentTask, stepIndex: number): boolean {
    const step = task.steps[stepIndex];
    return step.output?.continueOnError ?? false;
  }

  private updateAverage(current: number, count: number, newValue: number): number {
    if (count === 1) return newValue;
    return (current * (count - 1) + newValue) / count;
  }

  private generateSDKId(): string {
    return `sdk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMemoryId(): string {
    return `memory-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Helper functions to create tools and tasks
export function createAgentTool(
  id: string,
  name: string,
  description: string,
  type: ToolType,
  handler: ToolHandler,
  parameters: ToolParameter[] = [],
  permissions?: Partial<ToolPermissions>
): AgentTool {
  return {
    id,
    name,
    description,
    type,
    handler,
    parameters,
    enabled: true,
    permissions: {
      readFile: permissions?.readFile ?? false,
      writeFile: permissions?.writeFile ?? false,
      executeCommand: permissions?.executeCommand ?? false,
      networkAccess: permissions?.networkAccess ?? false,
    },
  };
}

export function createToolParameter(
  name: string,
  type: ParameterType,
  required: boolean,
  description: string,
  defaultValue?: unknown
): ToolParameter {
  return { name, type, required, description, defaultValue };
}

export function createMemoryEntry(
  id: string,
  type: MemoryType,
  content: string,
  importance: number,
  tags: string[] = []
): MemoryEntry {
  return {
    id,
    type,
    content,
    timestamp: Date.now(),
    importance,
    tags,
  };
}

export function createAgentTask(
  id: string,
  description: string,
  type: TaskType,
  steps: TaskStep[]
): AgentTask {
  return {
    id,
    description,
    type,
    status: 'pending',
    steps,
    currentStep: 0,
    startedAt: 0,
  };
}

export function createTaskStep(
  id: string,
  description: string,
  toolId: string,
  parameters: Record<string, unknown>
): TaskStep {
  return {
    id,
    description,
    toolId,
    parameters,
    status: 'pending',
  };
}

// Global software agent SDK instance
const softwareAgentSDK = new SoftwareAgentSDKImpl();

export function createSDK(name: string, config?: Partial<SDKConfig>): SoftwareAgentSDK {
  return softwareAgentSDK.createSDK(name, config);
}

export function getSDK(sdkId: string): SoftwareAgentSDK | undefined {
  return softwareAgentSDK.getSDK(sdkId);
}

export function getAllSDKs(): SoftwareAgentSDK[] {
  return softwareAgentSDK.getAllSDKs();
}

export function deleteSDK(sdkId: string): boolean {
  return softwareAgentSDK.deleteSDK(sdkId);
}

export function registerTool(sdkId: string, tool: AgentTool): boolean {
  return softwareAgentSDK.registerTool(sdkId, tool);
}

export function unregisterTool(sdkId: string, toolId: string): boolean {
  return softwareAgentSDK.unregisterTool(sdkId, toolId);
}

export async function executeTool(sdkId: string, toolId: string, parameters: Record<string, unknown>): Promise<ToolOutput> {
  return softwareAgentSDK.executeTool(sdkId, toolId, parameters);
}

export async function autoExecuteTool(sdkId: string, description: string, context?: AgentContext): Promise<ToolOutput> {
  return softwareAgentSDK.autoExecuteTool(sdkId, description, context);
}

export function updateContext(sdkId: string, context: Partial<AgentContext>): boolean {
  return softwareAgentSDK.updateContext(sdkId, context);
}

export function addFileToContext(sdkId: string, filePath: string, content: string, language: string): boolean {
  return softwareAgentSDK.addFileToContext(sdkId, filePath, content, language);
}

export function addMemoryEntry(sdkId: string, entry: MemoryEntry): boolean {
  return softwareAgentSDK.addMemoryEntry(sdkId, entry);
}

export function searchMemory(sdkId: string, query: string, tags?: string[]): MemoryEntry[] {
  return softwareAgentSDK.searchMemory(sdkId, query, tags);
}

export async function executeTask(sdkId: string, task: AgentTask): Promise<AgentTask> {
  return softwareAgentSDK.executeTask(sdkId, task);
}

export function getStatistics(sdkId: string): SDKStatistics | undefined {
  return softwareAgentSDK.getStatistics(sdkId);
}

export function resetStatistics(sdkId: string): boolean {
  return softwareAgentSDK.resetStatistics(sdkId);
}
