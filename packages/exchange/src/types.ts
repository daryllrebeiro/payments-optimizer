export type Currency = 'INR' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'SGD' | 'AED' | 'CAD' | 'AUD';

export interface ExchangeRate {
  from: Currency;
  to: Currency;
  rate: number;
  timestamp: number;
  source: string;
}

export interface Money {
  amountMinor: bigint;
  currency: Currency;
}

export interface ConvertedMoney {
  amountMinor: bigint;
  currency: Currency;
  originalAmountMinor: bigint;
  originalCurrency: Currency;
  rate: number;
  timestamp: number;
}
