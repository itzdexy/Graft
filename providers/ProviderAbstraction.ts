/**
 * Provider abstraction system - Unified interface for multiple AI providers
 * Inspired by Goose, Crush, and OpenCode for provider-agnostic architecture
 */

export interface Provider {
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKey?: string;
  models: string[];
  capabilities: ProviderCapabilities;
  config: ProviderConfig;
}

export type ProviderType = 
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'xai'
  | 'openrouter'
  | 'ollama'
  | 'lmstudio'
  | 'vllm'
  | 'custom';

export interface ProviderCapabilities {
  streaming: boolean;
  functionCalling: boolean;
  vision: boolean;
  images: boolean;
  maxTokens: number;
  contextWindow: number;
}

export interface ProviderConfig {
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  maxConcurrent: number;
  rateLimitRpm: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[];
}

export interface ChatCompletionOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  tools?: Tool[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: CompletionChoice[];
  usage: TokenUsage;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
}

export interface CompletionChoice {
  index: number;
  message: {
    role: 'assistant';
    content: string | null;
    toolCalls?: ToolCall[];
  };
  finishReason: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface StreamingChunk {
  id: string;
  model: string;
  choices: StreamingChoice[];
}

export interface StreamingChoice {
  index: number;
  delta: {
    role?: string;
    content?: string;
    toolCalls?: ToolCall[];
  };
  finishReason: string | null;
}

export interface ProviderRouterConfig {
  strategy: RoutingStrategy;
  fallbackEnabled: boolean;
  loadBalancingEnabled: boolean;
  costOptimizationEnabled: boolean;
  latencyOptimizationEnabled: boolean;
}

export type RoutingStrategy = 
  | 'round-robin'
  | 'latency'
  | 'cost'
  | 'quality'
  | 'health';

class ProviderManager {
  private providers: Map<string, Provider> = new Map();
  private router: ProviderRouter;
  private activeProvider: string | null = null;

  constructor() {
    this.router = new ProviderRouter();
    this.initializeDefaultProviders();
  }

  /**
   * Initialize default providers
   */
  private initializeDefaultProviders(): void {
    // OpenAI
    this.registerProvider({
      name: 'openai',
      type: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      capabilities: {
        streaming: true,
        functionCalling: true,
        vision: true,
        images: true,
        maxTokens: 128000,
        contextWindow: 128000,
      },
      config: {
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
        maxConcurrent: 10,
        rateLimitRpm: 3500,
      },
    });

    // Blink
    this.registerProvider({
      name: 'anthropic',
      type: 'anthropic',
      baseUrl: 'https://api.anthropic.com/v1',
      models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
      capabilities: {
        streaming: true,
        functionCalling: true,
        vision: true,
        images: false,
        maxTokens: 200000,
        contextWindow: 200000,
      },
      config: {
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
        maxConcurrent: 10,
        rateLimitRpm: 1000,
      },
    });

    // FreeModel
    this.registerProvider({
      name: 'freemodel',
      type: 'custom',
      baseUrl: 'https://cc.freemodel.dev/v1',
      models: ['claude-3-sonnet', 'claude-3-haiku'],
      capabilities: {
        streaming: true,
        functionCalling: true,
        vision: false,
        images: false,
        maxTokens: 200000,
        contextWindow: 200000,
      },
      config: {
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
        maxConcurrent: 10,
        rateLimitRpm: 100,
      },
    });
  }

  /**
   * Register a provider
   */
  registerProvider(provider: Provider): void {
    this.providers.set(provider.name, provider);
    this.router.addProvider(provider);
  }

  /**
   * Unregister a provider
   */
  unregisterProvider(name: string): void {
    this.providers.delete(name);
    this.router.removeProvider(name);
  }

  /**
   * Get a provider
   */
  getProvider(name: string): Provider | undefined {
    return this.providers.get(name);
  }

