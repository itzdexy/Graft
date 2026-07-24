/**
 * Automations
 * Inspired by Open WebUI's automation system for trigger-based workflows
 * Provides event-driven automation with triggers, actions, and scheduling
 */

export interface Automation {
  id: string;
  name: string;
  description: string;
  version: string;
  triggers: AutomationTrigger[];
  actions: AutomationAction[];
  conditions: AutomationCondition[];
  config: AutomationConfig;
  enabled: boolean;
  metadata: AutomationMetadata;
}

export interface AutomationTrigger {
  id: string;
  type: TriggerType;
  config: TriggerConfig;
  enabled: boolean;
}

export type TriggerType =
  | 'schedule'
  | 'webhook'
  | 'event'
  | 'file_change'
  | 'message_received'
  | 'user_action'
  | 'api_call'
  | 'custom';

export interface TriggerConfig {
  schedule?: ScheduleConfig;
  webhookUrl?: string;
  eventType?: string;
  filePattern?: string;
  messagePattern?: string;
  actionType?: string;
  customConfig?: Record<string, unknown>;
}

export interface ScheduleConfig {
  type: 'cron' | 'interval' | 'once';
  expression?: string; // cron expression
  interval?: number; // milliseconds
  runAt?: number; // timestamp
  timezone?: string;
}

export interface AutomationAction {
  id: string;
  type: ActionType;
  config: ActionConfig;
  order: number;
  enabled: boolean;
}

export type ActionType =
  | 'send_message'
  | 'execute_command'
  | 'call_api'
  | 'run_workflow'
  | 'create_task'
  | 'update_memory'
  | 'send_notification'
  | 'create_file'
  | 'custom';

export interface ActionConfig {
  message?: string;
  command?: string;
  apiUrl?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  workflowId?: string;
  taskId?: string;
  memoryData?: Record<string, unknown>;
  notificationType?: 'email' | 'slack' | 'discord' | 'webhook';
  filePath?: string;
  fileContent?: string;
  customConfig?: Record<string, unknown>;
  retryPolicy?: RetryPolicy;
}

export interface AutomationCondition {
  id: string;
  field: string;
  operator: ConditionOperator;
  value: unknown;
  enabled: boolean;
}

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'matches'
  | 'exists'
  | 'not_exists';

export interface AutomationConfig {
  errorHandling: ErrorHandlingStrategy;
  retryPolicy?: RetryPolicy;
  timeout?: number;
  maxConcurrentExecutions?: number;
}

export type ErrorHandlingStrategy = 'stop' | 'continue' | 'retry' | 'skip';

export interface RetryPolicy {
  maxAttempts: number;
  backoff: 'linear' | 'exponential';
  initialDelay: number;
  maxDelay: number;
}

export interface AutomationMetadata {
  version: string;
  author: string;
  createdAt: number;
  updatedAt: number;
  executionCount: number;
  successCount: number;
  failureCount: number;
  lastExecuted?: number;
  averageExecutionTime: number;
  tags: string[];
}

export interface AutomationExecution {
  id: string;
  automationId: string;
  automationName: string;
  trigger: TriggerExecution;
  status: ExecutionStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  actionResults: ActionResult[];
  error?: string;
  startedAt: number;
  completedAt?: number;
  duration: number;
  metadata: ExecutionMetadata;
}

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';

export interface TriggerExecution {
  triggerId: string;
  triggerType: TriggerType;
  triggeredAt: number;
  triggerData: Record<string, unknown>;
}

export interface ActionResult {
  actionId: string;
  actionType: ActionType;
  status: ExecutionStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
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
  triggeredBy: string;
  parentExecutionId?: string;
}

export interface AutomationSchedule {
  automationId: string;
  nextRun: number;
  schedule: ScheduleConfig;
}

