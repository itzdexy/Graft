/**
 * Tovyr Agent Server
 * Inspired by OpenHands' agent server for managing AI agents
 * Provides server-side agent lifecycle, communication, and orchestration
 */

export interface AgentServer {
  id: string;
  name: string;
  config: ServerConfig;
  agents: Map<string, Agent>;
  sessions: Map<string, Session>;
  tasks: Map<string, AgentTask>;
  statistics: ServerStatistics;
  metadata: ServerMetadata;
}

export interface ServerConfig {
  host: string;
  port: number;
  maxAgents: number;
  maxSessions: number;
  maxTasksPerAgent: number;
  enableAuth: boolean;
  enableTLS: boolean;
  enableWebSocket: boolean;
  enableREST: boolean;
  enableRPC: boolean;
  heartbeatInterval: number;
  sessionTimeout: number;
  taskTimeout: number;
  logLevel: LogLevel;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  capabilities: AgentCapabilities;
  config: AgentConfig;
  sessions: Set<string>;
  tasks: Set<string>;
  createdAt: number;
  lastHeartbeat: number;
  metadata: AgentMetadata;
}

export type AgentType = 'code' | 'chat' | 'analysis' | 'automation' | 'custom';

export type AgentStatus = 'idle' | 'busy' | 'paused' | 'stopped' | 'error';

export interface AgentCapabilities {
  codeGeneration: boolean;
  codeAnalysis: boolean;
  fileOperations: boolean;
  webAccess: boolean;
  commandExecution: boolean;
  databaseAccess: boolean;
  apiIntegration: boolean;
}

export interface AgentConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  tools: string[];
  memoryEnabled: boolean;
  contextWindow: number;
}

export interface AgentMetadata {
  version: string;
  author: string;
  description: string;
  tags: string[];
}

export interface Session {
  id: string;
  agentId: string;
  clientId: string;
  status: SessionStatus;
  messages: Message[];
  context: SessionContext;
  createdAt: number;
  lastActivity: number;
  expiresAt: number;
}

export type SessionStatus = 'active' | 'idle' | 'closed' | 'expired';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  metadata?: MessageMetadata;
}

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface MessageMetadata {
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  tokens?: number;
  latency?: number;
}

export interface ToolCall {
  id: string;
  name: string;
  parameters: Record<string, unknown>;
}

export interface ToolResult {
  id: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface SessionContext {
  variables: Map<string, unknown>;
  files: Map<string, FileContext>;
  environment: Record<string, string>;
}

export interface FileContext {
  path: string;
  content: string;
  language: string;
  lastModified: number;
}

export interface AgentTask {
  id: string;
  agentId: string;
  sessionId: string;
  type: TaskType;
  status: TaskStatus;
  input: TaskInput;
  output?: TaskOutput;
  progress: TaskProgress;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export type TaskType = 'code' | 'analysis' | 'automation' | 'query' | 'custom';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TaskInput {
  prompt: string;
  parameters: Record<string, unknown>;
  context?: SessionContext;
}

export interface TaskOutput {
  result: unknown;
  artifacts: Artifact[];
  metrics: TaskMetrics;
}

export interface Artifact {
  type: ArtifactType;
  content: string;
  path?: string;
  metadata?: Record<string, unknown>;
}

export type ArtifactType = 'code' | 'file' | 'data' | 'log' | 'custom';

export interface TaskProgress {
  current: number;
  total: number;
  message: string;
}

export interface TaskMetrics {
  duration: number;
  tokensUsed: number;
  toolsCalled: number;
  filesModified: number;
}

export interface ServerStatistics {
  totalAgents: number;
  activeAgents: number;
  totalSessions: number;
  activeSessions: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageTaskDuration: number;
  uptime: number;
  startTime: number;
}

export interface ServerMetadata {
  version: string;
  startTime: number;
  totalOperations: number;
}

export interface ServerEvent {
  type: EventType;
  timestamp: number;
  data: unknown;
}

export type EventType = 'agent_created' | 'agent_deleted' | 'agent_status_changed' | 'session_created' | 'session_closed' | 'task_created' | 'task_completed' | 'task_failed' | 'error';

class AgentServerManager {
  private servers: Map<string, AgentServer> = new Map();