  /**
   * Get all providers
   */
  getAllProviders(): Provider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Set active provider
   */
  setActiveProvider(name: string): void {
    if (this.providers.has(name)) {
      this.activeProvider = name;
    }
  }

  /**
   * Get active provider
   */
  getActiveProvider(): Provider | undefined {
    if (this.activeProvider) {
      return this.providers.get(this.activeProvider);
    }
    return this.router.selectProvider();
  }

  /**
   * Send chat completion request
   */
  async chatCompletion(
    messages: ChatMessage[],
    options: ChatCompletionOptions
  ): Promise<ChatCompletionResponse> {
    const provider = this.getActiveProvider();
    if (!provider) {
      throw new Error('No active provider available');
    }

    return this.sendRequest(provider, messages, options);
  }

  /**
   * Send streaming chat completion request
   */
  async *streamChatCompletion(
    messages: ChatMessage[],
    options: ChatCompletionOptions
  ): AsyncGenerator<StreamingChunk> {
    const provider = this.getActiveProvider();
    if (!provider) {
      throw new Error('No active provider available');
    }

    yield* this.streamRequest(provider, messages, options);
  }

  /**
   * Send request to specific provider
   */
  private async sendRequest(
    provider: Provider,
    messages: ChatMessage[],
    options: ChatCompletionOptions
  ): Promise<ChatCompletionResponse> {
    // In a real implementation, this would make actual API calls
    // based on the provider type (OpenAI, Blink, etc.)
    
    const startTime = Date.now();
    
    try {
      // Simulate API call
      await this.simulateRequest(provider);
      
      const response: ChatCompletionResponse = {
        id: `chatcmpl-${Date.now()}`,
        model: options.model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'This is a simulated response from the provider.',
            },
            finishReason: 'stop',
          },
        ],
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
        finishReason: 'stop',
      };

      return response;
    } catch (error) {
      // Try fallback if enabled
      if (this.router.config.fallbackEnabled) {
        const fallbackProvider = this.router.selectFallback(provider.name);
        if (fallbackProvider) {
          return this.sendRequest(fallbackProvider, messages, options);
        }
      }
      throw error;
    }
  }

  /**
   * Stream request to specific provider
   */
  private async *streamRequest(
    provider: Provider,
    messages: ChatMessage[],
    options: ChatCompletionOptions
  ): AsyncGenerator<StreamingChunk> {
    // In a real implementation, this would stream actual API responses
    
    const chunks = [
      {
        id: `chatcmpl-${Date.now()}`,
        model: options.model,
        choices: [
          {
            index: 0,
            delta: { role: 'assistant' },
            finishReason: null,
          },
        ],
      },
      {
        id: `chatcmpl-${Date.now()}`,
        model: options.model,
        choices: [
          {
            index: 0,
            delta: { content: 'This ' },
            finishReason: null,
          },
        ],
      },
      {
        id: `chatcmpl-${Date.now()}`,
        model: options.model,
        choices: [
          {
            index: 0,
            delta: { content: 'is ' },
            finishReason: null,
          },
        ],
      },
      {
        id: `chatcmpl-${Date.now()}`,
        model: options.model,
        choices: [
          {
            index: 0,
            delta: { content: 'a ' },
            finishReason: null,
          },
        ],
      },
      {
        id: `chatcmpl-${Date.now()}`,
        model: options.model,
        choices: [
          {
            index: 0,
            delta: { content: 'streamed ' },
            finishReason: null,
          },
        ],
      },
      {
        id: `chatcmpl-${Date.now()}`,
        model: options.model,
        choices: [
          {
            index: 0,
            delta: { content: 'response.' },
            finishReason: 'stop',
          },
        ],
      },
    ];

    for (const chunk of chunks) {
      yield chunk;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  /**
   * Get router configuration
   */
  getRouterConfig(): ProviderRouterConfig {
    return this.router.config;
  }

  /**
   * Update router configuration
   */
  updateRouterConfig(config: Partial<ProviderRouterConfig>): void {
    this.router.config = { ...this.router.config, ...config };
  }

  /**
   * Get provider statistics
   */
  getStatistics(): {
    totalProviders: number;
    activeProvider: string | null;
    routingStrategy: RoutingStrategy;
    fallbackEnabled: boolean;
  } {
    return {
      totalProviders: this.providers.size,
      activeProvider: this.activeProvider,
      routingStrategy: this.router.config.strategy,
      fallbackEnabled: this.router.config.fallbackEnabled,
    };
  }

  private async simulateRequest(provider: Provider): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
  }
}

