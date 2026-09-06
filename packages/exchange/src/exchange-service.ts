import type { Currency, ExchangeRate, Money, ConvertedMoney } from './types';

// Common currency pairs with fixed rates (fallback when API unavailable)
const FIXED_RATES: Record<string, number> = {
  'USD-INR': 83.5,
  'INR-USD': 0.012,
  'EUR-INR': 90.0,
  'INR-EUR': 0.011,
  'GBP-INR': 107.0,
  'INR-GBP': 0.0093,
  'USD-EUR': 0.92,
  'EUR-USD': 1.09,
  'USD-GBP': 0.79,
  'GBP-USD': 1.27,
};

// Default rates for common currencies
const DEFAULT_RATES: Partial<Record<Currency, Partial<Record<Currency, number>>>> = {
  INR: { USD: 0.012, EUR: 0.011, GBP: 0.0093, JPY: 1.75, SGD: 0.017, AED: 0.045, CAD: 0.016, AUD: 0.018 },
  USD: { INR: 83.5, EUR: 0.92, GBP: 0.79, JPY: 150.0, SGD: 1.35, AED: 3.67, CAD: 1.36, AUD: 1.52 },
  EUR: { INR: 90.0, USD: 1.09, GBP: 0.86, JPY: 163.0, SGD: 1.47, AED: 4.0, CAD: 1.48, AUD: 1.65 },
  GBP: { INR: 107.0, USD: 1.27, EUR: 1.16, JPY: 189.0, SGD: 1.71, AED: 4.64, CAD: 1.70, AUD: 1.90 },
};

/**
 * Exchange rate service for currency conversion
 * Uses in-memory cache for performance
 */
export class ExchangeService {
  private cache = new Map<string, ExchangeRate>();
  private cacheTTL = 60 * 60 * 1000; // 1 hour

  /**
   * Get exchange rate between two currencies
   */
  async getRate(from: Currency, to: Currency): Promise<number> {
    const key = `${from}-${to}`;
    
    // Check cache
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.rate;
    }

    // Try fixed rates first
    const fixedRate = FIXED_RATES[key] || DEFAULT_RATES[from]?.[to];
    if (fixedRate) {
      const rate = {
        from,
        to,
        rate: fixedRate,
        timestamp: Date.now(),
        source: 'fixed',
      };
      this.cache.set(key, rate);
      return fixedRate;
    }

    // For production, implement API call here
    // Example: fetch from exchange rate API
    console.warn(`No exchange rate found for ${from} -> ${to}`);
    return 1.0; // Default to 1:1
  }

  /**
   * Convert money from one currency to another
   */
  async convert(money: Money, toCurrency: Currency): Promise<ConvertedMoney> {
    const rate = await this.getRate(money.currency, toCurrency);
    const amountMajor = Number(money.amountMinor) / 100;
    const convertedMajor = amountMajor * rate;
    const convertedMinor = BigInt(Math.round(convertedMajor * 100));

    return {
      amountMinor: convertedMinor,
      currency: toCurrency,
      originalAmountMinor: money.amountMinor,
      originalCurrency: money.currency,
      rate,
      timestamp: Date.now(),
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get all cached rates
   */
  getCachedRates(): ExchangeRate[] {
    return Array.from(this.cache.values());
  }
}

/**
 * Convenience function to get exchange rate
 */
export async function getExchangeRate(from: Currency, to: Currency): Promise<number> {
  const service = new ExchangeService();
  return service.getRate(from, to);
}

/**
 * Convenience function to convert money
 */
export async function convertMoney(money: Money, toCurrency: Currency): Promise<ConvertedMoney> {
  const service = new ExchangeService();
  return service.convert(money, toCurrency);
}
