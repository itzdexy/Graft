/**
 * Client-Server Architecture
 * Inspired by Crush's client-server architecture for distributed agent execution
 * Provides server-side agent management with client connections and remote execution
 */

export interface ClientServer {
  id: string;
  name: string;
  config: ServerConfig;
  server: Server;
  clients: Map<string, Client>;
  sessions: Map<string, Session>;
  statistics: ServerStatistics;
  metadata: ServerMetadata;
}

export interface ServerConfig {
  host: string;
  port: number;
  protocol: Protocol;
  enableSSL: boolean;
  maxConnections: number;
  enableAuthentication: boolean;
  enableCompression: boolean;
  heartbeatInterval: number;
}

export type Protocol = 'http' | 'websocket' | 'grpc' | 'custom';

export interface Server {
  status: ServerStatus;
  startTime: number;
  uptime: number;
  connections: number;
  handlers: Map<string, RequestHandler>;
}

export type ServerStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

export interface RequestHandler {
  path: string;
  method: string;
  handler: (request: ServerRequest) => Promise<ServerResponse>;
  middleware: Middleware[];
}

export interface Middleware {
  name: string;
  handler: (request: ServerRequest, next: () => Promise<ServerResponse>) => Promise<ServerResponse>;
}

export interface ServerRequest {
  id: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
  query: Record<string, string>;
  client: Client;
  timestamp: number;
}

export interface ServerResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  timestamp: number;
}

export interface Client {
  id: string;
  address: string;
  userAgent: string;
  connectedAt: number;
  lastSeen: number;
  status: ClientStatus;
  capabilities: ClientCapabilities;
  metadata: ClientMetadata;
}

export type ClientStatus = 'connected' | 'disconnected' | 'authenticated' | 'blocked';

export interface ClientCapabilities {
  supportedProtocols: Protocol[];
  maxMessageSize: number;
  supportsCompression: boolean;
  supportsStreaming: boolean;
}

export interface ClientMetadata {
  version: string;
  platform: string;
  locale: string;
  timezone: string;
}

export interface Session {
  id: string;
  clientId: string;
  createdAt: number;
  lastActivity: number;
  status: SessionStatus;
  data: Record<string, unknown>;
}

export type SessionStatus = 'active' | 'idle' | 'expired' | 'terminated';

export interface ServerStatistics {
  totalConnections: number;
  activeConnections: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  totalBytesTransferred: number;
  uptime: number;
}

export interface ServerMetadata {
  version: string;
  createdAt: number;
  updatedAt: number;
  totalOperations: number;
}

export interface RemoteExecutionRequest {
  sessionId: string;
  task: string;
  parameters: Record<string, unknown>;
  timeout?: number;
}

export interface RemoteExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  executionTime: number;
}

class ClientServerManager {
  private servers: Map<string, ClientServer> = new Map();

  /**
   * Create a client-server instance
   */
  createServer(name: string, config?: Partial<ServerConfig>): ClientServer {
    const server: ClientServer = {
      id: this.generateServerId(),
      name,
      config: {
        host: config?.host || 'localhost',
        port: config?.port || 8080,
        protocol: config?.protocol || 'http',
        enableSSL: config?.enableSSL ?? false,
        maxConnections: config?.maxConnections || 100,
        enableAuthentication: config?.enableAuthentication ?? false,
        enableCompression: config?.enableCompression ?? true,
        heartbeatInterval: config?.heartbeatInterval || 30000,
      },
      server: {
        status: 'stopped',
        startTime: 0,
        uptime: 0,
        connections: 0,
        handlers: new Map(),
      },
      clients: new Map(),
      sessions: new Map(),
      statistics: {
        totalConnections: 0,
        activeConnections: 0,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        totalBytesTransferred: 0,
        uptime: 0,
      },
      metadata: {
        version: '1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        totalOperations: 0,
      },
    };

    this.servers.set(server.id, server);
    return server;
  }

  /**
   * Get a server
   */
  getServer(serverId: string): ClientServer | undefined {
    return this.servers.get(serverId);
  }

  /**
   * Get all servers
   */
  getAllServers(): ClientServer[] {
    return Array.from(this.servers.values());
  }

  /**
   * Delete a server
   */
  deleteServer(serverId: string): boolean {
    return this.servers.delete(serverId);
  }

  /**
   * Start a server
   */
  async startServer(serverId: string): Promise<boolean> {
    const server = this.servers.get(serverId);
    if (!server) return false;

    server.server.status = 'starting';
    server.server.startTime = Date.now();

    // Simulate server startup
    await new Promise(resolve => setTimeout(resolve, 100));

    server.server.status = 'running';
    server.metadata.updatedAt = Date.now();

    return true;
  }