class ProviderRouter {
  providers: Map<string, Provider> = new Map();
  config: ProviderRouterConfig = {
    strategy: 'latency',
    fallbackEnabled: true,
    loadBalancingEnabled: false,
    costOptimizationEnabled: false,
    latencyOptimizationEnabled: true,
  };
  private roundRobinIndex = 0;

  addProvider(provider: Provider): void {
    this.providers.set(provider.name, provider);
  }

  removeProvider(name: string): void {
    this.providers.delete(name);
  }

  selectProvider(): Provider | undefined {
    const providers = Array.from(this.providers.values());
    if (providers.length === 0) return undefined;

    switch (this.config.strategy) {
      case 'round-robin':
        return this.selectRoundRobin(providers);
      case 'latency':
        return this.selectByLatency(providers);
      case 'cost':
        return this.selectByCost(providers);
      case 'quality':
        return this.selectByQuality(providers);
      case 'health':
        return this.selectByHealth(providers);
      default:
        return providers[0];
    }
  }

  selectFallback(excludeProvider: string): Provider | undefined {
    const providers = Array.from(this.providers.values()).filter(p => p.name !== excludeProvider);
    if (providers.length === 0) return undefined;
    return providers[0];
  }

  private selectRoundRobin(providers: Provider[]): Provider {
    const provider = providers[this.roundRobinIndex % providers.length];
    this.roundRobinIndex++;
    return provider;
  }

  private selectByLatency(providers: Provider[]): Provider {
    // In a real implementation, this would use actual latency metrics
    return providers[0];
  }

  private selectByCost(providers: Provider[]): Provider {
    // In a real implementation, this would use actual cost data
    return providers[0];
  }

  private selectByQuality(providers: Provider[]): Provider {
    // In a real implementation, this would use quality metrics
    return providers[0];
  }

  private selectByHealth(providers: Provider[]): Provider {
    // In a real implementation, this would use health check data
    return providers[0];
  }
}

// Global provider manager instance
const providerManager = new ProviderManager();

export function registerProvider(provider: Provider): void {
  providerManager.registerProvider(provider);
}

export function unregisterProvider(name: string): void {
  providerManager.unregisterProvider(name);
}

export function getProvider(name: string): Provider | undefined {
  return providerManager.getProvider(name);
}

export function getAllProviders(): Provider[] {
  return providerManager.getAllProviders();
}

export function setActiveProvider(name: string): void {
  providerManager.setActiveProvider(name);
}

export function getActiveProvider(): Provider | undefined {
  return providerManager.getActiveProvider();
}

export async function chatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions
): Promise<ChatCompletionResponse> {
  return providerManager.chatCompletion(messages, options);
}

export async function *streamChatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions
): AsyncGenerator<StreamingChunk> {
  yield* providerManager.streamChatCompletion(messages, options);
}

export function getRouterConfig(): ProviderRouterConfig {
  return providerManager.getRouterConfig();
}

export function updateRouterConfig(config: Partial<ProviderRouterConfig>): void {
  providerManager.updateRouterConfig(config);
}

export function getStatistics(): {
  totalProviders: number;
  activeProvider: string | null;
  routingStrategy: RoutingStrategy;
  fallbackEnabled: boolean;
} {
  return providerManager.getStatistics();
}
