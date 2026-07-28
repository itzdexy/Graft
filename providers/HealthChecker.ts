/**
 * Provider health check system
 * Inspired by Goose and Crush for provider reliability and failover
 */

export interface ProviderConfig {
  name: string;
  baseUrl: string;
  apiKey?: string;
  models: string[];
  timeout: number;
  retryAttempts: number;
  enabled: boolean;
}

export interface HealthCheckResult {
  provider: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  timestamp: number;
  error?: string;
  availableModels: string[];
}

export interface ProviderMetrics {
  provider: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;
  lastCheck: number;
}

export interface HealthCheckConfig {
  interval: number;
  timeout: number;
  threshold: number;
  consecutiveFailures: number;
}

class ProviderHealthChecker {
  private providers: Map<string, ProviderConfig> = new Map();
  private healthStatus: Map<string, HealthCheckResult> = new Map();
  private metrics: Map<string, ProviderMetrics> = new Map();
  private config: HealthCheckConfig;
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<HealthCheckConfig>) {
    this.config = {
      interval: 60 * 1000, // 1 minute
      timeout: 10 * 1000, // 10 seconds
      threshold: 0.8, // 80% success rate threshold
      consecutiveFailures: 3,
      ...config,
    };

    this.initializeDefaultProviders();
  }

  /**
   * Initialize default providers
   */
  private initializeDefaultProviders(): void {
    // OpenAI
    this.providers.set('openai', {
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      timeout: 30000,
      retryAttempts: 3,
      enabled: true,
    });

    // Tovyr
    this.providers.set('anthropic', {
      name: 'Tovyr',
      baseUrl: 'https://api.anthropic.com/v1',
      models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
      timeout: 30000,
      retryAttempts: 3,
      enabled: true,
    });

    // FreeModel
    this.providers.set('freemodel', {
      name: 'FreeModel',
      baseUrl: 'https://cc.freemodel.dev/v1',
      models: ['claude-3-sonnet', 'claude-3-haiku'],
      timeout: 30000,
      retryAttempts: 3,
      enabled: true,
    });

    // Google
    this.providers.set('google', {
      name: 'Google',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      models: ['gemini-pro', 'gemini-pro-vision'],
      timeout: 30000,
      retryAttempts: 3,
      enabled: false,
    });

    // xAI
    this.providers.set('xai', {
      name: 'xAI',
      baseUrl: 'https://api.x.ai/v1',
      models: ['grok-beta'],
      timeout: 30000,
      retryAttempts: 3,
      enabled: false,
    });
  }

  /**
   * Register a provider
   */
  registerProvider(config: ProviderConfig): void {
    this.providers.set(config.name, config);
    this.initializeMetrics(config.name);
  }

  /**
   * Unregister a provider
   */
  unregisterProvider(name: string): void {
    this.providers.delete(name);
    this.healthStatus.delete(name);
    this.metrics.delete(name);
  }

  /**
   * Get a provider config
   */
  getProvider(name: string): ProviderConfig | undefined {
    return this.providers.get(name);
  }

  /**
   * Get all providers
   */
  getAllProviders(): ProviderConfig[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get enabled providers
   */
  getEnabledProviders(): ProviderConfig[] {
    return this.getAllProviders().filter(p => p.enabled);
  }

  /**
   * Enable/disable a provider
   */
  setProviderEnabled(name: string, enabled: boolean): void {
    const provider = this.providers.get(name);
    if (provider) {
      provider.enabled = enabled;
    }
  }

  /**
   * Perform health check for a provider
   */
  async checkHealth(providerName: string): Promise<HealthCheckResult> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      return {
        provider: providerName,
        status: 'unhealthy',
        latency: 0,
        timestamp: Date.now(),
        error: 'Provider not found',
        availableModels: [],
      };
    }

    if (!provider.enabled) {
      return {
        provider: providerName,
        status: 'unhealthy',
        latency: 0,
        timestamp: Date.now(),
        error: 'Provider disabled',
        availableModels: [],
      };
    }

    const startTime = Date.now();
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let error: string | undefined;
    const availableModels: string[] = [];

    try {
      // In a real implementation, this would make an actual API call
      await this.simulateHealthCheck(provider);
      
      // Simulate available models
      availableModels.push(...provider.models);
    } catch (err) {
      status = 'unhealthy';
      error = String(err);
    }

    const latency = Date.now() - startTime;

    // Determine status based on latency
    if (status === 'healthy' && latency > provider.timeout * 0.5) {
      status = 'degraded';
    }

    const result: HealthCheckResult = {
      provider: providerName,
      status,
      latency,
      timestamp: Date.now(),
      error,
      availableModels,
    };

    this.healthStatus.set(providerName, result);
    this.updateMetrics(providerName, status === 'healthy', latency);

    return result;
  }

  /**
   * Check health of all providers
   */
  async checkAllHealth(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];

    for (const providerName of this.providers.keys()) {
      const result = await this.checkHealth(providerName);
      results.push(result);
    }

    return results;
  }

  /**
   * Get health status for a provider
   */
  getHealthStatus(providerName: string): HealthCheckResult | undefined {
    return this.healthStatus.get(providerName);
  }

  /**
   * Get all health statuses
   */
  getAllHealthStatus(): HealthCheckResult[] {
    return Array.from(this.healthStatus.values());
  }

  /**
   * Get healthy providers
   */
  getHealthyProviders(): ProviderConfig[] {
    const healthyProviders = this.getAllHealthStatus()
      .filter(h => h.status === 'healthy')
      .map(h => h.provider);

    return this.getAllProviders().filter(p => healthyProviders.includes(p.name));
  }

  /**
   * Get provider metrics
   */
  getMetrics(providerName: string): ProviderMetrics | undefined {
    return this.metrics.get(providerName);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): ProviderMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Start automatic health checks
   */
  startHealthChecks(): void {
    if (this.checkInterval) {
      this.stopHealthChecks();
    }

    this.checkInterval = setInterval(() => {
      this.checkAllHealth().catch(err => {
        console.error('Health check failed:', err);
      });
    }, this.config.interval);
  }

  /**
   * Stop automatic health checks
   */
  stopHealthChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Get provider recommendation based on health and latency
   */
  getRecommendedProvider(): ProviderConfig | undefined {
    const healthyProviders = this.getHealthyProviders();
    if (healthyProviders.length === 0) {
      return undefined;
    }

    // Sort by latency
    healthyProviders.sort((a, b) => {
      const aLatency = this.healthStatus.get(a.name)?.latency || Infinity;
      const bLatency = this.healthStatus.get(b.name)?.latency || Infinity;
      return aLatency - bLatency;
    });

    return healthyProviders[0];
  }

  /**
   * Get provider statistics
   */
  getStatistics(): {
    totalProviders: number;
    healthyProviders: number;
    degradedProviders: number;
    unhealthyProviders: number;
    averageLatency: number;
    totalRequests: number;
    totalErrors: number;
  } {
    const allStatus = this.getAllHealthStatus();
    const healthy = allStatus.filter(s => s.status === 'healthy').length;
    const degraded = allStatus.filter(s => s.status === 'degraded').length;
    const unhealthy = allStatus.filter(s => s.status === 'unhealthy').length;

    const totalLatency = allStatus.reduce((sum, s) => sum + s.latency, 0);
    const averageLatency = allStatus.length > 0 ? totalLatency / allStatus.length : 0;

    const allMetrics = this.getAllMetrics();
    const totalRequests = allMetrics.reduce((sum, m) => sum + m.totalRequests, 0);
    const totalErrors = allMetrics.reduce((sum, m) => sum + m.failedRequests, 0);

    return {
      totalProviders: this.providers.size,
      healthyProviders: healthy,
      degradedProviders: degraded,
      unhealthyProviders: unhealthy,
      averageLatency,
      totalRequests,
      totalErrors,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HealthCheckConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart health checks if interval changed
    if (config.interval && this.checkInterval) {
      this.startHealthChecks();
    }
  }

  // Private methods

  private initializeMetrics(providerName: string): void {
    this.metrics.set(providerName, {
      provider: providerName,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      errorRate: 0,
      lastCheck: Date.now(),
    });
  }

  private updateMetrics(providerName: string, success: boolean, latency: number): void {
    const metrics = this.metrics.get(providerName);
    if (!metrics) return;

    metrics.totalRequests++;
    metrics.lastCheck = Date.now();

    if (success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }

    // Update average latency
    const totalLatency = metrics.averageLatency * (metrics.totalRequests - 1) + latency;
    metrics.averageLatency = totalLatency / metrics.totalRequests;

    // Update error rate
    metrics.errorRate = metrics.failedRequests / metrics.totalRequests;
  }

  private async simulateHealthCheck(provider: ProviderConfig): Promise<void> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

    // Simulate occasional failure (5% chance)
    if (Math.random() < 0.05) {
      throw new Error('Simulated network error');
    }
  }
}

