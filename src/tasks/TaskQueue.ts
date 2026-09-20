/**
 * Background task queue system
 * Inspired by OpenCode and OpenHands for parallel execution and background processing
 */

export interface QueuedTask {
  id: string;
  name: string;
  description: string;
  handler: TaskHandler;
  priority: TaskPriority;
  status: TaskStatus;
  dependencies: string[];
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: TaskResult;
  error?: string;
  retryCount: number;
  maxRetries: number;
  timeout: number;
}

export type TaskHandler = () => Promise<unknown>;
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TaskResult {
  success: boolean;
  output: unknown;
  duration: number;
}

export interface WorkerPool {
  id: string;
  name: string;
  size: number;
  activeWorkers: number;
  maxConcurrency: number;
}

export interface QueueStatistics {
  totalTasks: number;
  pendingTasks: number;
  runningTasks: number;
  completedTasks: number;
  failedTasks: number;
  cancelledTasks: number;
  averageExecutionTime: number;
  throughput: number;
  activeWorkers: number;
}

export interface QueueConfig {
  maxConcurrentTasks: number;
  retryDelay: number;
  defaultTimeout: number;
  autoRetry: boolean;
  maxRetries: number;
  priorityScheduling: boolean;
}

class TaskQueue {
  private queue: QueuedTask[] = [];
  private runningTasks: Map<string, QueuedTask> = new Map();
  private completedTasks: Map<string, QueuedTask> = new Map();
  private failedTasks: Map<string, QueuedTask> = new Map();
  private config: QueueConfig;
  private processing = false;
  private workerPool: WorkerPool;
  private taskHistory: TaskResult[] = [];

  constructor(config?: Partial<QueueConfig>) {
    this.config = {
      maxConcurrentTasks: 4,
      retryDelay: 1000,
      defaultTimeout: 30000,
      autoRetry: true,
      maxRetries: 3,
      priorityScheduling: true,
      ...config,
    };

    this.workerPool = {
      id: 'default',
      name: 'Default Worker Pool',
      size: this.config.maxConcurrentTasks,
      activeWorkers: 0,
      maxConcurrency: this.config.maxConcurrentTasks,
    };
  }

  /**
   * Add a task to the queue
   */
  addTask(
    name: string,
    handler: TaskHandler,
    priority: TaskPriority = 'medium',
    options?: {
      description?: string;
      dependencies?: string[];
      timeout?: number;
      maxRetries?: number;
    }
  ): string {
    const task: QueuedTask = {
      id: this.generateId(),
      name,
      description: options?.description || name,
      handler,
      priority,
      status: 'pending',
      dependencies: options?.dependencies || [],
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: options?.maxRetries || this.config.maxRetries,
      timeout: options?.timeout || this.config.defaultTimeout,
    };

    this.queue.push(task);
    this.sortQueue();

    return task.id;
  }

  /**
   * Add multiple tasks
   */
  addTasks(tasks: Array<{
    name: string;
    handler: TaskHandler;
    priority?: TaskPriority;
    options?: {
      description?: string;
      dependencies?: string[];
      timeout?: number;
      maxRetries?: number;
    };
  }>): string[] {
    return tasks.map(t => this.addTask(t.name, t.handler, t.priority, t.options));
  }

