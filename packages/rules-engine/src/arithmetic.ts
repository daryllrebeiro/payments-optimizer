import { Money, Currency, Decimal } from '@payments-optimizer/domain';

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(
      `Currency mismatch: cannot perform operation on ${a.currency} and ${b.currency}`
    );
  }
}

export function zeroMoney(currency: Currency): Money {
  return {
    amountMinor: 0n,
    currency,
  };
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return {
    amountMinor: a.amountMinor + b.amountMinor,
    currency: a.currency,
  };
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return {
    amountMinor: a.amountMinor - b.amountMinor,
    currency: a.currency,
  };
}

export function multiplyMoney(amount: Money, rate: Decimal): Money {
  const scale = 1_000_000n;
  const rateScaled = BigInt(Math.round(rate * 1_000_000));
  const resultMinor = (amount.amountMinor * rateScaled) / scale;
  return {
    amountMinor: resultMinor,
    currency: amount.currency,
  };
}

export function compareMoney(a: Money, b: Money): number {
  assertSameCurrency(a, b);
  if (a.amountMinor < b.amountMinor) return -1;
  if (a.amountMinor > b.amountMinor) return 1;
  return 0;
}

export function minMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return a.amountMinor <= b.amountMinor ? a : b;
}

export function maxMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return a.amountMinor >= b.amountMinor ? a : b;
}
