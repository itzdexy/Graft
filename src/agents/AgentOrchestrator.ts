/**
 * Multi-agent orchestration system
 * Inspired by OpenHands, LangGraph, AutoGen, and CrewAI for complex multi-agent workflows
 */

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  description: string;
  capabilities: AgentCapabilities;
  model: string;
  provider: string;
  systemPrompt: string;
  enabled: boolean;
  config: AgentConfig;
}

export type AgentRole =
  | 'planner'
  | 'coder'
  | 'reviewer'
  | 'debugger'
  | 'tester'
  | 'documentation'
  | 'researcher'
  | 'architect'
  | 'security'
  | 'optimizer';

export interface AgentCapabilities {
  canWriteCode: boolean;
  canReviewCode: boolean;
  canExecuteCommands: boolean;
  canAccessFiles: boolean;
  canUseTools: boolean;
  canCommunicate: boolean;
  maxContext: number;
}

export interface AgentConfig {
  temperature: number;
  maxTokens: number;
  timeout: number;
  retryAttempts: number;
}

export interface AgentMessage {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  content: string;
  timestamp: number;
  type: 'request' | 'response' | 'notification' | 'error';
  metadata?: Record<string, unknown>;
}

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  createdBy: string;
  status: TaskStatus;
  priority: TaskPriority;
  dependencies: string[];
  subtasks: AgentTask[];
  result?: TaskResult;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
}

export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface TaskResult {
  success: boolean;
  output: string;
  error?: string;
  data?: Record<string, unknown>;
  metrics: TaskMetrics;
}

export interface TaskMetrics {
  duration: number;
  tokensUsed: number;
  cost: number;
  stepsCompleted: number;
}

export interface SharedMemory {
  id: string;
  key: string;
  value: unknown;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  createdAt: number;
  updatedAt: number;
  accessCount: number;
  lastAccessedBy: string;
}

export interface AgentWorkflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  currentStep: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: WorkflowResult;
}

export interface WorkflowStep {
  id: string;
  agentId: string;
  task: string;
  dependencies: string[];
  parallel: boolean;
  timeout: number;
  retryOnFailure: boolean;
}

export interface WorkflowResult {
  success: boolean;
  completedSteps: number;
  totalSteps: number;
  output: string;
  errors: string[];
  metrics: WorkflowMetrics;
}

export interface WorkflowMetrics {
  totalDuration: number;
  agentExecutionTimes: Record<string, number>;
  totalTokens: number;
  totalCost: number;
}

class AgentOrchestrator {
  private agents: Map<string, Agent> = new Map();
  private tasks: Map<string, AgentTask> = new Map();
  private messages: Map<string, AgentMessage> = new Map();
  private sharedMemory: Map<string, SharedMemory> = new Map();
  private workflows: Map<string, AgentWorkflow> = new Map();
  private activeWorkflow: string | null = null;

  constructor() {
    this.initializeDefaultAgents();
  }

