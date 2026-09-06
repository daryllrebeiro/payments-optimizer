import type { Currency } from '@payments-optimizer/domain';

export interface StrategyExport {
  header: {
    extensionVersion: string;
    exportDate: string;
    merchantId: string;
    totalStrategies: number;
  };
  strategies: Array<{
    id: string;
    immediateDiscount: { amountMinor: string; currency: Currency };
    rewardValue: { amountMinor: string; currency: Currency };
    totalBenefit: { amountMinor: string; currency: Currency };
    confidence: number;
    complexityScore: number;
    steps: Array<{
      type: string;
      amount: { amountMinor: string; currency: Currency };
      paymentMethod: any;
      description: string;
    }>;
    recipeSteps?: Array<{
      stepNumber: number;
      phase: string;
      actionType: string;
      benefitSourceId: string;
      benefitSourceName: string;
      description: string;
      amountApplied: { amountMinor: string; currency: Currency };
      savingsGenerated: { amountMinor: string; currency: Currency };
    }>;
  }>;
  bestStrategy?: {
    id: string;
  };
}

export interface StrategyImport {
  version: string;
  strategies: Array<{
    id: string;
    steps: any[];
    immediateDiscount: any;
    rewardValue: any;
    totalBenefit: any;
    confidence: number;
  }>;
}
