/**
 * Tovyr Theory-of-Mind Module
 * Inspired by OpenHands' theory-of-mind capabilities for AI agents
 * Enables agents to model and reason about other agents' mental states, beliefs, and intentions
 */

export interface TheoryOfMindModule {
  id: string;
  config: ToMConfig;
  mentalModels: Map<string, MentalModel>;
  beliefs: Map<string, Belief>;
  intentions: Map<string, Intention>;
  predictions: Map<string, Prediction>;
  statistics: ToMStatistics;
  metadata: ToMMetadata;
}

export interface ToMConfig {
  enableBeliefTracking: boolean;
  enableIntentionInference: boolean;
  enablePrediction: boolean;
  enableEmpathy: boolean;
  maxMentalModels: number;
  beliefDecayRate: number;
  confidenceThreshold: number;
  updateFrequency: number;
}

export interface MentalModel {
  id: string;
  agentId: string;
  beliefs: Map<string, Belief>;
  intentions: Map<string, Intention>;
  traits: AgentTraits;
  state: AgentState;
  confidence: number;
  lastUpdated: number;
}

export interface Belief {
  id: string;
  subject: string;
  predicate: string;
  confidence: number;
  source: BeliefSource;
  timestamp: number;
  decay: number;
}

export type BeliefSource = 'observation' | 'inference' | 'communication' | 'assumption';

export interface Intention {
  id: string;
  agentId: string;
  goal: string;
  actions: string[];
  priority: IntentionPriority;
  confidence: number;
  estimatedDuration: number;
  timestamp: number;
}

export type IntentionPriority = 'low' | 'medium' | 'high' | 'critical';

export interface AgentTraits {
  cooperativeness: number;
  honesty: number;
  competence: number;
  riskTolerance: number;
  communicationStyle: CommunicationStyle;
}

export type CommunicationStyle = 'direct' | 'indirect' | 'formal' | 'casual' | 'technical';

export interface AgentState {
  knowledge: Set<string>;
  goals: Set<string>;
  emotions: Map<string, number>;
  resources: Map<string, number>;
}

export interface Prediction {
  id: string;
  agentId: string;
  prediction: string;
  confidence: number;
  evidence: string[];
  timestamp: number;
  expiresAt: number;
}

export interface ToMStatistics {
  totalMentalModels: number;
  totalBeliefs: number;
  totalIntentions: number;
  totalPredictions: number;
  correctPredictions: number;
  incorrectPredictions: number;
  averageConfidence: number;
  updateCount: number;
}

export interface ToMMetadata {
  version: string;
  createdAt: number;
  updatedAt: number;
  totalOperations: number;
}

export interface ToMQuery {
  type: QueryType;
  agentId?: string;
  subject?: string;
  predicate?: string;
  timeRange?: TimeRange;
}

export type QueryType = 'beliefs' | 'intentions' | 'predictions' | 'traits' | 'state';

export interface TimeRange {
  start: number;
  end: number;
}

export interface ToMResult {
  success: boolean;
  data?: unknown;
  confidence: number;
  evidence: string[];
}

class TheoryOfMindManager {
  private modules: Map<string, TheoryOfMindModule> = new Map();

  /**
   * Create a theory-of-mind module
   */
  createModule(config?: Partial<ToMConfig>): TheoryOfMindModule {
    const module: TheoryOfMindModule = {
      id: this.generateModuleId(),
      config: {
        enableBeliefTracking: config?.enableBeliefTracking ?? true,
        enableIntentionInference: config?.enableIntentionInference ?? true,
        enablePrediction: config?.enablePrediction ?? true,
        enableEmpathy: config?.enableEmpathy ?? false,
        maxMentalModels: config?.maxMentalModels || 100,
        beliefDecayRate: config?.beliefDecayRate || 0.01,
        confidenceThreshold: config?.confidenceThreshold || 0.5,
        updateFrequency: config?.updateFrequency || 60000,
      },
      mentalModels: new Map(),
      beliefs: new Map(),
      intentions: new Map(),
      predictions: new Map(),
      statistics: {
        totalMentalModels: 0,
        totalBeliefs: 0,
        totalIntentions: 0,
        totalPredictions: 0,
        correctPredictions: 0,
        incorrectPredictions: 0,
        averageConfidence: 0,
        updateCount: 0,
      },
      metadata: {
        version: '1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        totalOperations: 0,
      },
    };

    this.modules.set(module.id, module);
    return module;
  }

  /**
   * Get a module
   */
  getModule(moduleId: string): TheoryOfMindModule | undefined {
    return this.modules.get(moduleId);
  }