  /**
   * Initialize default agents
   */
  private initializeDefaultAgents(): void {
    // Planner Agent
    this.registerAgent({
      id: 'planner',
      name: 'Planner',
      role: 'planner',
      description: 'Breaks down complex tasks into subtasks and creates execution plans',
      capabilities: {
        canWriteCode: false,
        canReviewCode: true,
        canExecuteCommands: false,
        canAccessFiles: true,
        canUseTools: true,
        canCommunicate: true,
        maxContext: 128000,
      },
      model: 'claude-3-sonnet',
      provider: 'freemodel',
      systemPrompt: 'You are a planning agent. Your job is to break down complex tasks into manageable subtasks and create detailed execution plans.',
      enabled: true,
      config: {
        temperature: 0.3,
        maxTokens: 4000,
        timeout: 60000,
        retryAttempts: 3,
      },
    });

    // Coder Agent
    this.registerAgent({
      id: 'coder',
      name: 'Coder',
      role: 'coder',
      description: 'Writes and modifies code based on specifications',
      capabilities: {
        canWriteCode: true,
        canReviewCode: true,
        canExecuteCommands: false,
        canAccessFiles: true,
        canUseTools: true,
        canCommunicate: true,
        maxContext: 128000,
      },
      model: 'claude-3-sonnet',
      provider: 'freemodel',
      systemPrompt: 'You are a coding agent. Your job is to write high-quality code following best practices and specifications.',
      enabled: true,
      config: {
        temperature: 0.2,
        maxTokens: 8000,
        timeout: 120000,
        retryAttempts: 3,
      },
    });

    // Reviewer Agent
    this.registerAgent({
      id: 'reviewer',
      name: 'Reviewer',
      role: 'reviewer',
      description: 'Reviews code for quality, security, and best practices',
      capabilities: {
        canWriteCode: false,
        canReviewCode: true,
        canExecuteCommands: false,
        canAccessFiles: true,
        canUseTools: true,
        canCommunicate: true,
        maxContext: 128000,
      },
      model: 'claude-3-sonnet',
      provider: 'freemodel',
      systemPrompt: 'You are a code reviewer. Your job is to review code for quality, security, and adherence to best practices.',
      enabled: true,
      config: {
        temperature: 0.1,
        maxTokens: 4000,
        timeout: 60000,
        retryAttempts: 3,
      },
    });

    // Debugger Agent
    this.registerAgent({
      id: 'debugger',
      name: 'Debugger',
      role: 'debugger',
      description: 'Identifies and fixes bugs in code',
      capabilities: {
        canWriteCode: true,
        canReviewCode: true,
        canExecuteCommands: true,
        canAccessFiles: true,
        canUseTools: true,
        canCommunicate: true,
        maxContext: 128000,
      },
      model: 'claude-3-sonnet',
      provider: 'freemodel',
      systemPrompt: 'You are a debugging agent. Your job is to identify and fix bugs in code systematically.',
      enabled: true,
      config: {
        temperature: 0.2,
        maxTokens: 8000,
        timeout: 120000,
        retryAttempts: 3,
      },
    });

    // Tester Agent
    this.registerAgent({
      id: 'tester',
      name: 'Tester',
      role: 'tester',
      description: 'Writes and executes tests for code',
      capabilities: {
        canWriteCode: true,
        canReviewCode: true,
        canExecuteCommands: true,
        canAccessFiles: true,
        canUseTools: true,
        canCommunicate: true,
        maxContext: 128000,
      },
      model: 'claude-3-sonnet',
      provider: 'freemodel',
      systemPrompt: 'You are a testing agent. Your job is to write comprehensive tests and ensure code quality.',
      enabled: true,
      config: {
        temperature: 0.2,
        maxTokens: 8000,
        timeout: 120000,
        retryAttempts: 3,
      },
    });
  }

