import {
  MerchantAdapter,
  MerchantDetectionResult,
  PageContext,
  Cart,
  ProductContext,
  Money,
  Currency,
} from '@payments-optimizer/domain';

function parsePriceString(text: string, currency: Currency): Money | null {
  const cleaned = text.replace(/[₹$£€,\s]/g, '').trim();
  const numeric = parseFloat(cleaned);
  if (isNaN(numeric)) return null;
  return { amountMinor: BigInt(Math.round(numeric * 100)), currency };
}

function detectCurrencyFromMeta(domContentStub: string): Currency {
  const currencyMap: Record<string, Currency> = {
    INR: 'INR',
    USD: 'USD',
    EUR: 'EUR',
    GBP: 'GBP',
    JPY: 'JPY',
    SGD: 'SGD',
    AED: 'AED',
  };

  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(domContentStub, 'text/html');
    const currencyMeta = doc
      .querySelector('meta[property="og:price:currency"]')
      ?.getAttribute('content')
      ?.toUpperCase();
    if (currencyMeta && currencyMeta in currencyMap) {
      return currencyMap[currencyMeta] as Currency;
    }
  }

  // Regex fallback
  const match = domContentStub.match(/og:price:currency.*?content="([A-Z]{3})"/i);
  if (match?.[1]) {
    const code = match[1].toUpperCase();
    if (code in currencyMap) return currencyMap[code] as Currency;
  }

  return 'INR'; // default
}

function extractFromOpenGraph(
  domContentStub: string,
  currency: Currency
): { price: Money | null; title: string | null; merchantId: string | null } {
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(domContentStub, 'text/html');

    const title =
      doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ??
      doc.querySelector('title')?.textContent?.trim() ??
      null;

    const siteName =
      doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ?? null;

    const merchantId = siteName
      ? siteName.toLowerCase().replace(/[^a-z0-9]/g, '-')
      : null;

    const priceContent = doc
      .querySelector('meta[property="og:price:amount"]')
      ?.getAttribute('content');

    const price = priceContent ? parsePriceString(priceContent, currency) : null;

    return { price, title, merchantId };
  }

  // Regex fallback
  const titleMatch = domContentStub.match(/og:title.*?content="([^"]+)"/i);
  const priceMatch = domContentStub.match(/og:price:amount.*?content="([^"]+)"/i);
  const siteMatch = domContentStub.match(/og:site_name.*?content="([^"]+)"/i);

  const title = titleMatch?.[1] ?? null;
  const price = priceMatch?.[1] ? parsePriceString(priceMatch[1], currency) : null;
  const site = siteMatch?.[1] ?? null;
  const merchantId = site ? site.toLowerCase().replace(/[^a-z0-9]/g, '-') : null;

  return { price, title, merchantId };
}

function extractDomainId(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return hostname.split('.')[0] ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export class GenericMerchantAdapter implements MerchantAdapter {
  // Generic adapter handles anything — always returns true
  canHandle(_context: PageContext): boolean {
    return true;
  }

  detectMerchant(context: PageContext): MerchantDetectionResult {
    const domainId = extractDomainId(context.url);
    return {
      merchantId: domainId,
      confidence: 'LOW',
      matchedDomain: domainId,
    };
  }

  async extractCart(context: PageContext): Promise<Cart> {
    const currency = context.domContentStub
      ? detectCurrencyFromMeta(context.domContentStub)
      : 'INR';
    const zeroMoney: Money = { amountMinor: 0n, currency };

    if (!context.domContentStub) {
      return {
        merchantId: extractDomainId(context.url),
        items: [],
        subtotal: zeroMoney,
        discounts: [],
        shipping: zeroMoney,
        taxes: zeroMoney,
        total: zeroMoney,
        currency,
      };
    }

    const { price, title, merchantId } = extractFromOpenGraph(context.domContentStub, currency);
    const total = price ?? zeroMoney;
    const mid = merchantId ?? extractDomainId(context.url);

    return {
      merchantId: mid,
      items: price
        ? [
            {
              id: `${mid}-product`,
              name: title ?? 'Product',
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
    const currency = context.domContentStub
      ? detectCurrencyFromMeta(context.domContentStub)
      : 'INR';
    const zeroMoney: Money = { amountMinor: 0n, currency };

    if (!context.domContentStub) {
      return {
        productId: 'generic-unknown',
        name: 'Unknown Product',
        price: zeroMoney,
      };
    }

    const { price, title } = extractFromOpenGraph(context.domContentStub, currency);
    return {
      productId: 'generic-product',
      name: title ?? 'Product',
      price: price ?? zeroMoney,
    };
  }
}