  /**
   * Get all modules
   */
  getAllModules(): TheoryOfMindModule[] {
    return Array.from(this.modules.values());
  }

  /**
   * Delete a module
   */
  deleteModule(moduleId: string): boolean {
    return this.modules.delete(moduleId);
  }

  /**
   * Create a mental model for an agent
   */
  createMentalModel(moduleId: string, agentId: string, traits?: Partial<AgentTraits>): MentalModel | undefined {
    const module = this.modules.get(moduleId);
    if (!module) return undefined;

    if (module.mentalModels.size >= module.config.maxMentalModels) {
      return undefined;
    }

    const mentalModel: MentalModel = {
      id: this.generateMentalModelId(),
      agentId,
      beliefs: new Map(),
      intentions: new Map(),
      traits: {
        cooperativeness: traits?.cooperativeness ?? 0.5,
        honesty: traits?.honesty ?? 0.5,
        competence: traits?.competence ?? 0.5,
        riskTolerance: traits?.riskTolerance ?? 0.5,
        communicationStyle: traits?.communicationStyle || 'direct',
      },
      state: {
        knowledge: new Set(),
        goals: new Set(),
        emotions: new Map(),
        resources: new Map(),
      },
      confidence: 0.5,
      lastUpdated: Date.now(),
    };

    module.mentalModels.set(mentalModel.id, mentalModel);
    module.statistics.totalMentalModels++;
    module.metadata.totalOperations++;

    return mentalModel;
  }

  /**
   * Get a mental model
   */
  getMentalModel(moduleId: string, modelId: string): MentalModel | undefined {
    const module = this.modules.get(moduleId);
    if (!module) return undefined;

    return module.mentalModels.get(modelId);
  }

  /**
   * Get mental model by agent ID
   */
  getMentalModelByAgent(moduleId: string, agentId: string): MentalModel | undefined {
    const module = this.modules.get(moduleId);
    if (!module) return undefined;

    for (const model of module.mentalModels.values()) {
      if (model.agentId === agentId) {
        return model;
      }
    }

    return undefined;
  }

  /**
   * Add a belief to a mental model
   */
  addBelief(moduleId: string, modelId: string, belief: Belief): boolean {
    const module = this.modules.get(moduleId);
    if (!module || !module.config.enableBeliefTracking) return false;

    const model = module.mentalModels.get(modelId);
    if (!model) return false;

    model.beliefs.set(belief.id, belief);
    module.beliefs.set(belief.id, belief);
    model.lastUpdated = Date.now();
    module.statistics.totalBeliefs++;
    module.metadata.totalOperations++;

    return true;
  }

  /**
   * Update a belief
   */
  updateBelief(moduleId: string, beliefId: string, confidence: number): boolean {
    const module = this.modules.get(moduleId);
    if (!module) return false;

    const belief = module.beliefs.get(beliefId);
    if (!belief) return false;

    belief.confidence = confidence;
    belief.timestamp = Date.now();

    for (const model of module.mentalModels.values()) {
      if (model.beliefs.has(beliefId)) {
        model.lastUpdated = Date.now();
      }
    }

    module.metadata.totalOperations++;

    return true;
  }

  /**
   * Decay beliefs
   */
  decayBeliefs(moduleId: string): number {
    const module = this.modules.get(moduleId);
    if (!module) return 0;

    let decayed = 0;
    const decayRate = module.config.beliefDecayRate;

    for (const belief of module.beliefs.values()) {
      belief.confidence = Math.max(0, belief.confidence - decayRate);
      belief.decay += decayRate;

      if (belief.confidence < module.config.confidenceThreshold) {
        // Remove from mental models
        for (const model of module.mentalModels.values()) {
          model.beliefs.delete(belief.id);
        }
        module.beliefs.delete(belief.id);
        decayed++;
      }
    }

    if (decayed > 0) {
      module.metadata.totalOperations++;
    }

    return decayed;
  }

  /**
   * Infer intention from observations
   */
  inferIntention(moduleId: string, agentId: string, observations: string[]): Intention | undefined {
    const module = this.modules.get(moduleId);
    if (!module || !module.config.enableIntentionInference) return undefined;

    const model = this.getMentalModelByAgent(moduleId, agentId);
    if (!model) return undefined;

    // Simple intention inference based on observations
    const goal = this.extractGoalFromObservations(observations);
    const actions = this.extractActionsFromObservations(observations);

    const intention: Intention = {
      id: this.generateIntentionId(),
      agentId,
      goal,
      actions,
      priority: this.determinePriority(observations, model.traits),
      confidence: this.calculateConfidence(observations, model),
      estimatedDuration: this.estimateDuration(actions),
      timestamp: Date.now(),
    };

    model.intentions.set(intention.id, intention);
    module.intentions.set(intention.id, intention);
    model.lastUpdated = Date.now();
    module.statistics.totalIntentions++;
    module.metadata.totalOperations++;

    return intention;
  }

