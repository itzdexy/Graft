/**
 * Real-time collaboration system for Blink
 * Enables multiple users to work together on the same project with shared sessions
 */

export interface User {
  id: string;
  name: string;
  avatar?: string;
  color: string;
  isLocal: boolean;
}

export interface CursorPosition {
  userId: string;
  file: string;
  line: number;
  column: number;
  timestamp: number;
}

export interface CollaborationSession {
  id: string;
  name: string;
  projectId: string;
  users: User[];
  createdAt: number;
  isActive: boolean;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: number;
  type: 'text' | 'system' | 'code';
}

export interface EditOperation {
  id: string;
  userId: string;
  file: string;
  operation: 'insert' | 'delete' | 'replace';
  position: { line: number; column: number };
  content?: string;
  length?: number;
  timestamp: number;
}

type EventCallback = (data: any) => void;

class CollaborationManager {
  private currentSession: CollaborationSession | null = null;
  private localUser: User;
  private remoteUsers: Map<string, User> = new Map();
  private cursorPositions: Map<string, CursorPosition> = new Map();
  private chatMessages: ChatMessage[] = [];
  private editOperations: EditOperation[] = [];
  private isConnected = false;
  private eventListeners: Map<string, EventCallback[]> = new Map();

  constructor() {
    this.localUser = this.createLocalUser();
  }

  on(event: string, callback: EventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: EventCallback): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  /**
   * Create a new collaboration session
   */
  createSession(name: string, projectId: string): CollaborationSession {
    const session: CollaborationSession = {
      id: this.generateId(),
      name,
      projectId,
      users: [this.localUser],
      createdAt: Date.now(),
      isActive: true,
    };

    this.currentSession = session;
    this.emit('sessionCreated', session);
    return session;
  }

  /**
   * Join an existing collaboration session
   */
  async joinSession(sessionId: string): Promise<void> {
    // In a real implementation, this would connect to a signaling server
    this.isConnected = true;
    this.emit('sessionJoined', sessionId);
  }

  /**
   * Leave the current session
   */
  leaveSession(): void {
    if (!this.currentSession) return;

    this.emit('sessionLeft', this.currentSession.id);
    this.currentSession = null;
    this.remoteUsers.clear();
    this.cursorPositions.clear();
    this.chatMessages = [];
    this.editOperations = [];
    this.isConnected = false;
  }

  /**
   * Get the current session
   */
  getCurrentSession(): CollaborationSession | null {
    return this.currentSession;
  }

  /**
   * Get all users in the current session
   */
  getUsers(): User[] {
    if (!this.currentSession) return [];
    return this.currentSession.users;
  }

  /**
   * Get remote users only
   */
  getRemoteUsers(): User[] {
    return Array.from(this.remoteUsers.values());
  }

  /**
   * Update cursor position
   */
  updateCursorPosition(file: string, line: number, column: number): void {
    const position: CursorPosition = {
      userId: this.localUser.id,
      file,
      line,
      column,
      timestamp: Date.now(),
    };

    this.cursorPositions.set(this.localUser.id, position);
    this.emit('cursorMoved', position);

    // Broadcast to remote users
    if (this.isConnected) {
      this.broadcastCursorPosition(position);
    }
  }

  /**
   * Get all cursor positions
   */
  getCursorPositions(): CursorPosition[] {
    return Array.from(this.cursorPositions.values());
  }

  /**
   * Get cursor positions for a specific file
   */
  getCursorPositionsForFile(file: string): CursorPosition[] {
    return Array.from(this.cursorPositions.values()).filter(
      pos => pos.file === file
    );
  }

  /**
   * Send a chat message
   */
  sendChatMessage(content: string, type: 'text' | 'code' = 'text'): void {
    const message: ChatMessage = {
      id: this.generateId(),
      userId: this.localUser.id,
      userName: this.localUser.name,
      content,
      timestamp: Date.now(),
      type,
    };

    this.chatMessages.push(message);
    this.emit('chatMessage', message);

    // Broadcast to remote users
    if (this.isConnected) {
      this.broadcastChatMessage(message);
    }
  }

  /**
   * Get chat messages
   */
  getChatMessages(): ChatMessage[] {
    return this.chatMessages;
  }

  /**
   * Get chat messages after a timestamp
   */
  getChatMessagesAfter(timestamp: number): ChatMessage[] {
    return this.chatMessages.filter(msg => msg.timestamp > timestamp);
  }

  /**
   * Apply an edit operation
   */
  applyEditOperation(
    file: string,
    operation: 'insert' | 'delete' | 'replace',
    position: { line: number; column: number },
    content?: string,
    length?: number
  ): void {
    const edit: EditOperation = {
      id: this.generateId(),
      userId: this.localUser.id,
      file,
      operation,
      position,
      content,
      length,
      timestamp: Date.now(),
    };

    this.editOperations.push(edit);
    this.emit('editOperation', edit);

    // Broadcast to remote users
    if (this.isConnected) {
      this.broadcastEditOperation(edit);
    }
  }

