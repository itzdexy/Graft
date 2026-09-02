/**
 * Named Hooks
 * Inspired by Crush's named hooks feature for better hook identification and management
 * Provides named lifecycle hooks with identification, priority, and management capabilities
 */

export interface Hook {
  id: string;
  name: string;
  description: string;
  phase: HookPhase;
  priority: number;
  handler: HookHandler;
  enabled: boolean;
  metadata: HookMetadata;
}

export type HookPhase =
  | 'before_init'
  | 'after_init'
  | 'before_command'
  | 'after_command'
  | 'before_tool'
  | 'after_tool'
  | 'before_response'
  | 'after_response'
  | 'before_save'
  | 'after_save'
  | 'on_error'
  | 'on_shutdown'
  | 'custom';

export type HookHandler = (context: HookContext) => Promise<HookResult> | HookResult;

export interface HookContext {
  phase: HookPhase;
  sessionId?: string;
  userId?: string;
  projectId?: string;
  command?: string;
  tool?: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

export interface HookResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  modifiedContext?: Partial<HookContext>;
  stopPropagation?: boolean;
}

export interface HookMetadata {
  version: string;
  author: string;
  createdAt: number;
  updatedAt: number;
  executionCount: number;
  lastExecuted?: number;
  averageExecutionTime?: number;
  tags: string[];
}

export interface Hook {
  id: string;
  name: string;
  description: string;
  phase: HookPhase;
  priority: number;
  handler: HookHandler;
  enabled: boolean;
  metadata: HookMetadata;
  tags: string[];
}

export interface HookExecutionResult {
  hookId: string;
  hookName: string;
  success: boolean;
  duration: number;
  error?: string;
  data?: Record<string, unknown>;
}

export interface HookExecutionSummary {
  phase: HookPhase;
  totalHooks: number;
  executedHooks: number;
  successfulHooks: number;
  failedHooks: number;
  skippedHooks: number;
  totalDuration: number;
  results: HookExecutionResult[];
}

class HookManager {
  private hooks: Map<string, Hook> = new Map();
  private hooksByPhase: Map<HookPhase, string[]> = new Map();
  private executionHistory: HookExecutionResult[] = [];
  private maxHistorySize: number = 1000;

  /**
   * Register a hook
   */
  registerHook(hook: Hook): void {
    this.hooks.set(hook.id, hook);

    // Add to phase index
    if (!this.hooksByPhase.has(hook.phase)) {
      this.hooksByPhase.set(hook.phase, []);
    }
    this.hooksByPhase.get(hook.phase)!.push(hook.id);

    // Sort by priority (higher priority first)
    this.sortHooksByPhase(hook.phase);
  }

  /**
   * Unregister a hook
   */
  unregisterHook(hookId: string): boolean {
    const hook = this.hooks.get(hookId);
    if (!hook) return false;

    // Remove from phase index
    const phaseHooks = this.hooksByPhase.get(hook.phase);
    if (phaseHooks) {
      const index = phaseHooks.indexOf(hookId);
      if (index > -1) {
        phaseHooks.splice(index, 1);
      }
    }

    return this.hooks.delete(hookId);
  }

  /**
   * Get a hook
   */
  getHook(hookId: string): Hook | undefined {
    return this.hooks.get(hookId);
  }

  /**
   * Get all hooks
   */
  getAllHooks(): Hook[] {
    return Array.from(this.hooks.values());
  }

  /**
   * Get hooks by phase
   */
  getHooksByPhase(phase: HookPhase): Hook[] {
    const hookIds = this.hooksByPhase.get(phase) || [];
    return hookIds
      .map(id => this.hooks.get(id))
      .filter((h): h is Hook => h !== undefined && h.enabled);
  }

  /**
   * Get hooks by name
   */
  getHooksByName(name: string): Hook[] {
    return this.getAllHooks().filter(h => h.name === name);
  }