// Global health checker instance
const healthChecker = new ProviderHealthChecker();

export function registerProvider(config: ProviderConfig): void {
  healthChecker.registerProvider(config);
}

export function unregisterProvider(name: string): void {
  healthChecker.unregisterProvider(name);
}

export function getProvider(name: string): ProviderConfig | undefined {
  return healthChecker.getProvider(name);
}

export function getAllProviders(): ProviderConfig[] {
  return healthChecker.getAllProviders();
}

export function getEnabledProviders(): ProviderConfig[] {
  return healthChecker.getEnabledProviders();
}

export function setProviderEnabled(name: string, enabled: boolean): void {
  healthChecker.setProviderEnabled(name, enabled);
}

export async function checkHealth(providerName: string): Promise<HealthCheckResult> {
  return healthChecker.checkHealth(providerName);
}

export async function checkAllHealth(): Promise<HealthCheckResult[]> {
  return healthChecker.checkAllHealth();
}

export function getHealthStatus(providerName: string): HealthCheckResult | undefined {
  return healthChecker.getHealthStatus(providerName);
}

export function getAllHealthStatus(): HealthCheckResult[] {
  return healthChecker.getAllHealthStatus();
}

export function getHealthyProviders(): ProviderConfig[] {
  return healthChecker.getHealthyProviders();
}

export function getMetrics(providerName: string): ProviderMetrics | undefined {
  return healthChecker.getMetrics(providerName);
}

export function getAllMetrics(): ProviderMetrics[] {
  return healthChecker.getAllMetrics();
}

export function startHealthChecks(): void {
  healthChecker.startHealthChecks();
}

export function stopHealthChecks(): void {
  healthChecker.stopHealthChecks();
}

export function getRecommendedProvider(): ProviderConfig | undefined {
  return healthChecker.getRecommendedProvider();
}

export function getStatistics(): {
  totalProviders: number;
  healthyProviders: number;
  degradedProviders: number;
  unhealthyProviders: number;
  averageLatency: number;
  totalRequests: number;
  totalErrors: number;
} {
  return healthChecker.getStatistics();
}

export function updateConfig(config: Partial<HealthCheckConfig>): void {
  healthChecker.updateConfig(config);
}
