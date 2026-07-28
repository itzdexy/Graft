/**
 * Session persistence system - Session serialization, checkpointing, and recovery
 * Inspired by OpenCode and Goose session management
 */

export interface SessionData {
  id: string;
  createdAt: number;
  updatedAt: number;
  userId?: string;
  projectId?: string;
  cwd: string;
  messages: SessionMessage[];
  context: SessionContext;
  state: SessionState;
  metadata: SessionMetadata;
}

export interface SessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  timestamp: number;
}

export interface ToolResult {
  toolCallId: string;
  output: string;
  error?: string;
  timestamp: number;
}

export interface SessionContext {
  files: string[];
  directories: string[];
  environment: Record<string, string>;
  gitBranch?: string;
  gitCommit?: string;
}

export interface SessionState {
  currentMode: string;
  activeAgent?: string;
  pendingTasks: string[];
  completedTasks: string[];
  settings: Record<string, unknown>;
}

export interface SessionMetadata {
  title: string;
  description?: string;
  tags: string[];
  isPinned: boolean;
  isArchived: boolean;
}

export interface Checkpoint {
  id: string;
  sessionId: string;
  timestamp: number;
  data: SessionData;
  description: string;
  automatic: boolean;
}

export interface SessionRecoveryOptions {
  restoreMessages: boolean;
  restoreContext: boolean;
  restoreState: boolean;
  maxMessages?: number;
}

class SessionPersistenceManager {
  private sessions: Map<string, SessionData> = new Map();
  private checkpoints: Map<string, Checkpoint> = new Map();
  private autoCheckpointInterval: number = 5 * 60 * 1000; // 5 minutes
  private autoCheckpointTimer: ReturnType<typeof setInterval> | null = null;
  private maxSessions: number = 100;
  private persistencePath: string;

  constructor(persistencePath: string = '.tovyr/sessions') {
    this.persistencePath = persistencePath;
    this.loadSessions();
    this.startAutoCheckpoint();
  }

  /**
   * Create a new session
   */
  createSession(
    cwd: string,
    userId?: string,
    projectId?: string,
    metadata?: Partial<SessionMetadata>
  ): SessionData {
    const session: SessionData = {
      id: this.generateId(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      userId,
      projectId,
      cwd,
      messages: [],
      context: {
        files: [],
        directories: [],
        environment: {},
      },
      state: {
        currentMode: 'default',
        pendingTasks: [],
        completedTasks: [],
        settings: {},
      },
      metadata: {
        title: `Session ${new Date().toLocaleString()}`,
        tags: [],
        isPinned: false,
        isArchived: false,
        ...metadata,
      },
    };

    this.sessions.set(session.id, session);
    this.saveSessions();
    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(id: string): SessionData | undefined {
    return this.sessions.get(id);
  }

  /**
   * Get all sessions
   */
  getAllSessions(): SessionData[] {
    return Array.from(this.sessions.values())
      .filter(s => !s.metadata.isArchived)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Get sessions by user
   */
  getSessionsByUser(userId: string): SessionData[] {
    return this.getAllSessions().filter(s => s.userId === userId);
  }

  /**
   * Get sessions by project
   */
  getSessionsByProject(projectId: string): SessionData[] {
    return this.getAllSessions().filter(s => s.projectId === projectId);
  }

  /**
   * Update a session
   */
  updateSession(id: string, updates: Partial<SessionData>): SessionData | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;

    const updated = { ...session, ...updates, updatedAt: Date.now() };
    this.sessions.set(id, updated);
    this.saveSessions();
    return updated;
  }

  /**
   * Add a message to a session
   */
  addMessage(sessionId: string, message: SessionMessage): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.messages.push(message);
    session.updatedAt = Date.now();
    this.saveSessions();
  }

  /**
   * Update session context
   */
  updateContext(sessionId: string, context: Partial<SessionContext>): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.context = { ...session.context, ...context };
    session.updatedAt = Date.now();
    this.saveSessions();
  }

