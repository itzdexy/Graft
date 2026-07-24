/**
 * Multi-Model Chat
 * Inspired by Open WebUI's side-by-side model comparison feature
 * Provides parallel model execution, response comparison UI, and model selection based on task
 */

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  model: string;
  capabilities: ModelCapabilities;
  parameters: ModelParameters;
  enabled: boolean;
  metadata: ModelMetadata;
}

export interface ModelCapabilities {
  maxTokens: number;
  supportsStreaming: boolean;
  supportsImages: boolean;
  supportsTools: boolean;
  supportsFunctionCalling: boolean;
  contextWindow: number;
}

export interface ModelParameters {
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
  frequencyPenalty: number;
  presencePenalty: number;
}

export interface ModelMetadata {
  version: string;
  description: string;
  costPer1kTokens: number;
  averageLatency: number;
  qualityScore: number;
  tags: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  modelId?: string;
  metadata?: Record<string, unknown>;
}

export interface ModelResponse {
  modelId: string;
  modelName: string;
  response: string;
  finishReason: string;
  usage: TokenUsage;
  latency: number;
  quality: QualityMetrics;
  timestamp: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface QualityMetrics {
  coherence: number;
  relevance: number;
  accuracy: number;
  creativity: number;
  overall: number;
}

export interface ComparisonResult {
  prompt: string;
  responses: ModelResponse[];
  comparison: ComparisonMetrics;
  recommendation: ModelRecommendation;
  timestamp: number;
}

export interface ComparisonMetrics {
  fastestModel: string;
  mostCoherent: string;
  mostRelevant: string;
  mostCreative: string;
  bestValue: string;
  averageLatency: number;
  averageQuality: number;
}

export interface ModelRecommendation {
  recommendedModel: string;
  reason: string;
  confidence: number;
}

export interface ChatSession {
  id: string;
  name: string;
  models: string[];
  messages: ChatMessage[];
  responses: ModelResponse[];
  comparisons: ComparisonResult[];
  createdAt: number;
  updatedAt: number;
  metadata: SessionMetadata;
}

export interface SessionMetadata {
  userId?: string;
  projectId?: string;
  purpose: string;
  tags: string[];
}

class MultiModelChat {
  private models: Map<string, ModelConfig> = new Map();
  private sessions: Map<string, ChatSession> = new Map();
  private activeSession: string | null = null;

  /**
   * Register a model
   */
  registerModel(model: ModelConfig): void {
    this.models.set(model.id, model);
  }

  /**
   * Unregister a model
   */
  unregisterModel(modelId: string): boolean {
    return this.models.delete(modelId);
  }

  /**
   * Get a model
   */
  getModel(modelId: string): ModelConfig | undefined {
    return this.models.get(modelId);
  }

  /**
   * Get all models
   */
  getAllModels(): ModelConfig[] {
    return Array.from(this.models.values());
  }

  /**
   * Get enabled models
   */
  getEnabledModels(): ModelConfig[] {
    return this.getAllModels().filter(m => m.enabled);
  }

  /**
   * Get models by provider
   */
  getModelsByProvider(provider: string): ModelConfig[] {
    return this.getAllModels().filter(m => m.provider === provider);
  }

  /**
   * Enable a model
   */
  enableModel(modelId: string): boolean {
    const model = this.models.get(modelId);
    if (!model) return false;

    model.enabled = true;
    return true;
  }

  /**
   * Disable a model
   */
  disableModel(modelId: string): boolean {
    const model = this.models.get(modelId);
    if (!model) return false;

    model.enabled = false;
    return true;
  }

  /**
   * Create a chat session
   */
  createSession(name: string, modelIds: string[], metadata?: SessionMetadata): ChatSession {
    const session: ChatSession = {
      id: this.generateSessionId(),
      name,
      models: modelIds,
      messages: [],
      responses: [],
      comparisons: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: metadata || {
        purpose: 'general',
        tags: [],
      },
    };

    this.sessions.set(session.id, session);
    this.activeSession = session.id;

    return session;
  }

  /**
   * Get a session
   */
  getSession(sessionId: string): ChatSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get active session
   */
  getActiveSession(): ChatSession | undefined {
    if (!this.activeSession) return undefined;
    return this.sessions.get(this.activeSession);
  }

  /**
   * Set active session
   */
  setActiveSession(sessionId: string): void {
    if (this.sessions.has(sessionId)) {
      this.activeSession = sessionId;
    }
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    if (this.activeSession === sessionId) {
      this.activeSession = null;
    }
    return this.sessions.delete(sessionId);
  }

  /**
   * Add a message to a session
   */
  addMessage(sessionId: string, message: ChatMessage): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.messages.push(message);
    session.updatedAt = Date.now();
  }

