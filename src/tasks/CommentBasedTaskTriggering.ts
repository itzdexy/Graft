/**
 * Comment-Based Task Triggering
 * Inspired by Aider's comment-based task triggering for code changes
 * Parses special comments in code to trigger automated tasks and actions
 */

export interface CommentTaskTrigger {
  id: string;
  name: string;
  config: TriggerConfig;
  patterns: Map<string, TriggerPattern>;
  handlers: Map<string, TaskHandler>;
  queue: TriggerQueue;
  statistics: TriggerStatistics;
  metadata: TriggerMetadata;
}

export interface TriggerConfig {
  enabled: boolean;
  commentPrefixes: string[];
  caseSensitive: boolean;
  enableAutoTrigger: boolean;
  maxQueueSize: number;
  enableLogging: boolean;
}

export interface TriggerPattern {
  id: string;
  name: string;
  pattern: string;
  type: PatternType;
  priority: number;
  description: string;
  parameters: PatternParameter[];
}

export type PatternType = 'fix' | 'refactor' | 'optimize' | 'document' | 'test' | 'custom';

export interface PatternParameter {
  name: string;
  type: ParameterType;
  required: boolean;
  description: string;
  defaultValue?: unknown;
}

export type ParameterType = 'string' | 'number' | 'boolean' | 'array' | 'object';

export interface TaskHandler {
  patternId: string;
  handler: (trigger: TriggeredTask) => Promise<TaskResult>;
  enabled: boolean;
}

export interface TriggeredTask {
  id: string;
  patternId: string;
  patternName: string;
  filePath: string;
  lineNumber: number;
  comment: string;
  parameters: Record<string, unknown>;
  timestamp: number;
  status: TaskStatus;
}

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface TaskResult {
  success: boolean;
  output?: string;
  error?: string;
  modifications?: FileModification[];
}

export interface FileModification {
  filePath: string;
  changes: Change[];
}

export interface Change {
  lineNumber: number;
  oldContent: string;
  newContent: string;
}

export interface TriggerQueue {
  tasks: TriggeredTask[];
  maxSize: number;
}

export interface TriggerStatistics {
  totalTriggers: number;
  processedTriggers: number;
  failedTriggers: number;
  triggersByPattern: Record<string, number>;
  averageProcessingTime: number;
  queueSize: number;
}

export interface TriggerMetadata {
  createdAt: number;
  updatedAt: number;
  version: number;
  totalOperations: number;
}

export interface ParsedComment {
  patternId: string;
  parameters: Record<string, unknown>;
  rawComment: string;
}

class CommentTaskTriggerManager {
  private triggers: Map<string, CommentTaskTrigger> = new Map();

  /**
   * Create a comment task trigger
   */
  createTrigger(name: string, config?: Partial<TriggerConfig>): CommentTaskTrigger {
    const trigger: CommentTaskTrigger = {
      id: this.generateTriggerId(),
      name,
      config: {
        enabled: config?.enabled ?? true,
        commentPrefixes: config?.commentPrefixes || ['//', '#', '/*', '*', '"""'],
        caseSensitive: config?.caseSensitive ?? false,
        enableAutoTrigger: config?.enableAutoTrigger ?? true,
        maxQueueSize: config?.maxQueueSize || 1000,
        enableLogging: config?.enableLogging ?? true,
      },
      patterns: new Map(),
      handlers: new Map(),
      queue: {
        tasks: [],
        maxSize: config?.maxQueueSize || 1000,
      },
      statistics: {
        totalTriggers: 0,
        processedTriggers: 0,
        failedTriggers: 0,
        triggersByPattern: {},
        averageProcessingTime: 0,
        queueSize: 0,
      },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        totalOperations: 0,
      },
    };

