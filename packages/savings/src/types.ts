export interface BenefitApplication {
  benefitId: string;
  benefitType: string;
  benefitSourceId: string;
  benefitSourceName: string;
  amountApplied: {
    amountMinor: string; // String representation of BigInt
    currency: string;
  };
}

export interface SavingsEntry {
  id: string;
  timestamp: number;
  merchantId: string;
  cartTotal: {
    amountMinor: string;
    currency: string;
  };
  selectedStrategy: {
    id: string;
    immediateDiscount: {
      amountMinor: string;
      currency: string;
    };
    rewardValue: {
      amountMinor: string;
      currency: string;
    };
    totalBenefit: {
      amountMinor: string;
      currency: string;
    };
    confidence: number;
  };
  originalTotal: {
    amountMinor: string;
    currency: string;
  };
  savings: {
    amountMinor: string;
    currency: string;
  };
  paymentMethodUsed?: {
    type: string;
    cardId?: string;
  };
  benefitsApplied: BenefitApplication[];
}