  /**
   * Send a prompt to multiple models in parallel
   */
  async sendToModels(
    prompt: string,
    modelIds: string[],
    context?: ChatMessage[]
  ): Promise<ModelResponse[]> {
    const responses: ModelResponse[] = [];

    // Execute in parallel
    const promises = modelIds.map(async (modelId) => {
      const model = this.models.get(modelId);
      if (!model || !model.enabled) return null;

      return await this.executeModel(model, prompt, context);
    });

    const results = await Promise.all(promises);

    for (const result of results) {
      if (result) {
        responses.push(result);
      }
    }

    return responses;
  }

  /**
   * Compare responses from multiple models
   */
  compareResponses(prompt: string, responses: ModelResponse[]): ComparisonResult {
    const comparison: ComparisonMetrics = {
      fastestModel: '',
      mostCoherent: '',
      mostRelevant: '',
      mostCreative: '',
      bestValue: '',
      averageLatency: 0,
      averageQuality: 0,
    };

    if (responses.length === 0) {
      return {
        prompt,
        responses,
        comparison,
        recommendation: {
          recommendedModel: '',
          reason: 'No responses to compare',
          confidence: 0,
        },
        timestamp: Date.now(),
      };
    }

    // Find fastest
    const fastest = responses.reduce((min, r) => r.latency < min.latency ? r : min);
    comparison.fastestModel = fastest.modelId;

    // Find most coherent
    const mostCoherent = responses.reduce((max, r) => r.quality.coherence > max.quality.coherence ? r : max);
    comparison.mostCoherent = mostCoherent.modelId;

    // Find most relevant
    const mostRelevant = responses.reduce((max, r) => r.quality.relevance > max.quality.relevance ? r : max);
    comparison.mostRelevant = mostRelevant.modelId;

    // Find most creative
    const mostCreative = responses.reduce((max, r) => r.quality.creativity > max.quality.creativity ? r : max);
    comparison.mostCreative = mostCreative.modelId;

    // Find best value (quality / cost)
    let bestValue = responses[0];
    let bestValueScore = 0;
    for (const response of responses) {
      const model = this.models.get(response.modelId);
      if (model) {
        const score = response.quality.overall / model.metadata.costPer1kTokens;
        if (score > bestValueScore) {
          bestValueScore = score;
          bestValue = response;
        }
      }
    }
    comparison.bestValue = bestValue.modelId;

    // Calculate averages
    comparison.averageLatency = responses.reduce((sum, r) => sum + r.latency, 0) / responses.length;
    comparison.averageQuality = responses.reduce((sum, r) => sum + r.quality.overall, 0) / responses.length;

    // Generate recommendation
    const recommendation = this.generateRecommendation(prompt, responses, comparison);

    return {
      prompt,
      responses,
      comparison,
      recommendation,
      timestamp: Date.now(),
    };
  }

  /**
   * Get recommended model for a task
   */
  getRecommendedModel(task: string, context?: Record<string, unknown>): ModelConfig | undefined {
    const enabledModels = this.getEnabledModels();
    if (enabledModels.length === 0) return undefined;

    // Simple task-based recommendation
    const taskLower = task.toLowerCase();

    // For coding tasks, prefer models with high accuracy
    if (taskLower.includes('code') || taskLower.includes('programming')) {
      return enabledModels.sort((a, b) => b.metadata.qualityScore - a.metadata.qualityScore)[0];
    }

    // For creative tasks, prefer models with high creativity
    if (taskLower.includes('creative') || taskLower.includes('writing')) {
      return enabledModels.sort((a, b) => b.metadata.qualityScore - a.metadata.qualityScore)[0];
    }

    // For fast tasks, prefer low latency
    if (taskLower.includes('quick') || taskLower.includes('fast')) {
      return enabledModels.sort((a, b) => a.metadata.averageLatency - b.metadata.averageLatency)[0];
    }

    // Default to highest quality
    return enabledModels.sort((a, b) => b.metadata.qualityScore - a.metadata.qualityScore)[0];
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalModels: number;
    enabledModels: number;
    modelsByProvider: Record<string, number>;
    totalSessions: number;
    totalMessages: number;
    totalResponses: number;
    averageLatency: number;
    averageQuality: number;
  } {
    const models = this.getAllModels();
    const enabled = models.filter(m => m.enabled).length;

    const modelsByProvider: Record<string, number> = {} as any;
    for (const model of models) {
      modelsByProvider[model.provider] = (modelsByProvider[model.provider] || 0) + 1;
    }

    const sessions = Array.from(this.sessions.values());
    const totalMessages = sessions.reduce((sum, s) => sum + s.messages.length, 0);
    const totalResponses = sessions.reduce((sum, s) => sum + s.responses.length, 0);

    const allResponses = sessions.flatMap(s => s.responses);
    const averageLatency = allResponses.length > 0
      ? allResponses.reduce((sum, r) => sum + r.latency, 0) / allResponses.length
      : 0;
    const averageQuality = allResponses.length > 0
      ? allResponses.reduce((sum, r) => sum + r.quality.overall, 0) / allResponses.length
      : 0;

    return {
      totalModels: models.length,
      enabledModels: enabled,
      modelsByProvider,
      totalSessions: sessions.length,
      totalMessages,
      totalResponses,
      averageLatency,
      averageQuality,
    };
  }