  /**
   * Register an agent
   */
  registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: string): void {
    this.agents.delete(agentId);
  }

  /**
   * Get an agent
   */
  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all agents
   */
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents by role
   */
  getAgentsByRole(role: AgentRole): Agent[] {
    return this.getAllAgents().filter(a => a.role === role);
  }

  /**
   * Enable/disable an agent
   */
  setAgentEnabled(agentId: string, enabled: boolean): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.enabled = enabled;
    }
  }

  /**
   * Create a task
   */
  createTask(
    title: string,
    description: string,
    assignedTo: string,
    createdBy: string,
    priority: TaskPriority = 'medium'
  ): AgentTask {
    const task: AgentTask = {
      id: this.generateId(),
      title,
      description,
      assignedTo,
      createdBy,
      status: 'pending',
      priority,
      dependencies: [],
      subtasks: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.tasks.set(task.id, task);
    return task;
  }

  /**
   * Assign a task to an agent
   */
  assignTask(taskId: string, agentId: string): boolean {
    const task = this.tasks.get(taskId);
    const agent = this.agents.get(agentId);

    if (!task || !agent || !agent.enabled) {
      return false;
    }

    task.assignedTo = agentId;
    task.status = 'assigned';
    task.updatedAt = Date.now();

    return true;
  }

  /**
   * Start a task
   */
  async startTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    // Check dependencies
    for (const depId of task.dependencies) {
      const dep = this.tasks.get(depId);
      if (dep && dep.status !== 'completed') {
        return false; // Dependencies not met
      }
    }

    task.status = 'in_progress';
    task.startedAt = Date.now();
    task.updatedAt = Date.now();

    // Execute task (in real implementation, this would call the agent)
    await this.executeTask(task);

    return true;
  }

  /**
   * Complete a task
   */
  completeTask(taskId: string, result: TaskResult): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.status = 'completed';
    task.result = result;
    task.completedAt = Date.now();
    task.updatedAt = Date.now();

    return true;
  }

  /**
   * Fail a task
   */
  failTask(taskId: string, error: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.status = 'failed';
    task.result = {
      success: false,
      output: '',
      error,
      metrics: {
        duration: 0,
        tokensUsed: 0,
        cost: 0,
        stepsCompleted: 0,
      },
    };
    task.updatedAt = Date.now();

    return true;
  }

  /**
   * Get a task
   */
  getTask(taskId: string): AgentTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get tasks by agent
   */
  getTasksByAgent(agentId: string): AgentTask[] {
    return Array.from(this.tasks.values()).filter(t => t.assignedTo === agentId);
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(status: TaskStatus): AgentTask[] {
    return Array.from(this.tasks.values()).filter(t => t.status === status);
  }

  /**
   * Send a message between agents
   */
  sendMessage(
    fromAgentId: string,
    toAgentId: string,
    content: string,
    type: 'request' | 'response' | 'notification' | 'error' = 'request',
    metadata?: Record<string, unknown>
  ): AgentMessage {
    const message: AgentMessage = {
      id: this.generateId(),
      fromAgentId,
      toAgentId,
      content,
      timestamp: Date.now(),
      type,
      metadata,
    };

    this.messages.set(message.id, message);
    return message;
  }

  /**
   * Get messages for an agent
   */
  getMessages(agentId: string): AgentMessage[] {
    return Array.from(this.messages.values()).filter(
      m => m.fromAgentId === agentId || m.toAgentId === agentId
    );
  }

  /**
   * Get conversation between two agents
   */
  getConversation(agent1Id: string, agent2Id: string): AgentMessage[] {
    return Array.from(this.messages.values()).filter(
      m => (m.fromAgentId === agent1Id && m.toAgentId === agent2Id) ||
           (m.fromAgentId === agent2Id && m.toAgentId === agent1Id)
    ).sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Set shared memory
   */
  setSharedMemory(
    key: string,
    value: unknown,
    agentId: string,
    type: 'string' | 'number' | 'boolean' | 'object' | 'array' = 'object'
  ): void {
    const existing = this.sharedMemory.get(key);

    if (existing) {
      existing.value = value;
      existing.updatedAt = Date.now();
      existing.accessCount++;
      existing.lastAccessedBy = agentId;
    } else {
      this.sharedMemory.set(key, {
        id: this.generateId(),
        key,
        value,
        type,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        accessCount: 1,
        lastAccessedBy: agentId,
      });
    }
  }

  /**
   * Get shared memory
   */
  getSharedMemory(key: string, agentId: string): unknown | undefined {
    const memory = this.sharedMemory.get(key);
    if (memory) {
      memory.accessCount++;
      memory.lastAccessedBy = agentId;
      memory.updatedAt = Date.now();
      return memory.value;
    }
    return undefined;
  }

  /**
   * Delete shared memory
   */
  deleteSharedMemory(key: string): boolean {
    return this.sharedMemory.delete(key);
  }

  /**
   * Create a workflow
   */
  createWorkflow(name: string, description: string, steps: WorkflowStep[]): AgentWorkflow {
    const workflow: AgentWorkflow = {
      id: this.generateId(),
      name,
      description,
      steps,
      status: 'idle',
      currentStep: 0,
      createdAt: Date.now(),
    };

    this.workflows.set(workflow.id, workflow);
    return workflow;
  }

  /**
   * Start a workflow
   */
  async startWorkflow(workflowId: string): Promise<WorkflowResult> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    workflow.status = 'running';
    workflow.startedAt = Date.now();
    this.activeWorkflow = workflowId;

    const errors: string[] = [];
    let completedSteps = 0;

    for (let i = 0; i < workflow.steps.length; i++) {
      workflow.currentStep = i;
      const step = workflow.steps[i];

      try {
        await this.executeWorkflowStep(step);
        completedSteps++;
      } catch (error) {
        errors.push(String(error));
        if (!step.retryOnFailure) {
          break;
        }
      }
    }

    workflow.status = errors.length === 0 ? 'completed' : 'failed';
    workflow.completedAt = Date.now();
    workflow.result = {
      success: errors.length === 0,
      completedSteps,
      totalSteps: workflow.steps.length,
      output: errors.length === 0 ? 'Workflow completed successfully' : 'Workflow completed with errors',
      errors,
      metrics: {
        totalDuration: (workflow.completedAt || Date.now()) - (workflow.startedAt || Date.now()),
        agentExecutionTimes: {},
        totalTokens: 0,
        totalCost: 0,
      },
    };

    this.activeWorkflow = null;
    return workflow.result;
  }

  /**
   * Pause a workflow
   */
  pauseWorkflow(workflowId: string): boolean {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || workflow.status !== 'running') return false;

    workflow.status = 'paused';
    return true;
  }

  /**
   * Resume a workflow
   */
  async resumeWorkflow(workflowId: string): Promise<WorkflowResult> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || workflow.status !== 'paused') {
      throw new Error('Cannot resume workflow');
    }

    return this.startWorkflow(workflowId);
  }

  /**
   * Get workflow status
   */
  getWorkflowStatus(workflowId: string): AgentWorkflow | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * Get active workflow
   */
  getActiveWorkflow(): AgentWorkflow | undefined {
    if (!this.activeWorkflow) return undefined;
    return this.workflows.get(this.activeWorkflow);
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalAgents: number;
    enabledAgents: number;
    totalTasks: number;
    tasksByStatus: Record<TaskStatus, number>;
    totalMessages: number;
    totalSharedMemory: number;
    totalWorkflows: number;
    activeWorkflow: string | null;
  } {
    const tasksByStatus: Record<TaskStatus, number> = {
      pending: 0,
      assigned: 0,
      in_progress: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const task of this.tasks.values()) {
      tasksByStatus[task.status]++;
    }

    return {
      totalAgents: this.agents.size,
      enabledAgents: this.getAllAgents().filter(a => a.enabled).length,
      totalTasks: this.tasks.size,
      tasksByStatus,
      totalMessages: this.messages.size,
      totalSharedMemory: this.sharedMemory.size,
      totalWorkflows: this.workflows.size,
      activeWorkflow: this.activeWorkflow,
    };
  }

  // Private methods

  private async executeTask(task: AgentTask): Promise<void> {
    // In a real implementation, this would execute the task using the assigned agent
    const agent = this.agents.get(task.assignedTo);
    if (!agent) {
      throw new Error(`Agent ${task.assignedTo} not found`);
    }

    // Simulate task execution
    await new Promise(resolve => setTimeout(resolve, 1000));

    this.completeTask(task.id, {
      success: true,
      output: `Task "${task.title}" completed successfully`,
      metrics: {
        duration: 1000,
        tokensUsed: 100,
        cost: 0.001,
        stepsCompleted: 1,
      },
    });
  }

  private async executeWorkflowStep(step: WorkflowStep): Promise<void> {
    const agent = this.agents.get(step.agentId);
    if (!agent) {
      throw new Error(`Agent ${step.agentId} not found`);
    }

    // Create task for this step
    const task = this.createTask(step.task, step.task, step.agentId, 'workflow', 'high');
    await this.startTask(task.id);

    if (task.status !== 'completed') {
      throw new Error(`Step failed: ${step.task}`);
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Global agent orchestrator instance
const agentOrchestrator = new AgentOrchestrator();

export function registerAgent(agent: Agent): void {
  agentOrchestrator.registerAgent(agent);
}

export function unregisterAgent(agentId: string): void {
  agentOrchestrator.unregisterAgent(agentId);
}

export function getAgent(agentId: string): Agent | undefined {
  return agentOrchestrator.getAgent(agentId);
}

export function getAllAgents(): Agent[] {
  return agentOrchestrator.getAllAgents();
}

export function getAgentsByRole(role: AgentRole): Agent[] {
  return agentOrchestrator.getAgentsByRole(role);
}

export function setAgentEnabled(agentId: string, enabled: boolean): void {
  agentOrchestrator.setAgentEnabled(agentId, enabled);
}

export function createTask(
  title: string,
  description: string,
  assignedTo: string,
  createdBy: string,
  priority?: TaskPriority
): AgentTask {
  return agentOrchestrator.createTask(title, description, assignedTo, createdBy, priority);
}

export function assignTask(taskId: string, agentId: string): boolean {
  return agentOrchestrator.assignTask(taskId, agentId);
}

export async function startTask(taskId: string): Promise<boolean> {
  return agentOrchestrator.startTask(taskId);
}

export function completeTask(taskId: string, result: TaskResult): boolean {
  return agentOrchestrator.completeTask(taskId, result);
}

export function failTask(taskId: string, error: string): boolean {
  return agentOrchestrator.failTask(taskId, error);
}

export function getTask(taskId: string): AgentTask | undefined {
  return agentOrchestrator.getTask(taskId);
}

export function getTasksByAgent(agentId: string): AgentTask[] {
  return agentOrchestrator.getTasksByAgent(agentId);
}

export function getTasksByStatus(status: TaskStatus): AgentTask[] {
  return agentOrchestrator.getTasksByStatus(status);
}

export function sendMessage(
  fromAgentId: string,
  toAgentId: string,
  content: string,
  type?: 'request' | 'response' | 'notification' | 'error',
  metadata?: Record<string, unknown>
): AgentMessage {
  return agentOrchestrator.sendMessage(fromAgentId, toAgentId, content, type, metadata);
}

export function getMessages(agentId: string): AgentMessage[] {
  return agentOrchestrator.getMessages(agentId);
}

export function getConversation(agent1Id: string, agent2Id: string): AgentMessage[] {
  return agentOrchestrator.getConversation(agent1Id, agent2Id);
}

export function setSharedMemory(
  key: string,
  value: unknown,
  agentId: string,
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array'
): void {
  agentOrchestrator.setSharedMemory(key, value, agentId, type);
}

export function getSharedMemory(key: string, agentId: string): unknown | undefined {
  return agentOrchestrator.getSharedMemory(key, agentId);
}

export function deleteSharedMemory(key: string): boolean {
  return agentOrchestrator.deleteSharedMemory(key);
}

export function createWorkflow(name: string, description: string, steps: WorkflowStep[]): AgentWorkflow {
  return agentOrchestrator.createWorkflow(name, description, steps);
}

export async function startWorkflow(workflowId: string): Promise<WorkflowResult> {
  return agentOrchestrator.startWorkflow(workflowId);
}

export function pauseWorkflow(workflowId: string): boolean {
  return agentOrchestrator.pauseWorkflow(workflowId);
}

export async function resumeWorkflow(workflowId: string): Promise<WorkflowResult> {
  return agentOrchestrator.resumeWorkflow(workflowId);
}

export function getWorkflowStatus(workflowId: string): AgentWorkflow | undefined {
  return agentOrchestrator.getWorkflowStatus(workflowId);
}

export function getActiveWorkflow(): AgentWorkflow | undefined {
  return agentOrchestrator.getActiveWorkflow();
}

export function getStatistics(): {
  totalAgents: number;
  enabledAgents: number;
  totalTasks: number;
  tasksByStatus: Record<TaskStatus, number>;
  totalMessages: number;
  totalSharedMemory: number;
  totalWorkflows: number;
  activeWorkflow: string | null;
} {
  return agentOrchestrator.getStatistics();
}