  /**
   * Update session state
   */
  updateState(sessionId: string, state: Partial<SessionState>): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.state = { ...session.state, ...state };
    session.updatedAt = Date.now();
    this.saveSessions();
  }

  /**
   * Delete a session
   */
  deleteSession(id: string): boolean {
    const deleted = this.sessions.delete(id);
    if (deleted) {
      this.saveSessions();
    }
    return deleted;
  }

  /**
   * Archive a session
   */
  archiveSession(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;

    session.metadata.isArchived = true;
    session.updatedAt = Date.now();
    this.saveSessions();
    return true;
  }

  /**
   * Pin a session
   */
  pinSession(id: string, pinned: boolean): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;

    session.metadata.isPinned = pinned;
    session.updatedAt = Date.now();
    this.saveSessions();
    return true;
  }

  /**
   * Create a checkpoint
   */
  createCheckpoint(sessionId: string, description: string, automatic: boolean = false): Checkpoint {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const checkpoint: Checkpoint = {
      id: this.generateId(),
      sessionId,
      timestamp: Date.now(),
      data: JSON.parse(JSON.stringify(session)), // Deep clone
      description,
      automatic,
    };

    this.checkpoints.set(checkpoint.id, checkpoint);
    this.saveCheckpoints();
    return checkpoint;
  }

  /**
   * Get a checkpoint
   */
  getCheckpoint(id: string): Checkpoint | undefined {
    return this.checkpoints.get(id);
  }

  /**
   * Get checkpoints for a session
   */
  getCheckpoints(sessionId: string): Checkpoint[] {
    return Array.from(this.checkpoints.values())
      .filter(c => c.sessionId === sessionId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Restore from checkpoint
   */
  restoreFromCheckpoint(
    checkpointId: string,
    options: SessionRecoveryOptions = {
      restoreMessages: true,
      restoreContext: true,
      restoreState: true,
    }
  ): SessionData | undefined {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) return undefined;

    const session = this.sessions.get(checkpoint.sessionId);
    if (!session) return undefined;

    if (options.restoreMessages) {
      const maxMessages = options.maxMessages || checkpoint.data.messages.length;
      session.messages = checkpoint.data.messages.slice(-maxMessages);
    }

    if (options.restoreContext) {
      session.context = checkpoint.data.context;
    }

    if (options.restoreState) {
      session.state = checkpoint.data.state;
    }

    session.updatedAt = Date.now();
    this.saveSessions();
    return session;
  }

  /**
   * Delete a checkpoint
   */
  deleteCheckpoint(id: string): boolean {
    const deleted = this.checkpoints.delete(id);
    if (deleted) {
      this.saveCheckpoints();
    }
    return deleted;
  }

  /**
   * Search sessions
   */
  searchSessions(query: string): SessionData[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllSessions().filter(session =>
      session.metadata.title.toLowerCase().includes(lowerQuery) ||
      session.metadata.description?.toLowerCase().includes(lowerQuery) ||
      session.metadata.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get session statistics
   */
  getStatistics(): {
    totalSessions: number;
    activeSessions: number;
    archivedSessions: number;
    pinnedSessions: number;
    totalMessages: number;
    totalCheckpoints: number;
    oldestSession: number;
    newestSession: number;
  } {
    const sessions = Array.from(this.sessions.values());
    const activeSessions = sessions.filter(s => !s.metadata.isArchived).length;
    const archivedSessions = sessions.filter(s => s.metadata.isArchived).length;
    const pinnedSessions = sessions.filter(s => s.metadata.isPinned).length;
    const totalMessages = sessions.reduce((sum, s) => sum + s.messages.length, 0);

    const timestamps = sessions.map(s => s.createdAt);
    const oldestSession = timestamps.length > 0 ? Math.min(...timestamps) : 0;
    const newestSession = timestamps.length > 0 ? Math.max(...timestamps) : 0;

    return {
      totalSessions: sessions.length,
      activeSessions,
      archivedSessions,
      pinnedSessions,
      totalMessages,
      totalCheckpoints: this.checkpoints.size,
      oldestSession,
      newestSession,
    };
  }

  /**
   * Export session data
   */
  exportSession(id: string): string | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;

    return JSON.stringify(session, null, 2);
  }

  /**
   * Import session data
   */
  importSession(data: string): SessionData {
    const session: SessionData = JSON.parse(data);
    session.id = this.generateId(); // Generate new ID to avoid conflicts
    this.sessions.set(session.id, session);
    this.saveSessions();
    return session;
  }

  /**
   * Clean up old sessions
   */
  cleanup(maxAge: number = 30 * 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    const cutoff = now - maxAge;
    let deleted = 0;

    for (const [id, session] of this.sessions) {
      if (session.updatedAt < cutoff && !session.metadata.isPinned) {
        this.sessions.delete(id);
        deleted++;
      }
    }

    if (deleted > 0) {
      this.saveSessions();
    }

    return deleted;
  }

  /**
   * Clean up old checkpoints
   */
  cleanupCheckpoints(maxAge: number = 7 * 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    const cutoff = now - maxAge;
    let deleted = 0;

    for (const [id, checkpoint] of this.checkpoints) {
      if (checkpoint.timestamp < cutoff && !checkpoint.automatic) {
        this.checkpoints.delete(id);
        deleted++;
      }
    }

    if (deleted > 0) {
      this.saveCheckpoints();
    }

    return deleted;
  }

  // Private methods

  private loadSessions(): void {
    // In a real implementation, this would load from disk
    console.log('Loading sessions from disk...');
  }

  private saveSessions(): void {
    // In a real implementation, this would save to disk
    console.log('Saving sessions to disk...');

    // Enforce max sessions limit
    if (this.sessions.size > this.maxSessions) {
      const sessions = Array.from(this.sessions.entries())
        .sort((a, b) => a[1].updatedAt - b[1].updatedAt);
      
      const toDelete = sessions.slice(0, this.sessions.size - this.maxSessions);
      for (const [id] of toDelete) {
        if (!this.sessions.get(id)?.metadata.isPinned) {
          this.sessions.delete(id);
        }
      }
    }
  }

  private saveCheckpoints(): void {
    // In a real implementation, this would save to disk
    console.log('Saving checkpoints to disk...');
  }

  private startAutoCheckpoint(): void {
    if (this.autoCheckpointTimer) {
      clearInterval(this.autoCheckpointTimer);
    }

    this.autoCheckpointTimer = setInterval(() => {
      this.createAutoCheckpoints();
    }, this.autoCheckpointInterval);
  }

  private createAutoCheckpoints(): void {
    for (const [id, session] of this.sessions) {
      if (session.messages.length > 0 && !session.metadata.isArchived) {
        this.createCheckpoint(id, 'Auto checkpoint', true);
      }
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Global session persistence instance
let sessionPersistence: SessionPersistenceManager | null = null;

export function initializeSessionPersistence(persistencePath?: string): SessionPersistenceManager {
  if (!sessionPersistence) {
    sessionPersistence = new SessionPersistenceManager(persistencePath);
  }
  return sessionPersistence;
}

export function getSessionPersistence(): SessionPersistenceManager {
  if (!sessionPersistence) {
    sessionPersistence = new SessionPersistenceManager();
  }
  return sessionPersistence;
}

export function createSession(
  cwd: string,
  userId?: string,
  projectId?: string,
  metadata?: Partial<SessionMetadata>
): SessionData {
  return getSessionPersistence().createSession(cwd, userId, projectId, metadata);
}

export function getSession(id: string): SessionData | undefined {
  return getSessionPersistence().getSession(id);
}

export function getAllSessions(): SessionData[] {
  return getSessionPersistence().getAllSessions();
}

export function getSessionsByUser(userId: string): SessionData[] {
  return getSessionPersistence().getSessionsByUser(userId);
}

export function getSessionsByProject(projectId: string): SessionData[] {
  return getSessionPersistence().getSessionsByProject(projectId);
}

export function updateSession(id: string, updates: Partial<SessionData>): SessionData | undefined {
  return getSessionPersistence().updateSession(id, updates);
}

export function addMessage(sessionId: string, message: SessionMessage): void {
  getSessionPersistence().addMessage(sessionId, message);
}

export function updateContext(sessionId: string, context: Partial<SessionContext>): void {
  getSessionPersistence().updateContext(sessionId, context);
}

export function updateState(sessionId: string, state: Partial<SessionState>): void {
  getSessionPersistence().updateState(sessionId, state);
}

export function deleteSession(id: string): boolean {
  return getSessionPersistence().deleteSession(id);
}

export function archiveSession(id: string): boolean {
  return getSessionPersistence().archiveSession(id);
}

export function pinSession(id: string, pinned: boolean): boolean {
  return getSessionPersistence().pinSession(id, pinned);
}

export function createCheckpoint(sessionId: string, description: string, automatic?: boolean): Checkpoint {
  return getSessionPersistence().createCheckpoint(sessionId, description, automatic);
}

export function getCheckpoint(id: string): Checkpoint | undefined {
  return getSessionPersistence().getCheckpoint(id);
}

export function getCheckpoints(sessionId: string): Checkpoint[] {
  return getSessionPersistence().getCheckpoints(sessionId);
}

export function restoreFromCheckpoint(checkpointId: string, options?: SessionRecoveryOptions): SessionData | undefined {
  return getSessionPersistence().restoreFromCheckpoint(checkpointId, options);
}

export function deleteCheckpoint(id: string): boolean {
  return getSessionPersistence().deleteCheckpoint(id);
}

export function searchSessions(query: string): SessionData[] {
  return getSessionPersistence().searchSessions(query);
}

export function getStatistics(): {
  totalSessions: number;
  activeSessions: number;
  archivedSessions: number;
  pinnedSessions: number;
  totalMessages: number;
  totalCheckpoints: number;
  oldestSession: number;
  newestSession: number;
} {
  return getSessionPersistence().getStatistics();
}

export function exportSession(id: string): string | undefined {
  return getSessionPersistence().exportSession(id);
}

export function importSession(data: string): SessionData {
  return getSessionPersistence().importSession(data);
}

export function cleanupSessions(maxAge?: number): number {
  return getSessionPersistence().cleanup(maxAge);
}

export function cleanupCheckpoints(maxAge?: number): number {
  return getSessionPersistence().cleanupCheckpoints(maxAge);
}
