/**
 * Voice command support system
 * Provides speech recognition and voice command execution using Web Speech API
 */

export interface VoiceCommand {
  phrase: string;
  action: () => void | Promise<void>;
  description: string;
  category: 'navigation' | 'editing' | 'system' | 'custom';
  enabled: boolean;
  confidenceThreshold: number;
}

export interface VoiceRecognitionConfig {
  language: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  autoStart: boolean;
  wakeWord?: string;
}

export interface VoiceCommandResult {
  transcript: string;
  confidence: number;
  matchedCommand: VoiceCommand | null;
  success: boolean;
  error?: string;
}

type RecognitionState = 'idle' | 'listening' | 'processing' | 'error';

class VoiceCommandSystem {
  private commands: VoiceCommand[] = [];
  private config: VoiceRecognitionConfig;
  private state: RecognitionState = 'idle';
  private recognition: any = null;
  private isSupported = false;
  private eventListeners: Map<string, ((data: any) => void)[]> = new Map();

  constructor() {
    this.config = this.getDefaultConfig();
    this.checkSupport();
    this.initializeDefaultCommands();
  }

  /**
   * Check if speech recognition is supported
   */
  private checkSupport(): void {
    this.isSupported = 'webkitSpeechRecognition' in window || 
                      'SpeechRecognition' in window;
  }

  /**
   * Initialize default voice commands
   */
  private initializeDefaultCommands(): void {
    this.commands = [
      {
        phrase: 'start listening',
        action: () => this.startListening(),
        description: 'Start voice recognition',
        category: 'system',
        enabled: true,
        confidenceThreshold: 0.7,
      },
      {
        phrase: 'stop listening',
        action: () => this.stopListening(),
        description: 'Stop voice recognition',
        category: 'system',
        enabled: true,
        confidenceThreshold: 0.7,
      },
      {
        phrase: 'save',
        action: () => this.executeCommand('save'),
        description: 'Save current file',
        category: 'editing',
        enabled: true,
        confidenceThreshold: 0.8,
      },
      {
        phrase: 'open file',
        action: () => this.executeCommand('open-file'),
        description: 'Open file dialog',
        category: 'navigation',
        enabled: true,
        confidenceThreshold: 0.8,
      },
      {
        phrase: 'close file',
        action: () => this.executeCommand('close-file'),
        description: 'Close current file',
        category: 'navigation',
        enabled: true,
        confidenceThreshold: 0.8,
      },
      {
        phrase: 'new file',
        action: () => this.executeCommand('new-file'),
        description: 'Create new file',
        category: 'navigation',
        enabled: true,
        confidenceThreshold: 0.8,
      },
      {
        phrase: 'undo',
        action: () => this.executeCommand('undo'),
        description: 'Undo last action',
        category: 'editing',
        enabled: true,
        confidenceThreshold: 0.8,
      },
      {
        phrase: 'redo',
        action: () => this.executeCommand('redo'),
        description: 'Redo last action',
        category: 'editing',
        enabled: true,
        confidenceThreshold: 0.8,
      },
      {
        phrase: 'copy',
        action: () => this.executeCommand('copy'),
        description: 'Copy selection',
        category: 'editing',
        enabled: true,
        confidenceThreshold: 0.8,
      },
      {
        phrase: 'paste',
        action: () => this.executeCommand('paste'),
        description: 'Paste clipboard',
        category: 'editing',
        enabled: true,
        confidenceThreshold: 0.8,
      },
      {
        phrase: 'cut',
        action: () => this.executeCommand('cut'),
        description: 'Cut selection',
        category: 'editing',
        enabled: true,
        confidenceThreshold: 0.8,
      },
      {
        phrase: 'find',
        action: () => this.executeCommand('find'),
        description: 'Open find dialog',
        category: 'navigation',
        enabled: true,
        confidenceThreshold: 0.8,
      },
      {
        phrase: 'replace',
        action: () => this.executeCommand('replace'),
        description: 'Open replace dialog',
        category: 'navigation',
        enabled: true,
        confidenceThreshold: 0.8,
      },
      {
        phrase: 'go to line',
        action: () => this.executeCommand('goto-line'),
        description: 'Go to specific line',
        category: 'navigation',
        enabled: true,
        confidenceThreshold: 0.8,
      },
      {
        phrase: 'run tests',
        action: () => this.executeCommand('run-tests'),
        description: 'Run project tests',
        category: 'system',
        enabled: true,
        confidenceThreshold: 0.8,
      },
      {
        phrase: 'build',
        action: () => this.executeCommand('build'),
        description: 'Build project',
        category: 'system',
        enabled: true,
        confidenceThreshold: 0.8,
      },
      {
        phrase: 'help',
        action: () => this.executeCommand('help'),
        description: 'Show help',
        category: 'system',
        enabled: true,
        confidenceThreshold: 0.8,
      },
    ];
  }

  /**
   * Start voice recognition
   */
  async startListening(): Promise<void> {
    if (!this.isSupported) {
      throw new Error('Speech recognition is not supported in this browser');
    }

    if (this.state === 'listening') {
      return;
    }

    try {
      this.state = 'listening';
      this.emit('listening-started', {});

      // Initialize recognition
      const SpeechRecognition = (window as any).SpeechRecognition || 
                                (window as any).webkitSpeechRecognition;
      
      this.recognition = new SpeechRecognition();
      this.recognition.lang = this.config.language;
      this.recognition.continuous = this.config.continuous;
      this.recognition.interimResults = this.config.interimResults;
      this.recognition.maxAlternatives = this.config.maxAlternatives;

      this.recognition.onresult = (event: any) => this.handleResult(event);
      this.recognition.onerror = (event: any) => this.handleError(event);
      this.recognition.onend = () => this.handleEnd();

      this.recognition.start();
    } catch (error) {
      this.state = 'error';
      this.emit('error', { error: String(error) });
      throw error;
    }
  }