  /**
   * Create an agent server
   */
  createServer(name: string, config?: Partial<ServerConfig>): AgentServer {
    const server: AgentServer = {
      id: this.generateServerId(),
      name,
      config: {
        host: config?.host || 'localhost',
        port: config?.port || 8080,
        maxAgents: config?.maxAgents || 100,
        maxSessions: config?.maxSessions || 1000,
        maxTasksPerAgent: config?.maxTasksPerAgent || 10,
        enableAuth: config?.enableAuth ?? false,
        enableTLS: config?.enableTLS ?? false,
        enableWebSocket: config?.enableWebSocket ?? true,
        enableREST: config?.enableREST ?? true,
        enableRPC: config?.enableRPC ?? false,
        heartbeatInterval: config?.heartbeatInterval || 30000,
        sessionTimeout: config?.sessionTimeout || 3600000,
        taskTimeout: config?.taskTimeout || 300000,
        logLevel: config?.logLevel || 'info',
      },
      agents: new Map(),
      sessions: new Map(),
      tasks: new Map(),
      statistics: {
        totalAgents: 0,
        activeAgents: 0,
        totalSessions: 0,
        activeSessions: 0,
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        averageTaskDuration: 0,
        uptime: 0,
        startTime: Date.now(),
      },
      metadata: {
        version: '1.0.0',
        startTime: Date.now(),
        totalOperations: 0,
      },
    };

    this.servers.set(server.id, server);
    return server;
  }

  /**
   * Get a server
   */
  getServer(serverId: string): AgentServer | undefined {
    return this.servers.get(serverId);
  }

  /**
   * Get all servers
   */
  getAllServers(): AgentServer[] {
    return Array.from(this.servers.values());
  }

  /**
   * Delete a server
   */
  deleteServer(serverId: string): boolean {
    return this.servers.delete(serverId);
  }

