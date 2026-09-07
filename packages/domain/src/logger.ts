/**
 * Structured Logger with Privacy-First Design
 * Epic 1.9: Observability with structured logging and telemetry
 * 
 * Features:
 * - Structured JSON logging
 * - Automatic PII/redacted data filtering
 * - Context-aware logging with correlation IDs
 * - Multiple log levels with configurable thresholds
 * - Privacy safeguards for sensitive data (PII, financial, credentials)
 */

import { Result, ok, err } from './result.js';
import { Clock, getClock } from './clock.js';
import { DomainError, isDomainError } from './errors.js';

/**
 * Log level enum
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL',
}

/**
 * Log entry interface for structured logging
 */
export interface LogEntry {
  timestamp: string;        // ISO 8601 timestamp
  level: LogLevel;         // Log level
  message: string;         // Human-readable message
  context: Record<string, unknown>; // Additional context data
  correlationId?: string;  // Request/session correlation ID
  error?: ErrorInfo;       // Error details if applicable
  metadata?: Record<string, unknown>; // Application-specific metadata
}

/**
 * Error info for structured error logging
 */
export interface ErrorInfo {
  name: string;
  message: string;
  stack?: string;
  code?: string;
  context?: Record<string, unknown>;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level?: LogLevel;
  format?: 'json' | 'human';
  redactPaths?: string[];
  maxDepth?: number;
  includeTimestamp?: boolean;
  context?: Record<string, unknown>;
}

/**
 * Default redacted fields (PII, credentials, financial data)
 */
export const DEFAULT_REDACTED_PATHS = [
  'password',
  'secret',
  'token',
  'apiKey',
  'apiKey',
  'creditCard',
  'cardNumber',
  'cvv',
  'expiry',
  'amount',
  'balance',
  'email',
  'phone',
  'ssn',
  'socialSecurity',
  'bankAccount',
  'routingNumber',
  'paypalEmail',
  'venmoHandle',
  'applePay',
  'googlePay',
  'paymentMethod',
  'user',
  'userId',
  'customerId',
  'merchantId',
];

/**
 * Logger class with structured output and privacy features
 */
export class Logger {
  private config: LoggerConfig;
  private clock: Clock;
  private correlationId: string | undefined;

  constructor(config: LoggerConfig = {}) {
    this.config = {
      level: config.level ?? LogLevel.INFO,
      format: config.format ?? 'human',
      redactPaths: [...(config.redactPaths ?? []), ...DEFAULT_REDACTED_PATHS],
      maxDepth: config.maxDepth ?? 10,
      includeTimestamp: config.includeTimestamp ?? true,
      ...(config.context !== undefined && { context: config.context }),
    };
    this.clock = getClock();
  }

  /**
   * Set correlation ID for request/session tracking
   */
  withCorrelationId(id: string): this {
    this.correlationId = id;
    return this;
  }

  /**
   * Create child logger with additional context
   */
  child(context: Record<string, unknown>): Logger {
    const newContext = { ...this.config.context, ...context };
    const childLogger = new Logger({
      ...this.config,
      context: newContext,
    });
    // Preserve correlation ID and clock
    if (this.correlationId) {
      childLogger.correlationId = this.correlationId;
    }
    childLogger.clock = this.clock;
    return childLogger;
  }

