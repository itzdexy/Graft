/**
 * Pipelines Framework
 * Inspired by Open WebUI's custom logic integration with Python library support
 * Provides message filtering/transformation, rate limiting, and usage monitoring
 */

export interface Pipeline {
  id: string;
  name: string;
  description: string;
  version: string;
  stages: PipelineStage[];
  config: PipelineConfig;
  enabled: boolean;
  metadata: PipelineMetadata;
}

export interface PipelineStage {
  id: string;
  name: string;
  type: StageType;
  config: StageConfig;
  order: number;
  enabled: boolean;
}

export type StageType =
  | 'filter'
  | 'transform'
  | 'validate'
  | 'rate_limit'
  | 'logging'
  | 'analytics'
  | 'custom'
  | 'parallel'
  | 'conditional';

export interface StageConfig {
  parameters?: Record<string, unknown>;
  conditions?: StageCondition[];
  fallback?: string;
  timeout?: number;
  retryPolicy?: RetryPolicy;
}

export interface StageCondition {
  field: string;
  operator: 'equals' | 'contains' | 'matches' | 'greater_than' | 'less_than';
  value: unknown;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoff: 'linear' | 'exponential';
  initialDelay: number;
  maxDelay: number;
}

export interface PipelineConfig {
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  errorHandling: ErrorHandlingStrategy;
  timeout?: number;
  maxConcurrentExecutions?: number;
}

export type ErrorHandlingStrategy = 'stop' | 'continue' | 'skip' | 'retry';

export interface PipelineMetadata {
  version: string;
  author: string;
  createdAt: number;
  updatedAt: number;
  executionCount: number;
  successCount: number;
  failureCount: number;
  averageExecutionTime: number;
  tags: string[];
}

export interface PipelineContext {
  pipelineId: string;
  executionId: string;
  timestamp: number;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface PipelineExecution {
  id: string;
  pipelineId: string;
  pipelineName: string;
  status: ExecutionStatus;
  input: PipelineData;
  output?: PipelineData;
  stageResults: StageExecution[];
  error?: string;
  startedAt: number;
  completedAt?: number;
  duration: number;
  metadata: ExecutionMetadata;
}

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';

export interface PipelineData {
  messages: Message[];
  metadata: Record<string, unknown>;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface StageExecution {
  stageId: string;
  stageName: string;
  status: ExecutionStatus;
  input: PipelineData;
  output?: PipelineData;
  error?: string;
  startedAt: number;
  completedAt?: number;
  duration: number;
  retryCount: number;
}

export interface ExecutionMetadata {
  userId?: string;
  sessionId?: string;
  projectId?: string;
  triggeredBy: 'user' | 'automation' | 'api' | 'schedule';
  parentExecutionId?: string;
}

export interface PipelineStatistics {
  totalPipelines: number;
  enabledPipelines: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  mostExecutedPipelines: Pipeline[];
  stageStatistics: Record<string, StageStatistics>;
}

export interface StageStatistics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
}

class PipelineManager {
  private pipelines: Map<string, Pipeline> = new Map();
  private executions: Map<string, PipelineExecution> = new Map();
  private executionHistory: PipelineExecution[] = [];
  private maxHistorySize: number = 10000;

  /**
   * Register a pipeline
   */
  registerPipeline(pipeline: Pipeline): void {
    this.pipelines.set(pipeline.id, pipeline);
  }

  /**
   * Unregister a pipeline
   */
  unregisterPipeline(pipelineId: string): boolean {
    return this.pipelines.delete(pipelineId);
  }

  /**
   * Get a pipeline
   */
  getPipeline(pipelineId: string): Pipeline | undefined {
    return this.pipelines.get(pipelineId);
  }

  /**
   * Get all pipelines
   */
  getAllPipelines(): Pipeline[] {
    return Array.from(this.pipelines.values());
  }

  /**
   * Get enabled pipelines
   */
  getEnabledPipelines(): Pipeline[] {
    return this.getAllPipelines().filter(p => p.enabled);
  }

