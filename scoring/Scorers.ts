/**
 * Scorers
 * Inspired by Mastra's evaluation system for model-graded, rule-based, and statistical evaluation
 * Provides performance tracking, custom evals, and quality measurement over time
 */

export interface Scorer {
  id: string;
  name: string;
  description: string;
  type: ScorerType;
  config: ScorerConfig;
  enabled: boolean;
  metadata: ScorerMetadata;
}

export type ScorerType =
  | 'model_graded'
  | 'rule_based'
  | 'statistical'
  | 'custom'
  | 'semantic_similarity'
  | 'code_quality'
  | 'accuracy'
  | 'relevance'
  | 'coherence'
  | 'safety';

export interface ScorerConfig {
  threshold?: number;
  weights?: Record<string, number>;
  rules?: EvaluationRule[];
  model?: string;
  parameters?: Record<string, unknown>;
  comparisonMethod?: ComparisonMethod;
}

export type ComparisonMethod = 'absolute' | 'relative' | 'threshold' | 'ranking';

export interface EvaluationRule {
  id: string;
  name: string;
  condition: string;
  weight: number;
  description: string;
}

export interface ScorerMetadata {
  version: string;
  author: string;
  createdAt: number;
  updatedAt: number;
  evaluationCount: number;
  averageScore: number;
  lastEvaluated?: number;
  tags: string[];
}

export interface Evaluation {
  id: string;
  scorerId: string;
  scorerName: string;
  input: EvaluationInput;
  output: EvaluationOutput;
  expected?: EvaluationOutput;
  score: number;
  passed: boolean;
  details: EvaluationDetails;
  timestamp: number;
  metadata: EvaluationMetadata;
}

export interface EvaluationInput {
  content: string;
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface EvaluationOutput {
  content: string;
  metadata?: Record<string, unknown>;
}

export interface EvaluationDetails {
  ruleScores?: Record<string, number>;
  violations?: string[];
  suggestions?: string[];
  confidence: number;
  reasoning?: string;
}

export interface EvaluationMetadata {
  userId?: string;
  sessionId?: string;
  projectId?: string;
  model?: string;
  prompt?: string;
  duration?: number;
}

export interface EvaluationBatch {
  id: string;
  name: string;
  description: string;
  evaluations: Evaluation[];
  summary: BatchSummary;
  createdAt: number;
  completedAt?: number;
  status: BatchStatus;
}

export type BatchStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface BatchSummary {
  totalEvaluations: number;
  completedEvaluations: number;
  passedEvaluations: number;
  failedEvaluations: number;
  averageScore: number;
  minScore: number;
  maxScore: number;
  duration: number;
}

export interface PerformanceMetrics {
  scorerId: string;
  scorerName: string;
  totalEvaluations: number;
  averageScore: number;
  passRate: number;
  trend: 'improving' | 'declining' | 'stable';
  trendScore: number;
  lastEvaluationTime: number;
  evaluationHistory: Evaluation[];
}

class ScorerManager {
  private scorers: Map<string, Scorer> = new Map();
  private evaluations: Map<string, Evaluation> = new Map();
  private batches: Map<string, EvaluationBatch> = new Map();
  private evaluationHistory: Evaluation[] = [];
  private maxHistorySize: number = 10000;

  /**
   * Register a scorer
   */
  registerScorer(scorer: Scorer): void {
    this.scorers.set(scorer.id, scorer);
  }

  /**
   * Unregister a scorer
   */
  unregisterScorer(scorerId: string): boolean {
    return this.scorers.delete(scorerId);
  }

  /**
   * Get a scorer
   */
  getScorer(scorerId: string): Scorer | undefined {
    return this.scorers.get(scorerId);
  }

  /**
   * Get all scorers
   */
  getAllScorers(): Scorer[] {
    return Array.from(this.scorers.values());
  }

  /**
   * Get scorers by type
   */
  getScorersByType(type: ScorerType): Scorer[] {
    return this.getAllScorers().filter(s => s.type === type);
  }

  /**
   * Get enabled scorers
   */
  getEnabledScorers(): Scorer[] {
    return this.getAllScorers().filter(s => s.enabled);
  }

  /**
   * Enable a scorer
   */
  enableScorer(scorerId: string): boolean {
    const scorer = this.scorers.get(scorerId);
    if (!scorer) return false;

    scorer.enabled = true;
    scorer.metadata.updatedAt = Date.now();
    return true;
  }

  /**
   * Disable a scorer
   */
  disableScorer(scorerId: string): boolean {
    const scorer = this.scorers.get(scorerId);
    if (!scorer) return false;

    scorer.enabled = false;
    scorer.metadata.updatedAt = Date.now();
    return true;
  }

