/**
 * Sandbox execution system
 * Inspired by OpenHands and Codex for safe code execution in isolated environments
 */

export interface SandboxConfig {
  type: SandboxType;
  resourceLimits: ResourceLimits;
  networkPolicy: NetworkPolicy;
  filesystemPolicy: FilesystemPolicy;
  timeout: number;
  autoCleanup: boolean;
}

export type SandboxType = 'container' | 'process' | 'vm' | 'wasm';

export interface ResourceLimits {
  maxMemory: number;
  maxCpu: number;
  maxDisk: number;
  maxProcesses: number;
}

export interface NetworkPolicy {
  allowInternet: boolean;
  allowedHosts: string[];
  allowedPorts: number[];
  blockAll: boolean;
}

export interface FilesystemPolicy {
  readOnly: boolean;
  allowedPaths: string[];
  blockedPaths: string[];
  mountVolumes: VolumeMount[];
}

export interface VolumeMount {
  source: string;
  target: string;
  readOnly: boolean;
}

export interface SandboxSession {
  id: string;
  type: SandboxType;
  config: SandboxConfig;
  status: SessionStatus;
  createdAt: number;
  startedAt?: number;
  stoppedAt?: number;
  pid?: number;
  containerId?: string;
  exitCode?: number;
  stdout: string[];
  stderr: string[];
  resourceUsage: ResourceUsage;
}

export type SessionStatus = 'created' | 'running' | 'stopped' | 'failed' | 'timeout';

export interface ResourceUsage {
  memoryUsage: number;
  cpuUsage: number;
  diskUsage: number;
  processCount: number;
}

export interface ExecutionRequest {
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd: string;
  stdin?: string;
  timeout?: number;
}

export interface ExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
  timedOut: boolean;
  resourceUsage: ResourceUsage;
}

export interface SecurityBoundary {
  id: string;
  name: string;
  description: string;
  rules: SecurityRule[];
  violations: SecurityViolation[];
}

export interface SecurityRule {
  id: string;
  type: RuleType;
  pattern: string;
  action: RuleAction;
  severity: RuleSeverity;
}

export type RuleType = 'command' | 'file_access' | 'network' | 'system_call';
export type RuleAction = 'allow' | 'block' | 'log' | 'warn';
export type RuleSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SecurityViolation {
  ruleId: string;
  timestamp: number;
  description: string;
  severity: RuleSeverity;
  action: RuleAction;
}

class SandboxManager {
  private sessions: Map<string, SandboxSession> = new Map();
  private activeSession: string | null = null;
  private securityBoundaries: Map<string, SecurityBoundary> = new Map();
  private defaultConfig: SandboxConfig;

  constructor(config?: Partial<SandboxConfig>) {
    this.defaultConfig = {
      type: 'process',
      resourceLimits: {
        maxMemory: 512 * 1024 * 1024, // 512MB
        maxCpu: 1,
        maxDisk: 1024 * 1024 * 1024, // 1GB
        maxProcesses: 10,
      },
      networkPolicy: {
        allowInternet: false,
        allowedHosts: [],
        allowedPorts: [],
        blockAll: true,
      },
      filesystemPolicy: {
        readOnly: false,
        allowedPaths: ['/tmp'],
        blockedPaths: ['/etc', '/sys', '/proc'],
        mountVolumes: [],
      },
      timeout: 30000,
      autoCleanup: true,
      ...config,
    };

    this.initializeDefaultSecurityBoundary();
  }

  /**
   * Initialize default security boundary
   */
  private initializeDefaultSecurityBoundary(): void {
    const boundary: SecurityBoundary = {
      id: 'default',
      name: 'Default Security Boundary',
      description: 'Default security rules for sandbox execution',
      rules: [
        {
          id: 'block-system-critical',
          type: 'command',
          pattern: 'rm -rf /',
          action: 'block',
          severity: 'critical',
        },
        {
          id: 'block-etc-access',
          type: 'file_access',
          pattern: '/etc/*',
          action: 'block',
          severity: 'high',
        },
        {
          id: 'log-network-access',
          type: 'network',
          pattern: '*',
          action: 'log',
          severity: 'medium',
        },
      ],
      violations: [],
    };

    this.securityBoundaries.set('default', boundary);
  }