  /**
   * Make a prediction about an agent's behavior
   */
  makePrediction(moduleId: string, agentId: string, context: string): Prediction | undefined {
    const module = this.modules.get(moduleId);
    if (!module || !module.config.enablePrediction) return undefined;

    const model = this.getMentalModelByAgent(moduleId, agentId);
    if (!model) return undefined;

    // Generate prediction based on mental model
    const prediction = this.generatePrediction(model, context);
    const evidence = this.gatherEvidence(model, context);
    const confidence = this.calculatePredictionConfidence(model, evidence);

    const predictionObj: Prediction = {
      id: this.generatePredictionId(),
      agentId,
      prediction,
      confidence,
      evidence,
      timestamp: Date.now(),
      expiresAt: Date.now() + 3600000, // 1 hour
    };

    module.predictions.set(predictionObj.id, predictionObj);
    module.statistics.totalPredictions++;
    module.metadata.totalOperations++;

    return predictionObj;
  }

  /**
   * Validate a prediction
   */
  validatePrediction(moduleId: string, predictionId: string, actualOutcome: string): boolean {
    const module = this.modules.get(moduleId);
    if (!module) return false;

    const prediction = module.predictions.get(predictionId);
    if (!prediction) return false;

    const isCorrect = this.comparePrediction(prediction.prediction, actualOutcome);

    if (isCorrect) {
      module.statistics.correctPredictions++;
    } else {
      module.statistics.incorrectPredictions++;
    }

    module.predictions.delete(predictionId);
    module.metadata.totalOperations++;

    return isCorrect;
  }

  /**
   * Update agent traits based on observations
   */
  updateTraits(moduleId: string, modelId: string, observations: string[]): boolean {
    const module = this.modules.get(moduleId);
    if (!module) return false;

    const model = module.mentalModels.get(modelId);
    if (!model) return false;

    // Update traits based on observations
    model.traits.cooperativeness = this.updateTrait(model.traits.cooperativeness, observations, 'cooperativeness');
    model.traits.honesty = this.updateTrait(model.traits.honesty, observations, 'honesty');
    model.traits.competence = this.updateTrait(model.traits.competence, observations, 'competence');
    model.traits.riskTolerance = this.updateTrait(model.traits.riskTolerance, observations, 'riskTolerance');

    model.lastUpdated = Date.now();
    module.metadata.totalOperations++;

    return true;
  }

  /**
   * Query the theory-of-mind module
   */
  query(moduleId: string, query: ToMQuery): ToMResult {
    const module = this.modules.get(moduleId);
    if (!module) {
      return {
        success: false,
        confidence: 0,
        evidence: [],
      };
    }

    const result = this.executeQuery(module, query);
    module.statistics.updateCount++;
    module.metadata.totalOperations++;

    return result;
  }

  /**
   * Get statistics for a module
   */
  getStatistics(moduleId: string): ToMStatistics | undefined {
    const module = this.modules.get(moduleId);
    if (!module) return undefined;

    // Calculate average confidence
    const totalPredictions = module.statistics.correctPredictions + module.statistics.incorrectPredictions;
    module.statistics.averageConfidence = totalPredictions > 0
      ? module.statistics.correctPredictions / totalPredictions
      : 0;

    return { ...module.statistics };
  }

  /**
   * Reset statistics for a module
   */
  resetStatistics(moduleId: string): boolean {
    const module = this.modules.get(moduleId);
    if (!module) return false;

    module.statistics = {
      totalMentalModels: module.mentalModels.size,
      totalBeliefs: module.beliefs.size,
      totalIntentions: module.intentions.size,
      totalPredictions: module.predictions.size,
      correctPredictions: 0,
      incorrectPredictions: 0,
      averageConfidence: 0,
      updateCount: 0,
    };

    module.metadata.updatedAt = Date.now();

    return true;
  }

  // Private methods

  private extractGoalFromObservations(observations: string[]): string {
    // Simple goal extraction - in real implementation, use NLP
    const keywords = observations.join(' ').toLowerCase();
    if (keywords.includes('fix') || keywords.includes('repair')) return 'Fix issues';
    if (keywords.includes('create') || keywords.includes('build')) return 'Create something';
    if (keywords.includes('learn') || keywords.includes('understand')) return 'Learn something';
    if (keywords.includes('help') || keywords.includes('assist')) return 'Help others';
    return 'General task';
  }

