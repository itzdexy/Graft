/**
 * OpenTelemetry Observability
 * Inspired by AutoGen's OpenTelemetry integration for distributed tracing
 * Provides metrics, traces, and logs with OpenTelemetry-compatible instrumentation
 */

export interface TelemetryConfig {
  serviceName: string;
  serviceVersion: string;
  enableTracing: boolean;
  enableMetrics: boolean;
  enableLogging: boolean;
  exporter: TelemetryExporter;
  samplingRate: number;
}

export interface TelemetryExporter {
  type: 'console' | 'otlp' | 'jaeger' | 'zipkin' | 'custom';
  endpoint?: string;
  headers?: Record<string, string>;
  customExporter?: CustomExporter;
}

export interface CustomExporter {
  exportSpan(span: Span): Promise<void>;
  exportMetric(metric: Metric): Promise<void>;
  exportLog(log: LogRecord): Promise<void>;
}

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: SpanStatus;
  attributes: Record<string, unknown>;
  events: SpanEvent[];
  links: SpanLink[];
}

export type SpanStatus = 'unset' | 'ok' | 'error';

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes: Record<string, unknown>;
}

export interface SpanLink {
  traceId: string;
  spanId: string;
  attributes: Record<string, unknown>;
}

export interface Metric {
  name: string;
  type: MetricType;
  value: number;
  timestamp: number;
  attributes: Record<string, unknown>;
}

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

export interface LogRecord {
  timestamp: number;
  severity: LogSeverity;
  body: string;
  attributes: Record<string, unknown>;
  traceId?: string;
  spanId?: string;
}

export type LogSeverity = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface Tracer {
  name: string;
  startSpan(name: string, parentSpan?: Span): Span;
  endSpan(span: Span): void;
  addEvent(span: Span, name: string, attributes?: Record<string, unknown>): void;
  setAttribute(span: Span, key: string, value: unknown): void;
  recordException(span: Span, exception: Error): void;
}

export interface Meter {
  name: string;
  createCounter(name: string): Counter;
  createGauge(name: string): Gauge;
  createHistogram(name: string): Histogram;
  createSummary(name: string): Summary;
}

export interface Counter {
  name: string;
  increment(value?: number, attributes?: Record<string, unknown>): void;
}

export interface Gauge {
  name: string;
  set(value: number, attributes?: Record<string, unknown>): void;
}

export interface Histogram {
  name: string;
  record(value: number, attributes?: Record<string, unknown>): void;
}

export interface Summary {
  name: string;
  record(value: number, attributes?: Record<string, unknown>): void;
}

export interface Logger {
  name: string;
  emit(severity: LogSeverity, body: string, attributes?: Record<string, unknown>): void;
  trace(body: string, attributes?: Record<string, unknown>): void;
  debug(body: string, attributes?: Record<string, unknown>): void;
  info(body: string, attributes?: Record<string, unknown>): void;
  warn(body: string, attributes?: Record<string, unknown>): void;
  error(body: string, attributes?: Record<string, unknown>): void;
  fatal(body: string, attributes?: Record<string, unknown>): void;
}

export interface TelemetrySession {
  id: string;
  traces: Span[];
  metrics: Metric[];
  logs: LogRecord[];
  startTime: number;
  endTime?: number;
}

class OpenTelemetryManager {
  private config: TelemetryConfig;
  private tracers: Map<string, Tracer> = new Map();
  private meters: Map<string, Meter> = new Map();
  private loggers: Map<string, Logger> = new Map();
  private sessions: Map<string, TelemetrySession> = new Map();
  private activeSession: string | null = null;

  constructor(config: TelemetryConfig) {
    this.config = config;
  }

  /**
   * Get a tracer
   */
  getTracer(name: string): Tracer {
    if (!this.tracers.has(name)) {
      this.tracers.set(name, this.createTracer(name));
    }
    return this.tracers.get(name)!;
  }

  /**
   * Get a meter
   */
  getMeter(name: string): Meter {
    if (!this.meters.has(name)) {
      this.meters.set(name, this.createMeter(name));
    }
    return this.meters.get(name)!;
  }

  /**
   * Get a logger
   */
  getLogger(name: string): Logger {
    if (!this.loggers.has(name)) {
      this.loggers.set(name, this.createLogger(name));
    }
    return this.loggers.get(name)!;
  }

  /**
   * Start a telemetry session
   */
  startSession(): TelemetrySession {
    const session: TelemetrySession = {
      id: this.generateSessionId(),
      traces: [],
      metrics: [],
      logs: [],
      startTime: Date.now(),
    };

    this.sessions.set(session.id, session);
    this.activeSession = session.id;

    return session;
  }

