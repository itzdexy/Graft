/**
 * AI-powered command suggestions and auto-completion system.
 * Learns from user behavior and provides intelligent suggestions based on context.
 */

import Fuse from 'fuse.js';

export interface CommandSuggestion {
  command: string;
  description: string;
  category: 'file' | 'git' | 'build' | 'test' | 'deploy' | 'debug' | 'general';
  frequency: number;
  lastUsed: number;
  context?: string[];
  aliases?: string[];
}

export interface SuggestionContext {
  currentDirectory: string;
  recentCommands: string[];
  projectType?: string;
  gitBranch?: string;
  filesInScope: string[];
}

class AICommandSuggestionEngine {
  private suggestions: Map<string, CommandSuggestion> = new Map();
  private usageHistory: Map<string, number[]> = new Map();
  private fuse: any;
  private maxHistorySize = 100;

  constructor() {
    this.fuse = new Fuse([], {
      keys: ['command', 'description', 'aliases'],
      threshold: 0.3,
      includeScore: true,
    });
    this.initializeDefaultSuggestions();
  }

  private initializeDefaultSuggestions(): void {
    const defaultSuggestions: CommandSuggestion[] = [
      // File operations
      {
        command: 'git status',
        description: 'Show working tree status',
        category: 'git',
        frequency: 10,
        lastUsed: Date.now(),
        context: ['git'],
        aliases: ['gs', 'gst'],
      },
      {
        command: 'git add .',
        description: 'Stage all changes',
        category: 'git',
        frequency: 8,
        lastUsed: Date.now(),
        context: ['git'],
      },
      {
        command: 'git commit -m',
        description: 'Commit changes with message',
        category: 'git',
        frequency: 8,
        lastUsed: Date.now(),
        context: ['git'],
      },
      {
        command: 'git push',
        description: 'Push changes to remote',
        category: 'git',
        frequency: 7,
        lastUsed: Date.now(),
        context: ['git'],
      },
      {
        command: 'git pull',
        description: 'Pull changes from remote',
        category: 'git',
        frequency: 7,
        lastUsed: Date.now(),
        context: ['git'],
      },
      {
        command: 'git checkout -b',
        description: 'Create and switch to new branch',
        category: 'git',
        frequency: 5,
        lastUsed: Date.now(),
        context: ['git'],
      },
      // Build operations
      {
        command: 'npm run build',
        description: 'Build the project',
        category: 'build',
        frequency: 6,
        lastUsed: Date.now(),
        context: ['node', 'javascript', 'typescript'],
      },
      {
        command: 'npm run dev',
        description: 'Start development server',
        category: 'build',
        frequency: 6,
        lastUsed: Date.now(),
        context: ['node', 'javascript', 'typescript'],
      },
      {
        command: 'npm install',
        description: 'Install dependencies',
        category: 'build',
        frequency: 5,
        lastUsed: Date.now(),
        context: ['node', 'javascript', 'typescript'],
      },
      {
        command: 'bun run build',
        description: 'Build with Bun',
        category: 'build',
        frequency: 4,
        lastUsed: Date.now(),
        context: ['bun', 'javascript', 'typescript'],
      },
      // Test operations
      {
        command: 'npm test',
        description: 'Run tests',
        category: 'test',
        frequency: 5,
        lastUsed: Date.now(),
        context: ['node', 'javascript', 'typescript'],
      },
      {
        command: 'bun test',
        description: 'Run tests with Bun',
        category: 'test',
        frequency: 4,
        lastUsed: Date.now(),
        context: ['bun', 'javascript', 'typescript'],
      },
      {
        command: 'pytest',
        description: 'Run Python tests',
        category: 'test',
        frequency: 3,
        lastUsed: Date.now(),
        context: ['python'],
      },
      // Debug operations
      {
        command: 'node --inspect',
        description: 'Debug Node.js application',
        category: 'debug',
        frequency: 3,
        lastUsed: Date.now(),
        context: ['node', 'javascript', 'typescript'],
      },
      {
        command: 'console.log',
        description: 'Debug output',
        category: 'debug',
        frequency: 8,
        lastUsed: Date.now(),
        context: ['javascript', 'typescript'],
      },
      // File operations
      {
        command: 'ls -la',
        description: 'List all files with details',
        category: 'file',
        frequency: 9,
        lastUsed: Date.now(),
        context: ['unix', 'linux', 'macos'],
      },
      {
        command: 'cat',
        description: 'Display file contents',
        category: 'file',
        frequency: 7,
        lastUsed: Date.now(),
        context: ['unix', 'linux', 'macos'],
      },
      {
        command: 'grep -r',
        description: 'Search recursively',
        category: 'file',
        frequency: 6,
        lastUsed: Date.now(),
        context: ['unix', 'linux', 'macos'],
      },
      {
        command: 'find . -name',
        description: 'Find files by name',
        category: 'file',
        frequency: 5,
        lastUsed: Date.now(),
        context: ['unix', 'linux', 'macos'],
      },
      // Deploy operations
      {
        command: 'docker build',
        description: 'Build Docker image',
        category: 'deploy',
        frequency: 3,
        lastUsed: Date.now(),
        context: ['docker', 'containers'],
      },
      {
        command: 'docker run',
        description: 'Run Docker container',
        category: 'deploy',
        frequency: 3,
        lastUsed: Date.now(),
        context: ['docker', 'containers'],
      },
      {
        command: 'kubectl apply',
        description: 'Apply Kubernetes configuration',
        category: 'deploy',
        frequency: 2,
        lastUsed: Date.now(),
        context: ['kubernetes', 'k8s'],
      },
      // General
      {
        command: 'clear',
        description: 'Clear terminal',
        category: 'general',
        frequency: 10,
        lastUsed: Date.now(),
      },
      {
        command: 'history',
        description: 'Show command history',
        category: 'general',
        frequency: 4,
        lastUsed: Date.now(),
      },
    ];

    defaultSuggestions.forEach(suggestion => {
      this.suggestions.set(suggestion.command, suggestion);
    });

    this.fuse.setCollection(Array.from(this.suggestions.values()));
  }

