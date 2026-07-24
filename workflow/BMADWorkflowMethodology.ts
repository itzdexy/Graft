/**
 * BMAD Workflow Methodology
 * Inspired by OpenCode's BMAD (Build, Measure, Analyze, Deploy) workflow methodology
 * Provides structured workflow management with build, measurement, analysis, and deployment phases
 */

export interface BMADWorkflow {
  id: string;
  name: string;
  description: string;
  config: WorkflowConfig;
  phases: Map<string, WorkflowPhase>;
  executions: Map<string, WorkflowExecution>;
  metrics: Map<string, WorkflowMetric>;
  statistics: WorkflowStatistics;
  metadata: WorkflowMetadata;
}

export interface WorkflowConfig {
  enableParallelPhases: boolean;
  enableAutoRetry: boolean;
  maxRetries: number;
  timeout: number;
  enableMetrics: boolean;
  enableNotifications: boolean;
}

export interface WorkflowPhase {
  id: string;
  name: string;
  type: PhaseType;
  order: number;
  dependencies: string[];
  tasks: WorkflowTask[];
  config: PhaseConfig;
  status: PhaseStatus;
}

export type PhaseType = 'build' | 'measure' | 'analyze' | 'deploy' | 'custom';

export type PhaseStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface WorkflowTask {
  id: string;
  name: string;
  description: string;
  type: TaskType;
  command?: string;
  script?: string;
  parameters: Record<string, unknown>;
  timeout?: number;
  retryOnFailure: boolean;
  continueOnError: boolean;
  outputs: TaskOutput[];
}

export type TaskType = 'shell' | 'script' | 'docker' | 'api' | 'custom';

export interface TaskOutput {
  name: string;
  type: OutputType;
  path?: string;
  format?: string;
}

export type OutputType = 'file' | 'directory' | 'metric' | 'artifact' | 'log';

export interface PhaseConfig {
  parallel: boolean;
  timeout: number;
  environment: Record<string, string>;
  resources: ResourceAllocation;
}

export interface ResourceAllocation {
  cpu: number;
  memory: number;
  disk: number;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  startedAt: number;
  completedAt?: number;
  duration?: number;
  phaseExecutions: Map<string, PhaseExecution>;
  artifacts: Artifact[];
  logs: ExecutionLog[];
  triggeredBy: string;
  parameters: Record<string, unknown>;
}

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';

export interface PhaseExecution {
  id: string;
  phaseId: string;
  status: PhaseStatus;
  startedAt: number;
  completedAt?: number;
  duration?: number;
  taskExecutions: Map<string, TaskExecution>;
  outputs: Record<string, unknown>;
  error?: string;
}

export interface TaskExecution {
  id: string;
  taskId: string;
  status: TaskStatus;
  startedAt: number;
  completedAt?: number;
  duration?: number;
  output: string;
  error?: string;
  exitCode?: number;
  retryCount: number;
}

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface Artifact {
  id: string;
  name: string;
  type: ArtifactType;
  path: string;
  size: number;
  checksum: string;
  createdAt: number;
}

export type ArtifactType = 'binary' | 'archive' | 'log' | 'report' | 'metric' | 'custom';

export interface ExecutionLog {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: number;
  source: string;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface WorkflowMetric {
  id: string;
  name: string;
  type: MetricType;
  value: number;
  unit: string;
  timestamp: number;
  labels: Record<string, string>;
}

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

export interface WorkflowStatistics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  totalArtifacts: number;
  totalMetrics: number;
}

export interface WorkflowMetadata {
  version: string;
  createdAt: number;
  updatedAt: number;
  totalOperations: number;
}

class BMADWorkflowManager {
  private workflows: Map<string, BMADWorkflow> = new Map();

  /**
   * Create a BMAD workflow
   */
  createWorkflow(name: string, description: string, config?: Partial<WorkflowConfig>): BMADWorkflow {
    const workflow: BMADWorkflow = {
      id: this.generateWorkflowId(),
      name,
      description,
      config: {
        enableParallelPhases: config?.enableParallelPhases ?? false,
        enableAutoRetry: config?.enableAutoRetry ?? true,
        maxRetries: config?.maxRetries || 3,
        timeout: config?.timeout || 3600000, // 1 hour
        enableMetrics: config?.enableMetrics ?? true,
        enableNotifications: config?.enableNotifications ?? true,
      },
      phases: new Map(),
      executions: new Map(),
      metrics: new Map(),
      statistics: {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTime: 0,
        totalArtifacts: 0,
        totalMetrics: 0,
      },
      metadata: {
        version: '1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        totalOperations: 0,
      },
    };

    this.workflows.set(workflow.id, workflow);
    return workflow;
  }

