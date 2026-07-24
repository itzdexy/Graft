/**
 * Multi-Backend Support
 * Inspired by llama.cpp's support for multiple inference backends
 * Provides abstraction layer for different hardware acceleration backends
 */

export interface Backend {
  id: string;
  name: string;
  type: BackendType;
  config: BackendConfig;
  capabilities: BackendCapabilities;
  status: BackendStatus;
  statistics: BackendStatistics;
  metadata: BackendMetadata;
}

export type BackendType = 'cpu' | 'cuda' | 'metal' | 'vulkan' | 'opencl' | 'rocm' | 'custom';

export interface BackendConfig {
  deviceIndex?: number;
  numThreads?: number;
  enableFp16?: boolean;
  enableMmap?: boolean;
  enableMmapLock?: boolean;
  numaStrategy?: NumaStrategy;
  customParams?: Record<string, unknown>;
}

export type NumaStrategy = 'disabled' | 'distribute' | 'isolate' | 'numactl' | 'mirror';

export interface BackendCapabilities {
  maxContextLength: number;
  batchSize: number;
  supportedQuantizations: QuantizationType[];
  supportsGqa: boolean;
  supportsFlashAttention: boolean;
  supportsPagedAttention: boolean;
  memorySize: number;
  computeUnits: number;
}

export type QuantizationType = 'f32' | 'f16' | 'q8_0' | 'q4_0' | 'q4_1' | 'q5_0' | 'q5_1' | 'q8_1' | 'q2_k' | 'q3_k' | 'q4_k' | 'q5_k' | 'q6_k';

export type BackendStatus = 'available' | 'unavailable' | 'initializing' | 'error';

export interface BackendStatistics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  averageThroughput: number;
  memoryUsed: number;
  memoryPeak: number;
}

export interface BackendMetadata {
  version: string;
  driverVersion?: string;
  apiVersion?: string;
  vendor?: string;
  createdAt: number;
  updatedAt: number;
}

export interface BackendManager {
  id: string;
  name: string;
  backends: Map<string, Backend>;
  activeBackend: string | null;
  fallbackOrder: string[];
  config: ManagerConfig;
  statistics: ManagerStatistics;
}

export interface ManagerConfig {
  autoSelect: boolean;
  enableFallback: boolean;
  healthCheckInterval: number;
  loadBalancing: LoadBalancingStrategy;
}

export type LoadBalancingStrategy = 'round_robin' | 'least_loaded' | 'random' | 'custom';

export interface ManagerStatistics {
  totalRequests: number;
  backendRequests: Record<string, number>;
  fallbackCount: number;
  averageLatency: number;
}

export interface InferenceRequest {
  model: string;
  prompt: string;
  parameters: InferenceParameters;
  backendId?: string;
}

export interface InferenceParameters {
  maxTokens: number;
  temperature: number;
  topP: number;
  topK: number;
  repeatPenalty: number;
}

export interface InferenceResult {
  text: string;
  tokens: number[];
  backendId: string;
  latency: number;
  throughput: number;
}

class MultiBackendManager {
  private managers: Map<string, BackendManager> = new Map();

  /**
   * Create a backend manager
   */
  createManager(name: string, config?: Partial<ManagerConfig>): BackendManager {
    const manager: BackendManager = {
      id: this.generateManagerId(),
      name,
      backends: new Map(),
      activeBackend: null,
      fallbackOrder: [],
      config: {
        autoSelect: config?.autoSelect ?? true,
        enableFallback: config?.enableFallback ?? true,
        healthCheckInterval: config?.healthCheckInterval || 60000,
        loadBalancing: config?.loadBalancing || 'least_loaded',
      },
      statistics: {
        totalRequests: 0,
        backendRequests: {},
        fallbackCount: 0,
        averageLatency: 0,
      },
    };

    this.managers.set(manager.id, manager);
    return manager;
  }

  /**
   * Get a manager
   */
  getManager(managerId: string): BackendManager | undefined {
    return this.managers.get(managerId);
  }

  /**
   * Get all managers
   */
  getAllManagers(): BackendManager[] {
    return Array.from(this.managers.values());
  }

  /**
   * Delete a manager
   */
  deleteManager(managerId: string): boolean {
    return this.managers.delete(managerId);
  }

  /**
   * Register a backend
   */
  registerBackend(managerId: string, backend: Backend): boolean {
    const manager = this.managers.get(managerId);
    if (!manager) return false;

    manager.backends.set(backend.id, backend);
    manager.fallbackOrder.push(backend.id);

    // Set as active if first backend or auto-select enabled
    if (!manager.activeBackend && manager.config.autoSelect) {
      manager.activeBackend = backend.id;
    }

    return true;
  }