  private extractActionsFromObservations(observations: string[]): string[] {
    // Extract actions from observations
    return observations.filter(obs => {
      const lower = obs.toLowerCase();
      return lower.startsWith('will') || lower.startsWith('going to') || lower.includes('plan');
    });
  }

  private determinePriority(observations: string[], traits: AgentTraits): IntentionPriority {
    const keywords = observations.join(' ').toLowerCase();
    if (keywords.includes('urgent') || keywords.includes('critical')) return 'critical';
    if (keywords.includes('important') || keywords.includes('priority')) return 'high';
    if (traits.riskTolerance > 0.7) return 'high';
    if (traits.riskTolerance < 0.3) return 'low';
    return 'medium';
  }

  private calculateConfidence(observations: string[], model: MentalModel): number {
    // Confidence based on number of observations and model confidence
    const observationCount = observations.length;
    const baseConfidence = Math.min(1, observationCount / 10);
    return (baseConfidence + model.confidence) / 2;
  }

  private estimateDuration(actions: string[]): number {
    // Simple duration estimation based on action count
    return actions.length * 60000; // 1 minute per action
  }

  private generatePrediction(model: MentalModel, context: string): string {
    // Generate prediction based on model traits and state
    if (model.traits.cooperativeness > 0.7) {
      return 'Agent will likely cooperate and help';
    }
    if (model.traits.riskTolerance > 0.7) {
      return 'Agent will likely take bold actions';
    }
    if (model.traits.honesty > 0.7) {
      return 'Agent will likely be truthful and transparent';
    }
    return 'Agent will likely act according to established patterns';
  }

  private gatherEvidence(model: MentalModel, context: string): string[] {
    const evidence: string[] = [];

    // Gather evidence from beliefs
    for (const belief of model.beliefs.values()) {
      if (belief.confidence > 0.7) {
        evidence.push(`Belief: ${belief.subject} ${belief.predicate}`);
      }
    }

    // Gather evidence from intentions
    for (const intention of model.intentions.values()) {
      if (intention.confidence > 0.7) {
        evidence.push(`Intention: ${intention.goal}`);
      }
    }

    return evidence;
  }

  private calculatePredictionConfidence(model: MentalModel, evidence: string[]): number {
    // Confidence based on evidence count and model confidence
    const evidenceConfidence = Math.min(1, evidence.length / 5);
    return (evidenceConfidence + model.confidence) / 2;
  }

  private comparePrediction(prediction: string, actualOutcome: string): boolean {
    // Simple comparison - in real implementation, use semantic similarity
    const lowerPrediction = prediction.toLowerCase();
    const lowerOutcome = actualOutcome.toLowerCase();
    return lowerPrediction.includes(lowerOutcome) || lowerOutcome.includes(lowerPrediction);
  }

  private updateTrait(currentValue: number, observations: string[], trait: string): number {
    // Update trait based on observations
    const keywords = observations.join(' ').toLowerCase();
    let delta = 0;

    switch (trait) {
      case 'cooperativeness':
        if (keywords.includes('help') || keywords.includes('share')) delta = 0.1;
        if (keywords.includes('refuse') || keywords.includes('decline')) delta = -0.1;
        break;
      case 'honesty':
        if (keywords.includes('truth') || keywords.includes('honest')) delta = 0.1;
        if (keywords.includes('lie') || keywords.includes('deceive')) delta = -0.1;
        break;
      case 'competence':
        if (keywords.includes('success') || keywords.includes('complete')) delta = 0.1;
        if (keywords.includes('fail') || keywords.includes('error')) delta = -0.1;
        break;
      case 'riskTolerance':
        if (keywords.includes('bold') || keywords.includes('risk')) delta = 0.1;
        if (keywords.includes('safe') || keywords.includes('careful')) delta = -0.1;
        break;
    }

    return Math.max(0, Math.min(1, currentValue + delta));
  }