  /**
   * Create a sandbox session
   */
  async createSession(config?: Partial<SandboxConfig>): Promise<SandboxSession> {
    const fullConfig: SandboxConfig = {
      ...this.defaultConfig,
      ...config,
      resourceLimits: { ...this.defaultConfig.resourceLimits, ...config?.resourceLimits },
      networkPolicy: { ...this.defaultConfig.networkPolicy, ...config?.networkPolicy },
      filesystemPolicy: { ...this.defaultConfig.filesystemPolicy, ...config?.filesystemPolicy },
    };

    const session: SandboxSession = {
      id: this.generateId(),
      type: fullConfig.type,
      config: fullConfig,
      status: 'created',
      createdAt: Date.now(),
      stdout: [],
      stderr: [],
      resourceUsage: {
        memoryUsage: 0,
        cpuUsage: 0,
        diskUsage: 0,
        processCount: 0,
      },
    };

    this.sessions.set(session.id, session);
    this.activeSession = session.id;

    // Initialize sandbox based on type
    await this.initializeSandbox(session);

    return session;
  }

  /**
   * Start a session
   */
  async startSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status !== 'created') {
      throw new Error(`Session ${sessionId} is not in created state`);
    }

    session.status = 'running';
    session.startedAt = Date.now();

    // Start sandbox based on type
    await this.startSandbox(session);
  }

  /**
   * Stop a session
   */
  async stopSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.status !== 'running') return;

    session.status = 'stopped';
    session.stoppedAt = Date.now();

    // Stop sandbox based on type
    await this.stopSandbox(session);

    if (session.config.autoCleanup) {
      await this.cleanupSession(sessionId);
    }
  }

  /**
   * Execute a command in a session
   */
  async execute(sessionId: string, request: ExecutionRequest): Promise<ExecutionResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status !== 'running') {
      throw new Error(`Session ${sessionId} is not running`);
    }

    // Check security boundaries
    const violation = this.checkSecurityViolation(request);
    if (violation) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: `Security violation: ${violation.description}`,
        duration: 0,
        timedOut: false,
        resourceUsage: session.resourceUsage,
      };
    }

    const startTime = Date.now();
    const timeout = request.timeout || session.config.timeout;

    try {
      // Execute command with timeout
      const result = await Promise.race([
        this.executeCommand(session, request),
        new Promise<ExecutionResult>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), timeout)
        ),
      ]);

      const duration = Date.now() - startTime;
      result.duration = duration;

      // Update resource usage
      session.resourceUsage = await this.getResourceUsage(session);

      return result;
    } catch (error) {
      if (String(error).includes('Timeout')) {
        return {
          exitCode: 124,
          stdout: '',
          stderr: 'Command timed out',
          duration: timeout,
          timedOut: true,
          resourceUsage: session.resourceUsage,
        };
      }

      return {
        exitCode: 1,
        stdout: '',
        stderr: String(error),
        duration: Date.now() - startTime,
        timedOut: false,
        resourceUsage: session.resourceUsage,
      };
    }
  }

  /**
   * Get session status
   */
  getSessionStatus(sessionId: string): SandboxSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get active session
   */
  getActiveSession(): SandboxSession | undefined {
    if (!this.activeSession) return undefined;
    return this.sessions.get(this.activeSession);
  }

  /**
   * Get all sessions
   */
  getAllSessions(): SandboxSession[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.status === 'running') {
      await this.stopSession(sessionId);
    }

    await this.cleanupSession(sessionId);
    this.sessions.delete(sessionId);

    if (this.activeSession === sessionId) {
      this.activeSession = null;
    }
  }

  /**
   * Add a security boundary
   */
  addSecurityBoundary(boundary: SecurityBoundary): void {
    this.securityBoundaries.set(boundary.id, boundary);
  }

  /**
   * Get security boundary
   */
  getSecurityBoundary(id: string): SecurityBoundary | undefined {
    return this.securityBoundaries.get(id);
  }

  /**
   * Get all security boundaries
   */
  getAllSecurityBoundaries(): SecurityBoundary[] {
    return Array.from(this.securityBoundaries.values());
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalSessions: number;
    activeSessions: number;
    stoppedSessions: number;
    failedSessions: number;
    activeSession: string | null;
    totalViolations: number;
  } {
    const sessions = this.getAllSessions();
    const active = sessions.filter(s => s.status === 'running').length;
    const stopped = sessions.filter(s => s.status === 'stopped').length;
    const failed = sessions.filter(s => s.status === 'failed').length;

    const totalViolations = Array.from(this.securityBoundaries.values())
      .reduce((sum, b) => sum + b.violations.length, 0);

    return {
      totalSessions: sessions.length,
      activeSessions: active,
      stoppedSessions: stopped,
      failedSessions: failed,
      activeSession: this.activeSession,
      totalViolations,
    };
  }

  /**
   * Update default configuration
   */
  updateDefaultConfig(config: Partial<SandboxConfig>): void {
    this.defaultConfig = {
      ...this.defaultConfig,
      ...config,
      resourceLimits: { ...this.defaultConfig.resourceLimits, ...config?.resourceLimits },
      networkPolicy: { ...this.defaultConfig.networkPolicy, ...config?.networkPolicy },
      filesystemPolicy: { ...this.defaultConfig.filesystemPolicy, ...config?.filesystemPolicy },
    };
  }

  // Private methods

  private async initializeSandbox(session: SandboxSession): Promise<void> {
    // In a real implementation, this would initialize the actual sandbox
    switch (session.type) {
      case 'container':
        // Initialize container
        break;
      case 'process':
        // Initialize process isolation
        break;
      case 'vm':
        // Initialize VM
        break;
      case 'wasm':
        // Initialize WASM runtime
        break;
    }
  }

  private async startSandbox(session: SandboxSession): Promise<void> {
    // In a real implementation, this would start the actual sandbox
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async stopSandbox(session: SandboxSession): Promise<void> {
    // In a real implementation, this would stop the actual sandbox
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async cleanupSession(sessionId: string): Promise<void> {
    // In a real implementation, this would cleanup the actual sandbox
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async executeCommand(session: SandboxSession, request: ExecutionRequest): Promise<ExecutionResult> {
    // In a real implementation, this would execute the actual command in the sandbox
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));

    return {
      exitCode: 0,
      stdout: `Executed: ${request.command} ${request.args.join(' ')}`,
      stderr: '',
      duration: 0,
      timedOut: false,
      resourceUsage: session.resourceUsage,
    };
  }

  private async getResourceUsage(session: SandboxSession): Promise<ResourceUsage> {
    // In a real implementation, this would get actual resource usage
    return {
      memoryUsage: Math.floor(Math.random() * 100 * 1024 * 1024),
      cpuUsage: Math.random() * 100,
      diskUsage: Math.floor(Math.random() * 100 * 1024 * 1024),
      processCount: Math.floor(Math.random() * 5),
    };
  }

  private checkSecurityViolation(request: ExecutionRequest): SecurityViolation | null {
    const boundary = this.securityBoundaries.get('default');
    if (!boundary) return null;

    for (const rule of boundary.rules) {
      if (this.matchesRule(request, rule)) {
        const violation: SecurityViolation = {
          ruleId: rule.id,
          timestamp: Date.now(),
          description: `Rule "${rule.id}" violated`,
          severity: rule.severity,
          action: rule.action,
        };

        boundary.violations.push(violation);

        if (rule.action === 'block') {
          return violation;
        }
      }
    }

    return null;
  }

  private matchesRule(request: ExecutionRequest, rule: SecurityRule): boolean {
    const command = `${request.command} ${request.args.join(' ')}`;

    switch (rule.type) {
      case 'command':
        return command.includes(rule.pattern);
      case 'file_access':
        return command.includes(rule.pattern);
      case 'network':
        return rule.pattern === '*';
      case 'system_call':
        return false;
      default:
        return false;
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Global sandbox manager instance
const sandboxManager = new SandboxManager();

export async function createSession(config?: Partial<SandboxConfig>): Promise<SandboxSession> {
  return sandboxManager.createSession(config);
}

export async function startSession(sessionId: string): Promise<void> {
  return sandboxManager.startSession(sessionId);
}

export async function stopSession(sessionId: string): Promise<void> {
  return sandboxManager.stopSession(sessionId);
}

export async function execute(sessionId: string, request: ExecutionRequest): Promise<ExecutionResult> {
  return sandboxManager.execute(sessionId, request);
}

export function getSessionStatus(sessionId: string): SandboxSession | undefined {
  return sandboxManager.getSessionStatus(sessionId);
}

export function getActiveSession(): SandboxSession | undefined {
  return sandboxManager.getActiveSession();
}

export function getAllSessions(): SandboxSession[] {
  return sandboxManager.getAllSessions();
}

export async function deleteSession(sessionId: string): Promise<void> {
  return sandboxManager.deleteSession(sessionId);
}

export function addSecurityBoundary(boundary: SecurityBoundary): void {
  sandboxManager.addSecurityBoundary(boundary);
}

export function getSecurityBoundary(id: string): SecurityBoundary | undefined {
  return sandboxManager.getSecurityBoundary(id);
}

export function getAllSecurityBoundaries(): SecurityBoundary[] {
  return sandboxManager.getAllSecurityBoundaries();
}

export function getStatistics(): {
  totalSessions: number;
  activeSessions: number;
  stoppedSessions: number;
  failedSessions: number;
  activeSession: string | null;
  totalViolations: number;
} {
  return sandboxManager.getStatistics();
}

export function updateDefaultConfig(config: Partial<SandboxConfig>): void {
  sandboxManager.updateDefaultConfig(config);
}