  /**
   * End a telemetry session
   */
  endSession(sessionId?: string): TelemetrySession | null {
    const id = sessionId || this.activeSession;
    if (!id) return null;

    const session = this.sessions.get(id);
    if (!session) return null;

    session.endTime = Date.now();

    if (id === this.activeSession) {
      this.activeSession = null;
    }

    return session;
  }

  /**
   * Get a session
   */
  getSession(sessionId: string): TelemetrySession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get active session
   */
  getActiveSession(): TelemetrySession | undefined {
    if (!this.activeSession) return undefined;
    return this.sessions.get(this.activeSession);
  }

  /**
   * Get all sessions
   */
  getAllSessions(): TelemetrySession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Export telemetry data
   */
  async exportSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    try {
      // Export spans
      for (const span of session.traces) {
        await this.exportSpan(span);
      }

      // Export metrics
      for (const metric of session.metrics) {
        await this.exportMetric(metric);
      }

      // Export logs
      for (const log of session.logs) {
        await this.exportLog(log);
      }

      return true;
    } catch (error) {
      console.error('Export failed:', error);
      return false;
    }
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalTracers: number;
    totalMeters: number;
    totalLoggers: number;
    totalSessions: number;
    totalSpans: number;
    totalMetrics: number;
    totalLogs: number;
  } {
    const sessions = this.getAllSessions();

    return {
      totalTracers: this.tracers.size,
      totalMeters: this.meters.size,
      totalLoggers: this.loggers.size,
      totalSessions: sessions.length,
      totalSpans: sessions.reduce((sum, s) => sum + s.traces.length, 0),
      totalMetrics: sessions.reduce((sum, s) => sum + s.metrics.length, 0),
      totalLogs: sessions.reduce((sum, s) => sum + s.logs.length, 0),
    };
  }

  // Private methods

  private createTracer(name: string): Tracer {
    const manager = this;

    return {
      name,
      startSpan(spanName: string, parentSpan?: Span): Span {
        const span: Span = {
          traceId: manager.generateTraceId(),
          spanId: manager.generateSpanId(),
          parentSpanId: parentSpan?.spanId,
          name: spanName,
          startTime: Date.now(),
          status: 'unset',
          attributes: {},
          events: [],
          links: [],
        };

        manager.addToSession(span);
        return span;
      },

      endSpan(span: Span): void {
        span.endTime = Date.now();
        span.duration = span.endTime - span.startTime;
      },

      addEvent(span: Span, eventName: string, attributes?: Record<string, unknown>): void {
        span.events.push({
          name: eventName,
          timestamp: Date.now(),
          attributes: attributes || {},
        });
      },

      setAttribute(span: Span, key: string, value: unknown): void {
        span.attributes[key] = value;
      },

      recordException(span: Span, exception: Error): void {
        span.status = 'error';
        span.events.push({
          name: 'exception',
          timestamp: Date.now(),
          attributes: {
            'exception.type': exception.name,
            'exception.message': exception.message,
            'exception.stacktrace': exception.stack,
          },
        });
      },
    };
  }

  private createMeter(name: string): Meter {
    const manager = this;

    return {
      name,
      createCounter(counterName: string): Counter {
        return {
          name: counterName,
          increment(value = 1, attributes = {}) {
            const metric: Metric = {
              name: counterName,
              type: 'counter',
              value,
              timestamp: Date.now(),
              attributes,
            };
            manager.addToSession(metric);
          },
        };
      },

      createGauge(gaugeName: string): Gauge {
        return {
          name: gaugeName,
          set(value, attributes = {}) {
            const metric: Metric = {
              name: gaugeName,
              type: 'gauge',
              value,
              timestamp: Date.now(),
              attributes,
            };
            manager.addToSession(metric);
          },
        };
      },

      createHistogram(histogramName: string): Histogram {
        return {
          name: histogramName,
          record(value, attributes = {}) {
            const metric: Metric = {
              name: histogramName,
              type: 'histogram',
              value,
              timestamp: Date.now(),
              attributes,
            };
            manager.addToSession(metric);
          },
        };
      },

      createSummary(summaryName: string): Summary {
        return {
          name: summaryName,
          record(value, attributes = {}) {
            const metric: Metric = {
              name: summaryName,
              type: 'summary',
              value,
              timestamp: Date.now(),
              attributes,
            };
            manager.addToSession(metric);
          },
        };
      },
    };
  }

  private createLogger(name: string): Logger {
    const manager = this;

    return {
      name,
      emit(severity, body, attributes = {}) {
        const log: LogRecord = {
          timestamp: Date.now(),
          severity,
          body,
          attributes,
        };
        manager.addToSession(log);
      },

      trace(body, attributes) {
        this.emit('trace', body, attributes);
      },

      debug(body, attributes) {
        this.emit('debug', body, attributes);
      },

      info(body, attributes) {
        this.emit('info', body, attributes);
      },

      warn(body, attributes) {
        this.emit('warn', body, attributes);
      },

      error(body, attributes) {
        this.emit('error', body, attributes);
      },

      fatal(body, attributes) {
        this.emit('fatal', body, attributes);
      },
    };
  }

  private addToSession(data: Span | Metric | LogRecord): void {
    const session = this.getActiveSession();
    if (!session) return;

    if ('traceId' in data && 'spanId' in data) {
      session.traces.push(data as Span);
    } else if ('type' in data && 'value' in data) {
      session.metrics.push(data as Metric);
    } else {
      session.logs.push(data as LogRecord);
    }
  }

  private async exportSpan(span: Span): Promise<void> {
    if (this.config.exporter.type === 'console') {
      console.log('[SPAN]', JSON.stringify(span, null, 2));
    } else if (this.config.exporter.customExporter) {
      await this.config.exporter.customExporter.exportSpan(span);
    }
  }

  private async exportMetric(metric: Metric): Promise<void> {
    if (this.config.exporter.type === 'console') {
      console.log('[METRIC]', JSON.stringify(metric, null, 2));
    } else if (this.config.exporter.customExporter) {
      await this.config.exporter.customExporter.exportMetric(metric);
    }
  }

  private async exportLog(log: LogRecord): Promise<void> {
    if (this.config.exporter.type === 'console') {
      console.log('[LOG]', JSON.stringify(log, null, 2));
    } else if (this.config.exporter.customExporter) {
      await this.config.exporter.customExporter.exportLog(log);
    }
  }

  private generateTraceId(): string {
    return this.generateId(32);
  }

  private generateSpanId(): string {
    return this.generateId(16);
  }

  private generateSessionId(): string {
    return this.generateId(16);
  }

  private generateId(length: number): string {
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }
}