  /**
   * Remove a task
   */
  removeTask(taskId: string): boolean {
    const index = this.queue.findIndex(t => t.id === taskId);
    if (index >= 0) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Cancel a task
   */
  cancelTask(taskId: string): boolean {
    const task = this.getTask(taskId);
    if (!task) return false;

    if (task.status === 'pending' || task.status === 'queued') {
      const index = this.queue.findIndex(t => t.id === taskId);
      if (index >= 0) {
        this.queue.splice(index, 1);
      }
      task.status = 'cancelled';
      return true;
    }

    if (task.status === 'running') {
      task.status = 'cancelled';
      return true;
    }

    return false;
  }

  /**
   * Get a task
   */
  getTask(taskId: string): QueuedTask | undefined {
    // Check queue
    const queued = this.queue.find(t => t.id === taskId);
    if (queued) return queued;

    // Check running
    const running = this.runningTasks.get(taskId);
    if (running) return running;

    // Check completed
    const completed = this.completedTasks.get(taskId);
    if (completed) return completed;

    // Check failed
    const failed = this.failedTasks.get(taskId);
    if (failed) return failed;

    return undefined;
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(status: TaskStatus): QueuedTask[] {
    switch (status) {
      case 'pending':
      case 'queued':
        return this.queue.filter(t => t.status === status);
      case 'running':
        return Array.from(this.runningTasks.values());
      case 'completed':
        return Array.from(this.completedTasks.values());
      case 'failed':
        return Array.from(this.failedTasks.values());
      case 'cancelled':
        return [
          ...this.queue.filter(t => t.status === 'cancelled'),
          ...Array.from(this.runningTasks.values()).filter(t => t.status === 'cancelled'),
        ];
      default:
        return [];
    }
  }

  /**
   * Get all tasks
   */
  getAllTasks(): QueuedTask[] {
    return [
      ...this.queue,
      ...Array.from(this.runningTasks.values()),
      ...Array.from(this.completedTasks.values()),
      ...Array.from(this.failedTasks.values()),
    ];
  }

  /**
   * Start processing the queue
   */
  async start(): Promise<void> {
    if (this.processing) return;

    this.processing = true;
    await this.processQueue();
  }

  /**
   * Stop processing the queue
   */
  stop(): void {
    this.processing = false;
  }

  /**
   * Pause processing
   */
  pause(): void {
    this.processing = false;
  }

  /**
   * Resume processing
   */
  async resume(): Promise<void> {
    if (!this.processing) {
      this.processing = true;
      await this.processQueue();
    }
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue = [];
    this.runningTasks.clear();
  }

  /**
   * Clear completed tasks
   */
  clearCompleted(): void {
    this.completedTasks.clear();
  }

  /**
   * Clear failed tasks
   */
  clearFailed(): void {
    this.failedTasks.clear();
  }

  /**
   * Get queue statistics
   */
  getStatistics(): QueueStatistics {
    const allTasks = this.getAllTasks();
    const completed = Array.from(this.completedTasks.values());
    const averageExecutionTime = completed.length > 0
      ? completed.reduce((sum, t) => sum + (t.result?.duration || 0), 0) / completed.length
      : 0;

    return {
      totalTasks: allTasks.length,
      pendingTasks: this.queue.filter(t => t.status === 'pending').length,
      runningTasks: this.runningTasks.size,
      completedTasks: this.completedTasks.size,
      failedTasks: this.failedTasks.size,
      cancelledTasks: allTasks.filter(t => t.status === 'cancelled').length,
      averageExecutionTime,
      throughput: completed.length / ((Date.now() - this.getStartTime()) / 1000 || 1),
      activeWorkers: this.workerPool.activeWorkers,
    };
  }

  /**
   * Get worker pool info
   */
  getWorkerPool(): WorkerPool {
    return { ...this.workerPool };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<QueueConfig>): void {
    this.config = { ...this.config, ...config };
    this.workerPool.size = config.maxConcurrentTasks || this.config.maxConcurrentTasks;
    this.workerPool.maxConcurrency = this.workerPool.size;
  }

  /**
   * Wait for all tasks to complete
   */
  async waitForCompletion(): Promise<void> {
    while (this.queue.length > 0 || this.runningTasks.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Wait for a specific task to complete
   */
  async waitForTask(taskId: string): Promise<QueuedTask> {
    while (true) {
      const task = this.getTask(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }
      if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
        return task;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Private methods

  private async processQueue(): Promise<void> {
    while (this.processing) {
      // Check if we can start more tasks
      if (this.runningTasks.size < this.config.maxConcurrentTasks && this.queue.length > 0) {
        const task = this.getNextTask();
        if (task) {
          this.executeTask(task);
        }
      }

      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 100));

      // If queue is empty and no tasks running, stop processing
      if (this.queue.length === 0 && this.runningTasks.size === 0) {
        this.processing = false;
        break;
      }
    }
  }

  private getNextTask(): QueuedTask | undefined {
    // Find a task whose dependencies are satisfied
    const availableTasks = this.queue.filter(task => {
      if (task.status !== 'pending') return false;
      
      // Check dependencies
      for (const depId of task.dependencies) {
        const dep = this.getTask(depId);
        if (!dep || dep.status !== 'completed') {
          return false;
        }
      }
      
      return true;
    });

    if (availableTasks.length === 0) return undefined;

    // Sort by priority if enabled
    if (this.config.priorityScheduling) {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      availableTasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    }

    // Get the first available task
    const task = availableTasks[0];
    task.status = 'queued';
    
    return task;
  }

  private async executeTask(task: QueuedTask): Promise<void> {
    // Move from queue to running
    const index = this.queue.findIndex(t => t.id === task.id);
    if (index >= 0) {
      this.queue.splice(index, 1);
    }

    task.status = 'running';
    task.startedAt = Date.now();
    this.runningTasks.set(task.id, task);
    this.workerPool.activeWorkers++;

    try {
      const startTime = Date.now();
      
      // Execute with timeout
      const result = await Promise.race([
        task.handler(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Task timeout')), task.timeout)
        ),
      ]);

      const duration = Date.now() - startTime;

      task.status = 'completed';
      task.completedAt = Date.now();
      task.result = {
        success: true,
        output: result,
        duration,
      };

      this.runningTasks.delete(task.id);
      this.completedTasks.set(task.id, task);
      this.taskHistory.push(task.result);

      // Keep only last 1000 results in history
      if (this.taskHistory.length > 1000) {
        this.taskHistory.shift();
      }
    } catch (error) {
      task.error = String(error);
      task.retryCount++;

      if (this.config.autoRetry && task.retryCount < task.maxRetries) {
        // Retry the task
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        task.status = 'pending';
        this.queue.push(task);
        this.sortQueue();
      } else {
        task.status = 'failed';
        task.completedAt = Date.now();
        task.result = {
          success: false,
          output: null,
          duration: Date.now() - (task.startedAt || Date.now()),
        };

        this.runningTasks.delete(task.id);
        this.failedTasks.set(task.id, task);
      }
    } finally {
      this.workerPool.activeWorkers--;
    }
  }

  private sortQueue(): void {
    if (this.config.priorityScheduling) {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      this.queue.sort((a, b) => {
        // First sort by priority
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        
        // Then by creation time (older first)
        return a.createdAt - b.createdAt;
      });
    }
  }

  private getStartTime(): number {
    const allTasks = this.getAllTasks();
    if (allTasks.length === 0) return Date.now();
    return allTasks[0].createdAt;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Global task queue instance
const taskQueue = new TaskQueue();

export function addTask(
  name: string,
  handler: TaskHandler,
  priority?: TaskPriority,
  options?: {
    description?: string;
    dependencies?: string[];
    timeout?: number;
    maxRetries?: number;
  }
): string {
  return taskQueue.addTask(name, handler, priority, options);
}

export function addTasks(tasks: Array<{
  name: string;
  handler: TaskHandler;
  priority?: TaskPriority;
  options?: {
    description?: string;
    dependencies?: string[];
    timeout?: number;
    maxRetries?: number;
  };
}>): string[] {
  return taskQueue.addTasks(tasks);
}

export function removeTask(taskId: string): boolean {
  return taskQueue.removeTask(taskId);
}

export function cancelTask(taskId: string): boolean {
  return taskQueue.cancelTask(taskId);
}

export function getTask(taskId: string): QueuedTask | undefined {
  return taskQueue.getTask(taskId);
}

export function getTasksByStatus(status: TaskStatus): QueuedTask[] {
  return taskQueue.getTasksByStatus(status);
}

export function getAllTasks(): QueuedTask[] {
  return taskQueue.getAllTasks();
}

export async function start(): Promise<void> {
  return taskQueue.start();
}

export function stop(): void {
  taskQueue.stop();
}

export function pause(): void {
  taskQueue.pause();
}

export async function resume(): Promise<void> {
  return taskQueue.resume();
}

export function clear(): void {
  taskQueue.clear();
}

export function clearCompleted(): void {
  taskQueue.clearCompleted();
}

export function clearFailed(): void {
  taskQueue.clearFailed();
}

export function getStatistics(): QueueStatistics {
  return taskQueue.getStatistics();
}

export function getWorkerPool(): WorkerPool {
  return taskQueue.getWorkerPool();
}

export function updateConfig(config: Partial<QueueConfig>): void {
  taskQueue.updateConfig(config);
}

export async function waitForCompletion(): Promise<void> {
  return taskQueue.waitForCompletion();
}

export async function waitForTask(taskId: string): Promise<QueuedTask> {
  return taskQueue.waitForTask(taskId);
}
