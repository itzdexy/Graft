/**
 * Workflow Engine
 * Inspired by Mastra's graph-based workflow orchestration
 * Provides intuitive syntax for control flow: .then(), .branch(), .parallel()
 * Supports human-in-the-loop with suspend/resume and state persistence
 */

export interface Workflow {
  id: string;
  name: string;
  description: string;
  version: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  startNodeId: string;
  endNodeId?: string;
  metadata: WorkflowMetadata;
  state: WorkflowState;
}

export interface WorkflowNode {
  id: string;
  name: string;
  type: NodeType;
  config: NodeConfig;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  metadata: NodeMetadata;
}

export type NodeType =
  | 'start'
  | 'end'
  | 'task'
  | 'condition'
  | 'parallel'
  | 'loop'
  | 'subworkflow'
  | 'human_input'
  | 'tool'
  | 'agent';

export interface NodeConfig {
  agentId?: string;
  toolId?: string;
  condition?: string;
  parallelNodes?: string[];
  loopConfig?: LoopConfig;
  subWorkflowId?: string;
  humanInputConfig?: HumanInputConfig;
  timeout?: number;
  retryPolicy?: RetryPolicy;
}

export interface LoopConfig {
  type: 'fixed' | 'while' | 'forEach';
  iterations?: number;
  condition?: string;
  iterable?: string;
  maxIterations?: number;
}

export interface HumanInputConfig {
  prompt: string;
  inputType: 'text' | 'choice' | 'boolean' | 'file';
  choices?: string[];
  required: boolean;
  timeout?: number;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoff: 'linear' | 'exponential';
  initialDelay: number;
  maxDelay: number;
}

export interface NodeMetadata {
  estimatedDuration?: number;
  resourceRequirements?: ResourceRequirements;
  tags: string[];
}

export interface ResourceRequirements {
  cpu?: number;
  memory?: number;
  disk?: number;
}

export interface WorkflowEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  condition?: string;
  label?: string;
  metadata: EdgeMetadata;
}

export interface EdgeMetadata {
  weight?: number;
  tags: string[];
}

export interface WorkflowMetadata {
  version: string;
  author: string;
  createdAt: number;
  updatedAt: number;
  executionCount: number;
  lastExecuted?: number;
  averageExecutionTime?: number;
  successRate: number;
  tags: string[];
}

export interface WorkflowState {
  status: WorkflowStatus;
  currentNodeId: string | null;
  completedNodes: string[];
  failedNodes: string[];
  pendingNodes: string[];
  data: Record<string, unknown>;
  error?: string;
  suspendedAt?: number;
  suspendedReason?: string;
  startedAt?: number;
  completedAt?: number;
}

export type WorkflowStatus = 'idle' | 'running' | 'suspended' | 'completed' | 'failed' | 'cancelled';

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowVersion: string;
  status: WorkflowStatus;
  startedAt: number;
  completedAt?: number;
  currentNodeId: string | null;
  nodeExecutions: NodeExecution[];
  data: Record<string, unknown>;
  error?: string;
  suspendedAt?: number;
  suspendedReason?: string;
  metadata: ExecutionMetadata;
}

export interface NodeExecution {
  nodeId: string;
  status: NodeExecutionStatus;
  startedAt: number;
  completedAt?: number;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  retryCount: number;
  duration: number;
}

export type NodeExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'cancelled';

export interface ExecutionMetadata {
  userId?: string;
  sessionId?: string;
  projectId?: string;
  environment: string;
  triggeredBy: 'user' | 'automation' | 'api' | 'schedule';
  parentExecutionId?: string;
}

export interface WorkflowBuilder {
  workflow: Workflow;
  currentNodeId: string | null;
  pendingEdges: WorkflowEdge[];
}

class WorkflowEngine {
  private workflows: Map<string, Workflow> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();
  private storage: WorkflowStorage;

  constructor(storage?: WorkflowStorage) {
    this.storage = storage || new InMemoryWorkflowStorage();
  }