  /**
   * Unregister a backend
   */
  unregisterBackend(managerId: string, backendId: string): boolean {
    const manager = this.managers.get(managerId);
    if (!manager) return false;

    const removed = manager.backends.delete(backendId);
    manager.fallbackOrder = manager.fallbackOrder.filter(id => id !== backendId);

    if (manager.activeBackend === backendId) {
      manager.activeBackend = manager.fallbackOrder[0] || null;
    }

    return removed;
  }

  /**
   * Get a backend
   */
  getBackend(managerId: string, backendId: string): Backend | undefined {
    const manager = this.managers.get(managerId);
    if (!manager) return undefined;

    return manager.backends.get(backendId);
  }

  /**
   * Get all backends for a manager
   */
  getBackends(managerId: string): Backend[] {
    const manager = this.managers.get(managerId);
    if (!manager) return [];

    return Array.from(manager.backends.values());
  }

  /**
   * Set active backend
   */
  setActiveBackend(managerId: string, backendId: string): boolean {
    const manager = this.managers.get(managerId);
    if (!manager) return false;

    if (!manager.backends.has(backendId)) return false;

    manager.activeBackend = backendId;
    return true;
  }

  /**
   * Select best backend for request
   */
  selectBackend(managerId: string, request: InferenceRequest): string | null {
    const manager = this.managers.get(managerId);
    if (!manager) return null;

    if (request.backendId) {
      return request.backendId;
    }

    if (manager.activeBackend) {
      return manager.activeBackend;
    }

    // Auto-select based on load balancing strategy
    switch (manager.config.loadBalancing) {
      case 'least_loaded':
        return this.selectLeastLoaded(manager);
      case 'round_robin':
        return this.selectRoundRobin(manager);
      case 'random':
        return this.selectRandom(manager);
      default:
        return manager.fallbackOrder[0] || null;
    }
  }

  /**
   * Execute inference with backend selection and fallback
   */
  async executeInference(
    managerId: string,
    request: InferenceRequest,
    handler: (backendId: string, request: InferenceRequest) => Promise<InferenceResult>
  ): Promise<InferenceResult> {
    const manager = this.managers.get(managerId);
    if (!manager) {
      throw new Error(`Manager ${managerId} not found`);
    }

    let backendId = this.selectBackend(managerId, request);
    let attempts = 0;
    const maxAttempts = manager.fallbackOrder.length;

    while (attempts < maxAttempts) {
      if (!backendId) {
        throw new Error('No available backends');
      }

      const backend = manager.backends.get(backendId);
      if (!backend || backend.status !== 'available') {
        // Try next backend in fallback order
        const currentIndex = manager.fallbackOrder.indexOf(backendId);
        backendId = manager.fallbackOrder[currentIndex + 1] || null;
        attempts++;
        continue;
      }

      try {
        const startTime = Date.now();
        const result = await handler(backendId, request);
        const latency = Date.now() - startTime;

        // Update statistics
        backend.statistics.totalRequests++;
        backend.statistics.successfulRequests++;
        backend.statistics.averageLatency =
          this.updateAverage(backend.statistics.averageLatency, backend.statistics.totalRequests, latency);

        manager.statistics.totalRequests++;
        manager.statistics.backendRequests[backendId] =
          (manager.statistics.backendRequests[backendId] || 0) + 1;
        manager.statistics.averageLatency =
          this.updateAverage(manager.statistics.averageLatency, manager.statistics.totalRequests, latency);

        return result;

      } catch (error) {
        backend.statistics.totalRequests++;
        backend.statistics.failedRequests++;

        if (!manager.config.enableFallback) {
          throw error;
        }

        manager.statistics.fallbackCount++;

        // Try next backend
        const currentIndex = manager.fallbackOrder.indexOf(backendId);
        backendId = manager.fallbackOrder[currentIndex + 1] || null;
        attempts++;
      }
    }

    throw new Error('All backends failed or unavailable');
  }

  /**
   * Health check all backends
   */
  async healthCheck(managerId: string): Promise<Map<string, boolean>> {
    const manager = this.managers.get(managerId);
    if (!manager) return new Map();

    const results = new Map<string, boolean>();

    for (const [id, backend] of manager.backends) {
      try {
        const healthy = await this.checkBackendHealth(backend);
        backend.status = healthy ? 'available' : 'error';
        results.set(id, healthy);
      } catch (error) {
        backend.status = 'error';
        results.set(id, false);
      }
    }

    return results;
  }

  /**
   * Get manager statistics
   */
  getManagerStatistics(managerId: string): ManagerStatistics | undefined {
    const manager = this.managers.get(managerId);
    if (!manager) return undefined;

    return { ...manager.statistics };
  }