  /**
   * Evaluate using a scorer
   */
  async evaluate(
    scorerId: string,
    input: EvaluationInput,
    output: EvaluationOutput,
    expected?: EvaluationOutput,
    metadata?: EvaluationMetadata
  ): Promise<Evaluation> {
    const scorer = this.scorers.get(scorerId);
    if (!scorer) {
      throw new Error(`Scorer ${scorerId} not found`);
    }

    const evaluationId = this.generateEvaluationId();
    let score = 0;
    let passed = false;
    const details: EvaluationDetails = {
      confidence: 0,
    };

    switch (scorer.type) {
      case 'model_graded':
        const modelResult = await this.evaluateModelGraded(scorer, input, output, expected);
        score = modelResult.score;
        passed = modelResult.passed;
        details.ruleScores = modelResult.ruleScores;
        details.reasoning = modelResult.reasoning;
        details.confidence = modelResult.confidence;
        break;

      case 'rule_based':
        const ruleResult = this.evaluateRuleBased(scorer, input, output);
        score = ruleResult.score;
        passed = ruleResult.passed;
        details.ruleScores = ruleResult.ruleScores;
        details.violations = ruleResult.violations;
        details.suggestions = ruleResult.suggestions;
        details.confidence = ruleResult.confidence;
        break;

      case 'statistical':
        const statResult = this.evaluateStatistical(scorer, input, output);
        score = statResult.score;
        passed = statResult.passed;
        details.confidence = statResult.confidence;
        break;

      case 'semantic_similarity':
        const semanticResult = await this.evaluateSemanticSimilarity(scorer, input, output, expected);
        score = semanticResult.score;
        passed = semanticResult.passed;
        details.confidence = semanticResult.confidence;
        break;

      case 'code_quality':
        const codeResult = this.evaluateCodeQuality(scorer, input, output);
        score = codeResult.score;
        passed = codeResult.passed;
        details.violations = codeResult.violations;
        details.suggestions = codeResult.suggestions;
        details.confidence = codeResult.confidence;
        break;

      default:
        const customResult = await this.evaluateCustom(scorer, input, output);
        score = customResult.score;
        passed = customResult.passed;
        details.confidence = customResult.confidence;
    }

    const evaluation: Evaluation = {
      id: evaluationId,
      scorerId,
      scorerName: scorer.name,
      input,
      output,
      expected,
      score,
      passed,
      details,
      timestamp: Date.now(),
      metadata: metadata || {},
    };

    this.evaluations.set(evaluationId, evaluation);
    this.addToHistory(evaluation);

    // Update scorer metadata
    scorer.metadata.evaluationCount++;
    scorer.metadata.lastEvaluated = Date.now();
    scorer.metadata.averageScore = this.calculateAverageScore(
      scorer.metadata.averageScore,
      scorer.metadata.evaluationCount,
      score
    );

    return evaluation;
  }

  /**
   * Evaluate using multiple scorers
   */
  async evaluateMultiple(
    scorerIds: string[],
    input: EvaluationInput,
    output: EvaluationOutput,
    expected?: EvaluationOutput,
    metadata?: EvaluationMetadata
  ): Promise<Evaluation[]> {
    const evaluations: Evaluation[] = [];

    for (const scorerId of scorerIds) {
      try {
        const evaluation = await this.evaluate(scorerId, input, output, expected, metadata);
        evaluations.push(evaluation);
      } catch (error) {
        console.error(`Evaluation failed for scorer ${scorerId}:`, error);
      }
    }

    return evaluations;
  }

  /**
   * Create an evaluation batch
   */
  createBatch(name: string, description: string): EvaluationBatch {
    const batch: EvaluationBatch = {
      id: this.generateBatchId(),
      name,
      description,
      evaluations: [],
      summary: {
        totalEvaluations: 0,
        completedEvaluations: 0,
        passedEvaluations: 0,
        failedEvaluations: 0,
        averageScore: 0,
        minScore: 0,
        maxScore: 0,
        duration: 0,
      },
      createdAt: Date.now(),
      status: 'pending',
    };

    this.batches.set(batch.id, batch);
    return batch;
  }