  /**
   * Stop a server
   */
  async stopServer(serverId: string): Promise<boolean> {
    const server = this.servers.get(serverId);
    if (!server) return false;

    server.server.status = 'stopping';

    // Simulate server shutdown
    await new Promise(resolve => setTimeout(resolve, 100));

    server.server.status = 'stopped';
    server.server.uptime = Date.now() - server.server.startTime;
    server.metadata.updatedAt = Date.now();

    return true;
  }

  /**
   * Register a request handler
   */
  registerHandler(serverId: string, handler: RequestHandler): boolean {
    const server = this.servers.get(serverId);
    if (!server) return false;

    const key = `${handler.method}:${handler.path}`;
    server.server.handlers.set(key, handler);
    server.metadata.updatedAt = Date.now();

    return true;
  }

  /**
   * Handle a request
   */
  async handleRequest(serverId: string, request: ServerRequest): Promise<ServerResponse> {
    const server = this.servers.get(serverId);
    if (!server) {
      return {
        status: 503,
        headers: {},
        body: { error: 'Service unavailable' },
        timestamp: Date.now(),
      };
    }

    const startTime = Date.now();

    try {
      const key = `${request.method}:${request.path}`;
      const handler = server.server.handlers.get(key);

      if (!handler) {
        server.statistics.totalRequests++;
        server.statistics.failedRequests++;

        return {
          status: 404,
          headers: {},
          body: { error: 'Not found' },
          timestamp: Date.now(),
        };
      }

      // Apply middleware
      let response = await this.applyMiddleware(handler.middleware, request, () => handler.handler(request));

      const responseTime = Date.now() - startTime;

      server.statistics.totalRequests++;
      server.statistics.successfulRequests++;
      server.statistics.averageResponseTime =
        this.updateAverage(server.statistics.averageResponseTime, server.statistics.totalRequests, responseTime);

      server.metadata.totalOperations++;
      server.metadata.updatedAt = Date.now();

      return response;

    } catch (error) {
      server.statistics.totalRequests++;
      server.statistics.failedRequests++;

      return {
        status: 500,
        headers: {},
        body: { error: String(error) },
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Connect a client
   */
  connectClient(serverId: string, client: Client): boolean {
    const server = this.servers.get(serverId);
    if (!server) return false;

    if (server.server.connections >= server.config.maxConnections) {
      return false;
    }

    server.clients.set(client.id, client);
    server.server.connections++;
    server.statistics.totalConnections++;
    server.statistics.activeConnections++;

    server.metadata.updatedAt = Date.now();

    return true;
  }

  /**
   * Disconnect a client
   */
  disconnectClient(serverId: string, clientId: string): boolean {
    const server = this.servers.get(serverId);
    if (!server) return false;

    const removed = server.clients.delete(clientId);
    if (removed) {
      server.server.connections--;
      server.statistics.activeConnections--;
      server.metadata.updatedAt = Date.now();
    }

    return removed;
  }

  /**
   * Create a session
   */
  createSession(serverId: string, clientId: string): Session {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    const session: Session = {
      id: this.generateSessionId(),
      clientId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      status: 'active',
      data: {},
    };

    server.sessions.set(session.id, session);
    server.metadata.updatedAt = Date.now();

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
   * Execute remote task
   */
  async executeRemoteTask(serverId: string, request: RemoteExecutionRequest): Promise<RemoteExecutionResult> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    const session = server.sessions.get(request.sessionId);
    if (!session) {
      throw new Error(`Session ${request.sessionId} not found`);
    }

    const startTime = Date.now();

    try {
      // Simulate remote execution
      await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));

      const result = {
        task: request.task,
        parameters: request.parameters,
        output: `Executed: ${request.task}`,
      };

      const executionTime = Date.now() - startTime;

      session.lastActivity = Date.now();
      server.metadata.totalOperations++;
      server.metadata.updatedAt = Date.now();

      return {
        success: true,
        result,
        executionTime,
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        error: String(error),
        executionTime,
      };
    }
  }

  /**
   * Get statistics for a server
   */
  getStatistics(serverId: string): ServerStatistics | undefined {
    const server = this.servers.get(serverId);
    if (!server) return undefined;

    // Update uptime if server is running
    if (server.server.status === 'running') {
      server.statistics.uptime = Date.now() - server.server.startTime;
    }

    return { ...server.statistics };
  }

  /**
   * Get connected clients
   */
  getClients(serverId: string): Client[] {
    const server = this.servers.get(serverId);
    if (!server) return [];

    return Array.from(server.clients.values());
  }

  /**
   * Get active sessions
   */
  getSessions(serverId: string): Session[] {
    const server = this.servers.get(serverId);
    if (!server) return [];

    return Array.from(server.sessions.values());
  }

  // Private methods

  private async applyMiddleware(
    middleware: Middleware[],
    request: ServerRequest,
    finalHandler: () => Promise<ServerResponse>
  ): Promise<ServerResponse> {
    if (middleware.length === 0) {
      return finalHandler();
    }

    let index = 0;
    const next = async (): Promise<ServerResponse> => {
      if (index >= middleware.length) {
        return finalHandler();
      }
      const mw = middleware[index++];
      return mw.handler(request, next);
    };

    return next();
  }

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
}

// Helper functions to create clients and handlers
export function createClient(
  address: string,
  userAgent: string,
  capabilities?: Partial<ClientCapabilities>,
  metadata?: Partial<ClientMetadata>
): Client {
  return {
    id: `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    address,
    userAgent,
    connectedAt: Date.now(),
    lastSeen: Date.now(),
    status: 'connected',
    capabilities: {
      supportedProtocols: capabilities?.supportedProtocols || ['http'],
      maxMessageSize: capabilities?.maxMessageSize || 1024 * 1024,
      supportsCompression: capabilities?.supportsCompression ?? true,
      supportsStreaming: capabilities?.supportsStreaming ?? false,
    },
    metadata: {
      version: metadata?.version || '1.0.0',
      platform: metadata?.platform || 'unknown',
      locale: metadata?.locale || 'en-US',
      timezone: metadata?.timezone || 'UTC',
    },
  };
}

export function createRequestHandler(
  path: string,
  method: string,
  handler: (request: ServerRequest) => Promise<ServerResponse>,
  middleware: Middleware[] = []
): RequestHandler {
  return { path, method, handler, middleware };
}

export function createMiddleware(
  name: string,
  handler: (request: ServerRequest, next: () => Promise<ServerResponse>) => Promise<ServerResponse>
): Middleware {
  return { name, handler };
}

export function createServerRequest(
  method: string,
  path: string,
  client: Client,
  body?: unknown,
  headers?: Record<string, string>,
  query?: Record<string, string>
): ServerRequest {
  return {
    id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    method,
    path,
    headers: headers || {},
    body,
    query: query || {},
    client,
    timestamp: Date.now(),
  };
}

// Global client-server manager instance
const clientServerManager = new ClientServerManager();

export function createServer(name: string, config?: Partial<ServerConfig>): ClientServer {
  return clientServerManager.createServer(name, config);
}

export function getServer(serverId: string): ClientServer | undefined {
  return clientServerManager.getServer(serverId);
}

export function getAllServers(): ClientServer[] {
  return clientServerManager.getAllServers();
}

export function deleteServer(serverId: string): boolean {
  return clientServerManager.deleteServer(serverId);
}

export async function startServer(serverId: string): Promise<boolean> {
  return clientServerManager.startServer(serverId);
}

export async function stopServer(serverId: string): Promise<boolean> {
  return clientServerManager.stopServer(serverId);
}

export function registerHandler(serverId: string, handler: RequestHandler): boolean {
  return clientServerManager.registerHandler(serverId, handler);
}

export async function handleRequest(serverId: string, request: ServerRequest): Promise<ServerResponse> {
  return clientServerManager.handleRequest(serverId, request);
}

export function connectClient(serverId: string, client: Client): boolean {
  return clientServerManager.connectClient(serverId, client);
}

export function disconnectClient(serverId: string, clientId: string): boolean {
  return clientServerManager.disconnectClient(serverId, clientId);
}

export function createSession(serverId: string, clientId: string): Session {
  return clientServerManager.createSession(serverId, clientId);
}

export function getSession(serverId: string, sessionId: string): Session | undefined {
  return clientServerManager.getSession(serverId, sessionId);
}

export async function executeRemoteTask(serverId: string, request: RemoteExecutionRequest): Promise<RemoteExecutionResult> {
  return clientServerManager.executeRemoteTask(serverId, request);
}

export function getStatistics(serverId: string): ServerStatistics | undefined {
  return clientServerManager.getStatistics(serverId);
}

export function getClients(serverId: string): Client[] {
  return clientServerManager.getClients(serverId);
}

export function getSessions(serverId: string): Session[] {
  return clientServerManager.getSessions(serverId);
}
