/**
 * Actor Model
 * Inspired by AutoGen's actor-based agent architecture
 * Provides independent actors with state, message queues, and concurrent execution
 */

export interface Actor {
  id: string;
  name: string;
  type: ActorType;
  state: ActorState;
  mailbox: Message[];
  config: ActorConfig;
  metadata: ActorMetadata;
}

export type ActorType = 'agent' | 'tool' | 'supervisor' | 'worker' | 'orchestrator' | 'custom';

export interface ActorState {
  status: ActorStatus;
  currentTask?: string;
  busy: boolean;
  error?: string;
  customState: Record<string, unknown>;
}

export type ActorStatus = 'idle' | 'busy' | 'suspended' | 'terminated' | 'error';

export interface ActorConfig {
  maxMailboxSize: number;
  processingMode: ProcessingMode;
  timeout?: number;
  retryPolicy?: RetryPolicy;
  enablePersistence: boolean;
}

export type ProcessingMode = 'sequential' | 'parallel' | 'batch';

export interface RetryPolicy {
  maxAttempts: number;
  backoff: 'linear' | 'exponential';
  initialDelay: number;
  maxDelay: number;
}

export interface ActorMetadata {
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  version: number;
  tags: string[];
}

export interface Message {
  id: string;
  from: string;
  to: string;
  type: MessageType;
  payload: Record<string, unknown>;
  timestamp: number;
  replyTo?: string;
  correlationId?: string;
  priority: MessagePriority;
}

export type MessageType = 'request' | 'response' | 'notification' | 'command' | 'event' | 'error';

export type MessagePriority = 'low' | 'normal' | 'high' | 'urgent';

export interface ActorSystem {
  id: string;
  name: string;
  actors: Map<string, Actor>;
  messageRouter: MessageRouter;
  supervisor?: string;
  config: SystemConfig;
  metadata: SystemMetadata;
}

export interface MessageRouter {
  route(message: Message): string[];
}

export interface SystemConfig {
  maxActors: number;
  enableDeadLetterQueue: boolean;
  enableMetrics: boolean;
  defaultTimeout: number;
}

export interface SystemMetadata {
  createdAt: number;
  totalMessages: number;
  totalErrors: number;
}

export interface ActorRef {
  actorId: string;
  systemId: string;
}

export interface ActorResponse {
  success: boolean;
  payload?: Record<string, unknown>;
  error?: string;
  correlationId?: string;
}

export interface DeadLetterMessage {
  message: Message;
  error: string;
  timestamp: number;
  retryCount: number;
}

export interface ActorMetrics {
  actorId: string;
  messagesProcessed: number;
  messagesSent: number;
  messagesReceived: number;
  averageProcessingTime: number;
  errorCount: number;
  uptime: number;
}

class ActorManager {
  private systems: Map<string, ActorSystem> = new Map();
  private deadLetterQueue: DeadLetterMessage[] = [];
  private metrics: Map<string, ActorMetrics> = new Map();

  /**
   * Create an actor system
   */
  createSystem(name: string, config?: Partial<SystemConfig>): ActorSystem {
    const system: ActorSystem = {
      id: this.generateSystemId(),
      name,
      actors: new Map(),
      messageRouter: this.createDefaultRouter(),
      config: {
        maxActors: config?.maxActors || 1000,
        enableDeadLetterQueue: config?.enableDeadLetterQueue || true,
        enableMetrics: config?.enableMetrics || true,
        defaultTimeout: config?.defaultTimeout || 30000,
      },
      metadata: {
        createdAt: Date.now(),
        totalMessages: 0,
        totalErrors: 0,
      },
    };

    this.systems.set(system.id, system);
    return system;
  }

  /**
   * Get a system
   */
  getSystem(systemId: string): ActorSystem | undefined {
    return this.systems.get(systemId);
  }

  /**
   * Get all systems
   */
  getAllSystems(): ActorSystem[] {
    return Array.from(this.systems.values());
  }

  /**
   * Delete a system
   */
  deleteSystem(systemId: string): boolean {
    this.systems.delete(systemId);
    this.metrics.delete(systemId);
    return true;
  }

  /**
   * Spawn an actor
   */
  spawnActor(systemId: string, name: string, type: ActorType, config?: Partial<ActorConfig>): Actor {
    const system = this.systems.get(systemId);
    if (!system) {
      throw new Error(`System ${systemId} not found`);
    }

    if (system.actors.size >= system.config.maxActors) {
      throw new Error('Maximum actors reached');
    }

    const actor: Actor = {
      id: this.generateActorId(),
      name,
      type,
      state: {
        status: 'idle',
        busy: false,
        customState: {},
      },
      mailbox: [],
      config: {
        maxMailboxSize: config?.maxMailboxSize || 1000,
        processingMode: config?.processingMode || 'sequential',
        timeout: config?.timeout,
        retryPolicy: config?.retryPolicy,
        enablePersistence: config?.enablePersistence || false,
      },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'system',
        version: 1,
        tags: [],
      },
    };

