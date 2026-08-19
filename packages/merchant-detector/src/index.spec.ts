import { describe, it, expect } from 'vitest';
import { detectMerchant, getAdapterForContext, AmazonAdapter, FlipkartAdapter } from './index.js';
import type { PageContext } from '@payments-optimizer/domain';

// ── detectMerchant registry ──────────────────────────────────────────────────

describe('detectMerchant', () => {
  it('identifies amazon.in as HIGH confidence', () => {
    const ctx: PageContext = { url: 'https://www.amazon.in/dp/B09XYZ' };
    const result = detectMerchant(ctx);
    expect(result.merchantId).toBe('amazon');
    expect(result.confidence).toBe('HIGH');
  });

  it('identifies amazon.com as HIGH confidence', () => {
    const ctx: PageContext = { url: 'https://www.amazon.com/dp/B09XYZ' };
    const result = detectMerchant(ctx);
    expect(result.merchantId).toBe('amazon');
    expect(result.confidence).toBe('HIGH');
  });

  it('identifies flipkart.com as HIGH confidence', () => {
    const ctx: PageContext = { url: 'https://www.flipkart.com/product/p/123' };
    const result = detectMerchant(ctx);
    expect(result.merchantId).toBe('flipkart');
    expect(result.confidence).toBe('HIGH');
  });

  it('falls back to generic adapter for unknown domains', () => {
    const ctx: PageContext = { url: 'https://www.myntra.com/product/123' };
    const result = detectMerchant(ctx);
    expect(result.confidence).toBe('LOW');
    expect(result.merchantId).toBe('myntra');
  });
});

// ── getAdapterForContext ─────────────────────────────────────────────────────

describe('getAdapterForContext', () => {
  it('returns AmazonAdapter for amazon.in', () => {
    const ctx: PageContext = { url: 'https://www.amazon.in/dp/B09XYZ' };
    const adapter = getAdapterForContext(ctx);
    expect(adapter).toBeInstanceOf(AmazonAdapter);
  });

  it('returns FlipkartAdapter for flipkart.com', () => {
    const ctx: PageContext = { url: 'https://www.flipkart.com/product' };
    const adapter = getAdapterForContext(ctx);
    expect(adapter).toBeInstanceOf(FlipkartAdapter);
  });
});

// ── AmazonAdapter ────────────────────────────────────────────────────────────

describe('AmazonAdapter', () => {
  const adapter = new AmazonAdapter();

  it('canHandle amazon.in', () => {
    expect(adapter.canHandle({ url: 'https://www.amazon.in/dp/B09' })).toBe(true);
  });

  it('canHandle amazon.com', () => {
    expect(adapter.canHandle({ url: 'https://www.amazon.com/dp/B09' })).toBe(true);
  });

  it('cannot handle flipkart.com', () => {
    expect(adapter.canHandle({ url: 'https://www.flipkart.com/product' })).toBe(false);
  });

  it('extracts cart from price stub', async () => {
    const domStub = `₹18,499`;
    const ctx: PageContext = {
      url: 'https://www.amazon.in/dp/B09XYZ',
      domContentStub: domStub,
    };
    const cart = await adapter.extractCart(ctx);
    expect(cart.merchantId).toBe('amazon');
    expect(cart.currency).toBe('INR');
    // Price ₹18,499 = 1849900 minor units
    expect(cart.total.amountMinor).toBe(1849900n);
  });

  it('returns zero-value cart when no DOM stub is provided', async () => {
    const ctx: PageContext = { url: 'https://www.amazon.in/dp/B09XYZ' };
    const cart = await adapter.extractCart(ctx);
    expect(cart.total.amountMinor).toBe(0n);
  });
});

// ── FlipkartAdapter ──────────────────────────────────────────────────────────

describe('FlipkartAdapter', () => {
  const adapter = new FlipkartAdapter();

  it('canHandle flipkart.com', () => {
    expect(adapter.canHandle({ url: 'https://www.flipkart.com/product' })).toBe(true);
  });

  it('cannot handle amazon.in', () => {
    expect(adapter.canHandle({ url: 'https://www.amazon.in/dp/B09' })).toBe(false);
  });

  it('extracts cart from price stub', async () => {
    const domStub = `₹5,999`;
    const ctx: PageContext = {
      url: 'https://www.flipkart.com/product',
      domContentStub: domStub,
    };
    const cart = await adapter.extractCart(ctx);
    expect(cart.merchantId).toBe('flipkart');
    expect(cart.currency).toBe('INR');
    expect(cart.total.amountMinor).toBe(599900n);
  });
});
