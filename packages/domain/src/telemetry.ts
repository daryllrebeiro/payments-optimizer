/**
 * Privacy-First Telemetry System
 * Epic 1.9: Observability with structured logging and telemetry
 * 
 * Features:
 * - Event-based telemetry with optional PII
 * - Privacy-first: PII opt-in only
 * - Analytics pipeline with sampling
 * - Event queue for batch sending
 * - Local-only or remote capable
 */

import { Logger, getLogger } from './logger.js';
import { Clock, getClock } from './clock.js';

/**
 * Telemetry event interface
 */
export interface TelemetryEvent {
  id: string;
  type: string;
  timestamp: string;      // ISO 8601
  properties: Record<string, unknown>;
  metadata?: {
    userId?: string;
    sessionId?: string;
    correlationId?: string;
    deviceInfo?: {
      platform?: string;
      browser?: string;
      viewport?: string;
    };
    location?: {
      country?: string;
      region?: string;
      city?: string;
    };
    custom?: Record<string, unknown>;
  };
}

/**
 * Telemetry configuration
 */
export interface TelemetryConfig {
  enabled?: boolean;
  endpoint?: string;
  apiKey?: string;
  sampleRate?: number;     // 0.0 - 1.0 (fraction of events to send)
  maxQueueSize?: number;
  flushInterval?: number;  // ms
  includePii?: boolean;    // Explicitly include PII (opt-in)
  redactPaths?: string[];
  privacyPolicyUrl?: string;
}

/**
 * Telemetry event types
 */
export const TelemetryEventType = {
  // User interactions
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  USER_REGISTER: 'user_register',
  USER_PROFILE_UPDATE: 'user_profile_update',
  
  // Feature usage
  FEATURE_ENABLED: 'feature_enabled',
  FEATURE_DISABLED: 'feature_disabled',
  OPTION_SELECTED: 'option_selected',
  BUTTON_CLICKED: 'button_clicked',
  
  // Business events
  BENEFIT_APPLIED: 'benefit_applied',
  VOUCHER_BURNED: 'voucher_burned',
  SAVINGS_SAVED: 'savings_saved',
  STRATEGY_GENERATED: 'strategy_generated',
  STRATEGY_ACCEPTED: 'strategy_accepted',
  
  // Performance
  OPTIMIZATION_COMPLETE: 'optimization_complete',
  API_REQUEST: 'api_request',
  API_RESPONSE: 'api_response',
  API_ERROR: 'api_error',
  
  // Errors
  ERROR_OCCURRED: 'error_occurred',
  CRITICAL_ERROR: 'critical_error',
} as const;

/**
 * Telemetry event types union
 */
export type TelemetryEventName = typeof TelemetryEventType[keyof typeof TelemetryEventType];

/**
 * Telemetry class with privacy safeguards
 */
export class Telemetry {
  private config: TelemetryConfig;
  private logger: Logger;
  private clock: Clock;
  private queue: TelemetryEvent[] = [];
  private enabled: boolean;

  constructor(config: TelemetryConfig = {}) {
    const enabled = config.enabled ?? true;
    const sampleRate = config.sampleRate ?? 1.0;
    this.config = {
      enabled,
      sampleRate,                      // Send all events by default
      maxQueueSize: config.maxQueueSize ?? 1000,
      flushInterval: config.flushInterval ?? 5000, // 5 seconds
      includePii: config.includePii ?? false,    // Privacy first - opt-in
      redactPaths: config.redactPaths ?? [],
    };
    this.logger = getLogger();
    this.clock = getClock();
    this.enabled = enabled && Math.random() < sampleRate;
    
    if (this.enabled) {
      this.startFlushTimer();
    }
  }

  /**
   * Record an event
   */
  record(event: Omit<TelemetryEvent, 'id' | 'timestamp'>): void {
    if (!this.enabled) {
      return;
    }

    const telemetryEvent: TelemetryEvent = {
      id: this.generateId(),
      timestamp: this.clock.toISO(),
      ...event,
    };

    this.queueEvent(telemetryEvent);
  }

  /**
   * Record a feature usage event
   */
  featureUsed(feature: string, properties?: Record<string, unknown>): void {
    this.record({
      type: TelemetryEventType.FEATURE_ENABLED,
      properties: { feature, ...properties },
    });
  }

  /**
   * Record a user action
   */
  userAction(action: string, properties?: Record<string, unknown>): void {
    this.record({
      type: TelemetryEventType.BUTTON_CLICKED,
      properties: { action, ...properties },
    });
  }

  /**
   * Record a benefit application
   */
  benefitApplied(benefitId: string, savings: number, properties?: Record<string, unknown>): void {
    this.record({
      type: TelemetryEventType.BENEFIT_APPLIED,
      properties: { benefitId, savings, ...properties },
    });
  }