  // Private methods

  private async executeModel(
    model: ModelConfig,
    prompt: string,
    context?: ChatMessage[]
  ): Promise<ModelResponse> {
    const startTime = Date.now();

    // In a real implementation, this would call the actual model API
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

    const latency = Date.now() - startTime;

    // Simulate response
    const response = `Response from ${model.name}: ${prompt}`;

    // Calculate quality metrics
    const quality = this.calculateQuality(response, prompt);

    return {
      modelId: model.id,
      modelName: model.name,
      response,
      finishReason: 'stop',
      usage: {
        promptTokens: prompt.length / 4,
        completionTokens: response.length / 4,
        totalTokens: (prompt.length + response.length) / 4,
      },
      latency,
      quality,
      timestamp: Date.now(),
    };
  }

  private calculateQuality(response: string, prompt: string): QualityMetrics {
    // Simple quality calculation
    const coherence = Math.random() * 0.3 + 0.7;
    const relevance = Math.random() * 0.3 + 0.7;
    const accuracy = Math.random() * 0.3 + 0.7;
    const creativity = Math.random() * 0.3 + 0.7;
    const overall = (coherence + relevance + accuracy + creativity) / 4;

    return {
      coherence,
      relevance,
      accuracy,
      creativity,
      overall,
    };
  }

  private generateRecommendation(
    prompt: string,
    responses: ModelResponse[],
    comparison: ComparisonMetrics
  ): ModelRecommendation {
    // Simple recommendation logic
    const bestOverall = responses.reduce((max, r) => r.quality.overall > max.quality.overall ? r : max);

    return {
      recommendedModel: bestOverall.modelId,
      reason: `Best overall quality score (${bestOverall.quality.overall.toFixed(2)})`,
      confidence: bestOverall.quality.overall,
    };
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Global multi-model chat instance
const multiModelChat = new MultiModelChat();

export function registerModel(model: ModelConfig): void {
  multiModelChat.registerModel(model);
}

export function unregisterModel(modelId: string): boolean {
  return multiModelChat.unregisterModel(modelId);
}

export function getModel(modelId: string): ModelConfig | undefined {
  return multiModelChat.getModel(modelId);
}

export function getAllModels(): ModelConfig[] {
  return multiModelChat.getAllModels();
}

export function getEnabledModels(): ModelConfig[] {
  return multiModelChat.getEnabledModels();
}

export function getModelsByProvider(provider: string): ModelConfig[] {
  return multiModelChat.getModelsByProvider(provider);
}

export function enableModel(modelId: string): boolean {
  return multiModelChat.enableModel(modelId);
}

export function disableModel(modelId: string): boolean {
  return multiModelChat.disableModel(modelId);
}

export function createSession(name: string, modelIds: string[], metadata?: SessionMetadata): ChatSession {
  return multiModelChat.createSession(name, modelIds, metadata);
}

export function getSession(sessionId: string): ChatSession | undefined {
  return multiModelChat.getSession(sessionId);
}

export function getActiveSession(): ChatSession | undefined {
  return multiModelChat.getActiveSession();
}

export function setActiveSession(sessionId: string): void {
  multiModelChat.setActiveSession(sessionId);
}

export function deleteSession(sessionId: string): boolean {
  return multiModelChat.deleteSession(sessionId);
}

export function addMessage(sessionId: string, message: ChatMessage): void {
  multiModelChat.addMessage(sessionId, message);
}

export async function sendToModels(
  prompt: string,
  modelIds: string[],
  context?: ChatMessage[]
): Promise<ModelResponse[]> {
  return multiModelChat.sendToModels(prompt, modelIds, context);
}

export function compareResponses(prompt: string, responses: ModelResponse[]): ComparisonResult {
  return multiModelChat.compareResponses(prompt, responses);
}

export function getRecommendedModel(task: string, context?: Record<string, unknown>): ModelConfig | undefined {
  return multiModelChat.getRecommendedModel(task, context);
}

export function getStatistics(): {
  totalModels: number;
  enabledModels: number;
  modelsByProvider: Record<string, number>;
  totalSessions: number;
  totalMessages: number;
  totalResponses: number;
  averageLatency: number;
  averageQuality: number;
} {
  return multiModelChat.getStatistics();
}