// Global OpenTelemetry manager instance
let openTelemetryManager: OpenTelemetryManager | null = null;

export function initializeOpenTelemetry(config: TelemetryConfig): void {
  openTelemetryManager = new OpenTelemetryManager(config);
}

export function getTracer(name: string): Tracer {
  if (!openTelemetryManager) {
    throw new Error('OpenTelemetry not initialized. Call initializeOpenTelemetry first.');
  }
  return openTelemetryManager.getTracer(name);
}

export function getMeter(name: string): Meter {
  if (!openTelemetryManager) {
    throw new Error('OpenTelemetry not initialized. Call initializeOpenTelemetry first.');
  }
  return openTelemetryManager.getMeter(name);
}

export function getLogger(name: string): Logger {
  if (!openTelemetryManager) {
    throw new Error('OpenTelemetry not initialized. Call initializeOpenTelemetry first.');
  }
  return openTelemetryManager.getLogger(name);
}

export function startSession(): TelemetrySession {
  if (!openTelemetryManager) {
    throw new Error('OpenTelemetry not initialized. Call initializeOpenTelemetry first.');
  }
  return openTelemetryManager.startSession();
}

export function endSession(sessionId?: string): TelemetrySession | null {
  if (!openTelemetryManager) {
    throw new Error('OpenTelemetry not initialized. Call initializeOpenTelemetry first.');
  }
  return openTelemetryManager.endSession(sessionId);
}

export function getSession(sessionId: string): TelemetrySession | undefined {
  if (!openTelemetryManager) {
    throw new Error('OpenTelemetry not initialized. Call initializeOpenTelemetry first.');
  }
  return openTelemetryManager.getSession(sessionId);
}

export function getActiveSession(): TelemetrySession | undefined {
  if (!openTelemetryManager) {
    throw new Error('OpenTelemetry not initialized. Call initializeOpenTelemetry first.');
  }
  return openTelemetryManager.getActiveSession();
}

export function getAllSessions(): TelemetrySession[] {
  if (!openTelemetryManager) {
    throw new Error('OpenTelemetry not initialized. Call initializeOpenTelemetry first.');
  }
  return openTelemetryManager.getAllSessions();
}

export async function exportSession(sessionId: string): Promise<boolean> {
  if (!openTelemetryManager) {
    throw new Error('OpenTelemetry not initialized. Call initializeOpenTelemetry first.');
  }
  return openTelemetryManager.exportSession(sessionId);
}

export function getStatistics(): {
  totalTracers: number;
  totalMeters: number;
  totalLoggers: number;
  totalSessions: number;
  totalSpans: number;
  totalMetrics: number;
  totalLogs: number;
} {
  if (!openTelemetryManager) {
    throw new Error('OpenTelemetry not initialized. Call initializeOpenTelemetry first.');
  }
  return openTelemetryManager.getStatistics();
}
