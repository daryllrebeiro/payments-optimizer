/* eslint-disable @typescript-eslint/no-explicit-any -- legacy explicit-any usage; remove when typed */
/**
 * Tests for Offer API Client with Circuit Breaker
 * Epic 1.5: Verify circuit breaker integration and fallback behavior
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OfferApiClient, createOfferApiClient } from './offer-api-client.js';
import { CircuitState } from './circuit-breaker.js';
import type { Offer } from './index.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('OfferApiClient', () => {
  let client: OfferApiClient;
  const baseUrl = 'https://api.example.com';

  const mockOffer: Offer = {
    id: 'offer-1',
    merchantId: 'amazon',
    title: '10% off',
    validFrom: '2026-01-01T00:00:00Z',
    validUntil: '2026-12-31T23:59:59Z',
    conditions: [],
    benefit: {
      type: 'PERCENTAGE_DISCOUNT',
      value: 0.1,
    },
    stackingPolicy: {
      canStackWithCoupons: true,
      canStackWithGiftCards: false,
    },
    source: {
      type: 'OFFICIAL',
      retrievedAt: '2026-01-01T00:00:00Z',
    },
    confidence: 'HIGH',
  };

  beforeEach(() => {
    client = createOfferApiClient(baseUrl, {
      timeout: 1000,
      circuitBreaker: {
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 1000,
      },
    });
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Successful requests', () => {
    it('should fetch offers successfully', async () => {
      const mockResponse = { offers: [mockOffer] };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const offers = await client.getOffers('amazon');

      expect(offers).toEqual([mockOffer]);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('merchantId=amazon'),
        expect.any(Object)
      );
    });

    it('should fetch single offer by ID', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOffer,
      });

      const offer = await client.getOfferById('offer-1');

      expect(offer).toEqual(mockOffer);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/offers/offer-1'),
        expect.any(Object)
      );
    });

    it('should search offers with params', async () => {
      const mockResponse = { offers: [mockOffer] };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const offers = await client.searchOffers({
        category: 'electronics',
        active: true,
        minValue: 100,
      });

      expect(offers).toEqual([mockOffer]);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('category=electronics'),
        expect.any(Object)
      );
    });

    it('should return empty array when no offers found', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ offers: [] }),
      });

      const offers = await client.getOffers('unknown-merchant');

      expect(offers).toEqual([]);
    });
  });

  describe('Error handling', () => {
    it('should return empty array on HTTP error', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const offers = await client.getOffers('amazon');

      expect(offers).toEqual([]);
    });

    it('should return null on 404 for single offer', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const offer = await client.getOfferById('nonexistent');

      expect(offer).toBeNull();
    });

    it('should return empty array on network error', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const offers = await client.getOffers('amazon');

      expect(offers).toEqual([]);
    });
  });

  describe('Circuit breaker integration', () => {
    it('should track failures and open circuit', async () => {
      // Fail 3 times to open circuit
      (global.fetch as any).mockRejectedValue(new Error('API down'));

      await client.getOffers('amazon');
      await client.getOffers('amazon');
      await client.getOffers('amazon');

      const health = client.getHealthStatus();
      expect(health.state).toBe(CircuitState.OPEN);
      expect(health.failures).toBe(3);
    });

    it('should fail fast when circuit is open', async () => {
      // Open the circuit
      (global.fetch as any).mockRejectedValue(new Error('API down'));

      await client.getOffers('amazon');
      await client.getOffers('amazon');
      await client.getOffers('amazon');

      // Circuit should now be open
      let health = client.getHealthStatus();
      expect(health.state).toBe(CircuitState.OPEN);

      // Next request should fail fast without calling fetch
      const fetchCallsBefore = (global.fetch as any).mock.calls.length;
      const offers = await client.getOffers('amazon');
      const fetchCallsAfter = (global.fetch as any).mock.calls.length;

      expect(offers).toEqual([]);
      expect(fetchCallsAfter).toBe(fetchCallsBefore); // No new fetch call

      // Check that request was rejected
      health = client.getHealthStatus();
      expect(health.rejectedRequests).toBe(1);
    });

    it('should transition to half-open after timeout', async () => {
      // Open the circuit
      (global.fetch as any).mockRejectedValue(new Error('API down'));

      await client.getOffers('amazon');
      await client.getOffers('amazon');
      await client.getOffers('amazon');

      expect(client.getHealthStatus().state).toBe(CircuitState.OPEN);

      // Advance time past circuit breaker timeout
      vi.advanceTimersByTime(1001);

      // Mock successful response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ offers: [mockOffer] }),
      });

      // Next request should transition to half-open and succeed
      const offers = await client.getOffers('amazon');

      expect(offers).toEqual([mockOffer]);
      expect(client.getHealthStatus().state).toBe(CircuitState.HALF_OPEN);
    });

    it('should close circuit after success threshold in half-open', async () => {
      // Open the circuit
      (global.fetch as any).mockRejectedValue(new Error('API down'));

      await client.getOffers('amazon');
      await client.getOffers('amazon');
      await client.getOffers('amazon');

      // Wait for timeout
      vi.advanceTimersByTime(1001);

      // Mock successful responses
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ offers: [mockOffer] }),
      });

      // Succeed twice to close circuit (successThreshold = 2)
      await client.getOffers('amazon');
      expect(client.getHealthStatus().state).toBe(CircuitState.HALF_OPEN);

      await client.getOffers('amazon');
      expect(client.getHealthStatus().state).toBe(CircuitState.CLOSED);
    });

    it('should reopen circuit on failure in half-open', async () => {
      // Open the circuit
      (global.fetch as any).mockRejectedValue(new Error('API down'));

      await client.getOffers('amazon');
      await client.getOffers('amazon');
      await client.getOffers('amazon');

      // Wait for timeout
      vi.advanceTimersByTime(1001);

      // First request succeeds (transition to half-open)
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ offers: [mockOffer] }),
      });
      await client.getOffers('amazon');
      expect(client.getHealthStatus().state).toBe(CircuitState.HALF_OPEN);

      // Second request fails (reopen circuit)
      (global.fetch as any).mockRejectedValueOnce(new Error('Still down'));
      await client.getOffers('amazon');

      expect(client.getHealthStatus().state).toBe(CircuitState.OPEN);
    });
  });

  describe('Health status monitoring', () => {
    it('should provide circuit breaker metrics', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ offers: [mockOffer] }),
      });

      await client.getOffers('amazon');
      await client.getOffers('amazon');

      const health = client.getHealthStatus();
      expect(health.state).toBe(CircuitState.CLOSED);
      expect(health.successes).toBe(2);
      expect(health.totalRequests).toBe(2);
    });

    it('should reset circuit breaker', async () => {
      // Generate some state
      (global.fetch as any).mockRejectedValue(new Error('API down'));
      await client.getOffers('amazon');
      await client.getOffers('amazon');

      let health = client.getHealthStatus();
      expect(health.failures).toBe(2);

      // Reset
      client.resetCircuitBreaker();

      health = client.getHealthStatus();
      expect(health.state).toBe(CircuitState.CLOSED);
      expect(health.failures).toBe(0);
      expect(health.totalRequests).toBe(0);
    });
  });

  describe('Timeout handling', () => {
    it.skip('should timeout long requests', async () => {
      // Mock a request that never resolves
      let abortCalled = false;
      (global.fetch as any).mockImplementation((url: string, options: any) => {
        // Simulate abort being called
        if (options?.signal) {
          options.signal.addEventListener('abort', () => {
            abortCalled = true;
          });
        }
        return new Promise(() => {}); // Never resolves
      });

      // Start the request (don't await yet)
      const promise = client.getOffers('amazon');

      // Advance timers to trigger timeout
      await vi.advanceTimersByTimeAsync(1001);

      // Should return empty array after timeout
      const offers = await promise;
      expect(offers).toEqual([]);
      expect(abortCalled).toBe(true);
    }, 10000); // Increase test timeout
  });

  describe('createOfferApiClient helper', () => {
    it('should create client with defaults', () => {
      const client = createOfferApiClient('https://api.test.com');
      expect(client).toBeDefined();
      expect(client.getHealthStatus().state).toBe(CircuitState.CLOSED);
    });

    it('should accept config overrides', () => {
      const client = createOfferApiClient('https://api.test.com', {
        timeout: 10000,
        retries: 5,
        circuitBreaker: {
          failureThreshold: 10,
        },
      });

      expect(client).toBeDefined();
    });
  });
});