  /**
   * Get a workflow
   */
  getWorkflow(workflowId: string): BMADWorkflow | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * Get all workflows
   */
  getAllWorkflows(): BMADWorkflow[] {
    return Array.from(this.workflows.values());
  }

  /**
   * Delete a workflow
   */
  deleteWorkflow(workflowId: string): boolean {
    return this.workflows.delete(workflowId);
  }

  /**
   * Add a phase to a workflow
   */
  addPhase(workflowId: string, phase: WorkflowPhase): boolean {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return false;

    workflow.phases.set(phase.id, phase);
    workflow.metadata.updatedAt = Date.now();

    return true;
  }

  /**
   * Get a phase
   */
  getPhase(workflowId: string, phaseId: string): WorkflowPhase | undefined {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return undefined;

    return workflow.phases.get(phaseId);
  }

  /**
   * Get all phases for a workflow
   */
  getPhases(workflowId: string): WorkflowPhase[] {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return [];

    return Array.from(workflow.phases.values()).sort((a, b) => a.order - b.order);
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(workflowId: string, parameters?: Record<string, unknown>): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const execution: WorkflowExecution = {
      id: this.generateExecutionId(),
      workflowId,
      status: 'pending',
      startedAt: Date.now(),
      phaseExecutions: new Map(),
      artifacts: [],
      logs: [],
      triggeredBy: 'user',
      parameters: parameters || {},
    };

    workflow.executions.set(execution.id, execution);

    try {
      execution.status = 'running';

      // Get phases in order
      const phases = this.getPhases(workflowId);

      // Execute phases
      for (const phase of phases) {
        const phaseExecution = await this.executePhase(workflow, phase, execution, parameters);
        execution.phaseExecutions.set(phaseExecution.id, phaseExecution);

        if (phaseExecution.status === 'failed' && !phase.tasks.some(t => t.continueOnError)) {
          execution.status = 'failed';
          break;
        }
      }

      if (execution.status === 'running') {
        execution.status = 'completed';
        workflow.statistics.successfulExecutions++;
      }

    } catch (error) {
      execution.status = 'failed';
      workflow.statistics.failedExecutions++;
    }

    execution.completedAt = Date.now();
    execution.duration = execution.completedAt - execution.startedAt;

    workflow.statistics.totalExecutions++;
    workflow.statistics.averageExecutionTime =
      this.updateAverage(workflow.statistics.averageExecutionTime, workflow.statistics.totalExecutions, execution.duration);

    workflow.metadata.totalOperations++;
    workflow.metadata.updatedAt = Date.now();

    return execution;
  }

  /**
   * Execute a phase
   */
  private async executePhase(
    workflow: BMADWorkflow,
    phase: WorkflowPhase,
    execution: WorkflowExecution,
    parameters?: Record<string, unknown>
  ): Promise<PhaseExecution> {
    const phaseExecution: PhaseExecution = {
      id: this.generatePhaseExecutionId(),
      phaseId: phase.id,
      status: 'running',
      startedAt: Date.now(),
      taskExecutions: new Map(),
      outputs: {},
    };

    phase.status = 'running';

    try {
      // Check dependencies
      for (const depId of phase.dependencies) {
        const depExecution = execution.phaseExecutions.get(depId);
        if (!depExecution || depExecution.status !== 'completed') {
          phaseExecution.status = 'skipped';
          phaseExecution.error = `Dependency ${depId} not completed`;
          return phaseExecution;
        }
      }

      // Execute tasks
      if (phase.config.parallel) {
        // Parallel execution
        const taskPromises = phase.tasks.map(task =>
          this.executeTask(workflow, task, phaseExecution, parameters)
        );
        await Promise.all(taskPromises);
      } else {
        // Sequential execution
        for (const task of phase.tasks) {
          const taskExecution = await this.executeTask(workflow, task, phaseExecution, parameters);
          phaseExecution.taskExecutions.set(taskExecution.id, taskExecution);

          if (taskExecution.status === 'failed' && !task.continueOnError) {
            phaseExecution.status = 'failed';
            phaseExecution.error = `Task ${task.id} failed`;
            return phaseExecution;
          }
        }
      }

      phaseExecution.status = 'completed';

    } catch (error) {
      phaseExecution.status = 'failed';
      phaseExecution.error = String(error);
    }

    phaseExecution.completedAt = Date.now();
    phaseExecution.duration = phaseExecution.completedAt - phaseExecution.startedAt;

    phase.status = phaseExecution.status;

    return phaseExecution;
  }

