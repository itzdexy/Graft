/**
 * Agent Skills Standard
 * Inspired by Crush's support for the Agent Skills open standard (agentskills.io)
 * Skills are folders containing a SKILL.md file with instructions that agents can discover and activate on demand
 */

export interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: SkillCategory;
  instructions: string;
  capabilities: SkillCapability[];
  dependencies: string[];
  parameters: SkillParameter[];
  examples: SkillExample[];
  metadata: SkillMetadata;
  path: string;
  enabled: boolean;
}

export type SkillCategory =
  | 'coding'
  | 'testing'
  | 'documentation'
  | 'deployment'
  | 'security'
  | 'analysis'
  | 'automation'
  | 'communication'
  | 'custom';

export interface SkillCapability {
  name: string;
  description: string;
  required: boolean;
}

export interface SkillParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  default?: unknown;
  validation?: ParameterValidation;
}

export interface ParameterValidation {
  pattern?: string;
  min?: number;
  max?: number;
  enum?: string[];
}

export interface SkillExample {
  description: string;
  input: Record<string, unknown>;
  output: string;
}

export interface SkillMetadata {
  createdAt: number;
  updatedAt: number;
  lastUsed?: number;
  usageCount: number;
  rating?: number;
  tags: string[];
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: SkillCategory;
  instructions: string;
  capabilities: SkillCapability[];
  dependencies: string[];
  parameters: SkillParameter[];
  examples: SkillExample[];
  metadata: SkillMetadata;
  path: string;
  enabled: boolean;
  tags: string[];
}

export interface SkillDiscoveryResult {
  skills: Skill[];
  errors: DiscoveryError[];
}

export interface DiscoveryError {
  path: string;
  error: string;
}

export interface SkillActivationResult {
  success: boolean;
  skill: Skill;
  error?: string;
}

export interface SkillContext {
  projectId: string;
  sessionId: string;
  userId?: string;
  environment: 'development' | 'staging' | 'production';
}

class SkillManager {
  private skills: Map<string, Skill> = new Map();
  private activeSkills: Set<string> = new Set();
  private skillPaths: string[] = [];
  private context: SkillContext | null = null;

  /**
   * Initialize skill manager with search paths
   */
  constructor(skillPaths: string[] = []) {
    this.skillPaths = skillPaths;
  }

  /**
   * Set skill search paths
   */
  setSkillPaths(paths: string[]): void {
    this.skillPaths = paths;
  }

  /**
   * Add a skill search path
   */
  addSkillPath(path: string): void {
    this.skillPaths.push(path);
  }

  /**
   * Discover skills from all configured paths
   */
  async discoverSkills(): Promise<SkillDiscoveryResult> {
    const skills: Skill[] = [];
    const errors: DiscoveryError[] = [];

    for (const path of this.skillPaths) {
      try {
        const discovered = await this.discoverSkillsFromPath(path);
        skills.push(...discovered);
      } catch (error) {
        errors.push({
          path,
          error: String(error),
        });
      }
    }

    // Add discovered skills to registry
    for (const skill of skills) {
      this.skills.set(skill.id, skill);
    }

    return { skills, errors };
  }

  /**
   * Discover skills from a specific path
   */
  private async discoverSkillsFromPath(path: string): Promise<Skill[]> {
    // In a real implementation, this would scan the directory for SKILL.md files
    // For now, we'll return a mock skill
    const mockSkill: Skill = {
      id: 'mock-skill',
      name: 'Mock Skill',
      description: 'A mock skill for testing',
      version: '1.0.0',
      author: 'Blink',
      category: 'custom',
      instructions: 'This is a mock skill for testing the skill system.',
      capabilities: [
        { name: 'test', description: 'Test capability', required: true },
      ],
      dependencies: [],
      parameters: [],
      examples: [],
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        usageCount: 0,
        tags: ['test'],
      },
      path,
      enabled: true,
      tags: ['test'],
    };

