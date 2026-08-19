import {
  MerchantAdapter,
  MerchantDetectionResult,
  PageContext,
  Cart,
  ProductContext,
  Money,
  Currency,
} from '@payments-optimizer/domain';

const FLIPKART_DOMAINS = ['flipkart.com'];

function parsePriceString(text: string, currency: Currency): Money | null {
  const cleaned = text.replace(/[₹,\s]/g, '').trim();
  const numeric = parseFloat(cleaned);
  if (isNaN(numeric)) return null;
  return { amountMinor: BigInt(Math.round(numeric * 100)), currency };
}

function parseFlipkartDom(
  domContentStub: string,
  currency: Currency
): { price: Money | null; title: string | null } {
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(domContentStub, 'text/html');

    const title =
      doc.querySelector('span.B_NuCI')?.textContent?.trim() ??
      doc.querySelector('h1._35KyD6')?.textContent?.trim() ??
      doc.querySelector('h1')?.textContent?.trim() ??
      null;

    // Flipkart price selectors for product page and cart page
    const priceSelectors = [
      '._30jeq3._16Jk6d', // product page final price
      '._30jeq3',         // general price
      '._3I9_wc._2p6lqe', // cart subtotal
      '._2-ut7e',         // order total
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

  // Regex fallback for test/node environments
  const priceMatch = domContentStub.match(/₹\s*([\d,]+(?:\.\d{1,2})?)/);
  const titleMatch = domContentStub.match(/class="B_NuCI"[^>]*>([^<]+)</);
  const price = priceMatch ? parsePriceString(priceMatch[1] ?? '', currency) : null;
  const title = titleMatch ? (titleMatch[1] ?? '').trim() : null;
  return { price, title };
}

export class FlipkartAdapter implements MerchantAdapter {
  canHandle(context: PageContext): boolean {
    try {
      const hostname = new URL(context.url).hostname.replace(/^www\./, '');
      return FLIPKART_DOMAINS.some((d) => hostname === d || hostname.endsWith('.' + d));
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
        merchantId: 'flipkart',
        confidence: 'HIGH',
        matchedDomain: hostname,
      };
    } catch {
      return { confidence: 'NONE' };
    }
  }

  async extractCart(context: PageContext): Promise<Cart> {
    const currency: Currency = 'INR';
    const zeroMoney: Money = { amountMinor: 0n, currency };

    if (!context.domContentStub) {
      return {
        merchantId: 'flipkart',
        items: [],
        subtotal: zeroMoney,
        discounts: [],
        shipping: zeroMoney,
        taxes: zeroMoney,
        total: zeroMoney,
        currency,
      };
    }

    const { price, title } = parseFlipkartDom(context.domContentStub, currency);
    const total = price ?? zeroMoney;

    return {
      merchantId: 'flipkart',
      items: price
        ? [
            {
              id: 'flipkart-product',
              name: title ?? 'Flipkart Product',
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
    const currency: Currency = 'INR';
    const zeroMoney: Money = { amountMinor: 0n, currency };

    if (!context.domContentStub) {
      return { productId: 'flipkart-unknown', name: 'Unknown Product', price: zeroMoney };
    }

    const { price, title } = parseFlipkartDom(context.domContentStub, currency);
    return {
      productId: 'flipkart-product',
      name: title ?? 'Flipkart Product',
      price: price ?? zeroMoney,
    };
  }
}
