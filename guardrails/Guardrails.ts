/**
 * Guardrails
 * Inspired by Mastra's input/output processing pipeline for safety
 * Provides prompt injection prevention, response sanitization, and safety filters
 */

export interface Guardrail {
  id: string;
  name: string;
  description: string;
  type: GuardrailType;
  phase: GuardrailPhase;
  config: GuardrailConfig;
  enabled: boolean;
  priority: number;
  metadata: GuardrailMetadata;
}

export type GuardrailType =
  | 'prompt_injection'
  | 'toxic_content'
  | 'pii_detection'
  | 'code_injection'
  | 'rate_limiting'
  | 'content_filtering'
  | 'output_sanitization'
  | 'custom';

export type GuardrailPhase = 'input' | 'output' | 'both';

export interface GuardrailConfig {
  sensitivity: 'low' | 'medium' | 'high' | 'strict';
  action: GuardrailAction;
  thresholds?: Record<string, number>;
  patterns?: string[];
  allowList?: string[];
  blockList?: string[];
  customRules?: CustomRule[];
}

export type GuardrailAction = 'allow' | 'block' | 'warn' | 'modify' | 'flag' | 'retry';

export interface CustomRule {
  id: string;
  name: string;
  pattern: string;
  action: GuardrailAction;
  description: string;
}

export interface GuardrailMetadata {
  version: string;
  author: string;
  createdAt: number;
  updatedAt: number;
  executionCount: number;
  violationCount: number;
  lastExecuted?: number;
  tags: string[];
}

export interface GuardrailResult {
  guardrailId: string;
  guardrailName: string;
  passed: boolean;
  action: GuardrailAction;
  violations: Violation[];
  modifiedContent?: string;
  metadata: ResultMetadata;
}

export interface Violation {
  ruleId: string;
  ruleName: string;
  severity: ViolationSeverity;
  message: string;
  location?: TextLocation;
  matchedPattern?: string;
}

export type ViolationSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface TextLocation {
  start: number;
  end: number;
  line?: number;
  column?: number;
}

export interface ResultMetadata {
  executionTime: number;
  confidence: number;
  timestamp: number;
}

export interface GuardrailPipelineResult {
  passed: boolean;
  action: GuardrailAction;
  results: GuardrailResult[];
  finalContent?: string;
  warnings: string[];
  metadata: PipelineMetadata;
}

export interface PipelineMetadata {
  totalGuardrails: number;
  executedGuardrails: number;
  passedGuardrails: number;
  failedGuardrails: number;
  totalExecutionTime: number;
  timestamp: number;
}

export interface ContentContext {
  userId?: string;
  sessionId?: string;
  projectId?: string;
  source: string;
  metadata?: Record<string, unknown>;
}

class GuardrailManager {
  private guardrails: Map<string, Guardrail> = new Map();
  private executionHistory: GuardrailResult[] = [];
  private maxHistorySize: number = 1000;

  /**
   * Register a guardrail
   */
  registerGuardrail(guardrail: Guardrail): void {
    this.guardrails.set(guardrail.id, guardrail);
  }

  /**
   * Unregister a guardrail
   */
  unregisterGuardrail(guardrailId: string): boolean {
    return this.guardrails.delete(guardrailId);
  }

  /**
   * Get a guardrail
   */
  getGuardrail(guardrailId: string): Guardrail | undefined {
    return this.guardrails.get(guardrailId);
  }

  /**
   * Get all guardrails
   */
  getAllGuardrails(): Guardrail[] {
    return Array.from(this.guardrails.values());
  }

  /**
   * Get guardrails by type
   */
  getGuardrailsByType(type: GuardrailType): Guardrail[] {
    return this.getAllGuardrails().filter(g => g.type === type);
  }

  /**
   * Get guardrails by phase
   */
  getGuardrailsByPhase(phase: GuardrailPhase): Guardrail[] {
    return this.getAllGuardrails().filter(g => g.phase === phase || g.phase === 'both');
  }

  /**
   * Get enabled guardrails
   */
  getEnabledGuardrails(): Guardrail[] {
    return this.getAllGuardrails().filter(g => g.enabled);
  }

  /**
   * Enable a guardrail
   */
  enableGuardrail(guardrailId: string): boolean {
    const guardrail = this.guardrails.get(guardrailId);
    if (!guardrail) return false;

    guardrail.enabled = true;
    guardrail.metadata.updatedAt = Date.now();
    return true;
  }

