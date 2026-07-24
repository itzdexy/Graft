/**
 * Slash command system - Command registry and management
 * Inspired by OpenCode, Crush, and industry-leading CLI tools
 */

export interface SlashCommand {
  name: string;
  aliases: string[];
  description: string;
  category: CommandCategory;
  handler: CommandHandler;
  arguments?: CommandArgument[];
  options?: CommandOption[];
  examples: string[];
  hidden?: boolean;
  requiresAuth?: boolean;
  requiresProject?: boolean;
  enabled: boolean;
}

export type CommandCategory = 
  | 'general'
  | 'agent'
  | 'context'
  | 'session'
  | 'provider'
  | 'model'
  | 'tools'
  | 'memory'
  | 'browser'
  | 'git'
  | 'debug'
  | 'config'
  | 'help';

export interface CommandArgument {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'file' | 'directory';
  required: boolean;
  default?: unknown;
  variadic?: boolean;
}

export interface CommandOption {
  name: string;
  short?: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'flag';
  default?: unknown;
  required?: boolean;
}

export interface CommandHandler {
  (args: Record<string, unknown>, options: Record<string, unknown>): Promise<CommandResult>;
}

export interface CommandResult {
  success: boolean;
  output: string;
  error?: string;
  data?: unknown;
}

export interface CommandContext {
  cwd: string;
  sessionId: string;
  userId?: string;
  projectId?: string;
  environment: 'development' | 'staging' | 'production';
}

class SlashCommandRegistry {
  private commands: Map<string, SlashCommand> = new Map();
  private aliases: Map<string, string> = new Map();
  private categories: Map<CommandCategory, Set<string>> = new Map();
  private history: CommandHistoryEntry[] = [];
  private maxHistorySize = 100;

  /**
   * Register a slash command
   */
  register(command: SlashCommand): void {
    this.commands.set(command.name, command);
    
    // Register aliases
    for (const alias of command.aliases) {
      this.aliases.set(alias, command.name);
    }

    // Add to category
    if (!this.categories.has(command.category)) {
      this.categories.set(command.category, new Set());
    }
    this.categories.get(command.category)!.add(command.name);
  }

  /**
   * Unregister a command
   */
  unregister(name: string): void {
    const command = this.commands.get(name);
    if (command) {
      // Remove aliases
      for (const alias of command.aliases) {
        this.aliases.delete(alias);
      }

      // Remove from category
      this.categories.get(command.category)?.delete(name);

      // Remove command
      this.commands.delete(name);
    }
  }

  /**
   * Get a command by name or alias
   */
  get(name: string): SlashCommand | undefined {
    // Check direct name
    const command = this.commands.get(name);
    if (command) return command;

    // Check alias
    const aliasedName = this.aliases.get(name);
    if (aliasedName) {
      return this.commands.get(aliasedName);
    }

    return undefined;
  }

  /**
   * Get all commands
   */
  getAll(): SlashCommand[] {
    return Array.from(this.commands.values()).filter(c => !c.hidden && c.enabled);
  }

  /**
   * Get commands by category
   */
  getByCategory(category: CommandCategory): SlashCommand[] {
    const commandNames = this.categories.get(category);
    if (!commandNames) return [];

    return Array.from(commandNames)
      .map(name => this.commands.get(name))
      .filter((c): c is SlashCommand => c !== undefined && !c.hidden && c.enabled);
  }