    this.triggers.set(trigger.id, trigger);
    return trigger;
  }

  /**
   * Get a trigger
   */
  getTrigger(triggerId: string): CommentTaskTrigger | undefined {
    return this.triggers.get(triggerId);
  }

  /**
   * Get all triggers
   */
  getAllTriggers(): CommentTaskTrigger[] {
    return Array.from(this.triggers.values());
  }

  /**
   * Delete a trigger
   */
  deleteTrigger(triggerId: string): boolean {
    return this.triggers.delete(triggerId);
  }

  /**
   * Register a pattern
   */
  registerPattern(triggerId: string, pattern: TriggerPattern): boolean {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) return false;

    trigger.patterns.set(pattern.id, pattern);
    trigger.metadata.updatedAt = Date.now();

    return true;
  }

  /**
   * Register a handler
   */
  registerHandler(triggerId: string, handler: TaskHandler): boolean {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) return false;

    trigger.handlers.set(handler.patternId, handler);
    trigger.metadata.updatedAt = Date.now();

    return true;
  }

  /**
   * Scan file for trigger comments
   */
  scanFile(triggerId: string, filePath: string, content: string): TriggeredTask[] {
    const trigger = this.triggers.get(triggerId);
    if (!trigger || !trigger.config.enabled) return [];

    const lines = content.split('\n');
    const triggeredTasks: TriggeredTask[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const parsed = this.parseComment(trigger, line);

      if (parsed) {
        const task: TriggeredTask = {
          id: this.generateTaskId(),
          patternId: parsed.patternId,
          patternName: trigger.patterns.get(parsed.patternId)?.name || 'unknown',
          filePath,
          lineNumber: i + 1,
          comment: parsed.rawComment,
          parameters: parsed.parameters,
          timestamp: Date.now(),
          status: 'pending',
        };

        triggeredTasks.push(task);

        if (trigger.config.enableAutoTrigger) {
          this.queueTask(trigger, task);
        }
      }
    }

    trigger.statistics.totalTriggers += triggeredTasks.length;
    trigger.metadata.updatedAt = Date.now();

    return triggeredTasks;
  }

  /**
   * Queue a task
   */
  queueTask(trigger: CommentTaskTrigger, task: TriggeredTask): boolean {
    if (trigger.queue.tasks.length >= trigger.queue.maxSize) {
      return false;
    }

    trigger.queue.tasks.push(task);
    trigger.statistics.queueSize = trigger.queue.tasks.length;

    return true;
  }

  /**
   * Process queued tasks
   */
  async processQueue(triggerId: string): Promise<TaskResult[]> {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) return [];

    const results: TaskResult[] = [];

    while (trigger.queue.tasks.length > 0) {
      const task = trigger.queue.tasks.shift()!;
      trigger.statistics.queueSize = trigger.queue.tasks.length;

      const result = await this.processTask(trigger, task);
      results.push(result);
    }

    trigger.metadata.updatedAt = Date.now();

    return results;
  }

  /**
   * Process a single task
   */
  async processTask(trigger: CommentTaskTrigger, task: TriggeredTask): Promise<TaskResult> {
    const handler = trigger.handlers.get(task.patternId);
    if (!handler || !handler.enabled) {
      return {
        success: false,
        error: `No handler found for pattern: ${task.patternId}`,
      };
    }

    task.status = 'processing';

    const startTime = Date.now();

    try {
      const result = await handler.handler(task);

      task.status = 'completed';
      trigger.statistics.processedTriggers++;
      trigger.statistics.triggersByPattern[task.patternId] =
        (trigger.statistics.triggersByPattern[task.patternId] || 0) + 1;

      const processingTime = Date.now() - startTime;
      trigger.statistics.averageProcessingTime =
        this.updateAverage(trigger.statistics.averageProcessingTime, trigger.statistics.processedTriggers, processingTime);

      trigger.metadata.totalOperations++;
      trigger.metadata.updatedAt = Date.now();

      return result;

    } catch (error) {
      task.status = 'failed';
      trigger.statistics.failedTriggers++;

      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Get queue status
   */
  getQueueStatus(triggerId: string): {
    queueSize: number;
    tasks: TriggeredTask[];
    maxSize: number;
  } | undefined {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) return undefined;

    return {
      queueSize: trigger.queue.tasks.length,
      tasks: [...trigger.queue.tasks],
      maxSize: trigger.queue.maxSize,
    };
  }

  /**
   * Clear queue
   */
  clearQueue(triggerId: string): boolean {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) return false;

    trigger.queue.tasks = [];
    trigger.statistics.queueSize = 0;
    trigger.metadata.updatedAt = Date.now();

    return true;
  }

  /**
   * Get statistics for a trigger
   */
  getStatistics(triggerId: string): TriggerStatistics | undefined {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) return undefined;

    return { ...trigger.statistics };
  }

  /**
   * Reset statistics for a trigger
   */
  resetStatistics(triggerId: string): boolean {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) return false;

    trigger.statistics = {
      totalTriggers: 0,
      processedTriggers: 0,
      failedTriggers: 0,
      triggersByPattern: {},
      averageProcessingTime: 0,
      queueSize: trigger.queue.tasks.length,
    };

    trigger.metadata.updatedAt = Date.now();

    return true;
  }

  // Private methods

  private parseComment(trigger: CommentTaskTrigger, line: string): ParsedComment | null {
    const trimmedLine = line.trim();

    // Check if line starts with a comment prefix
    const hasPrefix = trigger.config.commentPrefixes.some(prefix =>
      trimmedLine.startsWith(prefix)
    );

    if (!hasPrefix) return null;

    // Remove comment prefix
    let commentText = trimmedLine;
    for (const prefix of trigger.config.commentPrefixes) {
      if (commentText.startsWith(prefix)) {
        commentText = commentText.substring(prefix.length).trim();
        break;
      }
    }

    // Match against patterns
    for (const [patternId, pattern] of trigger.patterns) {
      const match = this.matchPattern(pattern.pattern, commentText, trigger.config.caseSensitive);
      if (match) {
        return {
          patternId,
          parameters: match,
          rawComment: commentText,
        };
      }
    }

    return null;
  }

  private matchPattern(pattern: string, text: string, caseSensitive: boolean): Record<string, unknown> | null {
    // Simple pattern matching - in real implementation, use regex
    const searchPattern = caseSensitive ? pattern : pattern.toLowerCase();
    const searchText = caseSensitive ? text : text.toLowerCase();

    if (searchText.includes(searchPattern)) {
      // Extract parameters from the pattern
      const params: Record<string, unknown> = {};
      const paramMatches = searchText.match(/(\w+):\s*(\S+)/g);

      if (paramMatches) {
        for (const match of paramMatches) {
          const [key, value] = match.split(':').map(s => s.trim());
          params[key] = value;
        }
      }

      return params;
    }

    return null;
  }

  private updateAverage(current: number, count: number, newValue: number): number {
    if (count === 1) return newValue;
    return (current * (count - 1) + newValue) / count;
  }

  private generateTriggerId(): string {
    return `trigger-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Helper functions to create patterns and handlers
export function createTriggerPattern(
  id: string,
  name: string,
  pattern: string,
  type: PatternType,
  priority: number = 0,
  description: string = '',
  parameters: PatternParameter[] = []
): TriggerPattern {
  return { id, name, pattern, type, priority, description, parameters };
}

export function createPatternParameter(
  name: string,
  type: ParameterType,
  required: boolean,
  description: string,
  defaultValue?: unknown
): PatternParameter {
  return { name, type, required, description, defaultValue };
}

export function createTaskHandler(
  patternId: string,
  handler: (trigger: TriggeredTask) => Promise<TaskResult>,
  enabled: boolean = true
): TaskHandler {
  return { patternId, handler, enabled };
}

// Global comment task trigger manager instance
const commentTaskTriggerManager = new CommentTaskTriggerManager();

export function createTrigger(name: string, config?: Partial<TriggerConfig>): CommentTaskTrigger {
  return commentTaskTriggerManager.createTrigger(name, config);
}

export function getTrigger(triggerId: string): CommentTaskTrigger | undefined {
  return commentTaskTriggerManager.getTrigger(triggerId);
}

export function getAllTriggers(): CommentTaskTrigger[] {
  return commentTaskTriggerManager.getAllTriggers();
}

export function deleteTrigger(triggerId: string): boolean {
  return commentTaskTriggerManager.deleteTrigger(triggerId);
}

export function registerPattern(triggerId: string, pattern: TriggerPattern): boolean {
  return commentTaskTriggerManager.registerPattern(triggerId, pattern);
}

export function registerHandler(triggerId: string, handler: TaskHandler): boolean {
  return commentTaskTriggerManager.registerHandler(triggerId, handler);
}

export function scanFile(triggerId: string, filePath: string, content: string): TriggeredTask[] {
  return commentTaskTriggerManager.scanFile(triggerId, filePath, content);
}

export async function processQueue(triggerId: string): Promise<TaskResult[]> {
  return commentTaskTriggerManager.processQueue(triggerId);
}

export function getQueueStatus(triggerId: string): {
  queueSize: number;
  tasks: TriggeredTask[];
  maxSize: number;
} | undefined {
  return commentTaskTriggerManager.getQueueStatus(triggerId);
}

export function clearQueue(triggerId: string): boolean {
  return commentTaskTriggerManager.clearQueue(triggerId);
}

export function getStatistics(triggerId: string): TriggerStatistics | undefined {
  return commentTaskTriggerManager.getStatistics(triggerId);
}

export function resetStatistics(triggerId: string): boolean {
  return commentTaskTriggerManager.resetStatistics(triggerId);
}