  private executeQuery(module: TheoryOfMindModule, query: ToMQuery): ToMResult {
    const results: unknown[] = [];

    switch (query.type) {
      case 'beliefs':
        if (query.agentId) {
          const model = this.getMentalModelByAgent(module.id, query.agentId);
          if (model) {
            results.push(...Array.from(model.beliefs.values()));
          }
        } else {
          results.push(...Array.from(module.beliefs.values()));
        }
        break;

      case 'intentions':
        if (query.agentId) {
          const model = this.getMentalModelByAgent(module.id, query.agentId);
          if (model) {
            results.push(...Array.from(model.intentions.values()));
          }
        } else {
          results.push(...Array.from(module.intentions.values()));
        }
        break;

      case 'predictions':
        if (query.agentId) {
          for (const pred of module.predictions.values()) {
            if (pred.agentId === query.agentId) {
              results.push(pred);
            }
          }
        } else {
          results.push(...Array.from(module.predictions.values()));
        }
        break;

      case 'traits':
        if (query.agentId) {
          const model = this.getMentalModelByAgent(module.id, query.agentId);
          if (model) {
            results.push(model.traits);
          }
        }
        break;

      case 'state':
        if (query.agentId) {
          const model = this.getMentalModelByAgent(module.id, query.agentId);
          if (model) {
            results.push(model.state);
          }
        }
        break;
    }

    return {
      success: true,
      data: results,
      confidence: 0.8,
      evidence: [],
    };
  }

  private generateModuleId(): string {
    return `tom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMentalModelId(): string {
    return `model-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateIntentionId(): string {
    return `intent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generatePredictionId(): string {
    return `pred-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Helper functions
export function createBelief(
  subject: string,
  predicate: string,
  confidence: number,
  source: BeliefSource
): Belief {
  return {
    id: `belief-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    subject,
    predicate,
    confidence,
    source,
    timestamp: Date.now(),
    decay: 0,
  };
}

export function createAgentTraits(
  cooperativeness: number,
  honesty: number,
  competence: number,
  riskTolerance: number,
  communicationStyle: CommunicationStyle
): AgentTraits {
  return {
    cooperativeness,
    honesty,
    competence,
    riskTolerance,
    communicationStyle,
  };
}

export function createToMQuery(
  type: QueryType,
  agentId?: string,
  subject?: string,
  predicate?: string
): ToMQuery {
  return {
    type,
    agentId,
    subject,
    predicate,
  };
}

// Global theory-of-mind manager instance
const theoryOfMindManager = new TheoryOfMindManager();

export function createTheoryOfMindModule(config?: Partial<ToMConfig>): TheoryOfMindModule {
  return theoryOfMindManager.createModule(config);
}

export function getTheoryOfMindModule(moduleId: string): TheoryOfMindModule | undefined {
  return theoryOfMindManager.getModule(moduleId);
}

export function getAllTheoryOfMindModules(): TheoryOfMindModule[] {
  return theoryOfMindManager.getAllModules();
}

export function deleteTheoryOfMindModule(moduleId: string): boolean {
  return theoryOfMindManager.deleteModule(moduleId);
}

export function createMentalModel(moduleId: string, agentId: string, traits?: Partial<AgentTraits>): MentalModel | undefined {
  return theoryOfMindManager.createMentalModel(moduleId, agentId, traits);
}

export function getMentalModel(moduleId: string, modelId: string): MentalModel | undefined {
  return theoryOfMindManager.getMentalModel(moduleId, modelId);
}

export function getMentalModelByAgent(moduleId: string, agentId: string): MentalModel | undefined {
  return theoryOfMindManager.getMentalModelByAgent(moduleId, agentId);
}

export function addBelief(moduleId: string, modelId: string, belief: Belief): boolean {
  return theoryOfMindManager.addBelief(moduleId, modelId, belief);
}

export function updateBelief(moduleId: string, beliefId: string, confidence: number): boolean {
  return theoryOfMindManager.updateBelief(moduleId, beliefId, confidence);
}

export function decayBeliefs(moduleId: string): number {
  return theoryOfMindManager.decayBeliefs(moduleId);
}

export function inferIntention(moduleId: string, agentId: string, observations: string[]): Intention | undefined {
  return theoryOfMindManager.inferIntention(moduleId, agentId, observations);
}

export function makePrediction(moduleId: string, agentId: string, context: string): Prediction | undefined {
  return theoryOfMindManager.makePrediction(moduleId, agentId, context);
}

export function validatePrediction(moduleId: string, predictionId: string, actualOutcome: string): boolean {
  return theoryOfMindManager.validatePrediction(moduleId, predictionId, actualOutcome);
}

export function updateTraits(moduleId: string, modelId: string, observations: string[]): boolean {
  return theoryOfMindManager.updateTraits(moduleId, modelId, observations);
}

export function queryTheoryOfMind(moduleId: string, query: ToMQuery): ToMResult {
  return theoryOfMindManager.query(moduleId, query);
}

export function getToMStatistics(moduleId: string): ToMStatistics | undefined {
  return theoryOfMindManager.getStatistics(moduleId);
}

export function resetToMStatistics(moduleId: string): boolean {
  return theoryOfMindManager.resetStatistics(moduleId);
}