  /**
   * Get edit operations
   */
  getEditOperations(): EditOperation[] {
    return this.editOperations;
  }

  /**
   * Get edit operations for a specific file
   */
  getEditOperationsForFile(file: string): EditOperation[] {
    return this.editOperations.filter(edit => edit.file === file);
  }

  /**
   * Handle remote user joining
   */
  handleUserJoined(user: User): void {
    this.remoteUsers.set(user.id, user);
    if (this.currentSession) {
      this.currentSession.users.push(user);
    }
    this.emit('userJoined', user);
  }

  /**
   * Handle remote user leaving
   */
  handleUserLeft(userId: string): void {
    const user = this.remoteUsers.get(userId);
    if (user) {
      this.remoteUsers.delete(userId);
      this.cursorPositions.delete(userId);
      if (this.currentSession) {
        this.currentSession.users = this.currentSession.users.filter(u => u.id !== userId);
      }
      this.emit('userLeft', user);
    }
  }

  /**
   * Handle remote cursor movement
   */
  handleRemoteCursorMoved(position: CursorPosition): void {
    this.cursorPositions.set(position.userId, position);
    this.emit('remoteCursorMoved', position);
  }

  /**
   * Handle remote chat message
   */
  handleRemoteChatMessage(message: ChatMessage): void {
    this.chatMessages.push(message);
    this.emit('remoteChatMessage', message);
  }

  /**
   * Handle remote edit operation
   */
  handleRemoteEditOperation(edit: EditOperation): void {
    this.editOperations.push(edit);
    this.emit('remoteEditOperation', edit);
  }

  /**
   * Check if connected to collaboration server
   */
  isSessionActive(): boolean {
    return this.isConnected && this.currentSession !== null;
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): {
    connected: boolean;
    session: CollaborationSession | null;
    userCount: number;
  } {
    return {
      connected: this.isConnected,
      session: this.currentSession,
      userCount: this.currentSession?.users.length || 0,
    };
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create local user
   */
  private createLocalUser(): User {
    return {
      id: 'local',
      name: 'You',
      color: '#00ff00',
      isLocal: true,
    };
  }

  /**
   * Broadcast cursor position to remote users
   */
  private broadcastCursorPosition(position: CursorPosition): void {
    // In a real implementation, this would use WebSocket or similar
    console.log('Broadcasting cursor position:', position);
  }

  /**
   * Broadcast chat message to remote users
   */
  private broadcastChatMessage(message: ChatMessage): void {
    // In a real implementation, this would use WebSocket or similar
    console.log('Broadcasting chat message:', message);
  }

  /**
   * Broadcast edit operation to remote users
   */
  private broadcastEditOperation(edit: EditOperation): void {
    // In a real implementation, this would use WebSocket or similar
    console.log('Broadcasting edit operation:', edit);
  }
}

// Global collaboration manager instance
const collaborationManager = new CollaborationManager();

export function getCollaborationManager(): CollaborationManager {
  return collaborationManager;
}

export function createSession(name: string, projectId: string): CollaborationSession {
  return collaborationManager.createSession(name, projectId);
}

export async function joinSession(sessionId: string): Promise<void> {
  return collaborationManager.joinSession(sessionId);
}

export function leaveSession(): void {
  collaborationManager.leaveSession();
}

export function getCurrentSession(): CollaborationSession | null {
  return collaborationManager.getCurrentSession();
}

export function getUsers(): User[] {
  return collaborationManager.getUsers();
}

export function getRemoteUsers(): User[] {
  return collaborationManager.getRemoteUsers();
}

export function updateCursorPosition(file: string, line: number, column: number): void {
  collaborationManager.updateCursorPosition(file, line, column);
}

export function getCursorPositions(): CursorPosition[] {
  return collaborationManager.getCursorPositions();
}

export function getCursorPositionsForFile(file: string): CursorPosition[] {
  return collaborationManager.getCursorPositionsForFile(file);
}

export function sendChatMessage(content: string, type?: 'text' | 'code'): void {
  collaborationManager.sendChatMessage(content, type);
}

export function getChatMessages(): ChatMessage[] {
  return collaborationManager.getChatMessages();
}

export function applyEditOperation(
  file: string,
  operation: 'insert' | 'delete' | 'replace',
  position: { line: number; column: number },
  content?: string,
  length?: number
): void {
  collaborationManager.applyEditOperation(file, operation, position, content, length);
}

export function isSessionActive(): boolean {
  return collaborationManager.isSessionActive();
}