  /**
   * Get intelligent suggestions based on current context
   */
  getSuggestions(
    partialCommand: string,
    context: SuggestionContext
  ): CommandSuggestion[] {
    // Update frequency based on recent usage
    this.updateFrequencyFromHistory(context.recentCommands);

    // Get fuzzy matches
    const fuzzyMatches = this.fuse.search(partialCommand);

    // Filter and rank by context relevance
    const contextRelevant = fuzzyMatches
      .map(result => result.item)
      .filter(suggestion => this.isContextRelevant(suggestion, context))
      .sort((a, b) => {
        // Sort by combined score of frequency, recency, and context match
        const scoreA = this.calculateRelevanceScore(a, context);
        const scoreB = this.calculateRelevanceScore(b, context);
        return scoreB - scoreA;
      });

    return contextRelevant.slice(0, 10);
  }

  /**
   * Record command usage for learning
   */
  recordUsage(command: string): void {
    const now = Date.now();
    const history = this.usageHistory.get(command) || [];
    
    history.push(now);
    
    // Keep only recent history
    if (history.length > this.maxHistorySize) {
      history.shift();
    }
    
    this.usageHistory.set(command, history);

    // Update suggestion frequency
    const suggestion = this.suggestions.get(command);
    if (suggestion) {
      suggestion.frequency++;
      suggestion.lastUsed = now;
    } else {
      // Learn new command
      this.suggestions.set(command, {
        command,
        description: 'Custom command',
        category: 'general',
        frequency: 1,
        lastUsed: now,
      });
      this.fuse.setCollection(Array.from(this.suggestions.values()));
    }
  }

  /**
   * Get most frequently used commands
   */
  getTopCommands(limit: number = 10): CommandSuggestion[] {
    return Array.from(this.suggestions.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit);
  }

  /**
   * Get recently used commands
   */
  getRecentCommands(limit: number = 10): CommandSuggestion[] {
    return Array.from(this.suggestions.values())
      .sort((a, b) => b.lastUsed - a.lastUsed)
      .slice(0, limit);
  }

  /**
   * Update frequency based on usage history
   */
  private updateFrequencyFromHistory(recentCommands: string[]): void {
    recentCommands.forEach(command => {
      const suggestion = this.suggestions.get(command);
      if (suggestion) {
        // Boost frequency for recently used commands
        suggestion.frequency += 0.5;
      }
    });
  }

  /**
   * Check if suggestion is relevant to current context
   */
  private isContextRelevant(
    suggestion: CommandSuggestion,
    context: SuggestionContext
  ): boolean {
    // Check if suggestion matches project type
    if (context.projectType && suggestion.context) {
      return suggestion.context.includes(context.projectType);
    }

    // Check file relevance
    if (context.filesInScope.length > 0) {
      const hasRelevantFiles = context.filesInScope.some(file => {
        const ext = file.split('.').pop();
        if (suggestion.category === 'build' && ['js', 'ts', 'json'].includes(ext || '')) {
          return true;
        }
        if (suggestion.category === 'test' && ['test', 'spec'].some(t => file.includes(t))) {
          return true;
        }
        return false;
      });
      if (hasRelevantFiles) return true;
    }

    // Git context
    if (context.gitBranch && suggestion.category === 'git') {
      return true;
    }

    return true; // Default to showing if no specific context
  }

  /**
   * Calculate relevance score for ranking
   */
  private calculateRelevanceScore(
    suggestion: CommandSuggestion,
    context: SuggestionContext
  ): number {
    let score = suggestion.frequency * 10;

    // Boost for recent usage
    const daysSinceUse = (Date.now() - suggestion.lastUsed) / (1000 * 60 * 60 * 24);
    score *= Math.max(0.1, 1 - daysSinceUse / 30);

    // Boost for context match
    if (context.projectType && suggestion.context?.includes(context.projectType)) {
      score *= 2;
    }

    // Boost for git context
    if (context.gitBranch && suggestion.category === 'git') {
      score *= 1.5;
    }

    return score;
  }

  /**
   * Export learned suggestions for persistence
   */
  exportLearnedSuggestions(): Record<string, CommandSuggestion> {
    return Object.fromEntries(this.suggestions);
  }

  /**
   * Import learned suggestions from persistence
   */
  importLearnedSuggestions(data: Record<string, CommandSuggestion>): void {
    Object.entries(data).forEach(([command, suggestion]) => {
      this.suggestions.set(command, suggestion);
    });
    this.fuse.setCollection(Array.from(this.suggestions.values()));
  }
}

// Global instance
const suggestionEngine = new AICommandSuggestionEngine();

export function getSuggestions(
  partialCommand: string,
  context: SuggestionContext
): CommandSuggestion[] {
  return suggestionEngine.getSuggestions(partialCommand, context);
}

export function recordCommandUsage(command: string): void {
  suggestionEngine.recordUsage(command);
}

export function getTopCommands(limit?: number): CommandSuggestion[] {
  return suggestionEngine.getTopCommands(limit);
}

export function getRecentCommands(limit?: number): CommandSuggestion[] {
  return suggestionEngine.getRecentCommands(limit);
}