  /**
   * Get backend statistics
   */
  getBackendStatistics(managerId: string, backendId: string): BackendStatistics | undefined {
    const manager = this.managers.get(managerId);
    if (!manager) return undefined;

    const backend = manager.backends.get(backendId);
    if (!backend) return undefined;

    return { ...backend.statistics };
  }

  // Private methods

  private async checkBackendHealth(backend: Backend): Promise<boolean> {
    // In a real implementation, this would perform actual health checks
    // For now, simulate based on status
    return backend.status === 'available';
  }

  private selectLeastLoaded(manager: BackendManager): string | null {
    let leastLoaded: string | null = null;
    let minRequests = Infinity;

    for (const [id, backend] of manager.backends) {
      if (backend.status !== 'available') continue;

      if (backend.statistics.totalRequests < minRequests) {
        minRequests = backend.statistics.totalRequests;
        leastLoaded = id;
      }
    }

    return leastLoaded;
  }

  private selectRoundRobin(manager: BackendManager): string | null {
    const available = manager.fallbackOrder.filter(id => {
      const backend = manager.backends.get(id);
      return backend && backend.status === 'available';
    });

    if (available.length === 0) return null;

    // Use total requests as round-robin counter
    const index = manager.statistics.totalRequests % available.length;
    return available[index];
  }

  private selectRandom(manager: BackendManager): string | null {
    const available = manager.fallbackOrder.filter(id => {
      const backend = manager.backends.get(id);
      return backend && backend.status === 'available';
    });

    if (available.length === 0) return null;

    const index = Math.floor(Math.random() * available.length);
    return available[index];
  }

  private updateAverage(current: number, count: number, newValue: number): number {
    if (count === 1) return newValue;
    return (current * (count - 1) + newValue) / count;
  }

  private generateManagerId(): string {
    return `manager-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Helper functions to create backends
export function createBackend(
  name: string,
  type: BackendType,
  capabilities: BackendCapabilities,
  config?: Partial<BackendConfig>
): Backend {
  return {
    id: `backend-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    type,
    config: {
      deviceIndex: config?.deviceIndex,
      numThreads: config?.numThreads,
      enableFp16: config?.enableFp16 ?? true,
      enableMmap: config?.enableMmap ?? true,
      enableMmapLock: config?.enableMmapLock ?? false,
      numaStrategy: config?.numaStrategy || 'disabled',
      customParams: config?.customParams,
    },
    capabilities,
    status: 'available',
    statistics: {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      averageThroughput: 0,
      memoryUsed: 0,
      memoryPeak: 0,
    },
    metadata: {
      version: '1.0.0',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  };
}

// Global multi-backend manager instance
const multiBackendManager = new MultiBackendManager();

export function createManager(name: string, config?: Partial<ManagerConfig>): BackendManager {
  return multiBackendManager.createManager(name, config);
}

export function getManager(managerId: string): BackendManager | undefined {
  return multiBackendManager.getManager(managerId);
}

export function getAllManagers(): BackendManager[] {
  return multiBackendManager.getAllManagers();
}

export function deleteManager(managerId: string): boolean {
  return multiBackendManager.deleteManager(managerId);
}

export function registerBackend(managerId: string, backend: Backend): boolean {
  return multiBackendManager.registerBackend(managerId, backend);
}

export function unregisterBackend(managerId: string, backendId: string): boolean {
  return multiBackendManager.unregisterBackend(managerId, backendId);
}

export function getBackend(managerId: string, backendId: string): Backend | undefined {
  return multiBackendManager.getBackend(managerId, backendId);
}

export function getBackends(managerId: string): Backend[] {
  return multiBackendManager.getBackends(managerId);
}

export function setActiveBackend(managerId: string, backendId: string): boolean {
  return multiBackendManager.setActiveBackend(managerId, backendId);
}

export function selectBackend(managerId: string, request: InferenceRequest): string | null {
  return multiBackendManager.selectBackend(managerId, request);
}

export async function executeInference(
  managerId: string,
  request: InferenceRequest,
  handler: (backendId: string, request: InferenceRequest) => Promise<InferenceResult>
): Promise<InferenceResult> {
  return multiBackendManager.executeInference(managerId, request, handler);
}

export async function healthCheck(managerId: string): Promise<Map<string, boolean>> {
  return multiBackendManager.healthCheck(managerId);
}

export function getManagerStatistics(managerId: string): ManagerStatistics | undefined {
  return multiBackendManager.getManagerStatistics(managerId);
}

export function getBackendStatistics(managerId: string, backendId: string): BackendStatistics | undefined {
  return multiBackendManager.getBackendStatistics(managerId, backendId);
}
