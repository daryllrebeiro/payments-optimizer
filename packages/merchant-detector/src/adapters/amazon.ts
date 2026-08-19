import {
  MerchantAdapter,
  MerchantDetectionResult,
  PageContext,
  Cart,
  ProductContext,
  Money,
  Currency,
} from '@payments-optimizer/domain';

const AMAZON_DOMAINS = ['amazon.in', 'amazon.com', 'amazon.co.uk', 'amazon.de'];

function parsePriceString(text: string, currency: Currency): Money | null {
  // Remove currency symbols, commas, whitespace
  const cleaned = text.replace(/[₹$£€,\s]/g, '').trim();
  const numeric = parseFloat(cleaned);
  if (isNaN(numeric)) return null;
  const amountMinor = BigInt(Math.round(numeric * 100));
  return { amountMinor, currency };
}

function detectCurrency(url: string): Currency {
  if (url.includes('amazon.in')) return 'INR';
  if (url.includes('amazon.co.uk')) return 'GBP';
  if (url.includes('amazon.de')) return 'EUR';
  return 'USD';
}

function parseAmazonDom(
  domContentStub: string,
  currency: Currency
): { price: Money | null; title: string | null } {
  // Use DOMParser if available (content script context), otherwise regex fallback
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(domContentStub, 'text/html');

    const title =
      doc.querySelector('#productTitle')?.textContent?.trim() ??
      doc.querySelector('h1.a-size-large')?.textContent?.trim() ??
      null;

    // Try buybox price selectors
    const priceSelectors = [
      '.a-price .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '.a-price-whole',
      '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
      '#subtotals-marketplace-table .a-color-price',
    ];

    let price: Money | null = null;
    for (const sel of priceSelectors) {
      const el = doc.querySelector(sel);
      if (el?.textContent) {
        price = parsePriceString(el.textContent, currency);
        if (price) break;
      }
    }

    return { price, title };
  }

  // Regex fallback for non-DOM environments (tests / node)
  const priceMatch = domContentStub.match(/₹\s*([\d,]+(?:\.\d{1,2})?)/);
  const titleMatch = domContentStub.match(/id="productTitle"[^>]*>([^<]+)</);
  const price = priceMatch ? parsePriceString(priceMatch[1] ?? '', currency) : null;
  const title = titleMatch ? (titleMatch[1] ?? '').trim() : null;
  return { price, title };
}

export class AmazonAdapter implements MerchantAdapter {
  canHandle(context: PageContext): boolean {
    try {
      const hostname = new URL(context.url).hostname.replace(/^www\./, '');
      return AMAZON_DOMAINS.some((d) => hostname === d || hostname.endsWith('.' + d));
    } catch {
      return false;
    }
  }

  detectMerchant(context: PageContext): MerchantDetectionResult {
    if (!this.canHandle(context)) {
      return { confidence: 'NONE' };
    }
    try {
      const hostname = new URL(context.url).hostname.replace(/^www\./, '');
      return {
        merchantId: 'amazon',
        confidence: 'HIGH',
        matchedDomain: hostname,
      };
    } catch {
      return { confidence: 'NONE' };
    }
  }

  async extractCart(context: PageContext): Promise<Cart> {
    const currency = detectCurrency(context.url);
    const zeroMoney: Money = { amountMinor: 0n, currency };

    if (!context.domContentStub) {
      return {
        merchantId: 'amazon',
        items: [],
        subtotal: zeroMoney,
        discounts: [],
        shipping: zeroMoney,
        taxes: zeroMoney,
        total: zeroMoney,
        currency,
      };
    }

    const { price, title } = parseAmazonDom(context.domContentStub, currency);
    const total = price ?? zeroMoney;

    return {
      merchantId: 'amazon',
      items: price
        ? [
            {
              id: 'amazon-product',
              name: title ?? 'Amazon Product',
              price: total,
              quantity: 1,
            },
          ]
        : [],
      subtotal: total,
      discounts: [],
      shipping: zeroMoney,
      taxes: zeroMoney,
      total,
      currency,
    };
  }

  async extractProduct(context: PageContext): Promise<ProductContext> {
    const currency = detectCurrency(context.url);
    const zeroMoney: Money = { amountMinor: 0n, currency };

    if (!context.domContentStub) {
      return { productId: 'amazon-unknown', name: 'Unknown Product', price: zeroMoney };
    }

    const { price, title } = parseAmazonDom(context.domContentStub, currency);
    return {
      productId: 'amazon-product',
      name: title ?? 'Amazon Product',
      price: price ?? zeroMoney,
    };
  }
}
