/**
 * Local model support - Ollama, LM Studio, vLLM, llama.cpp integration
 * Inspired by industry trends for privacy and offline capability
 */

export interface LocalModel {
  id: string;
  name: string;
  provider: LocalModelProvider;
  size: number;
  parameters: number;
  quantization: string;
  contextWindow: number;
  capabilities: ModelCapabilities;
  status: ModelStatus;
  downloaded: boolean;
  path?: string;
}

export type LocalModelProvider = 'ollama' | 'lmstudio' | 'vllm' | 'llamacpp' | 'custom';

export interface ModelCapabilities {
  streaming: boolean;
  functionCalling: boolean;
  vision: boolean;
  embedding: boolean;
  maxTokens: number;
}

export type ModelStatus = 'available' | 'downloading' | 'loading' | 'running' | 'error' | 'stopped';

export interface ModelConfig {
  temperature: number;
  topP: number;
  topK: number;
  repeatPenalty: number;
  numGpu: number;
  numThread: number;
  batchSize: number;
  contextLimit: number;
}

export interface ModelDownloadProgress {
  modelId: string;
  downloaded: number;
  total: number;
  speed: number;
  eta: number;
}

export interface ModelInferenceRequest {
  model: string;
  prompt: string;
  systemPrompt?: string;
  config?: Partial<ModelConfig>;
  stream?: boolean;
}

export interface ModelInferenceResponse {
  id: string;
  model: string;
  response: string;
  tokens: number;
  duration: number;
  perTokenSpeed: number;
}

export interface ModelStats {
  modelId: string;
  provider: LocalModelProvider;
  memoryUsage: number;
  gpuMemoryUsage: number;
  cpuUsage: number;
  tokensPerSecond: number;
  activeConnections: number;
  uptime: number;
}

class LocalModelManager {
  private models: Map<string, LocalModel> = new Map();
  private activeModel: string | null = null;
  private providers: Map<LocalModelProvider, ProviderClient> = new Map();
  private downloadProgress: Map<string, ModelDownloadProgress> = new Map();

  constructor() {
    this.initializeProviders();
    this.initializeDefaultModels();
  }

  /**
   * Initialize provider clients
   */
  private initializeProviders(): void {
    this.providers.set('ollama', new OllamaClient());
    this.providers.set('lmstudio', new LMStudioClient());
    this.providers.set('vllm', new VLLMClient());
    this.providers.set('llamacpp', new LlamaCppClient());
  }

  /**
   * Initialize default models
   */
  private initializeDefaultModels(): void {
    const defaultModels: LocalModel[] = [
      {
        id: 'ollama-llama3',
        name: 'llama3:8b',
        provider: 'ollama',
        size: 4.7 * 1024 * 1024 * 1024, // 4.7GB
        parameters: 8000000000,
        quantization: 'Q4_K_M',
        contextWindow: 8192,
        capabilities: {
          streaming: true,
          functionCalling: false,
          vision: false,
          embedding: true,
          maxTokens: 4096,
        },
        status: 'available',
        downloaded: false,
      },
      {
        id: 'ollama-mistral',
        name: 'mistral:7b',
        provider: 'ollama',
        size: 4.1 * 1024 * 1024 * 1024, // 4.1GB
        parameters: 7000000000,
        quantization: 'Q4_K_M',
        contextWindow: 32768,
        capabilities: {
          streaming: true,
          functionCalling: false,
          vision: false,
          embedding: true,
          maxTokens: 4096,
        },
        status: 'available',
        downloaded: false,
      },
      {
        id: 'ollama-codellama',
        name: 'codellama:7b',
        provider: 'ollama',
        size: 3.8 * 1024 * 1024 * 1024, // 3.8GB
        parameters: 7000000000,
        quantization: 'Q4_K_M',
        contextWindow: 16384,
        capabilities: {
          streaming: true,
          functionCalling: false,
          vision: false,
          embedding: true,
          maxTokens: 4096,
        },
        status: 'available',
        downloaded: false,
      },
    ];

    for (const model of defaultModels) {
      this.models.set(model.id, model);
    }
  }

  /**
   * Get all models
   */
  getAllModels(): LocalModel[] {
    return Array.from(this.models.values());
  }

  /**
   * Get models by provider
   */
  getModelsByProvider(provider: LocalModelProvider): LocalModel[] {
    return this.getAllModels().filter(m => m.provider === provider);
  }

  /**
   * Get a model
   */
  getModel(modelId: string): LocalModel | undefined {
    return this.models.get(modelId);
  }

