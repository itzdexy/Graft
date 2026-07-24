/**
 * Advanced logging and analytics system
 * Provides comprehensive logging, analytics tracking, and insights generation
 */

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  source: string;
  userId?: string;
  sessionId?: string;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface AnalyticsEvent {
  id: string;
  timestamp: number;
  type: string;
  category: string;
  properties: Record<string, unknown>;
  userId?: string;
  sessionId?: string;
}

export interface LogConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  filePath?: string;
  maxFileSize: number;
  enableAnalytics: boolean;
  analyticsEndpoint?: string;
  samplingRate: number;
}

export interface AnalyticsMetrics {
  totalEvents: number;
  eventsByType: Map<string, number>;
  eventsByCategory: Map<string, number>;
  averageEventsPerSession: number;
  uniqueUsers: number;
  timeRange: { start: number; end: number };
}

export interface Insight {
  type: 'usage' | 'performance' | 'error' | 'feature';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  data: Record<string, unknown>;
  suggestion?: string;
}

class LoggingAnalyticsSystem {
  private logs: LogEntry[] = [];
  private events: AnalyticsEvent[] = [];
  private config: LogConfig;
  private sessionMetrics: Map<string, number> = new Map();
  private userSessions: Map<string, Set<string>> = new Map();

  constructor() {
    this.config = this.getDefaultConfig();
  }

  /**
   * Log a message
   */
  log(level: LogLevel, message: string, context?: Record<string, unknown>, source: string = 'system'): void {
    const entry: LogEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      level,
      message,
      context,
      source,
    };

    this.logs.push(entry);

    // Console output if enabled
    if (this.config.enableConsole) {
      this.outputToConsole(entry);
    }

    // Keep logs within limit
    if (this.logs.length > 10000) {
      this.logs.shift();
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: Record<string, unknown>, source?: string): void {
    this.log('debug', message, context, source);
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, unknown>, source?: string): void {
    this.log('info', message, context, source);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, unknown>, source?: string): void {
    this.log('warn', message, context, source);
  }

  /**
   * Log error message
   */
  error(message: string, context?: Record<string, unknown>, source?: string): void {
    this.log('error', message, context, source);
  }

  /**
   * Log fatal message
   */
  fatal(message: string, context?: Record<string, unknown>, source?: string): void {
    this.log('fatal', message, context, source);
  }

  /**
   * Track an analytics event
   */
  trackEvent(
    type: string,
    category: string,
    properties: Record<string, unknown>,
    userId?: string,
    sessionId?: string
  ): void {
    if (!this.config.enableAnalytics) return;

    // Apply sampling
    if (Math.random() > this.config.samplingRate) return;

    const event: AnalyticsEvent = {
      id: this.generateId(),
      timestamp: Date.now(),
      type,
      category,
      properties,
      userId,
      sessionId,
    };

    this.events.push(event);

    // Track session metrics
    if (sessionId) {
      const count = this.sessionMetrics.get(sessionId) || 0;
      this.sessionMetrics.set(sessionId, count + 1);
    }

    // Track user sessions
    if (userId && sessionId) {
      if (!this.userSessions.has(userId)) {
        this.userSessions.set(userId, new Set());
      }
      this.userSessions.get(userId)!.add(sessionId);
    }

    // Keep events within limit
    if (this.events.length > 10000) {
      this.events.shift();
    }
  }

  /**
   * Get logs
   */
  getLogs(level?: LogLevel, limit?: number): LogEntry[] {
    let filtered = this.logs;
    
    if (level) {
      filtered = filtered.filter(log => log.level === level);
    }

    if (limit) {
      filtered = filtered.slice(-limit);
    }

    return filtered;
  }

  /**
   * Get events
   */
  getEvents(type?: string, category?: string, limit?: number): AnalyticsEvent[] {
    let filtered = this.events;

    if (type) {
      filtered = filtered.filter(event => event.type === type);
    }

    if (category) {
      filtered = filtered.filter(event => event.category === category);
    }

    if (limit) {
      filtered = filtered.slice(-limit);
    }

    return filtered;
  }