  /**
   * Stop voice recognition
   */
  stopListening(): void {
    if (this.recognition) {
      this.recognition.stop();
    }
    this.state = 'idle';
    this.emit('listening-stopped', {});
  }

  /**
   * Add a custom voice command
   */
  addCommand(command: VoiceCommand): void {
    this.commands.push(command);
  }

  /**
   * Remove a voice command
   */
  removeCommand(phrase: string): void {
    this.commands = this.commands.filter(c => c.phrase !== phrase);
  }

  /**
   * Get all commands
   */
  getCommands(): VoiceCommand[] {
    return this.commands.filter(c => c.enabled);
  }

  /**
   * Get commands by category
   */
  getCommandsByCategory(category: VoiceCommand['category']): VoiceCommand[] {
    return this.commands.filter(c => c.category === category && c.enabled);
  }

  /**
   * Enable/disable a command
   */
  setCommandEnabled(phrase: string, enabled: boolean): void {
    const command = this.commands.find(c => c.phrase === phrase);
    if (command) {
      command.enabled = enabled;
    }
  }

  /**
   * Get current state
   */
  getState(): RecognitionState {
    return this.state;
  }

  /**
   * Check if voice recognition is supported
   */
  isRecognitionSupported(): boolean {
    return this.isSupported;
  }

  /**
   * Get configuration
   */
  getConfig(): VoiceRecognitionConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<VoiceRecognitionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get available languages
   */
  getAvailableLanguages(): string[] {
    return [
      'en-US',
      'en-GB',
      'es-ES',
      'fr-FR',
      'de-DE',
      'it-IT',
      'pt-BR',
      'ja-JP',
      'ko-KR',
      'zh-CN',
      'zh-TW',
      'ru-RU',
      'ar-SA',
      'hi-IN',
    ];
  }

  /**
   * Execute a command by name
   */
  private async executeCommand(commandName: string): Promise<void> {
    this.emit('command-executed', { command: commandName });
    // In a real implementation, this would execute the actual command
    console.log(`Executing command: ${commandName}`);
  }

  /**
   * Handle speech recognition result
   */
  private handleResult(event: any): void {
    this.state = 'processing';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      
      if (result.isFinal) {
        const transcript = result[0].transcript.toLowerCase().trim();
        const confidence = result[0].confidence;

        const matched = this.matchCommand(transcript, confidence);
        
        this.emit('result', {
          transcript: result[0].transcript,
          confidence,
          matched: matched !== null,
        });

        if (matched && confidence >= matched.confidenceThreshold) {
          try {
            matched.action();
          } catch (error) {
            this.emit('command-error', { command: matched.phrase, error: String(error) });
          }
        }
      }
    }

    this.state = 'listening';
  }

  /**
   * Match transcript to a command
   */
  private matchCommand(transcript: string, confidence: number): VoiceCommand | null {
    const enabledCommands = this.commands.filter(c => c.enabled);

    for (const command of enabledCommands) {
      const phrase = command.phrase.toLowerCase();
      
      // Exact match
      if (transcript === phrase) {
        return command;
      }

      // Contains match
      if (transcript.includes(phrase)) {
        return command;
      }

      // Fuzzy match (simple implementation)
      const similarity = this.calculateSimilarity(transcript, phrase);
      if (similarity > 0.8) {
        return command;
      }
    }

    return null;
  }

  /**
   * Calculate similarity between two strings
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Handle recognition error
   */
  private handleError(event: any): void {
    this.state = 'error';
    this.emit('error', { error: event.error });
  }

  /**
   * Handle recognition end
   */
  private handleEnd(): void {
    if (this.state === 'listening') {
      this.state = 'idle';
    }
    this.emit('listening-ended', {});
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach(listener => listener(data));
  }

  /**
   * Add event listener
   */
  on(event: string, callback: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: (data: any) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): VoiceRecognitionConfig {
    return {
      language: 'en-US',
      continuous: true,
      interimResults: true,
      maxAlternatives: 3,
      autoStart: false,
      wakeWord: 'blink',
    };
  }
}

// Global voice command system instance
const voiceCommandSystem = new VoiceCommandSystem();

export function startListening(): Promise<void> {
  return voiceCommandSystem.startListening();
}

export function stopListening(): void {
  voiceCommandSystem.stopListening();
}

export function addCommand(command: VoiceCommand): void {
  voiceCommandSystem.addCommand(command);
}

export function removeCommand(phrase: string): void {
  voiceCommandSystem.removeCommand(phrase);
}

export function getCommands(): VoiceCommand[] {
  return voiceCommandSystem.getCommands();
}

export function getCommandsByCategory(category: VoiceCommand['category']): VoiceCommand[] {
  return voiceCommandSystem.getCommandsByCategory(category);
}

export function setCommandEnabled(phrase: string, enabled: boolean): void {
  voiceCommandSystem.setCommandEnabled(phrase, enabled);
}

export function getState(): RecognitionState {
  return voiceCommandSystem.getState();
}

export function isRecognitionSupported(): boolean {
  return voiceCommandSystem.isRecognitionSupported();
}

export function getConfig(): VoiceRecognitionConfig {
  return voiceCommandSystem.getConfig();
}

export function updateConfig(config: Partial<VoiceRecognitionConfig>): void {
  voiceCommandSystem.updateConfig(config);
}

export function getAvailableLanguages(): string[] {
  return voiceCommandSystem.getAvailableLanguages();
}

export function on(event: string, callback: (data: any) => void): void {
  voiceCommandSystem.on(event, callback);
}

export function off(event: string, callback: (data: any) => void): void {
  voiceCommandSystem.off(event, callback);
}