  /**
   * Search commands by name or description
   */
  search(query: string): SlashCommand[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(command => 
      command.name.toLowerCase().includes(lowerQuery) ||
      command.description.toLowerCase().includes(lowerQuery) ||
      command.aliases.some(alias => alias.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Execute a command
   */
  async execute(
    name: string,
    args: Record<string, unknown> = {},
    options: Record<string, unknown> = {},
    context?: CommandContext
  ): Promise<CommandResult> {
    const command = this.get(name);
    if (!command) {
      return {
        success: false,
        output: '',
        error: `Command '${name}' not found`,
      };
    }

    if (!command.enabled) {
      return {
        success: false,
        output: '',
        error: `Command '${name}' is disabled`,
      };
    }

    // Check requirements
    if (command.requiresAuth && !context?.userId) {
      return {
        success: false,
        output: '',
        error: `Command '${name}' requires authentication`,
      };
    }

    if (command.requiresProject && !context?.projectId) {
      return {
        success: false,
        output: '',
        error: `Command '${name}' requires a project context`,
      };
    }

    // Add to history
    this.addToHistory(name, args, options);

    try {
      const result = await command.handler(args, options);
      return result;
    } catch (error) {
      return {
        success: false,
        output: '',
        error: String(error),
      };
    }
  }

  /**
   * Enable/disable a command
   */
  setEnabled(name: string, enabled: boolean): void {
    const command = this.commands.get(name);
    if (command) {
      command.enabled = enabled;
    }
  }

  /**
   * Get command history
   */
  getHistory(limit?: number): CommandHistoryEntry[] {
    if (limit) {
      return this.history.slice(-limit);
    }
    return this.history;
  }

  /**
   * Clear command history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Get all categories
   */
  getCategories(): CommandCategory[] {
    return Array.from(this.categories.keys());
  }

  /**
   * Get command statistics
   */
  getStatistics(): {
    totalCommands: number;
    enabledCommands: number;
    disabledCommands: number;
    commandsByCategory: Record<CommandCategory, number>;
    totalAliases: number;
  } {
    const allCommands = Array.from(this.commands.values());
    const enabledCommands = allCommands.filter(c => c.enabled);
    const commandsByCategory: Record<CommandCategory, number> = {} as any;

    for (const [category, commands] of this.categories) {
      commandsByCategory[category] = commands.size;
    }

    return {
      totalCommands: allCommands.length,
      enabledCommands: enabledCommands.length,
      disabledCommands: allCommands.length - enabledCommands.length,
      commandsByCategory,
      totalAliases: this.aliases.size,
    };
  }

  /**
   * Generate help text for a command
   */
  generateHelp(name: string): string {
    const command = this.get(name);
    if (!command) {
      return `Command '${name}' not found`;
    }

    let help = `/${command.name}\n`;
    help += `  ${command.description}\n\n`;

    if (command.aliases.length > 0) {
      help += `Aliases: ${command.aliases.join(', ')}\n`;
    }

    if (command.arguments && command.arguments.length > 0) {
      help += '\nArguments:\n';
      for (const arg of command.arguments) {
        const required = arg.required ? '(required)' : '(optional)';
        help += `  ${arg.name} ${required}: ${arg.description}\n`;
      }
    }

    if (command.options && command.options.length > 0) {
      help += '\nOptions:\n';
      for (const opt of command.options) {
        const short = opt.short ? `-${opt.short}, ` : '';
        help += `  ${short}--${opt.name}: ${opt.description}\n`;
      }
    }

    if (command.examples.length > 0) {
      help += '\nExamples:\n';
      for (const example of command.examples) {
        help += `  ${example}\n`;
      }
    }

    return help;
  }

  /**
   * Generate general help text
   */
  generateGeneralHelp(): string {
    let help = 'Available Commands:\n\n';

    for (const category of this.getCategories()) {
      const commands = this.getByCategory(category);
      if (commands.length > 0) {
        help += `${category.toUpperCase()}:\n`;
        for (const command of commands) {
          help += `  /${command.name} - ${command.description}\n`;
        }
        help += '\n';
      }
    }

    help += 'Use /help <command> for detailed command information.\n';
    return help;
  }

  // Private methods

  private addToHistory(
    name: string,
    args: Record<string, unknown>,
    options: Record<string, unknown>
  ): void {
    this.history.push({
      name,
      args,
      options,
      timestamp: Date.now(),
    });

    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }
}

interface CommandHistoryEntry {
  name: string;
  args: Record<string, unknown>;
  options: Record<string, unknown>;
  timestamp: number;
}

// Global command registry instance
const commandRegistry = new SlashCommandRegistry();

export function registerCommand(command: SlashCommand): void {
  commandRegistry.register(command);
}

export function unregisterCommand(name: string): void {
  commandRegistry.unregister(name);
}

export function getCommand(name: string): SlashCommand | undefined {
  return commandRegistry.get(name);
}

export function getAllCommands(): SlashCommand[] {
  return commandRegistry.getAll();
}

export function getCommandsByCategory(category: CommandCategory): SlashCommand[] {
  return commandRegistry.getByCategory(category);
}

export function searchCommands(query: string): SlashCommand[] {
  return commandRegistry.search(query);
}

export async function executeCommand(
  name: string,
  args?: Record<string, unknown>,
  options?: Record<string, unknown>,
  context?: CommandContext
): Promise<CommandResult> {
  return commandRegistry.execute(name, args, options, context);
}

export function setCommandEnabled(name: string, enabled: boolean): void {
  commandRegistry.setEnabled(name, enabled);
}

export function getCommandHistory(limit?: number): CommandHistoryEntry[] {
  return commandRegistry.getHistory(limit);
}

export function clearCommandHistory(): void {
  commandRegistry.clearHistory();
}

export function getCategories(): CommandCategory[] {
  return commandRegistry.getCategories();
}

export function getCommandStatistics(): {
  totalCommands: number;
  enabledCommands: number;
  disabledCommands: number;
  commandsByCategory: Record<CommandCategory, number>;
  totalAliases: number;
} {
  return commandRegistry.getStatistics();
}

export function generateCommandHelp(name: string): string {
  return commandRegistry.generateHelp(name);
}

export function generateGeneralHelp(): string {
  return commandRegistry.generateGeneralHelp();
}