  /**
   * Run an evaluation batch
   */
  async runBatch(
    batchId: string,
    scorerId: string,
    testCases: Array<{ input: EvaluationInput; output: EvaluationOutput; expected?: EvaluationOutput }>
  ): Promise<EvaluationBatch> {
    const batch = this.batches.get(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    batch.status = 'running';
    batch.summary.totalEvaluations = testCases.length;

    const startTime = Date.now();
    const scores: number[] = [];

    for (const testCase of testCases) {
      try {
        const evaluation = await this.evaluate(
          scorerId,
          testCase.input,
          testCase.output,
          testCase.expected
        );
        batch.evaluations.push(evaluation);
        batch.summary.completedEvaluations++;
        scores.push(evaluation.score);

        if (evaluation.passed) {
          batch.summary.passedEvaluations++;
        } else {
          batch.summary.failedEvaluations++;
        }
      } catch (error) {
        console.error('Batch evaluation failed:', error);
        batch.summary.failedEvaluations++;
      }
    }

    batch.summary.duration = Date.now() - startTime;
    batch.summary.averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    batch.summary.minScore = scores.length > 0 ? Math.min(...scores) : 0;
    batch.summary.maxScore = scores.length > 0 ? Math.max(...scores) : 0;
    batch.status = 'completed';
    batch.completedAt = Date.now();

    return batch;
  }

  /**
   * Get an evaluation
   */
  getEvaluation(evaluationId: string): Evaluation | undefined {
    return this.evaluations.get(evaluationId);
  }

  /**
   * Get evaluations by scorer
   */
  getEvaluationsByScorer(scorerId: string): Evaluation[] {
    return Array.from(this.evaluations.values()).filter(e => e.scorerId === scorerId);
  }

  /**
   * Get all evaluations
   */
  getAllEvaluations(): Evaluation[] {
    return Array.from(this.evaluations.values());
  }

  /**
   * Get evaluation history
   */
  getEvaluationHistory(limit?: number): Evaluation[] {
    if (limit) {
      return this.evaluationHistory.slice(-limit);
    }
    return [...this.evaluationHistory];
  }

  /**
   * Get performance metrics for a scorer
   */
  getPerformanceMetrics(scorerId: string): PerformanceMetrics | undefined {
    const scorer = this.scorers.get(scorerId);
    if (!scorer) return undefined;

    const evaluations = this.getEvaluationsByScorer(scorerId);
    const totalEvaluations = evaluations.length;

    if (totalEvaluations === 0) {
      return {
        scorerId,
        scorerName: scorer.name,
        totalEvaluations: 0,
        averageScore: 0,
        passRate: 0,
        trend: 'stable',
        trendScore: 0,
        lastEvaluationTime: 0,
        evaluationHistory: [],
      };
    }

    const averageScore = evaluations.reduce((sum, e) => sum + e.score, 0) / totalEvaluations;
    const passedCount = evaluations.filter(e => e.passed).length;
    const passRate = passedCount / totalEvaluations;

    // Calculate trend
    const recentEvaluations = evaluations.slice(-20);
    const olderEvaluations = evaluations.slice(0, -20);
    const recentAverage = recentEvaluations.length > 0
      ? recentEvaluations.reduce((sum, e) => sum + e.score, 0) / recentEvaluations.length
      : averageScore;
    const olderAverage = olderEvaluations.length > 0
      ? olderEvaluations.reduce((sum, e) => sum + e.score, 0) / olderEvaluations.length
      : averageScore;

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    let trendScore = 0;

    if (recentAverage > olderAverage + 0.05) {
      trend = 'improving';
      trendScore = recentAverage - olderAverage;
    } else if (recentAverage < olderAverage - 0.05) {
      trend = 'declining';
      trendScore = olderAverage - recentAverage;
    }

    const lastEvaluationTime = evaluations[evaluations.length - 1].timestamp;

    return {
      scorerId,
      scorerName: scorer.name,
      totalEvaluations,
      averageScore,
      passRate,
      trend,
      trendScore,
      lastEvaluationTime,
      evaluationHistory: evaluations.slice(-100),
    };
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalScorers: number;
    enabledScorers: number;
    scorersByType: Record<ScorerType, number>;
    totalEvaluations: number;
    totalBatches: number;
    averageScore: number;
    passRate: number;
  } {
    const scorers = this.getAllScorers();
    const enabled = scorers.filter(s => s.enabled).length;

    const scorersByType: Record<ScorerType, number> = {} as any;
    for (const scorer of scorers) {
      scorersByType[scorer.type] = (scorersByType[scorer.type] || 0) + 1;
    }

    const evaluations = this.getAllEvaluations();
    const totalEvaluations = evaluations.length;
    const averageScore = totalEvaluations > 0
      ? evaluations.reduce((sum, e) => sum + e.score, 0) / totalEvaluations
      : 0;
    const passRate = totalEvaluations > 0
      ? evaluations.filter(e => e.passed).length / totalEvaluations
      : 0;

    return {
      totalScorers: scorers.length,
      enabledScorers: enabled,
      scorersByType,
      totalEvaluations,
      totalBatches: this.batches.size,
      averageScore,
      passRate,
    };
  }

  /**
   * Set max history size
   */
  setMaxHistorySize(size: number): void {
    this.maxHistorySize = size;
    this.trimHistory();
  }

  // Private methods

  private async evaluateModelGraded(
    scorer: Scorer,
    input: EvaluationInput,
    output: EvaluationOutput,
    expected?: EvaluationOutput
  ): Promise<{ score: number; passed: boolean; ruleScores: Record<string, number>; reasoning: string; confidence: number }> {
    // In a real implementation, this would use an LLM to grade the output
    const score = this.calculateSimilarity(output.content, expected?.content || '');
    const passed = score >= (scorer.config.threshold || 0.7);

    return {
      score,
      passed,
      ruleScores: { similarity: score },
      reasoning: 'Model-graded evaluation based on similarity to expected output',
      confidence: 0.8,
    };
  }

  private evaluateRuleBased(
    scorer: Scorer,
    input: EvaluationInput,
    output: EvaluationOutput
  ): { score: number; passed: boolean; ruleScores: Record<string, number>; violations: string[]; suggestions: string[]; confidence: number } {
    const ruleScores: Record<string, number> = {};
    const violations: string[] = [];
    const suggestions: string[] = [];
    let totalScore = 0;
    let totalWeight = 0;

    if (scorer.config.rules) {
      for (const rule of scorer.config.rules) {
        const passed = this.evaluateRule(rule, input, output);
        ruleScores[rule.id] = passed ? 1 : 0;
        totalScore += (passed ? 1 : 0) * rule.weight;
        totalWeight += rule.weight;

        if (!passed) {
          violations.push(`Rule ${rule.name} failed: ${rule.description}`);
          suggestions.push(`Fix: ${rule.description}`);
        }
      }
    }

    const score = totalWeight > 0 ? totalScore / totalWeight : 0;
    const passed = score >= (scorer.config.threshold || 0.7);

    return {
      score,
      passed,
      ruleScores,
      violations,
      suggestions,
      confidence: 0.9,
    };
  }

  private evaluateStatistical(
    scorer: Scorer,
    input: EvaluationInput,
    output: EvaluationOutput
  ): { score: number; passed: boolean; confidence: number } {
    // Calculate basic statistics
    const outputLength = output.content.length;
    const inputLength = input.content.length;
    const lengthRatio = outputLength / Math.max(inputLength, 1);

    // Score based on length ratio (ideal is around 1-2)
    let score = 1 - Math.abs(lengthRatio - 1.5) / 2;
    score = Math.max(0, Math.min(1, score));

    const passed = score >= (scorer.config.threshold || 0.5);

    return {
      score,
      passed,
      confidence: 0.7,
    };
  }

  private async evaluateSemanticSimilarity(
    scorer: Scorer,
    input: EvaluationInput,
    output: EvaluationOutput,
    expected?: EvaluationOutput
  ): Promise<{ score: number; passed: boolean; confidence: number }> {
    if (!expected) {
      return { score: 1, passed: true, confidence: 0.5 };
    }

    const similarity = this.calculateSimilarity(output.content, expected.content);
    const passed = similarity >= (scorer.config.threshold || 0.7);

    return {
      score: similarity,
      passed,
      confidence: 0.8,
    };
  }

  private evaluateCodeQuality(
    scorer: Scorer,
    input: EvaluationInput,
    output: EvaluationOutput
  ): { score: number; passed: boolean; violations: string[]; suggestions: string[]; confidence: number } {
    const violations: string[] = [];
    const suggestions: string[] = [];
    let score = 1;

    // Check for common code quality issues
    if (output.content.includes('console.log')) {
      violations.push('Contains console.log statements');
      suggestions.push('Remove console.log statements in production code');
      score -= 0.1;
    }

    if (output.content.includes('var ')) {
      violations.push('Uses var instead of const/let');
      suggestions.push('Use const or let instead of var');
      score -= 0.1;
    }

    if (!output.content.includes('return') && output.content.includes('function')) {
      violations.push('Function may be missing return statement');
      suggestions.push('Ensure functions have proper return statements');
      score -= 0.2;
    }

    score = Math.max(0, score);
    const passed = score >= (scorer.config.threshold || 0.7);

    return {
      score,
      passed,
      violations,
      suggestions,
      confidence: 0.8,
    };
  }

  private async evaluateCustom(
    scorer: Scorer,
    input: EvaluationInput,
    output: EvaluationOutput
  ): Promise<{ score: number; passed: boolean; confidence: number }> {
    // In a real implementation, this would execute custom evaluation logic
    return {
      score: 0.8,
      passed: true,
      confidence: 0.5,
    };
  }

  private evaluateRule(rule: EvaluationRule, input: EvaluationInput, output: EvaluationOutput): boolean {
    // Simple rule evaluation - in a real implementation, this would be more sophisticated
    const condition = rule.condition.toLowerCase();
    const content = output.content.toLowerCase();

    if (condition.includes('contains')) {
      const term = condition.split('contains')[1].trim();
      return content.includes(term);
    }

    if (condition.includes('length')) {
      const length = output.content.length;
      if (condition.includes('>')) {
        const threshold = parseInt(condition.split('>')[1]);
        return length > threshold;
      }
      if (condition.includes('<')) {
        const threshold = parseInt(condition.split('<')[1]);
        return length < threshold;
      }
    }

    return true;
  }

  private calculateSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0;

    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);

    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];