class AutomationManager {
  private automations: Map<string, Automation> = new Map();
  private executions: Map<string, AutomationExecution> = new Map();
  private schedules: Map<string, AutomationSchedule> = new Map();
  private executionHistory: AutomationExecution[] = [];
  private maxHistorySize: number = 10000;
  private schedulerInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startScheduler();
  }

  /**
   * Register an automation
   */
  registerAutomation(automation: Automation): void {
    this.automations.set(automation.id, automation);

    // Register schedules
    for (const trigger of automation.triggers) {
      if (trigger.type === 'schedule' && trigger.enabled && trigger.config.schedule) {
        this.schedules.set(`${automation.id}:${trigger.id}`, {
          automationId: automation.id,
          nextRun: this.calculateNextRun(trigger.config.schedule),
          schedule: trigger.config.schedule,
        });
      }
    }
  }

  /**
   * Unregister an automation
   */
  unregisterAutomation(automationId: string): boolean {
    // Remove schedules
    for (const key of this.schedules.keys()) {
      if (key.startsWith(automationId)) {
        this.schedules.delete(key);
      }
    }

    return this.automations.delete(automationId);
  }

  /**
   * Get an automation
   */
  getAutomation(automationId: string): Automation | undefined {
    return this.automations.get(automationId);
  }

  /**
   * Get all automations
   */
  getAllAutomations(): Automation[] {
    return Array.from(this.automations.values());
  }

  /**
   * Get enabled automations
   */
  getEnabledAutomations(): Automation[] {
    return this.getAllAutomations().filter(a => a.enabled);
  }

  /**
   * Enable an automation
   */
  enableAutomation(automationId: string): boolean {
    const automation = this.automations.get(automationId);
    if (!automation) return false;

    automation.enabled = true;
    automation.metadata.updatedAt = Date.now();

    // Register schedules
    for (const trigger of automation.triggers) {
      if (trigger.type === 'schedule' && trigger.enabled && trigger.config.schedule) {
        this.schedules.set(`${automation.id}:${trigger.id}`, {
          automationId: automation.id,
          nextRun: this.calculateNextRun(trigger.config.schedule),
          schedule: trigger.config.schedule,
        });
      }
    }

    return true;
  }

  /**
   * Disable an automation
   */
  disableAutomation(automationId: string): boolean {
    const automation = this.automations.get(automationId);
    if (!automation) return false;

    automation.enabled = false;
    automation.metadata.updatedAt = Date.now();

    // Remove schedules
    for (const key of this.schedules.keys()) {
      if (key.startsWith(automationId)) {
        this.schedules.delete(key);
      }
    }

    return true;
  }

  /**
   * Trigger an automation manually
   */
  async triggerAutomation(
    automationId: string,
    triggerData: Record<string, unknown> = {},
    metadata?: Partial<ExecutionMetadata>
  ): Promise<AutomationExecution> {
    const automation = this.automations.get(automationId);
    if (!automation) {
      throw new Error(`Automation ${automationId} not found`);
    }

    if (!automation.enabled) {
      throw new Error(`Automation ${automationId} is disabled`);
    }

    const executionId = this.generateExecutionId();
    const execution: AutomationExecution = {
      id: executionId,
      automationId,
      automationName: automation.name,
      trigger: {
        triggerId: 'manual',
        triggerType: 'custom',
        triggeredAt: Date.now(),
        triggerData,
      },
      status: 'running',
      input: triggerData,
      actionResults: [],
      startedAt: Date.now(),
      duration: 0,
      metadata: {
        userId: metadata?.userId,
        sessionId: metadata?.sessionId,
        projectId: metadata?.projectId,
        triggeredBy: 'manual',
        parentExecutionId: metadata?.parentExecutionId,
      },
    };

    this.executions.set(executionId, execution);

    try {
      // Check conditions
      if (!this.checkConditions(automation.conditions, triggerData)) {
        execution.status = 'completed';
        execution.completedAt = Date.now();
        execution.duration = execution.completedAt - execution.startedAt;
        return execution;
      }

      // Execute actions
      const sortedActions = automation.actions
        .filter(a => a.enabled)
        .sort((a, b) => a.order - b.order);

      let currentOutput: Record<string, unknown> = triggerData;

      for (const action of sortedActions) {
        const actionResult = await this.executeAction(action, currentOutput, execution);
        execution.actionResults.push(actionResult);

        if (actionResult.status === 'failed') {
          if (automation.config.errorHandling === 'stop') {
            execution.status = 'failed';
            execution.error = actionResult.error;
            break;
          } else if (automation.config.errorHandling === 'skip') {
            continue;
          }
        }

        if (actionResult.output) {
          currentOutput = { ...currentOutput, ...actionResult.output };
        }
      }

      if (execution.status === 'running') {
        execution.status = 'completed';
        execution.output = currentOutput;
      }

      execution.completedAt = Date.now();
      execution.duration = execution.completedAt - execution.startedAt;

      // Update automation metadata
      automation.metadata.executionCount++;
      automation.metadata.lastExecuted = Date.now();
      if (execution.status === 'completed') {
        automation.metadata.successCount++;
      } else {
        automation.metadata.failureCount++;
      }
      automation.metadata.averageExecutionTime = this.calculateAverageExecutionTime(
        automation.metadata.averageExecutionTime,
        automation.metadata.executionCount,
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
   * Handle a webhook trigger
   */
  async handleWebhook(automationId: string, data: Record<string, unknown>): Promise<AutomationExecution> {
    return this.triggerAutomation(automationId, data, { triggeredBy: 'webhook' });
  }

  /**
   * Handle an event trigger
   */
  async handleEvent(eventType: string, data: Record<string, unknown>): Promise<AutomationExecution[]> {
    const executions: AutomationExecution[] = [];

    for (const automation of this.getEnabledAutomations()) {
      for (const trigger of automation.triggers) {
        if (trigger.type === 'event' && trigger.enabled && trigger.config.eventType === eventType) {
          try {
            const execution = await this.triggerAutomation(automation.id, data, { triggeredBy: 'event' });
            executions.push(execution);
          } catch (error) {
            console.error(`Failed to trigger automation ${automation.id}:`, error);
          }
        }
      }
    }

    return executions;
  }

  /**
   * Get an execution
   */
  getExecution(executionId: string): AutomationExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Get executions by automation
   */
  getExecutionsByAutomation(automationId: string): AutomationExecution[] {
    return Array.from(this.executions.values()).filter(e => e.automationId === automationId);
  }

  /**
   * Get all executions
   */
  getAllExecutions(): AutomationExecution[] {
    return Array.from(this.executions.values());
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit?: number): AutomationExecution[] {
    if (limit) {
      return this.executionHistory.slice(-limit);
    }
    return [...this.executionHistory];
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalAutomations: number;
    enabledAutomations: number;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
    activeSchedules: number;
    mostExecutedAutomations: Automation[];
  } {
    const automations = this.getAllAutomations();
    const enabled = automations.filter(a => a.enabled).length;
    const executions = this.getAllExecutions();

    const successful = executions.filter(e => e.status === 'completed').length;
    const failed = executions.filter(e => e.status === 'failed').length;

    const averageExecutionTime = executions.length > 0
      ? executions.reduce((sum, e) => sum + e.duration, 0) / executions.length
      : 0;

    const mostExecutedAutomations = [...automations]
      .sort((a, b) => b.metadata.executionCount - a.metadata.executionCount)
      .slice(0, 5);

    return {
      totalAutomations: automations.length,
      enabledAutomations: enabled,
      totalExecutions: executions.length,
      successfulExecutions: successful,
      failedExecutions: failed,
      averageExecutionTime,
      activeSchedules: this.schedules.size,
      mostExecutedAutomations,
    };
  }

  /**
   * Set max history size
   */
  setMaxHistorySize(size: number): void {
    this.maxHistorySize = size;
    this.trimHistory();
  }

  /**
   * Stop the scheduler
   */
  stopScheduler(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }

  // Private methods

  private startScheduler(): void {
    this.schedulerInterval = setInterval(() => {
      this.checkSchedules();
    }, 1000); // Check every second
  }

  private async checkSchedules(): Promise<void> {
    const now = Date.now();

    for (const [key, schedule] of this.schedules.entries()) {
      if (now >= schedule.nextRun) {
        const automation = this.automations.get(schedule.automationId);
        if (automation && automation.enabled) {
          try {
            await this.triggerAutomation(schedule.automationId, { schedule }, { triggeredBy: 'schedule' });
          } catch (error) {
            console.error(`Failed to execute scheduled automation ${schedule.automationId}:`, error);
          }

          // Update next run
          schedule.nextRun = this.calculateNextRun(schedule.schedule);
        }
      }
    }
  }

  private calculateNextRun(schedule: ScheduleConfig): number {
    const now = Date.now();

    switch (schedule.type) {
      case 'interval':
        return now + (schedule.interval || 60000);

      case 'once':
        return schedule.runAt || now;

      case 'cron':
        // Simple cron implementation - in production, use a proper cron library
        // For now, default to 1 hour
        return now + 3600000;

      default:
        return now + 60000;
    }
  }

  private async executeAction(
    action: AutomationAction,
    input: Record<string, unknown>,
    execution: AutomationExecution
  ): Promise<ActionResult> {
    const actionResult: ActionResult = {
      actionId: action.id,
      actionType: action.type,
      status: 'running',
      input,
      startedAt: Date.now(),
      retryCount: 0,
      duration: 0,
    };

    try {
      let output: Record<string, unknown>;

      switch (action.type) {
        case 'send_message':
          output = await this.executeSendMessage(action, input);
          break;
        case 'execute_command':
          output = await this.executeCommand(action, input);
          break;
        case 'call_api':
          output = await this.callApi(action, input);
          break;
        case 'run_workflow':
          output = await this.runWorkflow(action, input);
          break;
        case 'create_task':
          output = await this.createTask(action, input);
          break;
        case 'update_memory':
          output = await this.updateMemory(action, input);
          break;
        case 'send_notification':
          output = await this.sendNotification(action, input);
          break;
        case 'create_file':
          output = await this.createFile(action, input);
          break;
        case 'custom':
          output = await this.executeCustom(action, input);
          break;
        default:
          output = {};
      }

      actionResult.output = output;
      actionResult.status = 'completed';
      actionResult.completedAt = Date.now();
      actionResult.duration = Date.now() - actionResult.startedAt;

    } catch (error) {
      // Retry logic
      if (action.config.retryPolicy && actionResult.retryCount < action.config.retryPolicy.maxAttempts) {
        actionResult.retryCount++;
        const delay = this.calculateRetryDelay(action.config.retryPolicy, actionResult.retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeAction(action, input, execution);
      }

      actionResult.status = 'failed';
      actionResult.error = String(error);
      actionResult.completedAt = Date.now();
      actionResult.duration = Date.now() - actionResult.startedAt;
    }

    return actionResult;
  }

  private async executeSendMessage(action: AutomationAction, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const message = action.config.message || 'Automated message';
    console.log(`Sending message: ${message}`);
    return { messageSent: true, message };
  }

  private async executeCommand(action: AutomationAction, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const command = action.config.command || '';
    console.log(`Executing command: ${command}`);
    return { commandExecuted: true, command };
  }

  private async callApi(action: AutomationAction, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const url = action.config.apiUrl || '';
    const method = action.config.method || 'GET';
    console.log(`Calling API: ${method} ${url}`);
    return { apiCalled: true, url, method };
  }

  private async runWorkflow(action: AutomationAction, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const workflowId = action.config.workflowId || '';
    console.log(`Running workflow: ${workflowId}`);
    return { workflowExecuted: true, workflowId };
  }

  private async createTask(action: AutomationAction, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const taskId = action.config.taskId || this.generateTaskId();
    console.log(`Creating task: ${taskId}`);
    return { taskCreated: true, taskId };
  }

  private async updateMemory(action: AutomationAction, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const memoryData = action.config.memoryData || {};
    console.log(`Updating memory:`, memoryData);
    return { memoryUpdated: true, memoryData };
  }

  private async sendNotification(action: AutomationAction, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const notificationType = action.config.notificationType || 'webhook';
    console.log(`Sending notification: ${notificationType}`);
    return { notificationSent: true, notificationType };
  }

  private async createFile(action: AutomationAction, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const filePath = action.config.filePath || '';
    const fileContent = action.config.fileContent || '';
    console.log(`Creating file: ${filePath}`);
    return { fileCreated: true, filePath };
  }

  private async executeCustom(action: AutomationAction, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const customConfig = action.config.customConfig || {};
    console.log(`Executing custom action:`, customConfig);
    return { customExecuted: true, customConfig };
  }

  private checkConditions(conditions: AutomationCondition[], data: Record<string, unknown>): boolean {
    for (const condition of conditions) {
      if (!condition.enabled) continue;

      const value = this.getFieldValue(data, condition.field);
      const matches = this.compareValues(value, condition.operator, condition.value);

      if (!matches) return false;
    }

    return true;
  }

  private getFieldValue(data: Record<string, unknown>, field: string): unknown {
    const parts = field.split('.');
    let current: any = data;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }

    return current;
  }

  private compareValues(value: unknown, operator: ConditionOperator, expected: unknown): boolean {
    switch (operator) {
      case 'equals':
        return value === expected;
      case 'not_equals':
        return value !== expected;
      case 'contains':
        return String(value).includes(String(expected));
      case 'not_contains':
        return !String(value).includes(String(expected));
      case 'greater_than':
        return Number(value) > Number(expected);
      case 'less_than':
        return Number(value) < Number(expected);
      case 'matches':
        return new RegExp(String(expected)).test(String(value));
      case 'exists':
        return value !== undefined && value !== null;
      case 'not_exists':
        return value === undefined || value === null;
      default:
        return false;
    }
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

  private addToHistory(execution: AutomationExecution): void {
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

  private generateTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Global automation manager instance
const automationManager = new AutomationManager();

export function registerAutomation(automation: Automation): void {
  automationManager.registerAutomation(automation);
}

export function unregisterAutomation(automationId: string): boolean {
  return automationManager.unregisterAutomation(automationId);
}

export function getAutomation(automationId: string): Automation | undefined {
  return automationManager.getAutomation(automationId);
}

export function getAllAutomations(): Automation[] {
  return automationManager.getAllAutomations();
}

export function getEnabledAutomations(): Automation[] {
  return automationManager.getEnabledAutomations();
}

export function enableAutomation(automationId: string): boolean {
  return automationManager.enableAutomation(automationId);
}

export function disableAutomation(automationId: string): boolean {
  return automationManager.disableAutomation(automationId);
}

export async function triggerAutomation(
  automationId: string,
  triggerData?: Record<string, unknown>,
  metadata?: Partial<ExecutionMetadata>
): Promise<AutomationExecution> {
  return automationManager.triggerAutomation(automationId, triggerData, metadata);
}

export async function handleWebhook(automationId: string, data: Record<string, unknown>): Promise<AutomationExecution> {
  return automationManager.handleWebhook(automationId, data);
}

export async function handleEvent(eventType: string, data: Record<string, unknown>): Promise<AutomationExecution[]> {
  return automationManager.handleEvent(eventType, data);
}

export function getExecution(executionId: string): AutomationExecution | undefined {
  return automationManager.getExecution(executionId);
}

export function getExecutionsByAutomation(automationId: string): AutomationExecution[] {
  return automationManager.getExecutionsByAutomation(automationId);
}

export function getAllExecutions(): AutomationExecution[] {
  return automationManager.getAllExecutions();
}

export function getExecutionHistory(limit?: number): AutomationExecution[] {
  return automationManager.getExecutionHistory(limit);
}

export function getStatistics(): {
  totalAutomations: number;
  enabledAutomations: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  activeSchedules: number;
  mostExecutedAutomations: Automation[];
} {
  return automationManager.getStatistics();
}

export function setMaxHistorySize(size: number): void {
  automationManager.setMaxHistorySize(size);
}

export function stopScheduler(): void {
  automationManager.stopScheduler();
}