  /**
   * Get analytics metrics
   */
  getAnalyticsMetrics(timeRange?: { start: number; end: number }): AnalyticsMetrics {
    let events = this.events;

    if (timeRange) {
      events = events.filter(e => e.timestamp >= timeRange.start && e.timestamp <= timeRange.end);
    }

    const eventsByType = new Map<string, number>();
    const eventsByCategory = new Map<string, number>();

    for (const event of events) {
      eventsByType.set(event.type, (eventsByType.get(event.type) || 0) + 1);
      eventsByCategory.set(event.category, (eventsByCategory.get(event.category) || 0) + 1);
    }

    const totalEvents = events.length;
    const sessionIds = new Set(events.map(e => e.sessionId).filter(Boolean) as string[]);
    const averageEventsPerSession = sessionIds.size > 0 ? totalEvents / sessionIds.size : 0;
    const uniqueUsers = new Set(events.map(e => e.userId).filter(Boolean) as string[]).size;

    return {
      totalEvents,
      eventsByType,
      eventsByCategory,
      averageEventsPerSession,
      uniqueUsers,
      timeRange: timeRange || { start: 0, end: Date.now() },
    };
  }

  /**
   * Generate insights
   */
  generateInsights(): Insight[] {
    const insights: Insight[] = [];
    const metrics = this.getAnalyticsMetrics();
    const logs = this.getLogs();

    // Error rate insight
    const errorLogs = logs.filter(l => l.level === 'error' || l.level === 'fatal');
    const errorRate = logs.length > 0 ? (errorLogs.length / logs.length) * 100 : 0;

    if (errorRate > 5) {
      insights.push({
        type: 'error',
        title: 'High Error Rate',
        description: `Error rate is ${errorRate.toFixed(1)}%, which is above the 5% threshold`,
        severity: 'critical',
        data: { errorRate, totalErrors: errorLogs.length },
        suggestion: 'Review error logs and address critical issues',
      });
    }

    // Usage pattern insight
    const mostUsedFeatures = Array.from(metrics.eventsByType.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (mostUsedFeatures.length > 0) {
      insights.push({
        type: 'usage',
        title: 'Top Features',
        description: 'Most frequently used features',
        severity: 'info',
        data: { topFeatures: mostUsedFeatures },
      });
    }

    // Performance insight
    const slowOperations = this.events.filter(e => 
      e.category === 'performance' && 
      e.properties.duration && 
      typeof e.properties.duration === 'number' &&
      e.properties.duration > 1000
    );

    if (slowOperations.length > 0) {
      insights.push({
        type: 'performance',
        title: 'Slow Operations Detected',
        description: `${slowOperations.length} operations took longer than 1 second`,
        severity: 'warning',
        data: { slowOperations: slowOperations.length },
        suggestion: 'Consider optimizing slow operations or adding caching',
      });
    }

    // Feature adoption insight
    const uniqueFeatures = metrics.eventsByType.size;
    if (uniqueFeatures > 0) {
      insights.push({
        type: 'feature',
        title: 'Feature Adoption',
        description: `${uniqueFeatures} different features have been used`,
        severity: 'info',
        data: { uniqueFeatures },
      });
    }

    return insights;
  }

  /**
   * Get log configuration
   */
  getConfig(): LogConfig {
    return { ...this.config };
  }

  /**
   * Update log configuration
   */
  updateConfig(config: Partial<LogConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Clear events
   */
  clearEvents(): void {
    this.events = [];
  }

  /**
   * Export logs
   */
  exportLogs(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2);
    } else {
      const headers = ['id', 'timestamp', 'level', 'message', 'source'];
      const rows = this.logs.map(log => 
        headers.map(h => String(log[h as keyof LogEntry])).join(',')
      );
      return [headers.join(','), ...rows].join('\n');
    }
  }