    return intersection.length / union.length;
  }

  private calculateAverageScore(current: number, count: number, newScore: number): number {
    if (count === 1) return newScore;
    return (current * (count - 1) + newScore) / count;
  }

  private addToHistory(evaluation: Evaluation): void {
    this.evaluationHistory.push(evaluation);
    this.trimHistory();
  }

  private trimHistory(): void {
    if (this.evaluationHistory.length > this.maxHistorySize) {
      this.evaluationHistory = this.evaluationHistory.slice(-this.maxHistorySize);
    }
  }

  private generateEvaluationId(): string {
    return `eval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBatchId(): string {
    return `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Global scorer manager instance
const scorerManager = new ScorerManager();

export function registerScorer(scorer: Scorer): void {
  scorerManager.registerScorer(scorer);
}

export function unregisterScorer(scorerId: string): boolean {
  return scorerManager.unregisterScorer(scorerId);
}

export function getScorer(scorerId: string): Scorer | undefined {
  return scorerManager.getScorer(scorerId);
}

export function getAllScorers(): Scorer[] {
  return scorerManager.getAllScorers();
}

export function getScorersByType(type: ScorerType): Scorer[] {
  return scorerManager.getScorersByType(type);
}

export function getEnabledScorers(): Scorer[] {
  return scorerManager.getEnabledScorers();
}

export function enableScorer(scorerId: string): boolean {
  return scorerManager.enableScorer(scorerId);
}

export function disableScorer(scorerId: string): boolean {
  return scorerManager.disableScorer(scorerId);
}

export async function evaluate(
  scorerId: string,
  input: EvaluationInput,
  output: EvaluationOutput,
  expected?: EvaluationOutput,
  metadata?: EvaluationMetadata
): Promise<Evaluation> {
  return scorerManager.evaluate(scorerId, input, output, expected, metadata);
}

export async function evaluateMultiple(
  scorerIds: string[],
  input: EvaluationInput,
  output: EvaluationOutput,
  expected?: EvaluationOutput,
  metadata?: EvaluationMetadata
): Promise<Evaluation[]> {
  return scorerManager.evaluateMultiple(scorerIds, input, output, expected, metadata);
}

export function createBatch(name: string, description: string): EvaluationBatch {
  return scorerManager.createBatch(name, description);
}

export async function runBatch(
  batchId: string,
  scorerId: string,
  testCases: Array<{ input: EvaluationInput; output: EvaluationOutput; expected?: EvaluationOutput }>
): Promise<EvaluationBatch> {
  return scorerManager.runBatch(batchId, scorerId, testCases);
}

export function getEvaluation(evaluationId: string): Evaluation | undefined {
  return scorerManager.getEvaluation(evaluationId);
}

export function getEvaluationsByScorer(scorerId: string): Evaluation[] {
  return scorerManager.getEvaluationsByScorer(scorerId);
}

export function getAllEvaluations(): Evaluation[] {
  return scorerManager.getAllEvaluations();
}

export function getEvaluationHistory(limit?: number): Evaluation[] {
  return scorerManager.getEvaluationHistory(limit);
}

export function getPerformanceMetrics(scorerId: string): PerformanceMetrics | undefined {
  return scorerManager.getPerformanceMetrics(scorerId);
}

export function getStatistics(): {
  totalScorers: number;
  enabledScorers: number;
  scorersByType: Record<ScorerType, number>;
  totalEvaluations: number;
  totalBatches: number;
  averageScore: number;
  passRate: number;
} {
  return scorerManager.getStatistics();
}

export function setMaxHistorySize(size: number): void {
  scorerManager.setMaxHistorySize(size);
}