  /**
   * Search hooks by query
   */
  searchHooks(query: string): Hook[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllHooks().filter(
      h =>
        h.name.toLowerCase().includes(lowerQuery) ||
        h.description.toLowerCase().includes(lowerQuery) ||
        h.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Enable a hook
   */
  enableHook(hookId: string): boolean {
    const hook = this.hooks.get(hookId);
    if (!hook) return false;

    hook.enabled = true;
    hook.metadata.updatedAt = Date.now();
    return true;
  }

  /**
   * Disable a hook
   */
  disableHook(hookId: string): boolean {
    const hook = this.hooks.get(hookId);
    if (!hook) return false;

    hook.enabled = false;
    hook.metadata.updatedAt = Date.now();
    return true;
  }

  /**
   * Execute hooks for a phase
   */
  async executeHooks(phase: HookPhase, context: HookContext): Promise<HookExecutionSummary> {
    const hooks = this.getHooksByPhase(phase);
    const results: HookExecutionResult[] = [];
    let currentContext = { ...context };
    let stopPropagation = false;

    for (const hook of hooks) {
      if (stopPropagation) {
        results.push({
          hookId: hook.id,
          hookName: hook.name,
          success: true,
          duration: 0,
          data: { skipped: true, reason: 'stopPropagation' },
        });
        continue;
      }

      const startTime = Date.now();
      let result: HookExecutionResult;

      try {
        const hookResult = await hook.handler(currentContext);
        const duration = Date.now() - startTime;

        // Update hook metadata
        hook.metadata.executionCount++;
        hook.metadata.lastExecuted = Date.now();
        hook.metadata.averageExecutionTime = this.calculateAverageExecutionTime(
          hook.metadata.averageExecutionTime,
          hook.metadata.executionCount,
          duration
        );

        result = {
          hookId: hook.id,
          hookName: hook.name,
          success: hookResult.success,
          duration,
          data: hookResult.data,
          error: hookResult.error,
        };

        // Update context if modified
        if (hookResult.modifiedContext) {
          currentContext = { ...currentContext, ...hookResult.modifiedContext };
        }

        // Check for stop propagation
        if (hookResult.stopPropagation) {
          stopPropagation = true;
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        result = {
          hookId: hook.id,
          hookName: hook.name,
          success: false,
          duration,
          error: String(error),
        };
      }

      results.push(result);
      this.addToHistory(result);
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const skipped = results.filter(r => r.data?.skipped).length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    return {
      phase,
      totalHooks: hooks.length,
      executedHooks: results.length,
      successfulHooks: successful,
      failedHooks: failed,
      skippedHooks: skipped,
      totalDuration,
      results,
    };
  }

  /**
   * Execute a specific hook by ID
   */
  async executeHook(hookId: string, context: HookContext): Promise<HookExecutionResult> {
    const hook = this.hooks.get(hookId);
    if (!hook) {
      return {
        hookId,
        hookName: 'Unknown',
        success: false,
        duration: 0,
        error: 'Hook not found',
      };
    }

    if (!hook.enabled) {
      return {
        hookId,
        hookName: hook.name,
        success: false,
        duration: 0,
        error: 'Hook is disabled',
      };
    }

    const startTime = Date.now();

    try {
      const hookResult = await hook.handler(context);
      const duration = Date.now() - startTime;

      // Update hook metadata
      hook.metadata.executionCount++;
      hook.metadata.lastExecuted = Date.now();
      hook.metadata.averageExecutionTime = this.calculateAverageExecutionTime(
        hook.metadata.averageExecutionTime,
        hook.metadata.executionCount,
        duration
      );

      const result: HookExecutionResult = {
        hookId: hook.id,
        hookName: hook.name,
        success: hookResult.success,
        duration,
        data: hookResult.data,
        error: hookResult.error,
      };

      this.addToHistory(result);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const result: HookExecutionResult = {
        hookId: hook.id,
        hookName: hook.name,
        success: false,
        duration,
        error: String(error),
      };

      this.addToHistory(result);
      return result;
    }
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit?: number): HookExecutionResult[] {
    if (limit) {
      return this.executionHistory.slice(-limit);
    }
    return [...this.executionHistory];
  }

  /**
   * Clear execution history
   */
  clearExecutionHistory(): void {
    this.executionHistory = [];
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalHooks: number;
    enabledHooks: number;
    hooksByPhase: Record<HookPhase, number>;
    totalExecutions: number;
    averageExecutionTime: number;
    mostExecutedHooks: Hook[];
    slowestHooks: Hook[];
  } {
    const hooks = this.getAllHooks();
    const enabled = hooks.filter(h => h.enabled).length;

    const hooksByPhase: Record<HookPhase, number> = {} as any;
    for (const hook of hooks) {
      hooksByPhase[hook.phase] = (hooksByPhase[hook.phase] || 0) + 1;
    }

    const totalExecutions = this.executionHistory.length;
    const averageExecutionTime = this.executionHistory.length > 0
      ? this.executionHistory.reduce((sum, r) => sum + r.duration, 0) / this.executionHistory.length
      : 0;

    const mostExecutedHooks = [...hooks].sort((a, b) => b.metadata.executionCount - a.metadata.executionCount).slice(0, 5);
    const slowestHooks = [...hooks]
      .filter(h => h.metadata.averageExecutionTime !== undefined)
      .sort((a, b) => (b.metadata.averageExecutionTime || 0) - (a.metadata.averageExecutionTime || 0))
      .slice(0, 5);

    return {
      totalHooks: hooks.length,
      enabledHooks: enabled,
      hooksByPhase,
      totalExecutions,
      averageExecutionTime,
      mostExecutedHooks,
      slowestHooks,
    };
  }

  /**
   * Set max history size
   */
  setMaxHistorySize(size: number): void {
    this.maxHistorySize = size;
    this.trimHistory();
  }

  // Private methods

  private sortHooksByPhase(phase: HookPhase): void {
    const hookIds = this.hooksByPhase.get(phase);
    if (!hookIds) return;

    hookIds.sort((a, b) => {
      const hookA = this.hooks.get(a);
      const hookB = this.hooks.get(b);
      if (!hookA || !hookB) return 0;
      return hookB.priority - hookA.priority;
    });
  }

  private addToHistory(result: HookExecutionResult): void {
    this.executionHistory.push(result);
    this.trimHistory();
  }

  private trimHistory(): void {
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory = this.executionHistory.slice(-this.maxHistorySize);
    }
  }

  private calculateAverageExecutionTime(current: number | undefined, count: number, newDuration: number): number {
    if (current === undefined) return newDuration;
    return (current * (count - 1) + newDuration) / count;
  }
}

// Global hook manager instance
const hookManager = new HookManager();

export function registerHook(hook: Hook): void {
  hookManager.registerHook(hook);
}

export function unregisterHook(hookId: string): boolean {
  return hookManager.unregisterHook(hookId);
}

export function getHook(hookId: string): Hook | undefined {
  return hookManager.getHook(hookId);
}

export function getAllHooks(): Hook[] {
  return hookManager.getAllHooks();
}

export function getHooksByPhase(phase: HookPhase): Hook[] {
  return hookManager.getHooksByPhase(phase);
}

export function getHooksByName(name: string): Hook[] {
  return hookManager.getHooksByName(name);
}

export function searchHooks(query: string): Hook[] {
  return hookManager.searchHooks(query);
}

export function enableHook(hookId: string): boolean {
  return hookManager.enableHook(hookId);
}

export function disableHook(hookId: string): boolean {
  return hookManager.disableHook(hookId);
}

export async function executeHooks(phase: HookPhase, context: HookContext): Promise<HookExecutionSummary> {
  return hookManager.executeHooks(phase, context);
}

export async function executeHook(hookId: string, context: HookContext): Promise<HookExecutionResult> {
  return hookManager.executeHook(hookId, context);
}

export function getExecutionHistory(limit?: number): HookExecutionResult[] {
  return hookManager.getExecutionHistory(limit);
}

export function clearExecutionHistory(): void {
  hookManager.clearExecutionHistory();
}

export function getStatistics(): {
  totalHooks: number;
  enabledHooks: number;
  hooksByPhase: Record<HookPhase, number>;
  totalExecutions: number;
  averageExecutionTime: number;
  mostExecutedHooks: Hook[];
  slowestHooks: Hook[];
} {
  return hookManager.getStatistics();
}

export function setMaxHistorySize(size: number): void {
  hookManager.setMaxHistorySize(size);
}