  /**
   * Download a model
   */
  async downloadModel(modelId: string): Promise<void> {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    if (model.downloaded) {
      return;
    }

    const provider = this.providers.get(model.provider);
    if (!provider) {
      throw new Error(`Provider ${model.provider} not available`);
    }

    model.status = 'downloading';

    try {
      await provider.downloadModel(model.name, (progress) => {
        this.downloadProgress.set(modelId, progress);
      });

      model.downloaded = true;
      model.status = 'available';
      this.downloadProgress.delete(modelId);
    } catch (error) {
      model.status = 'error';
      throw error;
    }
  }

  /**
   * Load a model
   */
  async loadModel(modelId: string, config?: Partial<ModelConfig>): Promise<void> {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    if (!model.downloaded) {
      await this.downloadModel(modelId);
    }

    const provider = this.providers.get(model.provider);
    if (!provider) {
      throw new Error(`Provider ${model.provider} not available`);
    }

    model.status = 'loading';

    try {
      await provider.loadModel(model.name, config);
      model.status = 'running';
      this.activeModel = modelId;
    } catch (error) {
      model.status = 'error';
      throw error;
    }
  }

  /**
   * Unload a model
   */
  async unloadModel(modelId: string): Promise<void> {
    const model = this.models.get(modelId);
    if (!model) return;

    const provider = this.providers.get(model.provider);
    if (!provider) return;

    await provider.unloadModel(model.name);
    model.status = 'stopped';

    if (this.activeModel === modelId) {
      this.activeModel = null;
    }
  }

  /**
   * Run inference
   */
  async inference(request: ModelInferenceRequest): Promise<ModelInferenceResponse> {
    const model = this.models.get(request.model);
    if (!model) {
      throw new Error(`Model ${request.model} not found`);
    }

    if (!model.downloaded) {
      await this.downloadModel(request.model);
    }

    if (model.status !== 'running') {
      await this.loadModel(request.model, request.config);
    }

    const provider = this.providers.get(model.provider);
    if (!provider) {
      throw new Error(`Provider ${model.provider} not available`);
    }

    const startTime = Date.now();
    const response = await provider.inference(request);
    const duration = Date.now() - startTime;

    return {
      id: this.generateId(),
      model: request.model,
      response: response.text,
      tokens: response.tokens,
      duration,
      perTokenSpeed: response.tokens / (duration / 1000),
    };
  }

  /**
   * Stream inference
   */
  async *streamInference(request: ModelInferenceRequest): AsyncGenerator<string> {
    const model = this.models.get(request.model);
    if (!model) {
      throw new Error(`Model ${request.model} not found`);
    }

    if (!model.downloaded) {
      await this.downloadModel(request.model);
    }

    if (model.status !== 'running') {
      await this.loadModel(request.model, request.config);
    }

    const provider = this.providers.get(model.provider);
    if (!provider) {
      throw new Error(`Provider ${model.provider} not available`);
    }

    yield* provider.streamInference(request);
  }

  /**
   * Get active model
   */
  getActiveModel(): LocalModel | undefined {
    if (!this.activeModel) return undefined;
    return this.models.get(this.activeModel);
  }

  /**
   * Get download progress
   */
  getDownloadProgress(modelId: string): ModelDownloadProgress | undefined {
    return this.downloadProgress.get(modelId);
  }

  /**
   * Get model statistics
   */
  async getModelStats(modelId: string): Promise<ModelStats> {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    const provider = this.providers.get(model.provider);
    if (!provider) {
      throw new Error(`Provider ${model.provider} not available`);
    }

    return provider.getStats(model.name);
  }

  /**
   * List available models from provider
   */
  async listProviderModels(provider: LocalModelProvider): Promise<string[]> {
    const client = this.providers.get(provider);
    if (!client) {
      return [];
    }

    return client.listModels();
  }

  /**
   * Delete a model
   */
  async deleteModel(modelId: string): Promise<void> {
    const model = this.models.get(modelId);
    if (!model) return;

    if (model.status === 'running') {
      await this.unloadModel(modelId);
    }

    const provider = this.providers.get(model.provider);
    if (!provider) return;

    await provider.deleteModel(model.name);
    model.downloaded = false;
    model.status = 'available';
  }

