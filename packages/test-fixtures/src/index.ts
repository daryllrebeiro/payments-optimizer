import { Money } from '@payments-optimizer/domain';

export const dummyMoney: Money = {
  amountMinor: 10000n, // 100.00
  currency: 'INR',
};

export * from './fixtures.js';
