/**
 * MCP (Model Context Protocol) Server implementation
 * Inspired by OpenCode and Goose for MCP server support
 */

export interface McpServerConfig {
  name: string;
  version: string;
  description: string;
  capabilities: ServerCapabilities;
  tools: McpTool[];
  resources: McpResource[];
  prompts: McpPrompt[];
}

export interface ServerCapabilities {
  tools: boolean;
  resources: boolean;
  prompts: boolean;
  logging: boolean;
  streaming: boolean;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: ToolHandler;
}

export interface McpResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  handler: ResourceHandler;
}

export interface McpPrompt {
  name: string;
  description: string;
  arguments?: PromptArgument[];
  handler: PromptHandler;
}

export interface PromptArgument {
  name: string;
  description: string;
  required: boolean;
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResult>;
export type ResourceHandler = (uri: string) => Promise<ResourceContent>;
export type PromptHandler = (args: Record<string, unknown>) => Promise<PromptResult>;

export interface ToolResult {
  content: ToolContent[];
  isError?: boolean;
}

export interface ToolContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
}

export interface ResourceContent {
  uri: string;
  mimeType: string;
  text?: string;
  blob?: string;
}

export interface PromptResult {
  messages: PromptMessage[];
}

export interface PromptMessage {
  role: 'user' | 'assistant' | 'system';
  content: PromptContent;
}

export interface PromptContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  uri?: string;
}

export interface ServerInfo {
  name: string;
  version: string;
  protocolVersion: string;
  capabilities: ServerCapabilities;
  uptime: number;
  requestCount: number;
  errorCount: number;
}

class McpServer {
  private config: McpServerConfig;
  private requestCount = 0;
  private errorCount = 0;
  private startTime = Date.now();
  private activeConnections = 0;
  private maxConnections = 100;

  constructor(config: McpServerConfig) {
    this.config = config;
  }

  /**
   * Handle tool call
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    this.requestCount++;

    const tool = this.config.tools.find(t => t.name === name);
    if (!tool) {
      this.errorCount++;
      return {
        content: [{ type: 'text', text: `Tool ${name} not found` }],
        isError: true,
      };
    }

    try {
      return await tool.handler(args);
    } catch (error) {
      this.errorCount++;
      return {
        content: [{ type: 'text', text: String(error) }],
        isError: true,
      };
    }
  }

  /**
   * List available tools
   */
  listTools(): McpTool[] {
    return this.config.tools;
  }

  /**
   * Read a resource
   */
  async readResource(uri: string): Promise<ResourceContent> {
    this.requestCount++;

    const resource = this.config.resources.find(r => r.uri === uri);
    if (!resource) {
      this.errorCount++;
      throw new Error(`Resource ${uri} not found`);
    }

    try {
      return await resource.handler(uri);
    } catch (error) {
      this.errorCount++;
      throw error;
    }
  }

  /**
   * List available resources
   */
  listResources(): McpResource[] {
    return this.config.resources;
  }

  /**
   * Get a prompt
   */
  async getPrompt(name: string, args: Record<string, unknown> = {}): Promise<PromptResult> {
    this.requestCount++;

    const prompt = this.config.prompts.find(p => p.name === name);
    if (!prompt) {
      this.errorCount++;
      throw new Error(`Prompt ${name} not found`);
    }

    try {
      return await prompt.handler(args);
    } catch (error) {
      this.errorCount++;
      throw error;
    }
  }

  /**
   * List available prompts
   */
  listPrompts(): McpPrompt[] {
    return this.config.prompts;
  }

  /**
   * Get server info
   */
  getServerInfo(): ServerInfo {
    return {
      name: this.config.name,
      version: this.config.version,
      protocolVersion: '2024-11-05',
      capabilities: this.config.capabilities,
      uptime: Date.now() - this.startTime,
      requestCount: this.requestCount,
      errorCount: this.errorCount,
    };
  }

  /**
   * Add a tool
   */
  addTool(tool: McpTool): void {
    this.config.tools.push(tool);
  }