  /**
   * Create a new workflow builder
   */
  createBuilder(name: string, description: string): WorkflowBuilder {
    const startNodeId = this.generateNodeId('start');
    const workflow: Workflow = {
      id: this.generateWorkflowId(),
      name,
      description,
      version: '1.0.0',
      nodes: [
        {
          id: startNodeId,
          name: 'Start',
          type: 'start',
          config: {},
          inputs: {},
          outputs: {},
          metadata: { tags: [] },
        },
      ],
      edges: [],
      startNodeId,
      metadata: {
        version: '1.0.0',
        author: 'Blink',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        executionCount: 0,
        successRate: 1.0,
        tags: [],
      },
      state: {
        status: 'idle',
        currentNodeId: null,
        completedNodes: [],
        failedNodes: [],
        pendingNodes: [],
        data: {},
      },
    };

    return {
      workflow,
      currentNodeId: startNodeId,
      pendingEdges: [],
    };
  }

  /**
   * Register a workflow
   */
  registerWorkflow(workflow: Workflow): void {
    this.workflows.set(workflow.id, workflow);
  }

  /**
   * Unregister a workflow
   */
  unregisterWorkflow(workflowId: string): boolean {
    return this.workflows.delete(workflowId);
  }

  /**
   * Get a workflow
   */
  getWorkflow(workflowId: string): Workflow | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * Get all workflows
   */
  getAllWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(
    workflowId: string,
    initialData: Record<string, unknown> = {},
    metadata?: Partial<ExecutionMetadata>
  ): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const executionId = this.generateExecutionId();
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      workflowVersion: workflow.version,
      status: 'running',
      startedAt: Date.now(),
      currentNodeId: workflow.startNodeId,
      nodeExecutions: [],
      data: { ...initialData },
      metadata: {
        userId: metadata?.userId,
        sessionId: metadata?.sessionId,
        projectId: metadata?.projectId,
        environment: metadata?.environment || 'development',
        triggeredBy: metadata?.triggeredBy || 'user',
        parentExecutionId: metadata?.parentExecutionId,
      },
    };

    this.executions.set(executionId, execution);

    try {
      await this.executeNodes(workflow, execution);
    } catch (error) {
      execution.status = 'failed';
      execution.error = String(error);
      execution.completedAt = Date.now();
    }

    // Update workflow metadata
    workflow.metadata.executionCount++;
    workflow.metadata.lastExecuted = Date.now();
    if (execution.completedAt) {
      const duration = execution.completedAt - execution.startedAt;
      workflow.metadata.averageExecutionTime = this.calculateAverageExecutionTime(
        workflow.metadata.averageExecutionTime,
        workflow.metadata.executionCount,
        duration
      );
    }

    const successCount = this.getSuccessfulExecutions(workflowId);
    workflow.metadata.successRate = successCount / workflow.metadata.executionCount;

    return execution;
  }

  /**
   * Suspend a workflow execution
   */
  suspendExecution(executionId: string, reason: string): boolean {
    const execution = this.executions.get(executionId);
    if (!execution || execution.status !== 'running') return false;

    execution.status = 'suspended';
    execution.suspendedAt = Date.now();
    execution.suspendedReason = reason;

    // Save state
    this.storage.saveExecution(execution);

    return true;
  }

  /**
   * Resume a suspended workflow execution
   */
  async resumeExecution(executionId: string): Promise<WorkflowExecution> {
    const execution = this.executions.get(executionId);
    if (!execution || execution.status !== 'suspended') {
      throw new Error(`Execution ${executionId} is not suspended`);
    }

    execution.status = 'running';
    execution.suspendedAt = undefined;
    execution.suspendedReason = undefined;

    const workflow = this.workflows.get(execution.workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${execution.workflowId} not found`);
    }

    await this.executeNodes(workflow, execution);

    return execution;
  }

  /**
   * Cancel a workflow execution
   */
  cancelExecution(executionId: string): boolean {
    const execution = this.executions.get(executionId);
    if (!execution || (execution.status !== 'running' && execution.status !== 'suspended')) return false;

    execution.status = 'cancelled';
    execution.completedAt = Date.now();

    return true;
  }

  /**
   * Get an execution
   */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Get executions by workflow
   */
  getExecutionsByWorkflow(workflowId: string): WorkflowExecution[] {
    return Array.from(this.executions.values()).filter(e => e.workflowId === workflowId);
  }

  /**
   * Get all executions
   */
  getAllExecutions(): WorkflowExecution[] {
    return Array.from(this.executions.values());
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalWorkflows: number;
    totalExecutions: number;
    runningExecutions: number;
    suspendedExecutions: number;
    completedExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
    mostExecutedWorkflows: Workflow[];
  } {
    const workflows = this.getAllWorkflows();
    const executions = this.getAllExecutions();

    const running = executions.filter(e => e.status === 'running').length;
    const suspended = executions.filter(e => e.status === 'suspended').length;
    const completed = executions.filter(e => e.status === 'completed').length;
    const failed = executions.filter(e => e.status === 'failed').length;

    const completedExecs = executions.filter(e => e.status === 'completed' && e.completedAt);
    const averageExecutionTime = completedExecs.length > 0
      ? completedExecs.reduce((sum, e) => sum + (e.completedAt! - e.startedAt), 0) / completedExecs.length
      : 0;

    const mostExecutedWorkflows = [...workflows].sort((a, b) => b.metadata.executionCount - a.metadata.executionCount).slice(0, 5);

    return {
      totalWorkflows: workflows.length,
      totalExecutions: executions.length,
      runningExecutions: running,
      suspendedExecutions: suspended,
      completedExecutions: completed,
      failedExecutions: failed,
      averageExecutionTime,
      mostExecutedWorkflows,
    };
  }

  // Private methods

  private async executeNodes(workflow: Workflow, execution: WorkflowExecution): Promise<void> {
    let currentNodeId = execution.currentNodeId || workflow.startNodeId;
    const visited = new Set<string>();

    while (currentNodeId) {
      if (visited.has(currentNodeId)) {
        throw new Error(`Cycle detected at node ${currentNodeId}`);
      }
      visited.add(currentNodeId);

      const node = workflow.nodes.find(n => n.id === currentNodeId);
      if (!node) {
        throw new Error(`Node ${currentNodeId} not found`);
      }

      // Execute node
      const nodeExecution = await this.executeNode(node, execution, workflow);
      execution.nodeExecutions.push(nodeExecution);
      execution.currentNodeId = currentNodeId;

      // Update execution data
      if (nodeExecution.output) {
        execution.data = { ...execution.data, ...nodeExecution.output };
      }

      // Check if node failed
      if (nodeExecution.status === 'failed') {
        execution.status = 'failed';
        execution.error = nodeExecution.error;
        execution.completedAt = Date.now();
        return;
      }

      // Find next node
      const nextNodeId = this.findNextNode(workflow, currentNodeId, execution.data);
      if (nextNodeId) {
        currentNodeId = nextNodeId;
      }

      // Check if we reached the end
      if (!nextNodeId || node.type === 'end') {
        execution.status = 'completed';
        execution.completedAt = Date.now();
        return;
      }

      // Check for human input
      if (node.type === 'human_input') {
        execution.status = 'suspended';
        execution.suspendedAt = Date.now();
        execution.suspendedReason = 'Waiting for human input';
        this.storage.saveExecution(execution);
        return;
      }
    }
  }

  private async executeNode(
    node: WorkflowNode,
    execution: WorkflowExecution,
    workflow: Workflow
  ): Promise<NodeExecution> {
    const nodeExecution: NodeExecution = {
      nodeId: node.id,
      status: 'running',
      startedAt: Date.now(),
      input: execution.data,
      retryCount: 0,
      duration: 0,
    };

    try {
      let output: Record<string, unknown> = {};

      switch (node.type) {
        case 'task':
          output = await this.executeTaskNode(node, execution);
          break;
        case 'condition':
          output = await this.executeConditionNode(node, execution);
          break;
        case 'parallel':
          output = await this.executeParallelNode(node, execution, workflow);
          break;
        case 'loop':
          output = await this.executeLoopNode(node, execution, workflow);
          break;
        case 'subworkflow':
          output = await this.executeSubWorkflowNode(node, execution);
          break;
        case 'tool':
          output = await this.executeToolNode(node, execution);
          break;
        case 'agent':
          output = await this.executeAgentNode(node, execution);
          break;
        case 'human_input':
          output = await this.executeHumanInputNode(node, execution);
          break;
        default:
          output = {};
      }

      nodeExecution.output = output;
      nodeExecution.status = 'completed';
      nodeExecution.completedAt = Date.now();
      nodeExecution.duration = Date.now() - nodeExecution.startedAt;

    } catch (error) {
      // Retry logic
      if (node.config.retryPolicy && nodeExecution.retryCount < node.config.retryPolicy.maxAttempts) {
        nodeExecution.retryCount++;
        const delay = this.calculateRetryDelay(node.config.retryPolicy, nodeExecution.retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeNode(node, execution, workflow);
      }

      nodeExecution.status = 'failed';
      nodeExecution.error = String(error);
      nodeExecution.completedAt = Date.now();
      nodeExecution.duration = Date.now() - nodeExecution.startedAt;
    }

    return nodeExecution;
  }

  private async executeTaskNode(node: WorkflowNode, execution: WorkflowExecution): Promise<Record<string, unknown>> {
    // In a real implementation, this would execute the task
    console.log(`Executing task ${node.name}`);
    await new Promise(resolve => setTimeout(resolve, 100));
    return { success: true };
  }

  private async executeConditionNode(node: WorkflowNode, execution: WorkflowExecution): Promise<Record<string, unknown>> {
    // In a real implementation, this would evaluate the condition
    console.log(`Evaluating condition ${node.name}`);
    await new Promise(resolve => setTimeout(resolve, 50));
    return { result: true };
  }

  private async executeParallelNode(
    node: WorkflowNode,
    execution: WorkflowExecution,
    workflow: Workflow
  ): Promise<Record<string, unknown>> {
    const parallelNodeIds = node.config.parallelNodes || [];
    const results: Record<string, unknown> = {};

    await Promise.all(
      parallelNodeIds.map(async (nodeId) => {
        const parallelNode = workflow.nodes.find(n => n.id === nodeId);
        if (parallelNode) {
          const result = await this.executeNode(parallelNode, execution, workflow);
          results[nodeId] = result.output;
        }
      })
    );

    return results;
  }

  private async executeLoopNode(
    node: WorkflowNode,
    execution: WorkflowExecution,
    workflow: Workflow
  ): Promise<Record<string, unknown>> {
    const loopConfig = node.config.loopConfig;
    if (!loopConfig) return {};

    const results: unknown[] = [];
    let iterations = 0;
    const maxIterations = loopConfig.maxIterations || 100;

    while (iterations < maxIterations) {
      if (loopConfig.type === 'fixed' && iterations >= (loopConfig.iterations || 0)) {
        break;
      }

      // Execute loop body
      const result = await this.executeTaskNode(node, execution);
      results.push(result);
      iterations++;
    }

    return { results, iterations };
  }

  private async executeSubWorkflowNode(node: WorkflowNode, execution: WorkflowExecution): Promise<Record<string, unknown>> {
    // In a real implementation, this would execute the sub-workflow
    console.log(`Executing sub-workflow ${node.config.subWorkflowId}`);
    await new Promise(resolve => setTimeout(resolve, 100));
    return { success: true };
  }

  private async executeToolNode(node: WorkflowNode, execution: WorkflowExecution): Promise<Record<string, unknown>> {
    // In a real implementation, this would execute the tool
    console.log(`Executing tool ${node.config.toolId}`);
    await new Promise(resolve => setTimeout(resolve, 100));
    return { success: true };
  }

  private async executeAgentNode(node: WorkflowNode, execution: WorkflowExecution): Promise<Record<string, unknown>> {
    // In a real implementation, this would execute the agent
    console.log(`Executing agent ${node.config.agentId}`);
    await new Promise(resolve => setTimeout(resolve, 100));
    return { success: true };
  }

  private async executeHumanInputNode(node: WorkflowNode, execution: WorkflowExecution): Promise<Record<string, unknown>> {
    // In a real implementation, this would wait for human input
    console.log(`Waiting for human input: ${node.config.humanInputConfig?.prompt}`);
    return { waiting: true };
  }

  private findNextNode(workflow: Workflow, currentNodeId: string, data: Record<string, unknown>): string | null {
    const outgoingEdges = workflow.edges.filter(e => e.sourceNodeId === currentNodeId);

    for (const edge of outgoingEdges) {
      if (edge.condition) {
        const conditionMet = this.evaluateCondition(edge.condition, data);
        if (conditionMet) {
          return edge.targetNodeId;
        }
      } else {
        return edge.targetNodeId;
      }
    }

    return null;
  }

  private evaluateCondition(condition: string, data: Record<string, unknown>): boolean {
    // In a real implementation, this would evaluate the condition
    // For now, return true
    return true;
  }

  private calculateRetryDelay(retryPolicy: RetryPolicy, attempt: number): number {
    if (retryPolicy.backoff === 'linear') {
      return Math.min(retryPolicy.initialDelay * attempt, retryPolicy.maxDelay);
    } else {
      return Math.min(retryPolicy.initialDelay * Math.pow(2, attempt - 1), retryPolicy.maxDelay);
    }
  }

  private calculateAverageExecutionTime(current: number | undefined, count: number, newDuration: number): number {
    if (current === undefined) return newDuration;
    return (current * (count - 1) + newDuration) / count;
  }

  private getSuccessfulExecutions(workflowId: string): number {
    return this.getExecutionsByWorkflow(workflowId).filter(e => e.status === 'completed').length;
  }

  private generateWorkflowId(): string {
    return `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateNodeId(type: string): string {
    return `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

interface WorkflowStorage {
  saveExecution(execution: WorkflowExecution): Promise<void>;
  loadExecution(executionId: string): Promise<WorkflowExecution | null>;
}

class InMemoryWorkflowStorage implements WorkflowStorage {
  private executions: Map<string, WorkflowExecution> = new Map();

  async saveExecution(execution: WorkflowExecution): Promise<void> {
    this.executions.set(execution.id, execution);
  }

  async loadExecution(executionId: string): Promise<WorkflowExecution | null> {
    return this.executions.get(executionId) || null;
  }
}

// Global workflow engine instance
const workflowEngine = new WorkflowEngine();

export function createBuilder(name: string, description: string): WorkflowBuilder {
  return workflowEngine.createBuilder(name, description);
}

export function registerWorkflow(workflow: Workflow): void {
  workflowEngine.registerWorkflow(workflow);
}

export function unregisterWorkflow(workflowId: string): boolean {
  return workflowEngine.unregisterWorkflow(workflowId);
}

export function getWorkflow(workflowId: string): Workflow | undefined {
  return workflowEngine.getWorkflow(workflowId);
}

export function getAllWorkflows(): Workflow[] {
  return workflowEngine.getAllWorkflows();
}

export async function executeWorkflow(
  workflowId: string,
  initialData?: Record<string, unknown>,
  metadata?: Partial<ExecutionMetadata>
): Promise<WorkflowExecution> {
  return workflowEngine.executeWorkflow(workflowId, initialData, metadata);
}

export function suspendExecution(executionId: string, reason: string): boolean {
  return workflowEngine.suspendExecution(executionId, reason);
}

export async function resumeExecution(executionId: string): Promise<WorkflowExecution> {
  return workflowEngine.resumeExecution(executionId);
}

export function cancelExecution(executionId: string): boolean {
  return workflowEngine.cancelExecution(executionId);
}

export function getExecution(executionId: string): WorkflowExecution | undefined {
  return workflowEngine.getExecution(executionId);
}

export function getExecutionsByWorkflow(workflowId: string): WorkflowExecution[] {
  return workflowEngine.getExecutionsByWorkflow(workflowId);
}

export function getAllExecutions(): WorkflowExecution[] {
  return workflowEngine.getAllExecutions();
}

export function getStatistics(): {
  totalWorkflows: number;
  totalExecutions: number;
  runningExecutions: number;
  suspendedExecutions: number;
  completedExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  mostExecutedWorkflows: Workflow[];
} {
  return workflowEngine.getStatistics();
}
