/**
 * @payments-optimizer/observability
 * Privacy-first observability package with structured logging and telemetry
 */

export { Logger, LogLevel, DEFAULT_REDACTED_PATHS, getLogger, setLogger, resetLogger } from './logger.js';
export type { LogEntry, LoggerConfig, ErrorInfo } from './logger.js';
export { Telemetry, TelemetryEventType, getTelemetry, setTelemetry, resetTelemetry } from './telemetry.js';
export type { TelemetryEvent, TelemetryConfig, TelemetryEventName } from './telemetry.js';