  /**
   * Remove a tool
   */
  removeTool(name: string): boolean {
    const index = this.config.tools.findIndex(t => t.name === name);
    if (index >= 0) {
      this.config.tools.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Add a resource
   */
  addResource(resource: McpResource): void {
    this.config.resources.push(resource);
  }

  /**
   * Remove a resource
   */
  removeResource(uri: string): boolean {
    const index = this.config.resources.findIndex(r => r.uri === uri);
    if (index >= 0) {
      this.config.resources.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Add a prompt
   */
  addPrompt(prompt: McpPrompt): void {
    this.config.prompts.push(prompt);
  }

  /**
   * Remove a prompt
   */
  removePrompt(name: string): boolean {
    const index = this.config.prompts.findIndex(p => p.name === name);
    if (index >= 0) {
      this.config.prompts.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    uptime: number;
    requestCount: number;
    errorCount: number;
    errorRate: number;
    activeConnections: number;
    toolsCount: number;
    resourcesCount: number;
    promptsCount: number;
  } {
    return {
      uptime: Date.now() - this.startTime,
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      errorRate: this.requestCount > 0 ? this.errorCount / this.requestCount : 0,
      activeConnections: this.activeConnections,
      toolsCount: this.config.tools.length,
      resourcesCount: this.config.resources.length,
      promptsCount: this.config.prompts.length,
    };
  }
}

class McpServerManager {
  private servers: Map<string, McpServer> = new Map();
  private defaultServer: string | null = null;

  /**
   * Create a new server
   */
  createServer(config: McpServerConfig): McpServer {
    const server = new McpServer(config);
    this.servers.set(config.name, server);
    return server;
  }

  /**
   * Get a server
   */
  getServer(name: string): McpServer | undefined {
    return this.servers.get(name);
  }

  /**
   * Get all servers
   */
  getAllServers(): McpServer[] {
    return Array.from(this.servers.values());
  }

  /**
   * Delete a server
   */
  deleteServer(name: string): boolean {
    return this.servers.delete(name);
  }

  /**
   * Set default server
   */
  setDefaultServer(name: string): void {
    if (this.servers.has(name)) {
      this.defaultServer = name;
    }
  }

  /**
   * Get default server
   */
  getDefaultServer(): McpServer | undefined {
    if (!this.defaultServer) return undefined;
    return this.servers.get(this.defaultServer);
  }

  /**
   * Get global statistics
   */
  getGlobalStatistics(): {
    totalServers: number;
    totalRequests: number;
    totalErrors: number;
    globalErrorRate: number;
    totalTools: number;
    totalResources: number;
    totalPrompts: number;
  } {
    const servers = this.getAllServers();
    const stats = servers.map(s => s.getStatistics());

    const totalRequests = stats.reduce((sum, s) => sum + s.requestCount, 0);
    const totalErrors = stats.reduce((sum, s) => sum + s.errorCount, 0);
    const totalTools = stats.reduce((sum, s) => sum + s.toolsCount, 0);
    const totalResources = stats.reduce((sum, s) => sum + s.resourcesCount, 0);
    const totalPrompts = stats.reduce((sum, s) => sum + s.promptsCount, 0);

    return {
      totalServers: servers.length,
      totalRequests,
      totalErrors,
      globalErrorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
      totalTools,
      totalResources,
      totalPrompts,
    };
  }
}

// Global MCP server manager instance
const mcpServerManager = new McpServerManager();

/**
 * Create a default Blink MCP server with common tools
 */
export function createBlinkMcpServer(): McpServer {
  const server = mcpServerManager.createServer({
    name: 'blink',
    version: '1.0.0',
    description: 'Blink MCP Server',
    capabilities: {
      tools: true,
      resources: true,
      prompts: true,
      logging: true,
      streaming: true,
    },
    tools: [
      {
        name: 'read_file',
        description: 'Read the contents of a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path' },
          },
          required: ['path'],
        },
        handler: async (args) => {
          // In a real implementation, this would read the actual file
          return {
            content: [{ type: 'text', text: `Contents of ${args.path}` }],
          };
        },
      },
      {
        name: 'write_file',
        description: 'Write content to a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path' },
            content: { type: 'string', description: 'File content' },
          },
          required: ['path', 'content'],
        },
        handler: async (args) => {
          // In a real implementation, this would write to the actual file
          return {
            content: [{ type: 'text', text: `Written to ${args.path}` }],
          };
        },
      },
      {
        name: 'list_directory',
        description: 'List contents of a directory',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Directory path' },
          },
          required: ['path'],
        },
        handler: async (args) => {
          // In a real implementation, this would list the actual directory
          return {
            content: [{ type: 'text', text: `Contents of ${args.path}` }],
          };
        },
      },
      {
        name: 'search_files',
        description: 'Search for files matching a pattern',
        inputSchema: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Search pattern' },
            path: { type: 'string', description: 'Search path' },
          },
          required: ['pattern'],
        },
        handler: async (args) => {
          // In a real implementation, this would search for actual files
          return {
            content: [{ type: 'text', text: `Search results for ${args.pattern}` }],
          };
        },
      },
      {
        name: 'execute_command',
        description: 'Execute a shell command',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Command to execute' },
            cwd: { type: 'string', description: 'Working directory' },
          },
          required: ['command'],
        },
        handler: async (args) => {
          // In a real implementation, this would execute the actual command
          return {
            content: [{ type: 'text', text: `Executed: ${args.command}` }],
          };
        },
      },
    ],
    resources: [
      {
        uri: 'file://project/structure',
        name: 'Project Structure',
        description: 'Current project structure',
        mimeType: 'application/json',
        handler: async (uri) => {
          return {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({ structure: 'mock' }, null, 2),
          };
        },
      },
      {
        uri: 'file://project/config',
        name: 'Project Configuration',
        description: 'Current project configuration',
        mimeType: 'application/json',
        handler: async (uri) => {
          return {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({ config: 'mock' }, null, 2),
          };
        },
      },
    ],
    prompts: [
      {
        name: 'explain_code',
        description: 'Generate a prompt to explain code',
        arguments: [
          { name: 'file', description: 'File to explain', required: true },
          { name: 'focus', description: 'Specific aspect to focus on', required: false },
        ],
        handler: async (args) => {
          return {
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: `Please explain the code in ${args.file}${args.focus ? `, focusing on ${args.focus}` : ''}`,
                },
              },
            ],
          };
        },
      },
      {
        name: 'refactor_code',
        description: 'Generate a prompt to refactor code',
        arguments: [
          { name: 'file', description: 'File to refactor', required: true },
          { name: 'goal', description: 'Refactoring goal', required: false },
        ],
        handler: async (args) => {
          return {
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: `Please refactor the code in ${args.file}${args.goal ? ` with the goal: ${args.goal}` : ''}`,
                },
              },
            ],
          };
        },
      },
    ],
  });

  mcpServerManager.setDefaultServer('blink');
  return server;
}

export function createServer(config: McpServerConfig): McpServer {
  return mcpServerManager.createServer(config);
}

export function getServer(name: string): McpServer | undefined {
  return mcpServerManager.getServer(name);
}

export function getAllServers(): McpServer[] {
  return mcpServerManager.getAllServers();
}

export function deleteServer(name: string): boolean {
  return mcpServerManager.deleteServer(name);
}

export function setDefaultServer(name: string): void {
  mcpServerManager.setDefaultServer(name);
}

export function getDefaultServer(): McpServer | undefined {
  return mcpServerManager.getDefaultServer();
}

export function getGlobalStatistics(): {
  totalServers: number;
  totalRequests: number;
  totalErrors: number;
  globalErrorRate: number;
  totalTools: number;
  totalResources: number;
  totalPrompts: number;
} {
  return mcpServerManager.getGlobalStatistics();
}