  /**
   * Register an agent
   */
  registerAgent(serverId: string, agent: Agent): boolean {
    const server = this.servers.get(serverId);
    if (!server) return false;

    if (server.agents.size >= server.config.maxAgents) {
      return false;
    }

    agent.createdAt = Date.now();
    agent.lastHeartbeat = Date.now();
    server.agents.set(agent.id, agent);
    server.statistics.totalAgents++;
    server.metadata.totalOperations++;

    return true;
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(serverId: string, agentId: string): boolean {
    const server = this.servers.get(serverId);
    if (!server) return false;

    const agent = server.agents.get(agentId);
    if (!agent) return false;

    // Close all sessions for this agent
    for (const sessionId of agent.sessions) {
      this.closeSession(serverId, sessionId);
    }

    // Cancel all tasks for this agent
    for (const taskId of agent.tasks) {
      this.cancelTask(serverId, taskId);
    }

    server.agents.delete(agentId);
    server.statistics.totalAgents--;
    server.metadata.totalOperations++;

    return true;
  }

  /**
   * Get an agent
   */
  getAgent(serverId: string, agentId: string): Agent | undefined {
    const server = this.servers.get(serverId);
    if (!server) return undefined;

    return server.agents.get(agentId);
  }

  /**
   * Get all agents
   */
  getAllAgents(serverId: string): Agent[] {
    const server = this.servers.get(serverId);
    if (!server) return [];

    return Array.from(server.agents.values());
  }

  /**
   * Update agent status
   */
  updateAgentStatus(serverId: string, agentId: string, status: AgentStatus): boolean {
    const server = this.servers.get(serverId);
    if (!server) return false;

    const agent = server.agents.get(agentId);
    if (!agent) return false;

    agent.status = status;
    agent.lastHeartbeat = Date.now();
    server.metadata.totalOperations++;

    return true;
  }

  /**
   * Create a session
   */
  createSession(serverId: string, agentId: string, clientId: string): Session | undefined {
    const server = this.servers.get(serverId);
    if (!server) return undefined;

    const agent = server.agents.get(agentId);
    if (!agent) return undefined;

    if (server.sessions.size >= server.config.maxSessions) {
      return undefined;
    }

    const session: Session = {
      id: this.generateSessionId(),
      agentId,
      clientId,
      status: 'active',
      messages: [],
      context: {
        variables: new Map(),
        files: new Map(),
        environment: {},
      },
      createdAt: Date.now(),
      lastActivity: Date.now(),
      expiresAt: Date.now() + server.config.sessionTimeout,
    };

    server.sessions.set(session.id, session);
    agent.sessions.add(session.id);
    server.statistics.totalSessions++;
    server.statistics.activeSessions++;
    server.metadata.totalOperations++;

    return session;
  }

  /**
   * Get a session
   */
  getSession(serverId: string, sessionId: string): Session | undefined {
    const server = this.servers.get(serverId);
    if (!server) return undefined;

    return server.sessions.get(sessionId);
  }

  /**
   * Close a session
   */
  closeSession(serverId: string, sessionId: string): boolean {
    const server = this.servers.get(serverId);
    if (!server) return false;

    const session = server.sessions.get(sessionId);
    if (!session) return false;

    session.status = 'closed';
    server.statistics.activeSessions--;

    const agent = server.agents.get(session.agentId);
    if (agent) {
      agent.sessions.delete(sessionId);
    }

    server.metadata.totalOperations++;

    return true;
  }

  /**
   * Add message to session
   */
  addMessage(serverId: string, sessionId: string, message: Message): boolean {
    const server = this.servers.get(serverId);
    if (!server) return false;

    const session = server.sessions.get(sessionId);
    if (!session) return false;

    session.messages.push(message);
    session.lastActivity = Date.now();
    server.metadata.totalOperations++;

    return true;
  }

  /**
   * Create a task
   */
  createTask(serverId: string, agentId: string, sessionId: string, input: TaskInput, type: TaskType): AgentTask | undefined {
    const server = this.servers.get(serverId);
    if (!server) return undefined;

    const agent = server.agents.get(agentId);
    if (!agent) return undefined;

    if (agent.tasks.size >= server.config.maxTasksPerAgent) {
      return undefined;
    }

    const task: AgentTask = {
      id: this.generateTaskId(),
      agentId,
      sessionId,
      type,
      status: 'pending',
      input,
      progress: {
        current: 0,
        total: 100,
        message: 'Pending',
      },
      createdAt: Date.now(),
    };

    server.tasks.set(task.id, task);
    agent.tasks.add(task.id);
    server.statistics.totalTasks++;
    server.metadata.totalOperations++;

    return task;
  }

  /**
   * Get a task
   */
  getTask(serverId: string, taskId: string): AgentTask | undefined {
    const server = this.servers.get(serverId);
    if (!server) return undefined;

    return server.tasks.get(taskId);
  }

  /**
   * Start a task
   */
  startTask(serverId: string, taskId: string): boolean {
    const server = this.servers.get(serverId);
    if (!server) return false;

    const task = server.tasks.get(taskId);
    if (!task) return false;

    task.status = 'running';
    task.startedAt = Date.now();
    server.metadata.totalOperations++;

    return true;
  }

  /**
   * Complete a task
   */
  completeTask(serverId: string, taskId: string, output: TaskOutput): boolean {
    const server = this.servers.get(serverId);
    if (!server) return false;

    const task = server.tasks.get(taskId);
    if (!task) return false;

    task.status = 'completed';
    task.output = output;
    task.completedAt = Date.now();
    task.progress.current = task.progress.total;
    task.progress.message = 'Completed';

    server.statistics.completedTasks++;
    server.statistics.averageTaskDuration = this.updateAverage(
      server.statistics.averageTaskDuration,
      server.statistics.completedTasks,
      task.completedAt - (task.startedAt || task.createdAt)
    );

    const agent = server.agents.get(task.agentId);
    if (agent) {
      agent.tasks.delete(taskId);
    }

    server.metadata.totalOperations++;

    return true;
  }

  /**
   * Fail a task
   */
  failTask(serverId: string, taskId: string, error: string): boolean {
    const server = this.servers.get(serverId);
    if (!server) return false;

    const task = server.tasks.get(taskId);
    if (!task) return false;

    task.status = 'failed';
    task.error = error;
    task.completedAt = Date.now();
    task.progress.message = `Failed: ${error}`;

    server.statistics.failedTasks++;

    const agent = server.agents.get(task.agentId);
    if (agent) {
      agent.tasks.delete(taskId);
    }

    server.metadata.totalOperations++;

    return true;
  }

  /**
   * Cancel a task
   */
  cancelTask(serverId: string, taskId: string): boolean {
    const server = this.servers.get(serverId);
    if (!server) return false;

    const task = server.tasks.get(taskId);
    if (!task) return false;

    task.status = 'cancelled';
    task.completedAt = Date.now();
    task.progress.message = 'Cancelled';

    const agent = server.agents.get(task.agentId);
    if (agent) {
      agent.tasks.delete(taskId);
    }

    server.metadata.totalOperations++;

    return true;
  }

  /**
   * Update task progress
   */
  updateTaskProgress(serverId: string, taskId: string, progress: Partial<TaskProgress>): boolean {
    const server = this.servers.get(serverId);
    if (!server) return false;

    const task = server.tasks.get(taskId);
    if (!task) return false;

    Object.assign(task.progress, progress);
    server.metadata.totalOperations++;

    return true;
  }

  /**
   * Get statistics for a server
   */
  getStatistics(serverId: string): ServerStatistics | undefined {
    const server = this.servers.get(serverId);
    if (!server) return undefined;

    // Update active agents count
    server.statistics.activeAgents = Array.from(server.agents.values())
      .filter(a => a.status === 'busy' || a.status === 'idle').length;

    // Update active sessions count
    server.statistics.activeSessions = Array.from(server.sessions.values())
      .filter(s => s.status === 'active').length;

    // Update uptime
    server.statistics.uptime = Date.now() - server.statistics.startTime;

    return { ...server.statistics };
  }

  /**
   * Reset statistics for a server
   */
  resetStatistics(serverId: string): boolean {
    const server = this.servers.get(serverId);
    if (!server) return false;

    server.statistics = {
      totalAgents: server.agents.size,
      activeAgents: 0,
      totalSessions: server.sessions.size,
      activeSessions: 0,
      totalTasks: server.tasks.size,
      completedTasks: 0,
      failedTasks: 0,
      averageTaskDuration: 0,
      uptime: 0,
      startTime: Date.now(),
    };

    server.metadata.totalOperations++;

    return true;
  }

  /**
   * Cleanup expired sessions
   */
  cleanupExpiredSessions(serverId: string): number {
    const server = this.servers.get(serverId);
    if (!server) return 0;

    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of server.sessions.entries()) {
      if (session.expiresAt < now) {
        session.status = 'expired';
        server.statistics.activeSessions--;

        const agent = server.agents.get(session.agentId);
        if (agent) {
          agent.sessions.delete(sessionId);
        }

        server.sessions.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      server.metadata.totalOperations++;
    }

    return cleaned;
  }

  /**
   * Check agent heartbeats
   */
  checkAgentHeartbeats(serverId: string): string[] {
    const server = this.servers.get(serverId);
    if (!server) return [];

    const now = Date.now();
    const timeout = server.config.heartbeatInterval * 2;
    const staleAgents: string[] = [];

    for (const [agentId, agent] of server.agents.entries()) {
      if (now - agent.lastHeartbeat > timeout) {
        staleAgents.push(agentId);
        agent.status = 'error';
      }
    }

    if (staleAgents.length > 0) {
      server.metadata.totalOperations++;
    }

    return staleAgents;
  }

  // Private methods

  private updateAverage(current: number, count: number, newValue: number): number {
    if (count === 1) return newValue;
    return (current * (count - 1) + newValue) / count;
  }

  private generateServerId(): string {
    return `server-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Helper functions
export function createAgent(
  id: string,
  name: string,
  type: AgentType,
  capabilities: AgentCapabilities,
  config: AgentConfig,
  metadata?: Partial<AgentMetadata>
): Agent {
  return {
    id,
    name,
    type,
    status: 'idle',
    capabilities,
    config,
    sessions: new Set(),
    tasks: new Set(),
    createdAt: 0,
    lastHeartbeat: 0,
    metadata: {
      version: '1.0.0',
      author: '',
      description: '',
      tags: [],
      ...metadata,
    },
  };
}

export function createMessage(role: MessageRole, content: string, metadata?: MessageMetadata): Message {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    role,
    content,
    timestamp: Date.now(),
    metadata,
  };
}

export function createTaskInput(prompt: string, parameters?: Record<string, unknown>, context?: SessionContext): TaskInput {
  return {
    prompt,
    parameters: parameters || {},
    context,
  };
}

export function createTaskOutput(result: unknown, artifacts: Artifact[], metrics: TaskMetrics): TaskOutput {
  return {
    result,
    artifacts,
    metrics,
  };
}

export function createArtifact(type: ArtifactType, content: string, path?: string, metadata?: Record<string, unknown>): Artifact {
  return {
    type,
    content,
    path,
    metadata,
  };
}

export function createTaskMetrics(duration: number, tokensUsed: number, toolsCalled: number, filesModified: number): TaskMetrics {
  return {
    duration,
    tokensUsed,
    toolsCalled,
    filesModified,
  };
}

// Global agent server manager instance
const agentServerManager = new AgentServerManager();

export function createAgentServer(name: string, config?: Partial<ServerConfig>): AgentServer {
  return agentServerManager.createServer(name, config);
}

export function getAgentServer(serverId: string): AgentServer | undefined {
  return agentServerManager.getServer(serverId);
}

export function getAllAgentServers(): AgentServer[] {
  return agentServerManager.getAllServers();
}

export function deleteAgentServer(serverId: string): boolean {
  return agentServerManager.deleteServer(serverId);
}

export function registerAgent(serverId: string, agent: Agent): boolean {
  return agentServerManager.registerAgent(serverId, agent);
}

export function unregisterAgent(serverId: string, agentId: string): boolean {
  return agentServerManager.unregisterAgent(serverId, agentId);
}

export function getAgent(serverId: string, agentId: string): Agent | undefined {
  return agentServerManager.getAgent(serverId, agentId);
}

export function getAllAgents(serverId: string): Agent[] {
  return agentServerManager.getAllAgents(serverId);
}

export function updateAgentStatus(serverId: string, agentId: string, status: AgentStatus): boolean {
  return agentServerManager.updateAgentStatus(serverId, agentId, status);
}

export function createSession(serverId: string, agentId: string, clientId: string): Session | undefined {
  return agentServerManager.createSession(serverId, agentId, clientId);
}

export function getSession(serverId: string, sessionId: string): Session | undefined {
  return agentServerManager.getSession(serverId, sessionId);
}

export function closeSession(serverId: string, sessionId: string): boolean {
  return agentServerManager.closeSession(serverId, sessionId);
}

export function addMessage(serverId: string, sessionId: string, message: Message): boolean {
  return agentServerManager.addMessage(serverId, sessionId, message);
}

export function createTask(serverId: string, agentId: string, sessionId: string, input: TaskInput, type: TaskType): AgentTask | undefined {
  return agentServerManager.createTask(serverId, agentId, sessionId, input, type);
}

export function getTask(serverId: string, taskId: string): AgentTask | undefined {
  return agentServerManager.getTask(serverId, taskId);
}

export function startTask(serverId: string, taskId: string): boolean {
  return agentServerManager.startTask(serverId, taskId);
}

export function completeTask(serverId: string, taskId: string, output: TaskOutput): boolean {
  return agentServerManager.completeTask(serverId, taskId, output);
}

export function failTask(serverId: string, taskId: string, error: string): boolean {
  return agentServerManager.failTask(serverId, taskId, error);
}

export function cancelTask(serverId: string, taskId: string): boolean {
  return agentServerManager.cancelTask(serverId, taskId);
}

export function updateTaskProgress(serverId: string, taskId: string, progress: Partial<TaskProgress>): boolean {
  return agentServerManager.updateTaskProgress(serverId, taskId, progress);
}

export function getServerStatistics(serverId: string): ServerStatistics | undefined {
  return agentServerManager.getStatistics(serverId);
}

export function resetServerStatistics(serverId: string): boolean {
  return agentServerManager.resetStatistics(serverId);
}

export function cleanupExpiredSessions(serverId: string): number {
  return agentServerManager.cleanupExpiredSessions(serverId);
}

export function checkAgentHeartbeats(serverId: string): string[] {
  return agentServerManager.checkAgentHeartbeats(serverId);
}
