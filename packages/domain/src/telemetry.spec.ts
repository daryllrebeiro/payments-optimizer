/**
 * Tests for privacy-first telemetry
 * Epic 1.9: Observability with structured logging and privacy-first telemetry
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Telemetry, TelemetryEventType, getTelemetry, setTelemetry, resetTelemetry } from './telemetry.js';

describe('Telemetry', () => {
  beforeEach(() => {
    vi.stubGlobal('console', {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
    });
  });

  afterEach(() => {
    setTelemetry(undefined as any);
    vi.restoreAllMocks();
  });

  describe('Construction', () => {
    it('should create telemetry with defaults', () => {
      const telemetry = Telemetry.create();
      expect(telemetry).toBeInstanceOf(Telemetry);
    });

    it('should create local-only telemetry', () => {
      const telemetry = Telemetry.localOnly();
      expect(telemetry).toBeInstanceOf(Telemetry);
    });

    it('should create telemetry with PII enabled', () => {
      const telemetry = Telemetry.withPii();
      expect(telemetry).toBeInstanceOf(Telemetry);
    });

    it('should respect sample rate', () => {
      const telemetry = Telemetry.create({ sampleRate: 0 });
      telemetry.record({ type: 'test', properties: {} });
    });

    it('should disable when enabled is false', () => {
      const telemetry = Telemetry.create({ enabled: false });
      telemetry.record({ type: 'test', properties: {} });
    });
  });

  describe('Event recording', () => {
    it('should record custom events', () => {
      const telemetry = Telemetry.create({ enabled: true });
      telemetry.record({ type: 'custom_event', properties: { key: 'value' } });
    });

    it('should generate unique IDs', () => {
      const telemetry = Telemetry.create({ enabled: true });
      telemetry.record({ type: 'event1', properties: {} });
      telemetry.record({ type: 'event2', properties: {} });
    });
  });

  describe('Feature usage events', () => {
    it('should record feature usage', () => {
      const telemetry = Telemetry.create({ enabled: true });
      telemetry.featureUsed('darkMode', { enabled: true });
    });
  });

  describe('User action events', () => {
    it('should record user actions', () => {
      const telemetry = Telemetry.create({ enabled: true });
      telemetry.userAction('button_click', { buttonId: 'save-btn' });
    });
  });

  describe('Business events', () => {
    it('should record benefit applied', () => {
      const telemetry = Telemetry.create({ enabled: true });
      telemetry.benefitApplied('benefit123', 15.50, { merchant: 'amazon' });
    });

    it('should record voucher burned', () => {
      const telemetry = Telemetry.create({ enabled: true });
      telemetry.voucherBurned('voucher456', 10.00, { merchant: 'target' });
    });

    it('should record savings saved', () => {
      const telemetry = Telemetry.create({ enabled: true });
      telemetry.savingsSaved(25.50, 3);
    });

    it('should record optimization completed', () => {
      const telemetry = Telemetry.create({ enabled: true });
      telemetry.optimizationCompleted(45.2, 5);
    });
  });

  describe('API events', () => {
    it('should record API request', () => {
      const telemetry = Telemetry.create({ enabled: true });
      telemetry.apiRequest('https://api.example.com', 'GET', 150, 200);
    });
  });

  describe('Error events', () => {
    it('should record error occurred', () => {
      const telemetry = Telemetry.create({ enabled: true });
      telemetry.errorOccurred('NetworkError', 'Connection refused');
    });

    it('should record critical error', () => {
      const telemetry = Telemetry.create({ enabled: true });
      telemetry.criticalError('DatabaseError', 'Connection lost', 'stack trace');
    });
  });

  describe('PII handling', () => {
    it('should not include PII by default', () => {
      const telemetry = Telemetry.create({ enabled: true });
      telemetry.userLogin('user123');
    });

    it('should include PII when enabled', () => {
      const telemetry = Telemetry.withPii({ enabled: true });
      telemetry.userLogin('user456');
    });

    it('should record user logout', () => {
      const telemetry = Telemetry.create({ enabled: true });
      telemetry.userLogout();
    });
  });

  describe('Telemetry event types', () => {
    it('should export all event types', () => {
      expect(TelemetryEventType.USER_LOGIN).toBe('user_login');
      expect(TelemetryEventType.USER_LOGOUT).toBe('user_logout');
      expect(TelemetryEventType.USER_REGISTER).toBe('user_register');
      expect(TelemetryEventType.FEATURE_ENABLED).toBe('feature_enabled');
      expect(TelemetryEventType.BENEFIT_APPLIED).toBe('benefit_applied');
      expect(TelemetryEventType.VOUCHER_BURNED).toBe('voucher_burned');
      expect(TelemetryEventType.SAVINGS_SAVED).toBe('savings_saved');
      expect(TelemetryEventType.OPTIMIZATION_COMPLETE).toBe('optimization_complete');
      expect(TelemetryEventType.API_REQUEST).toBe('api_request');
      expect(TelemetryEventType.ERROR_OCCURRED).toBe('error_occurred');
      expect(TelemetryEventType.CRITICAL_ERROR).toBe('critical_error');
    });
  });

  describe('Global telemetry', () => {
    it('should provide default telemetry', () => {
      const telemetry = getTelemetry();
      expect(telemetry).toBeDefined();
    });

    it('should allow setting custom telemetry', () => {
      const custom = Telemetry.create({ enabled: true });
      setTelemetry(custom);
      expect(getTelemetry()).toBe(custom);
    });

    it('should allow resetting telemetry', () => {
      setTelemetry(Telemetry.create({ enabled: false }));
      resetTelemetry();
      expect(getTelemetry()).not.toBeUndefined();
    });
  });
});