  /**
   * Export events
   */
  exportEvents(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.events, null, 2);
    } else {
      const headers = ['id', 'timestamp', 'type', 'category'];
      const rows = this.events.map(event => 
        headers.map(h => String(event[h as keyof AnalyticsEvent])).join(',')
      );
      return [headers.join(','), ...rows].join('\n');
    }
  }

  /**
   * Generate analytics report
   */
  generateAnalyticsReport(): string {
    const metrics = this.getAnalyticsMetrics();
    const insights = this.generateInsights();
    const logs = this.getLogs();

    let report = 'Analytics Report\n';
    report += '================\n\n';
    report += `Total Events: ${metrics.totalEvents}\n`;
    report += `Unique Users: ${metrics.uniqueUsers}\n`;
    report += `Avg Events/Session: ${metrics.averageEventsPerSession.toFixed(1)}\n`;
    report += `Total Logs: ${logs.length}\n\n`;

    report += 'Events by Type:\n';
    Array.from(metrics.eventsByType.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        report += `- ${type}: ${count}\n`;
      });

    report += '\nEvents by Category:\n';
    Array.from(metrics.eventsByCategory.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        report += `- ${category}: ${count}\n`;
      });

    report += '\nInsights:\n';
    insights.forEach(insight => {
      report += `- [${insight.severity.toUpperCase()}] ${insight.title}\n`;
      report += `  ${insight.description}\n`;
      if (insight.suggestion) {
        report += `  Suggestion: ${insight.suggestion}\n`;
      }
    });

    return report;
  }

  // Private helper methods

  private getDefaultConfig(): LogConfig {
    return {
      level: 'info',
      enableConsole: true,
      enableFile: false,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      enableAnalytics: true,
      samplingRate: 1.0,
    };
  }

  private outputToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.source}]`;
    
    switch (entry.level) {
      case 'debug':
        console.debug(prefix, entry.message, entry.context);
        break;
      case 'info':
        console.info(prefix, entry.message, entry.context);
        break;
      case 'warn':
        console.warn(prefix, entry.message, entry.context);
        break;
      case 'error':
      case 'fatal':
        console.error(prefix, entry.message, entry.context);
        break;
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Global logging analytics instance
const loggingAnalytics = new LoggingAnalyticsSystem();

export function log(level: LogLevel, message: string, context?: Record<string, unknown>, source?: string): void {
  loggingAnalytics.log(level, message, context, source);
}

export function debug(message: string, context?: Record<string, unknown>, source?: string): void {
  loggingAnalytics.debug(message, context, source);
}

export function info(message: string, context?: Record<string, unknown>, source?: string): void {
  loggingAnalytics.info(message, context, source);
}

export function warn(message: string, context?: Record<string, unknown>, source?: string): void {
  loggingAnalytics.warn(message, context, source);
}

export function error(message: string, context?: Record<string, unknown>, source?: string): void {
  loggingAnalytics.error(message, context, source);
}

export function fatal(message: string, context?: Record<string, unknown>, source?: string): void {
  loggingAnalytics.fatal(message, context, source);
}

export function trackEvent(
  type: string,
  category: string,
  properties: Record<string, unknown>,
  userId?: string,
  sessionId?: string
): void {
  loggingAnalytics.trackEvent(type, category, properties, userId, sessionId);
}

export function getLogs(level?: LogLevel, limit?: number): LogEntry[] {
  return loggingAnalytics.getLogs(level, limit);
}

export function getEvents(type?: string, category?: string, limit?: number): AnalyticsEvent[] {
  return loggingAnalytics.getEvents(type, category, limit);
}

export function getAnalyticsMetrics(timeRange?: { start: number; end: number }): AnalyticsMetrics {
  return loggingAnalytics.getAnalyticsMetrics(timeRange);
}

export function generateInsights(): Insight[] {
  return loggingAnalytics.generateInsights();
}

export function getConfig(): LogConfig {
  return loggingAnalytics.getConfig();
}

export function updateConfig(config: Partial<LogConfig>): void {
  loggingAnalytics.updateConfig(config);
}

export function clearLogs(): void {
  loggingAnalytics.clearLogs();
}

export function clearEvents(): void {
  loggingAnalytics.clearEvents();
}

export function exportLogs(format?: 'json' | 'csv'): string {
  return loggingAnalytics.exportLogs(format);
}

export function exportEvents(format?: 'json' | 'csv'): string {
  return loggingAnalytics.exportEvents(format);
}

export function generateAnalyticsReport(): string {
  return loggingAnalytics.generateAnalyticsReport();
}
