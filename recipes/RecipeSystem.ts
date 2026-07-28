/**
 * Recipe System
 * Inspired by Goose's recipe system for composable YAML workflows
 * Recipes are version-controlled, git-diffable workflows with Jinja2 templating
 * Support for parameterization, sub-recipes, and structured output validation
 */

export interface Recipe {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: RecipeCategory;
  parameters: RecipeParameter[];
  steps: RecipeStep[];
  subRecipes: SubRecipeReference[];
  outputSchema: Record<string, unknown>;
  metadata: RecipeMetadata;
  content: string;
  enabled: boolean;
  tags: string[];
  dependencies: string[];
}

export type RecipeCategory =
  | 'development'
  | 'testing'
  | 'deployment'
  | 'documentation'
  | 'security'
  | 'performance'
  | 'migration'
  | 'custom';

export interface RecipeParameter {
  name: string;
  type: ParameterType;
  description: string;
  required: boolean;
  default?: unknown;
  validation?: ParameterValidation;
  enum?: unknown[];
}

export type ParameterType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'file' | 'directory';

export interface ParameterValidation {
  pattern?: string;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  custom?: string;
}

export interface RecipeStep {
  id: string;
  name: string;
  type: StepType;
  description: string;
  tool?: string;
  command?: string;
  args?: Record<string, unknown>;
  condition?: string;
  retry?: RetryConfig;
  timeout?: number;
  dependsOn?: string[];
  outputMapping?: Record<string, string>;
  metadata: StepMetadata;
}

export type StepType =
  | 'tool'
  | 'command'
  | 'script'
  | 'sub_recipe'
  | 'parallel'
  | 'condition'
  | 'loop'
  | 'input'
  | 'output'
  | 'validation';

export interface RetryConfig {
  maxAttempts: number;
  backoff: 'linear' | 'exponential';
  initialDelay: number;
  maxDelay: number;
}

export interface StepMetadata {
  estimatedDuration?: number;
  resourceRequirements?: ResourceRequirements;
  tags: string[];
}

export interface ResourceRequirements {
  cpu?: number;
  memory?: number;
  disk?: number;
}

export interface SubRecipeReference {
  recipeId: string;
  alias?: string;
  parameters: Record<string, unknown>;
  condition?: string;
}

export interface RecipeMetadata {
  createdAt: number;
  updatedAt: number;
  executionCount: number;
  lastExecuted?: number;
  averageExecutionTime?: number;
  successRate: number;
  tags: string[];
  dependencies: string[];
}

export interface RecipeExecution {
  id: string;
  recipeId: string;
  recipeVersion: string;
  parameters: Record<string, unknown>;
  status: ExecutionStatus;
  startedAt: number;
  completedAt?: number;
  steps: StepExecution[];
  output: Record<string, unknown>;
  error?: string;
  metadata: ExecutionMetadata;
}

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';

export interface StepExecution {
  stepId: string;
  status: ExecutionStatus;
  startedAt: number;
  completedAt?: number;
  output?: unknown;
  error?: string;
  retryCount: number;
  duration: number;
}

export interface ExecutionMetadata {
  userId?: string;
  sessionId?: string;
  projectId?: string;
  environment: string;
  triggeredBy: 'user' | 'automation' | 'api' | 'schedule';
}

export interface RecipeValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  stepId?: string;
  parameter?: string;
  message: string;
  severity: 'error';
}

export interface ValidationWarning {
  stepId?: string;
  parameter?: string;
  message: string;
  severity: 'warning';
}

export interface RecipeTemplate {
  template: string;
  parameters: string[];
  rendered?: string;
}

class RecipeManager {
  private recipes: Map<string, Recipe> = new Map();
  private executions: Map<string, RecipeExecution> = new Map();
  private recipePath: string;
  private templateEngine: TemplateEngine;

  constructor(recipePath: string = '~/.tovyr/recipes') {
    this.recipePath = recipePath;
    this.templateEngine = new TemplateEngine();
  }

  /**
   * Load recipes from directory
   */
  async loadRecipes(): Promise<void> {
    // In a real implementation, this would scan the recipe directory
    console.log(`Loading recipes from ${this.recipePath}`);
  }

  /**
   * Save recipes to directory
   */
  async saveRecipes(): Promise<void> {
    // In a real implementation, this would save recipes to the directory
    console.log(`Saving recipes to ${this.recipePath}`);
  }