  /**
   * Log at DEBUG level
   */
  debug(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.log(LogLevel.DEBUG, message, context);
    }
  }

  /**
   * Log at INFO level
   */
  info(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.log(LogLevel.INFO, message, context);
    }
  }

  /**
   * Log at WARN level
   */
  warn(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.log(LogLevel.WARN, message, context);
    }
  }

  /**
   * Log at ERROR level
   */
  error(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.log(LogLevel.ERROR, message, context);
    }
  }

  /**
   * Log at FATAL level
   */
  fatal(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.FATAL)) {
      this.log(LogLevel.FATAL, message, context);
    }
  }

  /**
   * Log an error with stack trace
   */
  errorWithStack(error: Error, context?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const domainError = isDomainError(error) ? error : undefined;
      const errorInfo: ErrorInfo = {
        name: error.name,
        message: error.message,
        ...(error.stack !== undefined && { stack: error.stack }),
        ...(domainError !== undefined && { code: domainError.code }),
        ...(domainError?.context !== undefined && { context: domainError.context }),
      };
      this.log(LogLevel.ERROR, error.message, { ...context, error: errorInfo });
    }
  }

  /**
   * Log a Result (for success/failure tracking)
   */
  logResult<T, E>(
    result: Result<T, E>,
    message: string,
    context?: Record<string, unknown>
  ): void {
    if (result.isOk()) {
      this.info(`${message}: Success`, { ...context, result: 'ok' });
    } else {
      const error = result.error;
      this.error(`${message}: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        ...context,
        result: 'err',
        error: error instanceof Error ? { message: error.message } : error,
      });
    }
  }

  /**
   * Wrap an async function for automatic logging
   */
  async measure<T>(
    name: string,
    fn: () => Promise<T>,
    context?: Record<string, unknown>
  ): Promise<T> {
    const startTime = this.clock.now();
    this.debug(`Starting: ${name}`, context);
    
    try {
      const result = await fn();
      const duration = this.clock.now() - startTime;
      this.info(`Completed: ${name}`, { ...context, durationMs: duration, result: 'success' });
      return result;
    } catch (error) {
      const duration = this.clock.now() - startTime;
      this.error(`Failed: ${name}`, { ...context, durationMs: duration, error: String(error) });
      throw error;
    }
  }

  /**
   * Log a metric event
   */
  metric(name: string, value: number, context?: Record<string, unknown>): void {
    this.debug(`Metric: ${name}`, { ...context, metric: { name, value } });
  }

  /**
   * Check if should log at given level
   */
  private shouldLog(level: LogLevel): boolean {
    const levelOrder: Record<LogLevel, number> = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 1,
      [LogLevel.WARN]: 2,
      [LogLevel.ERROR]: 3,
      [LogLevel.FATAL]: 4,
    };
    return levelOrder[level] >= levelOrder[this.config.level!];
  }

  /**
   * Create log entry and output
   */
  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    // Merge config context with provided context
    const mergedContext = {
      ...(this.config.context ?? {}),
      ...(context ?? {}),
    };

    const entry: LogEntry = {
      timestamp: this.clock.toISO(),
      level,
      message,
      context: this.redact(mergedContext),
      ...(this.correlationId !== undefined && { correlationId: this.correlationId }),
    };

    const output = this.formatEntry(entry);
    this.output(output);
  }

  /**
   * Format log entry for output
   */
  private formatEntry(entry: LogEntry): string {
    if (this.config.format === 'json') {
      return JSON.stringify(entry);
    }
    
    // Human-readable format
    const parts: string[] = [
      entry.timestamp,
      `[${entry.level}]`,
      entry.message,
    ];
    
    if (entry.context && Object.keys(entry.context).length > 0) {
      parts.push(this.formatContext(entry.context));
    }
    
    if (entry.correlationId) {
      parts.push(`[correlation:${entry.correlationId}]`);
    }
    
    return parts.join(' ');
  }

  /**
   * Format context object for human-readable output
   */
  private formatContext(context: Record<string, unknown>, depth: number = 0): string {
    if (depth > this.config.maxDepth!) {
      return '[max depth reached]';
    }
    
    const entries = Object.entries(context).map(([key, value]) => {
      const formattedValue = this.formatValue(value, depth + 1);
      return `${key}=${formattedValue}`;
    });
    
    return `{${entries.join(', ')}}`;
  }

  /**
   * Format a single value
   */
  private formatValue(value: unknown, depth: number): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    
    if (typeof value === 'string') {
      return `"${value}"`;
    }
    
    if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
      return String(value);
    }
    
    if (Array.isArray(value)) {
      return `[${value.map((v) => this.formatValue(v, depth)).join(', ')}]`;
    }
    
    if (typeof value === 'object') {
      return this.formatContext(value as Record<string, unknown>, depth);
    }
    
    return String(value);
  }

  /**
   * Redact sensitive fields from object
   */
  private redact(obj: Record<string, unknown>, depth: number = 0): Record<string, unknown> {
    if (depth > this.config.maxDepth!) {
      return { '[max depth]': true };
    }
    
    const redacted: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      const shouldRedact = this.config.redactPaths!.some((path) => 
        lowerKey.includes(path.toLowerCase())
      );
      
      if (shouldRedact) {
        redacted[key] = '[REDACTED]';
      } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        redacted[key] = this.redact(value as Record<string, unknown>, depth + 1);
      } else {
        redacted[key] = value;
      }
    }
    
    return redacted;
  }

  /**
   * Output log entry (overridable for different environments)
   */
  protected output(output: string): void {
    // Default: use console
    // This can be overridden for different output destinations
    console.log(output);
  }

  /**
   * Create a new logger instance
   */
  static create(config: LoggerConfig = {}): Logger {
    return new Logger(config);
  }

  /**
   * Create a JSON formatter logger
   */
  static json(config: LoggerConfig = {}): Logger {
    return new Logger({ ...config, format: 'json' });
  }

  /**
   * Create a human-readable logger
   */
  static human(config: LoggerConfig = {}): Logger {
    return new Logger({ ...config, format: 'human' });
  }
}

/**
 * Default logger instance for global use
 */
let defaultLogger: Logger | undefined;

/**
 * Get the default logger instance
 */
export function getLogger(): Logger {
  if (!defaultLogger) {
    defaultLogger = Logger.create({ level: LogLevel.INFO });
  }
  return defaultLogger;
}

/**
 * Set the default logger instance
 */
export function setLogger(logger: Logger): void {
  defaultLogger = logger;
}

/**
 * Reset to default logger configuration
 */
export function resetLogger(): void {
  defaultLogger = Logger.create({ level: LogLevel.INFO });
}