  /**
   * Execute a task
   */
  private async executeTask(
    workflow: BMADWorkflow,
    task: WorkflowTask,
    phaseExecution: PhaseExecution,
    parameters?: Record<string, unknown>
  ): Promise<TaskExecution> {
    const taskExecution: TaskExecution = {
      id: this.generateTaskExecutionId(),
      taskId: task.id,
      status: 'running',
      startedAt: Date.now(),
      output: '',
      retryCount: 0,
    };

    const maxRetries = task.retryOnFailure ? workflow.config.maxRetries : 0;

    while (taskExecution.retryCount <= maxRetries) {
      try {
        // Simulate task execution
        await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));

        if (task.command) {
          taskExecution.output = `Executed: ${task.command}`;
        } else if (task.script) {
          taskExecution.output = `Executed script: ${task.script}`;
        }

        taskExecution.status = 'completed';
        taskExecution.exitCode = 0;

        // Record metric if enabled
        if (workflow.config.enableMetrics) {
          this.recordMetric(workflow.id, {
            id: this.generateMetricId(),
            name: `task_${task.id}_duration`,
            type: 'gauge',
            value: Date.now() - taskExecution.startedAt,
            unit: 'ms',
            timestamp: Date.now(),
            labels: { task: task.id },
          });
        }

        break;

      } catch (error) {
        taskExecution.status = 'failed';
        taskExecution.error = String(error);
        taskExecution.retryCount++;

        if (taskExecution.retryCount > maxRetries) {
          break;
        }
      }
    }

    taskExecution.completedAt = Date.now();
    taskExecution.duration = taskExecution.completedAt - taskExecution.startedAt;

    return taskExecution;
  }

  /**
   * Record a metric
   */
  recordMetric(workflowId: string, metric: WorkflowMetric): boolean {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return false;

    workflow.metrics.set(metric.id, metric);
    workflow.statistics.totalMetrics++;
    workflow.metadata.updatedAt = Date.now();

    return true;
  }

  /**
   * Get metrics for a workflow
   */
  getMetrics(workflowId: string): WorkflowMetric[] {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return [];

    return Array.from(workflow.metrics.values());
  }

  /**
   * Get an execution
   */
  getExecution(workflowId: string, executionId: string): WorkflowExecution | undefined {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return undefined;

    return workflow.executions.get(executionId);
  }

  /**
   * Get executions for a workflow
   */
  getExecutions(workflowId: string): WorkflowExecution[] {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return [];

    return Array.from(workflow.executions.values())
      .sort((a, b) => b.startedAt - a.startedAt);
  }

  /**
   * Cancel an execution
   */
  cancelExecution(workflowId: string, executionId: string): boolean {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return false;

    const execution = workflow.executions.get(executionId);
    if (!execution) return false;

    if (execution.status === 'running' || execution.status === 'pending') {
      execution.status = 'cancelled';
      execution.completedAt = Date.now();
      execution.duration = execution.completedAt - execution.startedAt;
      workflow.metadata.updatedAt = Date.now();
      return true;
    }

    return false;
  }

  /**
   * Get statistics for a workflow
   */
  getStatistics(workflowId: string): WorkflowStatistics | undefined {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return undefined;

    return { ...workflow.statistics };
  }

  /**
   * Reset statistics for a workflow
   */
  resetStatistics(workflowId: string): boolean {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return false;

    workflow.statistics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      totalArtifacts: 0,
      totalMetrics: workflow.metrics.size,
    };

    workflow.metadata.updatedAt = Date.now();

    return true;
  }

  // Private methods

  private updateAverage(current: number, count: number, newValue: number): number {
    if (count === 1) return newValue;
    return (current * (count - 1) + newValue) / count;
  }

  private generateWorkflowId(): string {
    return `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generatePhaseExecutionId(): string {
    return `phaseexec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTaskExecutionId(): string {
    return `taskexec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMetricId(): string {
    return `metric-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Helper functions to create phases and tasks
export function createWorkflowPhase(
  id: string,
  name: string,
  type: PhaseType,
  order: number,
  tasks: WorkflowTask[],
  dependencies: string[] = [],
  config?: Partial<PhaseConfig>
): WorkflowPhase {
  return {
    id,
    name,
    type,
    order,
    dependencies,
    tasks,
    config: {
      parallel: config?.parallel ?? false,
      timeout: config?.timeout || 300000,
      environment: config?.environment || {},
      resources: config?.resources || { cpu: 1, memory: 1024, disk: 1024 },
    },
    status: 'pending',
  };
}

export function createWorkflowTask(
  id: string,
  name: string,
  description: string,
  type: TaskType,
  command?: string,
  script?: string,
  parameters: Record<string, unknown> = {},
  outputs: TaskOutput[] = []
): WorkflowTask {
  return {
    id,
    name,
    description,
    type,
    command,
    script,
    parameters,
    timeout: 300000,
    retryOnFailure: false,
    continueOnError: false,
    outputs,
  };
}

export function createTaskOutput(
  name: string,
  type: OutputType,
  path?: string,
  format?: string
): TaskOutput {
  return { name, type, path, format };
}

export function createWorkflowMetric(
  id: string,
  name: string,
  type: MetricType,
  value: number,
  unit: string,
  labels: Record<string, string> = {}
): WorkflowMetric {
  return {
    id,
    name,
    type,
    value,
    unit,
    timestamp: Date.now(),
    labels,
  };
}

// Global BMAD workflow manager instance
const bmadWorkflowManager = new BMADWorkflowManager();

export function createWorkflow(name: string, description: string, config?: Partial<WorkflowConfig>): BMADWorkflow {
  return bmadWorkflowManager.createWorkflow(name, description, config);
}

export function getWorkflow(workflowId: string): BMADWorkflow | undefined {
  return bmadWorkflowManager.getWorkflow(workflowId);
}

export function getAllWorkflows(): BMADWorkflow[] {
  return bmadWorkflowManager.getAllWorkflows();
}

export function deleteWorkflow(workflowId: string): boolean {
  return bmadWorkflowManager.deleteWorkflow(workflowId);
}

export function addPhase(workflowId: string, phase: WorkflowPhase): boolean {
  return bmadWorkflowManager.addPhase(workflowId, phase);
}

export function getPhase(workflowId: string, phaseId: string): WorkflowPhase | undefined {
  return bmadWorkflowManager.getPhase(workflowId, phaseId);
}

export function getPhases(workflowId: string): WorkflowPhase[] {
  return bmadWorkflowManager.getPhases(workflowId);
}

export async function executeWorkflow(workflowId: string, parameters?: Record<string, unknown>): Promise<WorkflowExecution> {
  return bmadWorkflowManager.executeWorkflow(workflowId, parameters);
}

export function recordMetric(workflowId: string, metric: WorkflowMetric): boolean {
  return bmadWorkflowManager.recordMetric(workflowId, metric);
}

export function getMetrics(workflowId: string): WorkflowMetric[] {
  return bmadWorkflowManager.getMetrics(workflowId);
}

export function getExecution(workflowId: string, executionId: string): WorkflowExecution | undefined {
  return bmadWorkflowManager.getExecution(workflowId, executionId);
}

export function getExecutions(workflowId: string): WorkflowExecution[] {
  return bmadWorkflowManager.getExecutions(workflowId);
}

export function cancelExecution(workflowId: string, executionId: string): boolean {
  return bmadWorkflowManager.cancelExecution(workflowId, executionId);
}

export function getStatistics(workflowId: string): WorkflowStatistics | undefined {
  return bmadWorkflowManager.getStatistics(workflowId);
}

export function resetStatistics(workflowId: string): boolean {
  return bmadWorkflowManager.resetStatistics(workflowId);
}