    system.actors.set(actor.id, actor);
    this.metrics.set(actor.id, {
      actorId: actor.id,
      messagesProcessed: 0,
      messagesSent: 0,
      messagesReceived: 0,
      averageProcessingTime: 0,
      errorCount: 0,
      uptime: 0,
    });

    return actor;
  }

  /**
   * Get an actor
   */
  getActor(systemId: string, actorId: string): Actor | undefined {
    const system = this.systems.get(systemId);
    if (!system) return undefined;
    return system.actors.get(actorId);
  }

  /**
   * Get all actors in a system
   */
  getActors(systemId: string): Actor[] {
    const system = this.systems.get(systemId);
    if (!system) return [];
    return Array.from(system.actors.values());
  }

  /**
   * Terminate an actor
   */
  terminateActor(systemId: string, actorId: string): boolean {
    const system = this.systems.get(systemId);
    if (!system) return false;

    const actor = system.actors.get(actorId);
    if (!actor) return false;

    actor.state.status = 'terminated';
    actor.state.busy = false;
    actor.metadata.updatedAt = Date.now();

    return true;
  }

  /**
   * Send a message to an actor
   */
  async sendMessage(
    systemId: string,
    from: string,
    to: string,
    type: MessageType,
    payload: Record<string, unknown>,
    priority: MessagePriority = 'normal',
    replyTo?: string,
    correlationId?: string
  ): Promise<boolean> {
    const system = this.systems.get(systemId);
    if (!system) return false;

    const message: Message = {
      id: this.generateMessageId(),
      from,
      to,
      type,
      payload,
      timestamp: Date.now(),
      replyTo,
      correlationId,
      priority,
    };

    const actor = system.actors.get(to);
    if (!actor) {
      if (system.config.enableDeadLetterQueue) {
        this.deadLetterQueue.push({
          message,
          error: 'Actor not found',
          timestamp: Date.now(),
          retryCount: 0,
        });
      }
      return false;
    }

    // Check mailbox size
    if (actor.mailbox.length >= actor.config.maxMailboxSize) {
      if (system.config.enableDeadLetterQueue) {
        this.deadLetterQueue.push({
          message,
          error: 'Mailbox full',
          timestamp: Date.now(),
          retryCount: 0,
        });
      }
      return false;
    }

    // Add to mailbox
    actor.mailbox.push(message);
    system.metadata.totalMessages++;

    // Update metrics
    const metrics = this.metrics.get(to);
    if (metrics) {
      metrics.messagesReceived++;
    }

    // Process message if actor is idle
    if (actor.state.status === 'idle' && !actor.state.busy) {
      await this.processMailbox(systemId, actor.id);
    }

    return true;
  }

  /**
   * Process actor mailbox
   */
  async processMailbox(systemId: string, actorId: string): Promise<void> {
    const system = this.systems.get(systemId);
    if (!system) return;

    const actor = system.actors.get(actorId);
    if (!actor || actor.state.status === 'terminated') return;

    actor.state.status = 'busy';
    actor.state.busy = true;
    actor.metadata.updatedAt = Date.now();

    const metrics = this.metrics.get(actorId);

    while (actor.mailbox.length > 0) {
      const message = actor.mailbox.shift()!;
      const startTime = Date.now();

      try {
        // Process message (in real implementation, this would call actor's handler)
        await this.processMessage(system, actor, message);

        const processingTime = Date.now() - startTime;

        if (metrics) {
          metrics.messagesProcessed++;
          metrics.averageProcessingTime = this.calculateAverage(
            metrics.averageProcessingTime,
            metrics.messagesProcessed,
            processingTime
          );
        }

      } catch (error) {
        if (system.config.enableDeadLetterQueue) {
          this.deadLetterQueue.push({
            message,
            error: String(error),
            timestamp: Date.now(),
            retryCount: 0,
          });
        }

        if (metrics) {
          metrics.errorCount++;
        }

        system.metadata.totalErrors++;

        // Apply retry policy
        if (actor.config.retryPolicy) {
          const delay = this.calculateRetryDelay(actor.config.retryPolicy, 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          actor.mailbox.unshift(message);
        }
      }
    }

    actor.state.status = 'idle';
    actor.state.busy = false;
    actor.metadata.updatedAt = Date.now();
  }

  /**
   * Get dead letter queue
   */
  getDeadLetterQueue(): DeadLetterMessage[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Retry dead letter message
   */
  async retryDeadLetterMessage(messageId: string, systemId: string): Promise<boolean> {
    const index = this.deadLetterQueue.findIndex(dlm => dlm.message.id === messageId);
    if (index === -1) return false;

    const deadLetter = this.deadLetterQueue[index];
    this.deadLetterQueue.splice(index, 1);

    return await this.sendMessage(
      systemId,
      deadLetter.message.from,
      deadLetter.message.to,
      deadLetter.message.type,
      deadLetter.message.payload,
      deadLetter.message.priority,
      deadLetter.message.replyTo,
      deadLetter.message.correlationId
    );
  }

  /**
   * Get actor metrics
   */
  getActorMetrics(actorId: string): ActorMetrics | undefined {
    return this.metrics.get(actorId);
  }

  /**
   * Get system statistics
   */
  getSystemStatistics(systemId: string): {
    totalActors: number;
    actorsByType: Record<ActorType, number>;
    actorsByStatus: Record<ActorStatus, number>;
    totalMessages: number;
    totalErrors: number;
    deadLetterQueueSize: number;
  } | undefined {
    const system = this.systems.get(systemId);
    if (!system) return undefined;

    const actors = Array.from(system.actors.values());

    const actorsByType: Record<ActorType, number> = {} as any;
    const actorsByStatus: Record<ActorStatus, number> = {} as any;

    for (const actor of actors) {
      actorsByType[actor.type] = (actorsByType[actor.type] || 0) + 1;
      actorsByStatus[actor.state.status] = (actorsByStatus[actor.state.status] || 0) + 1;
    }

    return {
      totalActors: actors.length,
      actorsByType,
      actorsByStatus,
      totalMessages: system.metadata.totalMessages,
      totalErrors: system.metadata.totalErrors,
      deadLetterQueueSize: this.deadLetterQueue.filter(dlm => {
        const actor = system.actors.get(dlm.message.to);
        return actor !== undefined;
      }).length,
    };
  }

  // Private methods

  private createDefaultRouter(): MessageRouter {
    return {
      route(message: Message): string[] {
        return [message.to];
      },
    };
  }

  private async processMessage(system: ActorSystem, actor: Actor, message: Message): Promise<void> {
    // In a real implementation, this would call the actor's message handler
    console.log(`Actor ${actor.name} processing message from ${message.from}: ${message.type}`);

    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

    // If message expects a reply, send one
    if (message.replyTo && message.type === 'request') {
      await this.sendMessage(
        system.id,
        actor.id,
        message.replyTo,
        'response',
        { result: 'processed' },
        'normal',
        actor.id,
        message.correlationId
      );
    }
  }

  private calculateRetryDelay(retryPolicy: RetryPolicy, attempt: number): number {
    if (retryPolicy.backoff === 'linear') {
      return Math.min(retryPolicy.initialDelay * attempt, retryPolicy.maxDelay);
    } else {
      return Math.min(retryPolicy.initialDelay * Math.pow(2, attempt - 1), retryPolicy.maxDelay);
    }
  }

  private calculateAverage(current: number, count: number, newValue: number): number {
    if (count === 1) return newValue;
    return (current * (count - 1) + newValue) / count;
  }

  private generateSystemId(): string {
    return `sys-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateActorId(): string {
    return `actor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Global actor manager instance
const actorManager = new ActorManager();

export function createSystem(name: string, config?: Partial<SystemConfig>): ActorSystem {
  return actorManager.createSystem(name, config);
}

export function getSystem(systemId: string): ActorSystem | undefined {
  return actorManager.getSystem(systemId);
}

export function getAllSystems(): ActorSystem[] {
  return actorManager.getAllSystems();
}

export function deleteSystem(systemId: string): boolean {
  return actorManager.deleteSystem(systemId);
}

export function spawnActor(systemId: string, name: string, type: ActorType, config?: Partial<ActorConfig>): Actor {
  return actorManager.spawnActor(systemId, name, type, config);
}

export function getActor(systemId: string, actorId: string): Actor | undefined {
  return actorManager.getActor(systemId, actorId);
}

export function getActors(systemId: string): Actor[] {
  return actorManager.getActors(systemId);
}

export function terminateActor(systemId: string, actorId: string): boolean {
  return actorManager.terminateActor(systemId, actorId);
}

export async function sendMessage(
  systemId: string,
  from: string,
  to: string,
  type: MessageType,
  payload: Record<string, unknown>,
  priority?: MessagePriority,
  replyTo?: string,
  correlationId?: string
): Promise<boolean> {
  return actorManager.sendMessage(systemId, from, to, type, payload, priority, replyTo, correlationId);
}

export async function processMailbox(systemId: string, actorId: string): Promise<void> {
  return actorManager.processMailbox(systemId, actorId);
}

export function getDeadLetterQueue(): DeadLetterMessage[] {
  return actorManager.getDeadLetterQueue();
}

export async function retryDeadLetterMessage(messageId: string, systemId: string): Promise<boolean> {
  return actorManager.retryDeadLetterMessage(messageId, systemId);
}

export function getActorMetrics(actorId: string): ActorMetrics | undefined {
  return actorManager.getActorMetrics(actorId);
}

export function getSystemStatistics(systemId: string): {
  totalActors: number;
  actorsByType: Record<ActorType, number>;
  actorsByStatus: Record<ActorStatus, number>;
  totalMessages: number;
  totalErrors: number;
  deadLetterQueueSize: number;
} | undefined {
  return actorManager.getSystemStatistics(systemId);
}