    return [mockSkill];
  }

  /**
   * Register a skill manually
   */
  registerSkill(skill: Skill): void {
    this.skills.set(skill.id, skill);
  }

  /**
   * Unregister a skill
   */
  unregisterSkill(skillId: string): boolean {
    return this.skills.delete(skillId);
  }

  /**
   * Get a skill by ID
   */
  getSkill(skillId: string): Skill | undefined {
    return this.skills.get(skillId);
  }

  /**
   * Get all skills
   */
  getAllSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get skills by category
   */
  getSkillsByCategory(category: SkillCategory): Skill[] {
    return this.getAllSkills().filter(s => s.category === category);
  }

  /**
   * Get enabled skills
   */
  getEnabledSkills(): Skill[] {
    return this.getAllSkills().filter(s => s.enabled);
  }

  /**
   * Get active skills
   */
  getActiveSkills(): Skill[] {
    return Array.from(this.activeSkills)
      .map(id => this.skills.get(id))
      .filter((s): s is Skill => s !== undefined);
  }

  /**
   * Search skills by query
   */
  searchSkills(query: string): Skill[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllSkills().filter(
      s =>
        s.name.toLowerCase().includes(lowerQuery) ||
        s.description.toLowerCase().includes(lowerQuery) ||
        s.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Activate a skill
   */
  async activateSkill(skillId: string, context?: SkillContext): Promise<SkillActivationResult> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      return {
        success: false,
        skill: {} as Skill,
        error: `Skill ${skillId} not found`,
      };
    }

    if (!skill.enabled) {
      return {
        success: false,
        skill,
        error: `Skill ${skillId} is disabled`,
      };
    }

    // Check dependencies
    for (const dep of skill.dependencies) {
      if (!this.activeSkills.has(dep)) {
        return {
          success: false,
          skill,
          error: `Dependency ${dep} is not active`,
        };
      }
    }

    // Activate the skill
    this.activeSkills.add(skillId);
    skill.metadata.lastUsed = Date.now();
    skill.metadata.usageCount++;

    if (context) {
      this.context = context;
    }

    return {
      success: true,
      skill,
    };
  }

  /**
   * Deactivate a skill
   */
  deactivateSkill(skillId: string): boolean {
    return this.activeSkills.delete(skillId);
  }

  /**
   * Enable a skill
   */
  enableSkill(skillId: string): boolean {
    const skill = this.skills.get(skillId);
    if (!skill) return false;

    skill.enabled = true;
    return true;
  }

  /**
   * Disable a skill
   */
  disableSkill(skillId: string): boolean {
    const skill = this.skills.get(skillId);
    if (!skill) return false;

    skill.enabled = false;
    this.activeSkills.delete(skillId);
    return true;
  }

  /**
   * Get skill instructions for use in prompts
   */
  getSkillInstructions(skillId: string): string | undefined {
    const skill = this.skills.get(skillId);
    if (!skill || !this.activeSkills.has(skillId)) return undefined;

    return skill.instructions;
  }

  /**
   * Get all active skill instructions
   */
  getAllActiveInstructions(): string {
    const activeSkills = this.getActiveSkills();
    return activeSkills.map(s => `## ${s.name}\n${s.instructions}`).join('\n\n');
  }

  /**
   * Rate a skill
   */
  rateSkill(skillId: string, rating: number): boolean {
    const skill = this.skills.get(skillId);
    if (!skill) return false;

    skill.metadata.rating = rating;
    return true;
  }

  /**
   * Get skill statistics
   */
  getStatistics(): {
    totalSkills: number;
    enabledSkills: number;
    activeSkills: number;
    skillsByCategory: Record<SkillCategory, number>;
    mostUsedSkills: Skill[];
  } {
    const skills = this.getAllSkills();
    const enabled = skills.filter(s => s.enabled).length;
    const active = this.activeSkills.size;

    const skillsByCategory: Record<SkillCategory, number> = {} as any;
    for (const skill of skills) {
      skillsByCategory[skill.category] = (skillsByCategory[skill.category] || 0) + 1;
    }

    const mostUsedSkills = [...skills].sort((a, b) => b.metadata.usageCount - a.metadata.usageCount).slice(0, 5);

    return {
      totalSkills: skills.length,
      enabledSkills: enabled,
      activeSkills: active,
      skillsByCategory,
      mostUsedSkills,
    };
  }

  /**
   * Set context
   */
  setContext(context: SkillContext): void {
    this.context = context;
  }

  /**
   * Get context
   */
  getContext(): SkillContext | null {
    return this.context;
  }
}

// Global skill manager instance
const skillManager = new SkillManager();

export function setSkillPaths(paths: string[]): void {
  skillManager.setSkillPaths(paths);
}

export function addSkillPath(path: string): void {
  skillManager.addSkillPath(path);
}

export async function discoverSkills(): Promise<SkillDiscoveryResult> {
  return skillManager.discoverSkills();
}

export function registerSkill(skill: Skill): void {
  skillManager.registerSkill(skill);
}

export function unregisterSkill(skillId: string): boolean {
  return skillManager.unregisterSkill(skillId);
}

export function getSkill(skillId: string): Skill | undefined {
  return skillManager.getSkill(skillId);
}

export function getAllSkills(): Skill[] {
  return skillManager.getAllSkills();
}

export function getSkillsByCategory(category: SkillCategory): Skill[] {
  return skillManager.getSkillsByCategory(category);
}

export function getEnabledSkills(): Skill[] {
  return skillManager.getEnabledSkills();
}

export function getActiveSkills(): Skill[] {
  return skillManager.getActiveSkills();
}

export function searchSkills(query: string): Skill[] {
  return skillManager.searchSkills(query);
}

export async function activateSkill(skillId: string, context?: SkillContext): Promise<SkillActivationResult> {
  return skillManager.activateSkill(skillId, context);
}

export function deactivateSkill(skillId: string): boolean {
  return skillManager.deactivateSkill(skillId);
}

export function enableSkill(skillId: string): boolean {
  return skillManager.enableSkill(skillId);
}

export function disableSkill(skillId: string): boolean {
  return skillManager.disableSkill(skillId);
}

export function getSkillInstructions(skillId: string): string | undefined {
  return skillManager.getSkillInstructions(skillId);
}

export function getAllActiveInstructions(): string {
  return skillManager.getAllActiveInstructions();
}

export function rateSkill(skillId: string, rating: number): boolean {
  return skillManager.rateSkill(skillId, rating);
}

export function getStatistics(): {
  totalSkills: number;
  enabledSkills: number;
  activeSkills: number;
  skillsByCategory: Record<SkillCategory, number>;
  mostUsedSkills: Skill[];
} {
  return skillManager.getStatistics();
}

export function setContext(context: SkillContext): void {
  skillManager.setContext(context);
}

export function getContext(): SkillContext | null {
  return skillManager.getContext();
}