  /**
   * Enable a pipeline
   */
  enablePipeline(pipelineId: string): boolean {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) return false;

    pipeline.enabled = true;
    pipeline.metadata.updatedAt = Date.now();
    return true;
  }

  /**
   * Disable a pipeline
   */
  disablePipeline(pipelineId: string): boolean {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) return false;

    pipeline.enabled = false;
    pipeline.metadata.updatedAt = Date.now();
    return true;
  }

  /**
   * Execute a pipeline
   */
  async executePipeline(
    pipelineId: string,
    input: PipelineData,
    context?: Partial<PipelineContext>
  ): Promise<PipelineExecution> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    if (!pipeline.enabled) {
      throw new Error(`Pipeline ${pipelineId} is disabled`);
    }

    const executionId = this.generateExecutionId();
    const execution: PipelineExecution = {
      id: executionId,
      pipelineId,
      pipelineName: pipeline.name,
      status: 'running',
      input,
      stageResults: [],
      startedAt: Date.now(),
      duration: 0,
      metadata: {
        userId: context?.userId,
        sessionId: context?.sessionId,
        triggeredBy: 'user',
      },
    };

    this.executions.set(executionId, execution);

    try {
      // Sort stages by order
      const sortedStages = pipeline.stages
        .filter(s => s.enabled)
        .sort((a, b) => a.order - b.order);

      let currentData = input;

      for (const stage of sortedStages) {
        const stageResult = await this.executeStage(stage, currentData, {
          pipelineId,
          executionId,
          timestamp: Date.now(),
          ...context,
        });

        execution.stageResults.push(stageResult);

        if (stageResult.status === 'failed') {
          if (pipeline.config.errorHandling === 'stop') {
            execution.status = 'failed';
            execution.error = stageResult.error;
            break;
          } else if (pipeline.config.errorHandling === 'skip') {
            continue;
          }
        }

        if (stageResult.output) {
          currentData = stageResult.output;
        }
      }

      if (execution.status === 'running') {
        execution.status = 'completed';
        execution.output = currentData;
      }

      execution.completedAt = Date.now();
      execution.duration = execution.completedAt - execution.startedAt;

      // Update pipeline metadata
      pipeline.metadata.executionCount++;
      pipeline.metadata.updatedAt = Date.now();
      if (execution.status === 'completed') {
        pipeline.metadata.successCount++;
      } else {
        pipeline.metadata.failureCount++;
      }
      pipeline.metadata.averageExecutionTime = this.calculateAverageExecutionTime(
        pipeline.metadata.averageExecutionTime,
        pipeline.metadata.executionCount,
        execution.duration
      );

    } catch (error) {
      execution.status = 'failed';
      execution.error = String(error);
      execution.completedAt = Date.now();
      execution.duration = execution.completedAt - execution.startedAt;
    }

    this.addToHistory(execution);

    return execution;
  }

  /**
   * Execute a single stage
   */
  async executeStage(
    stage: PipelineStage,
    input: PipelineData,
    context: PipelineContext
  ): Promise<StageExecution> {
    const stageExecution: StageExecution = {
      stageId: stage.id,
      stageName: stage.name,
      status: 'running',
      input,
      startedAt: Date.now(),
      retryCount: 0,
      duration: 0,
    };

    try {
      // Check conditions
      if (stage.config.conditions && !this.checkConditions(stage.config.conditions, input)) {
        stageExecution.status = 'completed';
        stageExecution.output = input;
        stageExecution.completedAt = Date.now();
        stageExecution.duration = Date.now() - stageExecution.startedAt;
        return stageExecution;
      }

      // Execute based on stage type
      let output: PipelineData;
      switch (stage.type) {
        case 'filter':
          output = await this.executeFilterStage(stage, input, context);
          break;
        case 'transform':
          output = await this.executeTransformStage(stage, input, context);
          break;
        case 'validate':
          output = await this.executeValidateStage(stage, input, context);
          break;
        case 'rate_limit':
          output = await this.executeRateLimitStage(stage, input, context);
          break;
        case 'logging':
          output = await this.executeLoggingStage(stage, input, context);
          break;
        case 'analytics':
          output = await this.executeAnalyticsStage(stage, input, context);
          break;
        case 'custom':
          output = await this.executeCustomStage(stage, input, context);
          break;
        case 'parallel':
          output = await this.executeParallelStage(stage, input, context);
          break;
        case 'conditional':
          output = await this.executeConditionalStage(stage, input, context);
          break;
        default:
          output = input;
      }

      stageExecution.output = output;
      stageExecution.status = 'completed';
      stageExecution.completedAt = Date.now();
      stageExecution.duration = Date.now() - stageExecution.startedAt;

    } catch (error) {
      // Retry logic
      if (stage.config.retryPolicy && stageExecution.retryCount < stage.config.retryPolicy.maxAttempts) {
        stageExecution.retryCount++;
        const delay = this.calculateRetryDelay(stage.config.retryPolicy, stageExecution.retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeStage(stage, input, context);
      }

      stageExecution.status = 'failed';
      stageExecution.error = String(error);
      stageExecution.completedAt = Date.now();
      stageExecution.duration = Date.now() - stageExecution.startedAt;
    }

    return stageExecution;
  }

  /**
   * Get an execution
   */
  getExecution(executionId: string): PipelineExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Get executions by pipeline
   */
  getExecutionsByPipeline(pipelineId: string): PipelineExecution[] {
    return Array.from(this.executions.values()).filter(e => e.pipelineId === pipelineId);
  }

  /**
   * Get all executions
   */
  getAllExecutions(): PipelineExecution[] {
    return Array.from(this.executions.values());
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit?: number): PipelineExecution[] {
    if (limit) {
      return this.executionHistory.slice(-limit);
    }
    return [...this.executionHistory];
  }

  /**
   * Get statistics
   */
  getStatistics(): PipelineStatistics {
    const pipelines = this.getAllPipelines();
    const enabled = pipelines.filter(p => p.enabled).length;
    const executions = this.getAllExecutions();

    const successful = executions.filter(e => e.status === 'completed').length;
    const failed = executions.filter(e => e.status === 'failed').length;

    const averageExecutionTime = executions.length > 0
      ? executions.reduce((sum, e) => sum + e.duration, 0) / executions.length
      : 0;

    const mostExecutedPipelines = [...pipelines]
      .sort((a, b) => b.metadata.executionCount - a.metadata.executionCount)
      .slice(0, 5);

    // Calculate stage statistics
    const stageStatistics: Record<string, StageStatistics> = {} as any;
    for (const execution of executions) {
      for (const stageResult of execution.stageResults) {
        if (!stageStatistics[stageResult.stageId]) {
          stageStatistics[stageResult.stageId] = {
            totalExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            averageExecutionTime: 0,
          };
        }

        const stats = stageStatistics[stageResult.stageId];
        stats.totalExecutions++;
        if (stageResult.status === 'completed') {
          stats.successfulExecutions++;
        } else {
          stats.failedExecutions++;
        }
        stats.averageExecutionTime = (stats.averageExecutionTime * (stats.totalExecutions - 1) + stageResult.duration) / stats.totalExecutions;
      }
    }

    return {
      totalPipelines: pipelines.length,
      enabledPipelines: enabled,
      totalExecutions: executions.length,
      successfulExecutions: successful,
      failedExecutions: failed,
      averageExecutionTime,
      mostExecutedPipelines,
      stageStatistics,
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

  private async executeFilterStage(
    stage: PipelineStage,
    input: PipelineData,
    context: PipelineContext
  ): Promise<PipelineData> {
    const parameters = stage.config.parameters || {};
    const filterField = parameters.field as string;
    const filterValue = parameters.value as string;

    if (!filterField) return input;

    const filteredMessages = input.messages.filter(msg => {
      const fieldValue = (msg.metadata?.[filterField] as string) || msg.content;
      return fieldValue.includes(filterValue);
    });

    return {
      messages: filteredMessages,
      metadata: input.metadata,
    };
  }

  private async executeTransformStage(
    stage: PipelineStage,
    input: PipelineData,
    context: PipelineContext
  ): Promise<PipelineData> {
    const parameters = stage.config.parameters || {};
    const transformType = parameters.type as string;

    switch (transformType) {
      case 'uppercase':
        return {
          messages: input.messages.map(msg => ({
            ...msg,
            content: msg.content.toUpperCase(),
          })),
          metadata: input.metadata,
        };

      case 'lowercase':
        return {
          messages: input.messages.map(msg => ({
            ...msg,
            content: msg.content.toLowerCase(),
          })),
          metadata: input.metadata,
        };

      case 'truncate':
        const maxLength = (parameters.maxLength as number) || 1000;
        return {
          messages: input.messages.map(msg => ({
            ...msg,
            content: msg.content.substring(0, maxLength),
          })),
          metadata: input.metadata,
        };

      default:
        return input;
    }
  }

  private async executeValidateStage(
    stage: PipelineStage,
    input: PipelineData,
    context: PipelineContext
  ): Promise<PipelineData> {
    const parameters = stage.config.parameters || {};
    const requiredFields = parameters.requiredFields as string[] || [];

    for (const field of requiredFields) {
      if (!(field in input.metadata)) {
        throw new Error(`Required field ${field} is missing`);
      }
    }

    return input;
  }

  private async executeRateLimitStage(
    stage: PipelineStage,
    input: PipelineData,
    context: PipelineContext
  ): Promise<PipelineData> {
    const parameters = stage.config.parameters || {};
    const maxRequests = (parameters.maxRequests as number) || 100;
    const windowMs = (parameters.windowMs as number) || 60000;

    // In a real implementation, this would check actual rate limits
    console.log(`Rate limit check: ${maxRequests} requests per ${windowMs}ms`);

    return input;
  }

  private async executeLoggingStage(
    stage: PipelineStage,
    input: PipelineData,
    context: PipelineContext
  ): Promise<PipelineData> {
    const parameters = stage.config.parameters || {};
    const logLevel = parameters.logLevel as string || 'info';

    console.log(`[${logLevel.toUpperCase()}] Pipeline execution: ${context.pipelineId}`);
    console.log(`Messages: ${input.messages.length}`);

    return input;
  }

  private async executeAnalyticsStage(
    stage: PipelineStage,
    input: PipelineData,
    context: PipelineContext
  ): Promise<PipelineData> {
    // In a real implementation, this would send analytics data
    console.log('Analytics: Recording pipeline execution metrics');

    return input;
  }

  private async executeCustomStage(
    stage: PipelineStage,
    input: PipelineData,
    context: PipelineContext
  ): Promise<PipelineData> {
    const parameters = stage.config.parameters || {};
    const script = parameters.script as string;

    // In a real implementation, this would execute custom Python/JavaScript code
    console.log(`Executing custom script: ${script}`);

    return input;
  }

  private async executeParallelStage(
    stage: PipelineStage,
    input: PipelineData,
    context: PipelineContext
  ): Promise<PipelineData> {
    const parameters = stage.config.parameters || {};
    const parallelStages = parameters.stages as PipelineStage[] || [];

    const results = await Promise.all(
      parallelStages.map(s => this.executeStage(s, input, context))
    );

    // Combine results
    const combinedMessages = results.flatMap(r => r.output?.messages || []);
    const combinedMetadata = results.reduce((acc, r) => ({ ...acc, ...r.output?.metadata }), {} as Record<string, unknown>);

    return {
      messages: combinedMessages,
      metadata: combinedMetadata,
    };
  }

  private async executeConditionalStage(
    stage: PipelineStage,
    input: PipelineData,
    context: PipelineContext
  ): Promise<PipelineData> {
    const parameters = stage.config.parameters || {};
    const condition = parameters.condition as string;
    const trueStage = parameters.trueStage as PipelineStage;
    const falseStage = parameters.falseStage as PipelineStage;

    const conditionMet = this.evaluateCondition(condition, input);

    if (conditionMet && trueStage) {
      return (await this.executeStage(trueStage, input, context)).output || input;
    } else if (!conditionMet && falseStage) {
      return (await this.executeStage(falseStage, input, context)).output || input;
    }

    return input;
  }

  private checkConditions(conditions: StageCondition[], input: PipelineData): boolean {
    for (const condition of conditions) {
      const value = this.getFieldValue(input, condition.field);
      const matches = this.compareValues(value, condition.operator, condition.value);

      if (!matches) return false;
    }

    return true;
  }

  private getFieldValue(input: PipelineData, field: string): unknown {
    const parts = field.split('.');
    let current: any = input;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }

    return current;
  }

  private compareValues(value: unknown, operator: string, expected: unknown): boolean {
    switch (operator) {
      case 'equals':
        return value === expected;
      case 'contains':
        return String(value).includes(String(expected));
      case 'matches':
        return new RegExp(String(expected)).test(String(value));
      case 'greater_than':
        return Number(value) > Number(expected);
      case 'less_than':
        return Number(value) < Number(expected);
      default:
        return false;
    }
  }

  private evaluateCondition(condition: string, input: PipelineData): boolean {
    // Simple condition evaluation
    // In a real implementation, this would use a proper expression parser
    return true;
  }

  private calculateRetryDelay(retryPolicy: RetryPolicy, attempt: number): number {
    if (retryPolicy.backoff === 'linear') {
      return Math.min(retryPolicy.initialDelay * attempt, retryPolicy.maxDelay);
    } else {
      return Math.min(retryPolicy.initialDelay * Math.pow(2, attempt - 1), retryPolicy.maxDelay);
    }
  }

  private calculateAverageExecutionTime(current: number, count: number, newDuration: number): number {
    if (count === 1) return newDuration;
    return (current * (count - 1) + newDuration) / count;
  }

  private addToHistory(execution: PipelineExecution): void {
    this.executionHistory.push(execution);
    this.trimHistory();
  }

  private trimHistory(): void {
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory = this.executionHistory.slice(-this.maxHistorySize);
    }
  }

  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Global pipeline manager instance
const pipelineManager = new PipelineManager();

export function registerPipeline(pipeline: Pipeline): void {
  pipelineManager.registerPipeline(pipeline);
}

export function unregisterPipeline(pipelineId: string): boolean {
  return pipelineManager.unregisterPipeline(pipelineId);
}

export function getPipeline(pipelineId: string): Pipeline | undefined {
  return pipelineManager.getPipeline(pipelineId);
}

export function getAllPipelines(): Pipeline[] {
  return pipelineManager.getAllPipelines();
}

export function getEnabledPipelines(): Pipeline[] {
  return pipelineManager.getEnabledPipelines();
}

export function enablePipeline(pipelineId: string): boolean {
  return pipelineManager.enablePipeline(pipelineId);
}

export function disablePipeline(pipelineId: string): boolean {
  return pipelineManager.disablePipeline(pipelineId);
}

export async function executePipeline(
  pipelineId: string,
  input: PipelineData,
  context?: Partial<PipelineContext>
): Promise<PipelineExecution> {
  return pipelineManager.executePipeline(pipelineId, input, context);
}

export function getExecution(executionId: string): PipelineExecution | undefined {
  return pipelineManager.getExecution(executionId);
}

export function getExecutionsByPipeline(pipelineId: string): PipelineExecution[] {
  return pipelineManager.getExecutionsByPipeline(pipelineId);
}

export function getAllExecutions(): PipelineExecution[] {
  return pipelineManager.getAllExecutions();
}

export function getExecutionHistory(limit?: number): PipelineExecution[] {
  return pipelineManager.getExecutionHistory(limit);
}

export function getStatistics(): PipelineStatistics {
  return pipelineManager.getStatistics();
}

export function setMaxHistorySize(size: number): void {
  pipelineManager.setMaxHistorySize(size);
}