  /**
   * Register a recipe
   */
  registerRecipe(recipe: Recipe): void {
    this.recipes.set(recipe.id, recipe);
  }

  /**
   * Unregister a recipe
   */
  unregisterRecipe(recipeId: string): boolean {
    return this.recipes.delete(recipeId);
  }

  /**
   * Get a recipe
   */
  getRecipe(recipeId: string): Recipe | undefined {
    return this.recipes.get(recipeId);
  }

  /**
   * Get all recipes
   */
  getAllRecipes(): Recipe[] {
    return Array.from(this.recipes.values());
  }

  /**
   * Get recipes by category
   */
  getRecipesByCategory(category: RecipeCategory): Recipe[] {
    return this.getAllRecipes().filter(r => r.category === category);
  }

  /**
   * Get enabled recipes
   */
  getEnabledRecipes(): Recipe[] {
    return this.getAllRecipes().filter(r => r.enabled);
  }

  /**
   * Search recipes by query
   */
  searchRecipes(query: string): Recipe[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllRecipes().filter(
      r =>
        r.name.toLowerCase().includes(lowerQuery) ||
        r.description.toLowerCase().includes(lowerQuery) ||
        r.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Validate a recipe
   */
  validateRecipe(recipe: Recipe): RecipeValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check for circular dependencies
    if (this.hasCircularDependency(recipe.id, recipe.dependencies, new Set())) {
      errors.push({
        message: 'Circular dependency detected',
        severity: 'error',
      });
    }

    // Validate parameters
    for (const param of recipe.parameters) {
      if (param.required && param.default !== undefined) {
        warnings.push({
          parameter: param.name,
          message: `Required parameter ${param.name} has a default value`,
          severity: 'warning',
        });
      }
    }

    // Validate steps
    for (const step of recipe.steps) {
      if (step.type === 'sub_recipe' && !step.args?.recipeId) {
        errors.push({
          stepId: step.id,
          message: 'Sub-recipe step must specify recipeId',
          severity: 'error',
        });
      }

      if (step.type === 'tool' && !step.tool) {
        errors.push({
          stepId: step.id,
          message: 'Tool step must specify tool',
          severity: 'error',
        });
      }

      if (step.type === 'command' && !step.command) {
        errors.push({
          stepId: step.id,
          message: 'Command step must specify command',
          severity: 'error',
        });
      }
    }

    // Validate sub-recipes
    for (const subRef of recipe.subRecipes) {
      if (!this.recipes.has(subRef.recipeId)) {
        warnings.push({
          message: `Sub-recipe ${subRef.recipeId} not found`,
          severity: 'warning',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Render a recipe template with parameters
   */
  renderTemplate(recipe: Recipe, parameters: Record<string, unknown>): string {
    return this.templateEngine.render(recipe.content, parameters);
  }

  /**
   * Execute a recipe
   */
  async executeRecipe(
    recipeId: string,
    parameters: Record<string, unknown>,
    metadata?: Partial<ExecutionMetadata>
  ): Promise<RecipeExecution> {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) {
      throw new Error(`Recipe ${recipeId} not found`);
    }

    const executionId = this.generateExecutionId();
    const execution: RecipeExecution = {
      id: executionId,
      recipeId,
      recipeVersion: recipe.version,
      parameters,
      status: 'running',
      startedAt: Date.now(),
      steps: [],
      output: {},
      metadata: {
        userId: metadata?.userId,
        sessionId: metadata?.sessionId,
        projectId: metadata?.projectId,
        environment: metadata?.environment || 'development',
        triggeredBy: metadata?.triggeredBy || 'user',
      },
    };

    this.executions.set(executionId, execution);

    try {
      // Validate parameters
      this.validateParameters(recipe, parameters);

      // Execute steps
      for (const step of recipe.steps) {
        const stepExecution = await this.executeStep(step, execution, parameters);
        execution.steps.push(stepExecution);

        if (stepExecution.status === 'failed') {
          execution.status = 'failed';
          execution.error = stepExecution.error;
          break;
        }
      }

      if (execution.status === 'running') {
        execution.status = 'completed';
      }

      execution.completedAt = Date.now();

      // Update recipe metadata
      recipe.metadata.executionCount++;
      recipe.metadata.lastExecuted = Date.now();
      const duration = execution.completedAt - execution.startedAt;
      recipe.metadata.averageExecutionTime = this.calculateAverageExecutionTime(
        recipe.metadata.averageExecutionTime,
        recipe.metadata.executionCount,
        duration
      );

      const successCount = this.getSuccessfulExecutions(recipeId);
      recipe.metadata.successRate = successCount / recipe.metadata.executionCount;

    } catch (error) {
      execution.status = 'failed';
      execution.error = String(error);
      execution.completedAt = Date.now();
    }

    return execution;
  }

  /**
   * Cancel an execution
   */
  cancelExecution(executionId: string): boolean {
    const execution = this.executions.get(executionId);
    if (!execution || execution.status !== 'running') return false;

    execution.status = 'cancelled';
    execution.completedAt = Date.now();
    return true;
  }

  /**
   * Get an execution
   */
  getExecution(executionId: string): RecipeExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Get executions by recipe
   */
  getExecutionsByRecipe(recipeId: string): RecipeExecution[] {
    return Array.from(this.executions.values()).filter(e => e.recipeId === recipeId);
  }

  /**
   * Get all executions
   */
  getAllExecutions(): RecipeExecution[] {
    return Array.from(this.executions.values());
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalRecipes: number;
    enabledRecipes: number;
    recipesByCategory: Record<RecipeCategory, number>;
    totalExecutions: number;
    runningExecutions: number;
    completedExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
    mostExecutedRecipes: Recipe[];
  } {
    const recipes = this.getAllRecipes();
    const enabled = recipes.filter(r => r.enabled).length;
    const executions = this.getAllExecutions();

    const recipesByCategory: Record<RecipeCategory, number> = {} as any;
    for (const recipe of recipes) {
      recipesByCategory[recipe.category] = (recipesByCategory[recipe.category] || 0) + 1;
    }

    const running = executions.filter(e => e.status === 'running').length;
    const completed = executions.filter(e => e.status === 'completed').length;
    const failed = executions.filter(e => e.status === 'failed').length;

    const completedExecs = executions.filter(e => e.status === 'completed' && e.completedAt);
    const averageExecutionTime = completedExecs.length > 0
      ? completedExecs.reduce((sum, e) => sum + (e.completedAt! - e.startedAt), 0) / completedExecs.length
      : 0;

    const mostExecutedRecipes = [...recipes].sort((a, b) => b.metadata.executionCount - a.metadata.executionCount).slice(0, 5);

    return {
      totalRecipes: recipes.length,
      enabledRecipes: enabled,
      recipesByCategory,
      totalExecutions: executions.length,
      runningExecutions: running,
      completedExecutions: completed,
      failedExecutions: failed,
      averageExecutionTime,
      mostExecutedRecipes,
    };
  }

  // Private methods

  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private hasCircularDependency(recipeId: string, dependencies: string[], visited: Set<string>): boolean {
    if (visited.has(recipeId)) return true;

    visited.add(recipeId);

    for (const dep of dependencies) {
      const depRecipe = this.recipes.get(dep);
      if (depRecipe && this.hasCircularDependency(dep, depRecipe.dependencies, new Set(visited))) {
        return true;
      }
    }

    return false;
  }

  private validateParameters(recipe: Recipe, parameters: Record<string, unknown>): void {
    for (const param of recipe.parameters) {
      if (param.required && !(param.name in parameters)) {
        throw new Error(`Required parameter ${param.name} is missing`);
      }

      const value = parameters[param.name];
      if (value !== undefined) {
        this.validateParameterValue(param, value);
      }
    }
  }

  private validateParameterValue(param: RecipeParameter, value: unknown): void {
    // Type validation
    switch (param.type) {
      case 'string':
        if (typeof value !== 'string') {
          throw new Error(`Parameter ${param.name} must be a string`);
        }
        break;
      case 'number':
        if (typeof value !== 'number') {
          throw new Error(`Parameter ${param.name} must be a number`);
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          throw new Error(`Parameter ${param.name} must be a boolean`);
        }
        break;
      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          throw new Error(`Parameter ${param.name} must be an object`);
        }
        break;
      case 'array':
        if (!Array.isArray(value)) {
          throw new Error(`Parameter ${param.name} must be an array`);
        }
        break;
    }

    // Enum validation
    if (param.enum && !param.enum.includes(value)) {
      throw new Error(`Parameter ${param.name} must be one of: ${param.enum.join(', ')}`);
    }

    // Pattern validation
    if (param.validation?.pattern && typeof value === 'string') {
      const regex = new RegExp(param.validation.pattern);
      if (!regex.test(value)) {
        throw new Error(`Parameter ${param.name} does not match pattern ${param.validation.pattern}`);
      }
    }

    // Range validation
    if (param.validation?.min !== undefined && typeof value === 'number' && value < param.validation.min) {
      throw new Error(`Parameter ${param.name} must be at least ${param.validation.min}`);
    }

    if (param.validation?.max !== undefined && typeof value === 'number' && value > param.validation.max) {
      throw new Error(`Parameter ${param.name} must be at most ${param.validation.max}`);
    }

    // Length validation
    if (param.validation?.minLength !== undefined && typeof value === 'string' && value.length < param.validation.minLength) {
      throw new Error(`Parameter ${param.name} must be at least ${param.validation.minLength} characters`);
    }

    if (param.validation?.maxLength !== undefined && typeof value === 'string' && value.length > param.validation.maxLength) {
      throw new Error(`Parameter ${param.name} must be at most ${param.validation.maxLength} characters`);
    }
  }

  private async executeStep(
    step: RecipeStep,
    execution: RecipeExecution,
    parameters: Record<string, unknown>
  ): Promise<StepExecution> {
    const stepExecution: StepExecution = {
      stepId: step.id,
      status: 'running',
      startedAt: Date.now(),
      retryCount: 0,
      duration: 0,
    };

    try {
      // Check dependencies
      if (step.dependsOn) {
        for (const depId of step.dependsOn) {
          const depStep = execution.steps.find(s => s.stepId === step.id);
          if (!depStep || depStep.status !== 'completed') {
            throw new Error(`Dependency ${depId} not completed`);
          }
        }
      }

      // Check condition
      if (step.condition) {
        const conditionMet = this.evaluateCondition(step.condition, execution.output, parameters);
        if (!conditionMet) {
          stepExecution.status = 'completed';
          stepExecution.completedAt = Date.now();
          stepExecution.duration = Date.now() - stepExecution.startedAt;
          return stepExecution;
        }
      }

      // Execute based on step type
      let output: unknown;
      switch (step.type) {
        case 'tool':
          output = await this.executeToolStep(step, execution, parameters);
          break;
        case 'command':
          output = await this.executeCommandStep(step, execution, parameters);
          break;
        case 'sub_recipe':
          output = await this.executeSubRecipeStep(step, execution, parameters);
          break;
        default:
          output = null;
      }

      // Map output
      if (step.outputMapping) {
        for (const [key, path] of Object.entries(step.outputMapping)) {
          execution.output[key] = this.getNestedValue(output, path);
        }
      }

      stepExecution.output = output;
      stepExecution.status = 'completed';
      stepExecution.completedAt = Date.now();
      stepExecution.duration = Date.now() - stepExecution.startedAt;

    } catch (error) {
      // Retry logic
      if (step.retry && stepExecution.retryCount < step.retry.maxAttempts) {
        stepExecution.retryCount++;
        const delay = this.calculateRetryDelay(step.retry, stepExecution.retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeStep(step, execution, parameters);
      }

      stepExecution.status = 'failed';
      stepExecution.error = String(error);
      stepExecution.completedAt = Date.now();
      stepExecution.duration = Date.now() - stepExecution.startedAt;
    }

    return stepExecution;
  }

  private async executeToolStep(
    step: RecipeStep,
    execution: RecipeExecution,
    parameters: Record<string, unknown>
  ): Promise<unknown> {
    // In a real implementation, this would execute the tool
    console.log(`Executing tool ${step.tool} with args`, step.args);
    await new Promise(resolve => setTimeout(resolve, 100));
    return { success: true };
  }

  private async executeCommandStep(
    step: RecipeStep,
    execution: RecipeExecution,
    parameters: Record<string, unknown>
  ): Promise<unknown> {
    // In a real implementation, this would execute the command
    console.log(`Executing command ${step.command} with args`, step.args);
    await new Promise(resolve => setTimeout(resolve, 100));
    return { success: true };
  }

  private async executeSubRecipeStep(
    step: RecipeStep,
    execution: RecipeExecution,
    parameters: Record<string, unknown>
  ): Promise<unknown> {
    const recipeId = step.args?.recipeId as string;
    if (!recipeId) {
      throw new Error('Sub-recipe step must specify recipeId');
    }

    const subParams = { ...parameters, ...(step.args as Record<string, unknown>) };
    delete subParams.recipeId;

    return await this.executeRecipe(recipeId, subParams, execution.metadata);
  }

  private evaluateCondition(condition: string, output: Record<string, unknown>, parameters: Record<string, unknown>): boolean {
    // In a real implementation, this would evaluate the condition
    // For now, return true
    return true;
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    const keys = path.split('.');
    let current: any = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[key];
    }

    return current;
  }

  private calculateRetryDelay(retryConfig: RetryConfig, attempt: number): number {
    if (retryConfig.backoff === 'linear') {
      return Math.min(retryConfig.initialDelay * attempt, retryConfig.maxDelay);
    } else {
      return Math.min(retryConfig.initialDelay * Math.pow(2, attempt - 1), retryConfig.maxDelay);
    }
  }

  private calculateAverageExecutionTime(current: number | undefined, count: number, newDuration: number): number {
    if (current === undefined) return newDuration;
    return (current * (count - 1) + newDuration) / count;
  }

  private getSuccessfulExecutions(recipeId: string): number {
    return this.getExecutionsByRecipe(recipeId).filter(e => e.status === 'completed').length;
  }
}

class TemplateEngine {
  /**
   * Render a template with parameters using Jinja2-like syntax
   */
  render(template: string, parameters: Record<string, unknown>): string {
    let result = template;

    // Replace {{ variable }} syntax
    result = result.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
      return String(parameters[key] ?? '');
    });

    // Replace {% if condition %} syntax (simple implementation)
    result = result.replace(/\{%\s*if\s+(\w+)\s*%\}(.*?)\{%\s*endif\s*%\}/gs, (match, condition, content) => {
      if (parameters[condition]) {
        return content;
      }
      return '';
    });

    // Replace {% for item in items %} syntax (simple implementation)
    result = result.replace(/\{%\s*for\s+(\w+)\s+in\s+(\w+)\s*%\}(.*?)\{%\s*endfor\s*%\}/gs, (match, itemVar, arrayVar, content) => {
      const array = parameters[arrayVar] as unknown[];
      if (!Array.isArray(array)) return '';

      return array.map(item => {
        return content.replace(new RegExp(`\\{\\{\\s*${itemVar}\\s*\\}\\}`, 'g'), String(item));
      }).join('');
    });

    return result;
  }
}

// Global recipe manager instance
const recipeManager = new RecipeManager();

export async function loadRecipes(): Promise<void> {
  return recipeManager.loadRecipes();
}

export async function saveRecipes(): Promise<void> {
  return recipeManager.saveRecipes();
}

export function registerRecipe(recipe: Recipe): void {
  recipeManager.registerRecipe(recipe);
}

export function unregisterRecipe(recipeId: string): boolean {
  return recipeManager.unregisterRecipe(recipeId);
}

export function getRecipe(recipeId: string): Recipe | undefined {
  return recipeManager.getRecipe(recipeId);
}

export function getAllRecipes(): Recipe[] {
  return recipeManager.getAllRecipes();
}

export function getRecipesByCategory(category: RecipeCategory): Recipe[] {
  return recipeManager.getRecipesByCategory(category);
}

export function getEnabledRecipes(): Recipe[] {
  return recipeManager.getEnabledRecipes();
}

export function searchRecipes(query: string): Recipe[] {
  return recipeManager.searchRecipes(query);
}

export function validateRecipe(recipe: Recipe): RecipeValidationResult {
  return recipeManager.validateRecipe(recipe);
}

export function renderTemplate(recipe: Recipe, parameters: Record<string, unknown>): string {
  return recipeManager.renderTemplate(recipe, parameters);
}

export async function executeRecipe(
  recipeId: string,
  parameters: Record<string, unknown>,
  metadata?: Partial<ExecutionMetadata>
): Promise<RecipeExecution> {
  return recipeManager.executeRecipe(recipeId, parameters, metadata);
}

export function cancelExecution(executionId: string): boolean {
  return recipeManager.cancelExecution(executionId);
}

export function getExecution(executionId: string): RecipeExecution | undefined {
  return recipeManager.getExecution(executionId);
}

export function getExecutionsByRecipe(recipeId: string): RecipeExecution[] {
  return recipeManager.getExecutionsByRecipe(recipeId);
}

export function getAllExecutions(): RecipeExecution[] {
  return recipeManager.getAllExecutions();
}

export function getStatistics(): {
  totalRecipes: number;
  enabledRecipes: number;
  recipesByCategory: Record<RecipeCategory, number>;
  totalExecutions: number;
  runningExecutions: number;
  completedExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  mostExecutedRecipes: Recipe[];
} {
  return recipeManager.getStatistics();
}
