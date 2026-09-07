/**
 * Offer API Client with Circuit Breaker Integration
 * Epic 1.5: Example implementation showing circuit breaker usage
 */

import { CircuitBreaker, createCircuitBreaker } from './circuit-breaker.js';
import type { Offer } from './index.js';

export interface OfferApiConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
  circuitBreaker?: {
    failureThreshold?: number;
    successThreshold?: number;
    timeout?: number;
  };
}

export interface OfferQueryParams {
  merchantId?: string;
  category?: string;
  minValue?: number;
  maxValue?: number;
  active?: boolean;
}

/**
 * HTTP client for fetching offers from external API with circuit breaker protection
 */
export class OfferApiClient {
  private circuitBreaker: CircuitBreaker;
  private requestTimeout: number;

  constructor(private config: OfferApiConfig) {
    this.requestTimeout = config.timeout;
    
    // Initialize circuit breaker with custom or default config
    this.circuitBreaker = createCircuitBreaker('offer-api', {
      failureThreshold: config.circuitBreaker?.failureThreshold ?? 5,
      successThreshold: config.circuitBreaker?.successThreshold ?? 2,
      timeout: config.circuitBreaker?.timeout ?? 60000,
    });
  }

  /**
   * Fetch offers for a merchant with circuit breaker protection
   * @param merchantId - Merchant ID to query
   * @param params - Optional query parameters
   * @returns Array of offers or empty array on failure
   */
  async getOffers(
    merchantId: string,
    params?: OfferQueryParams
  ): Promise<Offer[]> {
    try {
      return await this.circuitBreaker.execute(async () => {
        return await this.fetchOffersInternal(merchantId, params);
      });
    } catch (error) {
      console.error(`[OfferApiClient] Failed to fetch offers for ${merchantId}:`, error);
      
      // Return empty array as fallback - don't propagate error to UI
      return [];
    }
  }

  /**
   * Fetch single offer by ID with circuit breaker protection
   * @param offerId - Offer ID to fetch
   * @returns Offer or null if not found/failed
   */
  async getOfferById(offerId: string): Promise<Offer | null> {
    try {
      return await this.circuitBreaker.execute(async () => {
        return await this.fetchOfferByIdInternal(offerId);
      });
    } catch (error) {
      console.error(`[OfferApiClient] Failed to fetch offer ${offerId}:`, error);
      return null;
    }
  }

  /**
   * Search offers with circuit breaker protection
   * @param params - Query parameters for search
   * @returns Array of matching offers
   */
  async searchOffers(params: OfferQueryParams): Promise<Offer[]> {
    try {
      return await this.circuitBreaker.execute(async () => {
        return await this.searchOffersInternal(params);
      });
    } catch (error) {
      console.error('[OfferApiClient] Failed to search offers:', error);
      return [];
    }
  }

  /**
   * Get circuit breaker health status
   */
  getHealthStatus() {
    return this.circuitBreaker.getMetrics();
  }

  /**
   * Reset circuit breaker (useful for testing/recovery)
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }

  /**
   * Internal implementation: Fetch offers for merchant
   * @private
   */
  private async fetchOffersInternal(
    merchantId: string,
    params?: OfferQueryParams
  ): Promise<Offer[]> {
    const url = new URL(`${this.config.baseUrl}/offers`);
    url.searchParams.set('merchantId', merchantId);
    
    if (params?.category) url.searchParams.set('category', params.category);
    if (params?.active !== undefined) url.searchParams.set('active', String(params.active));
    if (params?.minValue) url.searchParams.set('minValue', String(params.minValue));
    if (params?.maxValue) url.searchParams.set('maxValue', String(params.maxValue));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.offers || [];
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Internal implementation: Fetch single offer by ID
   * @private
   */
  private async fetchOfferByIdInternal(offerId: string): Promise<Offer | null> {
    const url = `${this.config.baseUrl}/offers/${offerId}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Internal implementation: Search offers
   * @private
   */
  private async searchOffersInternal(params: OfferQueryParams): Promise<Offer[]> {
    const url = new URL(`${this.config.baseUrl}/offers/search`);
    
    if (params.merchantId) url.searchParams.set('merchantId', params.merchantId);
    if (params.category) url.searchParams.set('category', params.category);
    if (params.active !== undefined) url.searchParams.set('active', String(params.active));
    if (params.minValue) url.searchParams.set('minValue', String(params.minValue));
    if (params.maxValue) url.searchParams.set('maxValue', String(params.maxValue));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.offers || [];
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Create offer API client with default configuration
 */
export function createOfferApiClient(
  baseUrl: string,
  overrides?: Partial<Omit<OfferApiConfig, 'baseUrl'>>
): OfferApiClient {
  const config: OfferApiConfig = {
    baseUrl,
    timeout: overrides?.timeout ?? 5000,
    retries: overrides?.retries ?? 3,
    ...(overrides?.circuitBreaker !== undefined && { circuitBreaker: overrides.circuitBreaker }),
  };

  return new OfferApiClient(config);
}