  /**
   * Record a voucher burn
   */
  voucherBurned(voucherId: string, savings: number, properties?: Record<string, unknown>): void {
    this.record({
      type: TelemetryEventType.VOUCHER_BURNED,
      properties: { voucherId, savings, ...properties },
    });
  }

  /**
   * Record savings summary
   */
  savingsSaved(totalSavings: number, numberOfStrategies: number): void {
    this.record({
      type: TelemetryEventType.SAVINGS_SAVED,
      properties: { totalSavings, numberOfStrategies },
    });
  }

  /**
   * Record optimization performance
   */
  optimizationCompleted(durationMs: number, strategyCount: number): void {
    this.record({
      type: TelemetryEventType.OPTIMIZATION_COMPLETE,
      properties: { durationMs, strategyCount },
    });
  }

  /**
   * Record API request/response
   */
  apiRequest(url: string, method: string, durationMs: number, statusCode: number): void {
    this.record({
      type: TelemetryEventType.API_REQUEST,
      properties: { url, method, durationMs, statusCode },
    });
  }

  /**
   * Record an error
   */
  errorOccurred(errorName: string, errorMessage: string, properties?: Record<string, unknown>): void {
    this.record({
      type: TelemetryEventType.ERROR_OCCURRED,
      properties: { errorName, errorMessage, ...properties },
    });
  }

  /**
   * Record a critical error
   */
  criticalError(errorName: string, errorMessage: string, stack?: string): void {
    this.record({
      type: TelemetryEventType.CRITICAL_ERROR,
      properties: { errorName, errorMessage, stack },
    });
  }

  /**
   * Record user login (opt-in PII)
   */
  userLogin(userId: string): void {
    if (!this.config.includePii) {
      this.record({
        type: TelemetryEventType.USER_LOGIN,
        properties: { pii: false },
      });
      return;
    }

    this.record({
      type: TelemetryEventType.USER_LOGIN,
      properties: { userId },
    });
  }

  /**
   * Record user logout
   */
  userLogout(): void {
    this.record({
      type: TelemetryEventType.USER_LOGOUT,
      properties: {},
    });
  }

  /**
   * Flush the event queue
   */
  async flush(): Promise<void> {
    if (this.queue.length === 0) {
      return;
    }

    const eventsToSend = [...this.queue];
    this.queue = [];

    try {
      await this.sendEvents(eventsToSend);
      this.logger.info(`Telemetry: Sent ${eventsToSend.length} events`);
    } catch (error) {
      // Re-queue failed events
      this.queue = [...eventsToSend, ...this.queue];
      this.logger.error('Telemetry: Failed to send events', { error: String(error) });
    }
  }

  /**
   * Start the flush timer
   */
  private startFlushTimer(): void {
    setInterval(() => {
      this.flush().catch((error) => {
        this.logger.error('Telemetry: Flush failed', { error: String(error) });
      });
    }, this.config.flushInterval);
  }

  /**
   * Send events to endpoint
   */
  private async sendEvents(events: TelemetryEvent[]): Promise<void> {
    if (this.config.endpoint && this.config.apiKey) {
      // Remote mode
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({ events }),
      });

      if (!response.ok) {
        throw new Error(`Telemetry: Failed to send events: ${response.status}`);
      }
    } else {
      // Local-only mode - log events
      for (const event of events) {
        this.logger.debug(`Telemetry event: ${event.type}`, event.properties);
      }
    }
  }

  /**
   * Generate unique event ID
   */
  private generateId(): string {
    return `${this.clock.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Queue an event with size limit
   */
  private queueEvent(event: TelemetryEvent): void {
    if (this.queue.length >= this.config.maxQueueSize!) {
      // Drop oldest events if queue full
      this.queue.shift();
      this.logger.warn('Telemetry: Queue full, dropped oldest event');
    }
    this.queue.push(event);
  }

  /**
   * Create telemetry instance
   */
  static create(config: TelemetryConfig = {}): Telemetry {
    return new Telemetry(config);
  }

  /**
   * Create telemetry instance for local-only mode
   */
  static localOnly(): Telemetry {
    return Telemetry.create({ enabled: true });
  }

  /**
   * Create telemetry instance with PII enabled
   */
  static withPii(config: TelemetryConfig = {}): Telemetry {
    return Telemetry.create({ ...config, includePii: true });
  }
}

// Global telemetry instance
let defaultTelemetry: Telemetry | undefined;

/**
 * Get the default telemetry instance
 */
export function getTelemetry(): Telemetry {
  if (!defaultTelemetry) {
    defaultTelemetry = Telemetry.create();
  }
  return defaultTelemetry;
}

/**
 * Set the default telemetry instance
 */
export function setTelemetry(telemetry: Telemetry): void {
  defaultTelemetry = telemetry;
}

/**
 * Reset to default telemetry configuration
 */
export function resetTelemetry(): void {
  defaultTelemetry = Telemetry.create();
}