  /**
   * Disable a guardrail
   */
  disableGuardrail(guardrailId: string): boolean {
    const guardrail = this.guardrails.get(guardrailId);
    if (!guardrail) return false;

    guardrail.enabled = false;
    guardrail.metadata.updatedAt = Date.now();
    return true;
  }

  /**
   * Process content through guardrail pipeline
   */
  async processContent(
    content: string,
    phase: GuardrailPhase,
    context?: ContentContext
  ): Promise<GuardrailPipelineResult> {
    const startTime = Date.now();
    const guardrails = this.getGuardrailsByPhase(phase)
      .filter(g => g.enabled)
      .sort((a, b) => b.priority - a.priority);

    const results: GuardrailResult[] = [];
    let currentContent = content;
    let finalAction: GuardrailAction = 'allow';
    const warnings: string[] = [];

    for (const guardrail of guardrails) {
      const result = await this.executeGuardrail(guardrail, currentContent, context);
      results.push(result);

      // Update guardrail metadata
      guardrail.metadata.executionCount++;
      guardrail.metadata.lastExecuted = Date.now();
      if (!result.passed) {
        guardrail.metadata.violationCount++;
      }

      // Handle action
      if (!result.passed) {
        switch (result.action) {
          case 'block':
            finalAction = 'block';
            break;
          case 'warn':
            warnings.push(`Guardrail ${guardrail.name} triggered: ${result.violations[0]?.message}`);
            break;
          case 'modify':
            if (result.modifiedContent) {
              currentContent = result.modifiedContent;
            }
            break;
          case 'flag':
            warnings.push(`Content flagged by ${guardrail.name}`);
            break;
          case 'retry':
            // In a real implementation, this would trigger a retry
            warnings.push(`Retry triggered by ${guardrail.name}`);
            break;
        }

        if (result.action === 'block') {
          break;
        }
      }
    }

    const totalExecutionTime = Date.now() - startTime;

    return {
      passed: finalAction !== 'block',
      action: finalAction,
      results,
      finalContent: currentContent,
      warnings,
      metadata: {
        totalGuardrails: guardrails.length,
        executedGuardrails: results.length,
        passedGuardrails: results.filter(r => r.passed).length,
        failedGuardrails: results.filter(r => !r.passed).length,
        totalExecutionTime,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Execute a single guardrail
   */
  async executeGuardrail(
    guardrail: Guardrail,
    content: string,
    context?: ContentContext
  ): Promise<GuardrailResult> {
    const startTime = Date.now();
    const violations: Violation[] = [];
    let passed = true;
    let modifiedContent: string | undefined;

    switch (guardrail.type) {
      case 'prompt_injection':
        const injectionResult = this.checkPromptInjection(content, guardrail.config);
        violations.push(...injectionResult.violations);
        passed = injectionResult.passed;
        break;

      case 'toxic_content':
        const toxicResult = this.checkToxicContent(content, guardrail.config);
        violations.push(...toxicResult.violations);
        passed = toxicResult.passed;
        break;

      case 'pii_detection':
        const piiResult = this.checkPII(content, guardrail.config);
        violations.push(...piiResult.violations);
        passed = piiResult.passed;
        if (piiResult.modifiedContent) {
          modifiedContent = piiResult.modifiedContent;
        }
        break;

      case 'code_injection':
        const codeResult = this.checkCodeInjection(content, guardrail.config);
        violations.push(...codeResult.violations);
        passed = codeResult.passed;
        break;

      case 'content_filtering':
        const filterResult = this.checkContentFiltering(content, guardrail.config);
        violations.push(...filterResult.violations);
        passed = filterResult.passed;
        break;

      default:
        // Custom guardrail
        const customResult = this.checkCustomRules(content, guardrail.config);
        violations.push(...customResult.violations);
        passed = customResult.passed;
    }

    const executionTime = Date.now() - startTime;

    // Add to history
    const result: GuardrailResult = {
      guardrailId: guardrail.id,
      guardrailName: guardrail.name,
      passed,
      action: passed ? 'allow' : guardrail.config.action,
      violations,
      modifiedContent,
      metadata: {
        executionTime,
        confidence: this.calculateConfidence(violations),
        timestamp: Date.now(),
      },
    };

    this.addToHistory(result);

    return result;
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit?: number): GuardrailResult[] {
    if (limit) {
      return this.executionHistory.slice(-limit);
    }
    return [...this.executionHistory];
  }

  /**
   * Clear execution history
   */
  clearExecutionHistory(): void {
    this.executionHistory = [];
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalGuardrails: number;
    enabledGuardrails: number;
    guardrailsByType: Record<GuardrailType, number>;
    totalExecutions: number;
    totalViolations: number;
    violationRate: number;
    averageExecutionTime: number;
    mostViolatedGuardrails: Guardrail[];
  } {
    const guardrails = this.getAllGuardrails();
    const enabled = guardrails.filter(g => g.enabled).length;

    const guardrailsByType: Record<GuardrailType, number> = {} as any;
    for (const guardrail of guardrails) {
      guardrailsByType[guardrail.type] = (guardrailsByType[guardrail.type] || 0) + 1;
    }

    const totalExecutions = this.executionHistory.length;
    const totalViolations = this.executionHistory.filter(r => !r.passed).length;
    const violationRate = totalExecutions > 0 ? totalViolations / totalExecutions : 0;

    const averageExecutionTime = this.executionHistory.length > 0
      ? this.executionHistory.reduce((sum, r) => sum + r.metadata.executionTime, 0) / this.executionHistory.length
      : 0;

    const mostViolatedGuardrails = [...guardrails]
      .sort((a, b) => b.metadata.violationCount - a.metadata.violationCount)
      .slice(0, 5);

    return {
      totalGuardrails: guardrails.length,
      enabledGuardrails: enabled,
      guardrailsByType,
      totalExecutions,
      totalViolations,
      violationRate,
      averageExecutionTime,
      mostViolatedGuardrails,
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

  private checkPromptInjection(content: string, config: GuardrailConfig): { passed: boolean; violations: Violation[] } {
    const violations: Violation[] = [];
    const patterns = config.patterns || [
      'ignore previous instructions',
      'forget everything',
      'new instructions:',
      'system:',
      'developer mode',
      'override',
    ];

    const lowerContent = content.toLowerCase();
    for (const pattern of patterns) {
      if (lowerContent.includes(pattern.toLowerCase())) {
        violations.push({
          ruleId: 'prompt-injection',
          ruleName: 'Prompt Injection',
          severity: 'high',
          message: `Potential prompt injection detected: "${pattern}"`,
          matchedPattern: pattern,
        });
      }
    }

    return {
      passed: violations.length === 0,
      violations,
    };
  }

  private checkToxicContent(content: string, config: GuardrailConfig): { passed: boolean; violations: Violation[] } {
    const violations: Violation[] = [];
    const patterns = config.blockList || [
      'hate',
      'violence',
      'threat',
      'harassment',
    ];

    const lowerContent = content.toLowerCase();
    for (const pattern of patterns) {
      if (lowerContent.includes(pattern.toLowerCase())) {
        violations.push({
          ruleId: 'toxic-content',
          ruleName: 'Toxic Content',
          severity: 'high',
          message: `Toxic content detected: "${pattern}"`,
          matchedPattern: pattern,
        });
      }
    }

    return {
      passed: violations.length === 0,
      violations,
    };
  }

  private checkPII(content: string, config: GuardrailConfig): { passed: boolean; violations: Violation[]; modifiedContent?: string } {
    const violations: Violation[] = [];
    let modifiedContent = content;

    // Email pattern
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = content.match(emailPattern);
    if (emails) {
      for (const email of emails) {
        violations.push({
          ruleId: 'pii-email',
          ruleName: 'PII Detection',
          severity: 'medium',
          message: `Email address detected: "${email}"`,
        });
      }
      modifiedContent = content.replace(emailPattern, '[EMAIL_REDACTED]');
    }

    // Phone pattern
    const phonePattern = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
    const phones = content.match(phonePattern);
    if (phones) {
      for (const phone of phones) {
        violations.push({
          ruleId: 'pii-phone',
          ruleName: 'PII Detection',
          severity: 'medium',
          message: `Phone number detected: "${phone}"`,
        });
      }
      modifiedContent = modifiedContent.replace(phonePattern, '[PHONE_REDACTED]');
    }

    return {
      passed: violations.length === 0,
      violations,
      modifiedContent,
    };
  }

  private checkCodeInjection(content: string, config: GuardrailConfig): { passed: boolean; violations: Violation[] } {
    const violations: Violation[] = [];
    const patterns = config.patterns || [
      'eval(',
      'exec(',
      'system(',
      '__import__',
      'subprocess.',
      'os.system',
    ];

    for (const pattern of patterns) {
      if (content.includes(pattern)) {
        violations.push({
          ruleId: 'code-injection',
          ruleName: 'Code Injection',
          severity: 'critical',
          message: `Potential code injection detected: "${pattern}"`,
          matchedPattern: pattern,
        });
      }
    }

    return {
      passed: violations.length === 0,
      violations,
    };
  }

  private checkContentFiltering(content: string, config: GuardrailConfig): { passed: boolean; violations: Violation[] } {
    const violations: Violation[] = [];

    // Check block list
    if (config.blockList) {
      for (const blocked of config.blockList) {
        if (content.toLowerCase().includes(blocked.toLowerCase())) {
          violations.push({
            ruleId: 'content-blocked',
            ruleName: 'Content Filtering',
            severity: 'medium',
            message: `Blocked content detected: "${blocked}"`,
            matchedPattern: blocked,
          });
        }
      }
    }

    // Check allow list
    if (config.allowList && config.allowList.length > 0) {
      const allowed = config.allowList.some(allowed => content.toLowerCase().includes(allowed.toLowerCase()));
      if (!allowed) {
        violations.push({
          ruleId: 'content-not-allowed',
          ruleName: 'Content Filtering',
          severity: 'medium',
          message: 'Content does not match any allowed patterns',
        });
      }
    }

    return {
      passed: violations.length === 0,
      violations,
    };
  }

  private checkCustomRules(content: string, config: GuardrailConfig): { passed: boolean; violations: Violation[] } {
    const violations: Violation[] = [];

    if (config.customRules) {
      for (const rule of config.customRules) {
        const regex = new RegExp(rule.pattern, 'gi');
        const matches = content.match(regex);
        if (matches) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: 'medium',
            message: rule.description,
            matchedPattern: rule.pattern,
          });
        }
      }
    }

    return {
      passed: violations.length === 0,
      violations,
    };
  }

  private calculateConfidence(violations: Violation[]): number {
    if (violations.length === 0) return 1.0;

    const severityWeights = { low: 0.25, medium: 0.5, high: 0.75, critical: 1.0 };
    const totalWeight = violations.reduce((sum, v) => sum + severityWeights[v.severity], 0);
    const maxWeight = violations.length * 1.0;

    return 1 - (totalWeight / maxWeight);
  }

  private addToHistory(result: GuardrailResult): void {
    this.executionHistory.push(result);
    this.trimHistory();
  }

  private trimHistory(): void {
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory = this.executionHistory.slice(-this.maxHistorySize);
    }
  }
}

// Global guardrail manager instance
const guardrailManager = new GuardrailManager();

export function registerGuardrail(guardrail: Guardrail): void {
  guardrailManager.registerGuardrail(guardrail);
}

export function unregisterGuardrail(guardrailId: string): boolean {
  return guardrailManager.unregisterGuardrail(guardrailId);
}

export function getGuardrail(guardrailId: string): Guardrail | undefined {
  return guardrailManager.getGuardrail(guardrailId);
}

export function getAllGuardrails(): Guardrail[] {
  return guardrailManager.getAllGuardrails();
}

export function getGuardrailsByType(type: GuardrailType): Guardrail[] {
  return guardrailManager.getGuardrailsByType(type);
}

export function getGuardrailsByPhase(phase: GuardrailPhase): Guardrail[] {
  return guardrailManager.getGuardrailsByPhase(phase);
}

export function getEnabledGuardrails(): Guardrail[] {
  return guardrailManager.getEnabledGuardrails();
}

export function enableGuardrail(guardrailId: string): boolean {
  return guardrailManager.enableGuardrail(guardrailId);
}

export function disableGuardrail(guardrailId: string): boolean {
  return guardrailManager.disableGuardrail(guardrailId);
}

export async function processContent(
  content: string,
  phase: GuardrailPhase,
  context?: ContentContext
): Promise<GuardrailPipelineResult> {
  return guardrailManager.processContent(content, phase, context);
}

export async function executeGuardrail(
  guardrailId: string,
  content: string,
  context?: ContentContext
): Promise<GuardrailResult> {
  const guardrail = guardrailManager.getGuardrail(guardrailId);
  if (!guardrail) {
    throw new Error(`Guardrail ${guardrailId} not found`);
  }
  return guardrailManager.executeGuardrail(guardrail, content, context);
}

export function getExecutionHistory(limit?: number): GuardrailResult[] {
  return guardrailManager.getExecutionHistory(limit);
}

export function clearExecutionHistory(): void {
  guardrailManager.clearExecutionHistory();
}

export function getStatistics(): {
  totalGuardrails: number;
  enabledGuardrails: number;
  guardrailsByType: Record<GuardrailType, number>;
  totalExecutions: number;
  totalViolations: number;
  violationRate: number;
  averageExecutionTime: number;
  mostViolatedGuardrails: Guardrail[];
} {
  return guardrailManager.getStatistics();
}

export function setMaxHistorySize(size: number): void {
  guardrailManager.setMaxHistorySize(size);
}