  /**
   * Get provider status
   */
  async getProviderStatus(provider: LocalModelProvider): Promise<{
    available: boolean;
    version: string;
    memoryUsage: number;
  }> {
    const client = this.providers.get(provider);
    if (!client) {
      return {
        available: false,
        version: 'unknown',
        memoryUsage: 0,
      };
    }

    return client.getStatus();
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalModels: number;
    downloadedModels: number;
    runningModels: number;
    activeModel: string | null;
    modelsByProvider: Record<LocalModelProvider, number>;
  } {
    const models = this.getAllModels();
    const downloadedModels = models.filter(m => m.downloaded).length;
    const runningModels = models.filter(m => m.status === 'running').length;
    const modelsByProvider: Record<LocalModelProvider, number> = {} as any;

    for (const model of models) {
      modelsByProvider[model.provider] = (modelsByProvider[model.provider] || 0) + 1;
    }

    return {
      totalModels: models.length,
      downloadedModels,
      runningModels,
      activeModel: this.activeModel,
      modelsByProvider,
    };
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Provider client interfaces
interface ProviderClient {
  downloadModel(name: string, onProgress?: (progress: ModelDownloadProgress) => void): Promise<void>;
  loadModel(name: string, config?: Partial<ModelConfig>): Promise<void>;
  unloadModel(name: string): Promise<void>;
  inference(request: ModelInferenceRequest): Promise<{ text: string; tokens: number }>;
  streamInference(request: ModelInferenceRequest): AsyncGenerator<string>;
  getStats(name: string): Promise<ModelStats>;
  listModels(): Promise<string[]>;
  deleteModel(name: string): Promise<void>;
  getStatus(): Promise<{ available: boolean; version: string; memoryUsage: number }>;
}

// Mock provider implementations — Ollama uses live HTTP when available
class OllamaClient implements ProviderClient {
  private baseUrl = process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434'

  async downloadModel(name: string, onProgress?: (progress: ModelDownloadProgress) => void): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, stream: false }),
      signal: AbortSignal.timeout(600_000),
    })
    if (!res.ok) throw new Error(`Ollama pull failed: ${res.status}`)
    if (onProgress) {
      onProgress({
        modelId: name,
        downloaded: 1,
        total: 1,
        speed: 0,
        eta: 0,
      })
    }
  }

  async loadModel(_name: string, _config?: Partial<ModelConfig>): Promise<void> {
    // Ollama loads on first inference
  }

  async unloadModel(name: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: name, keep_alive: 0 }),
    }).catch(() => undefined)
  }

  async inference(request: ModelInferenceRequest): Promise<{ text: string; tokens: number }> {
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model,
        prompt: request.prompt,
        system: request.systemPrompt,
        stream: false,
        options: {
          temperature: request.config?.temperature ?? 0.7,
          top_p: request.config?.topP,
          num_predict: request.config?.contextLimit,
        },
      }),
      signal: AbortSignal.timeout(300_000),
    })
    if (!res.ok) throw new Error(`Ollama inference failed: ${res.status}`)
    const data = (await res.json()) as { response?: string; eval_count?: number }
    return {
      text: data.response ?? '',
      tokens: data.eval_count ?? 0,
    }
  }

  async *streamInference(request: ModelInferenceRequest): AsyncGenerator<string> {
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model,
        prompt: request.prompt,
        stream: true,
      }),
    })
    if (!res.ok || !res.body) throw new Error(`Ollama stream failed: ${res.status}`)
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const j = JSON.parse(line) as { response?: string }
          if (j.response) yield j.response
        } catch {
          // skip partial
        }
      }
    }
  }

  async getStats(name: string): Promise<ModelStats> {
    return {
      modelId: name,
      provider: 'ollama',
      memoryUsage: 0,
      gpuMemoryUsage: 0,
      cpuUsage: 0,
      tokensPerSecond: 0,
      activeConnections: 1,
      uptime: 0,
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      })
      if (!res.ok) return []
      const data = (await res.json()) as { models?: Array<{ name: string }> }
      return (data.models ?? []).map(m => m.name)
    } catch {
      return []
    }
  }

  async deleteModel(name: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
  }

  async getStatus(): Promise<{ available: boolean; version: string; memoryUsage: number }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/version`, {
        signal: AbortSignal.timeout(2000),
      })
      if (!res.ok) return { available: false, version: 'unknown', memoryUsage: 0 }
      const data = (await res.json()) as { version?: string }
      return { available: true, version: data.version ?? 'unknown', memoryUsage: 0 }
    } catch {
      return { available: false, version: 'unknown', memoryUsage: 0 }
    }
  }
}

class LMStudioClient implements ProviderClient {
  async downloadModel(name: string, onProgress?: (progress: ModelDownloadProgress) => void): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  async loadModel(name: string, config?: Partial<ModelConfig>): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  async unloadModel(name: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  async inference(request: ModelInferenceRequest): Promise<{ text: string; tokens: number }> {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { text: `LM Studio response: ${request.prompt}`, tokens: 100 };
  }

  async *streamInference(request: ModelInferenceRequest): AsyncGenerator<string> {
    const words = `LM Studio response: ${request.prompt}`.split(' ');
    for (const word of words) {
      yield word + ' ';
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async getStats(name: string): Promise<ModelStats> {
    return {
      modelId: name,
      provider: 'lmstudio',
      memoryUsage: 1024 * 1024 * 1024,
      gpuMemoryUsage: 512 * 1024 * 1024,
      cpuUsage: 50,
      tokensPerSecond: 50,
      activeConnections: 1,
      uptime: 3600,
    };
  }

  async listModels(): Promise<string[]> {
    return [];
  }

  async deleteModel(name: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  async getStatus(): Promise<{ available: boolean; version: string; memoryUsage: number }> {
    return {
      available: false,
      version: 'unknown',
      memoryUsage: 0,
    };
  }
}

class VLLMClient implements ProviderClient {
  async downloadModel(name: string, onProgress?: (progress: ModelDownloadProgress) => void): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  async loadModel(name: string, config?: Partial<ModelConfig>): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  async unloadModel(name: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  async inference(request: ModelInferenceRequest): Promise<{ text: string; tokens: number }> {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { text: `vLLM response: ${request.prompt}`, tokens: 100 };
  }

  async *streamInference(request: ModelInferenceRequest): AsyncGenerator<string> {
    const words = `vLLM response: ${request.prompt}`.split(' ');
    for (const word of words) {
      yield word + ' ';
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async getStats(name: string): Promise<ModelStats> {
    return {
      modelId: name,
      provider: 'vllm',
      memoryUsage: 1024 * 1024 * 1024,
      gpuMemoryUsage: 512 * 1024 * 1024,
      cpuUsage: 50,
      tokensPerSecond: 50,
      activeConnections: 1,
      uptime: 3600,
    };
  }

  async listModels(): Promise<string[]> {
    return [];
  }

  async deleteModel(name: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  async getStatus(): Promise<{ available: boolean; version: string; memoryUsage: number }> {
    return {
      available: false,
      version: 'unknown',
      memoryUsage: 0,
    };
  }
}

class LlamaCppClient implements ProviderClient {
  async downloadModel(name: string, onProgress?: (progress: ModelDownloadProgress) => void): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  async loadModel(name: string, config?: Partial<ModelConfig>): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  async unloadModel(name: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  async inference(request: ModelInferenceRequest): Promise<{ text: string; tokens: number }> {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { text: `llama.cpp response: ${request.prompt}`, tokens: 100 };
  }

  async *streamInference(request: ModelInferenceRequest): AsyncGenerator<string> {
    const words = `llama.cpp response: ${request.prompt}`.split(' ');
    for (const word of words) {
      yield word + ' ';
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async getStats(name: string): Promise<ModelStats> {
    return {
      modelId: name,
      provider: 'llamacpp',
      memoryUsage: 1024 * 1024 * 1024,
      gpuMemoryUsage: 512 * 1024 * 1024,
      cpuUsage: 50,
      tokensPerSecond: 50,
      activeConnections: 1,
      uptime: 3600,
    };
  }

  async listModels(): Promise<string[]> {
    return [];
  }

  async deleteModel(name: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  async getStatus(): Promise<{ available: boolean; version: string; memoryUsage: number }> {
    return {
      available: false,
      version: 'unknown',
      memoryUsage: 0,
    };
  }
}

// Global local model manager instance
const localModelManager = new LocalModelManager();

export function getAllModels(): LocalModel[] {
  return localModelManager.getAllModels();
}

export function getModelsByProvider(provider: LocalModelProvider): LocalModel[] {
  return localModelManager.getModelsByProvider(provider);
}

export function getModel(modelId: string): LocalModel | undefined {
  return localModelManager.getModel(modelId);
}

export async function downloadModel(modelId: string): Promise<void> {
  return localModelManager.downloadModel(modelId);
}

export async function loadModel(modelId: string, config?: Partial<ModelConfig>): Promise<void> {
  return localModelManager.loadModel(modelId, config);
}

export async function unloadModel(modelId: string): Promise<void> {
  return localModelManager.unloadModel(modelId);
}

export async function inference(request: ModelInferenceRequest): Promise<ModelInferenceResponse> {
  return localModelManager.inference(request);
}

export async function *streamInference(request: ModelInferenceRequest): AsyncGenerator<string> {
  yield* localModelManager.streamInference(request);
}

export function getActiveModel(): LocalModel | undefined {
  return localModelManager.getActiveModel();
}

export function getDownloadProgress(modelId: string): ModelDownloadProgress | undefined {
  return localModelManager.getDownloadProgress(modelId);
}

export async function getModelStats(modelId: string): Promise<ModelStats> {
  return localModelManager.getModelStats(modelId);
}

export async function listProviderModels(provider: LocalModelProvider): Promise<string[]> {
  return localModelManager.listProviderModels(provider);
}

export async function deleteModel(modelId: string): Promise<void> {
  return localModelManager.deleteModel(modelId);
}

export async function getProviderStatus(provider: LocalModelProvider): Promise<{
  available: boolean;
  version: string;
  memoryUsage: number;
}> {
  return localModelManager.getProviderStatus(provider);
}

export function getStatistics(): {
  totalModels: number;
  downloadedModels: number;
  runningModels: number;
  activeModel: string | null;
  modelsByProvider: Record<LocalModelProvider, number>;
} {
  return localModelManager.getStatistics();
}
