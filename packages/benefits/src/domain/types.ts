import type {
  Money,
  BenefitSourceType,
  BenefitActionType,
  UserMembership,
  UserVoucher,
  PartnerBenefit,
  StrategyRecipeStep,
  UnifiedTransactionStrategy,
} from '@payments-optimizer/domain';

export {
  BenefitSourceType,
  BenefitActionType,
  UserMembership,
  UserVoucher,
  PartnerBenefit,
  StrategyRecipeStep,
  UnifiedTransactionStrategy,
};

export interface BenefitProgram {
  id: string;
  name: string;
  category: 'AIRLINE' | 'HOTEL' | 'RETAIL' | 'SUBSCRIPTION' | 'DINING' | 'FINANCIAL';
  issuerOrBrand: string;
  tiers?: string[];
  partnerBenefits: PartnerBenefit[];
}

export type GraphNodeType = 'PROGRAM' | 'MERCHANT' | 'CATEGORY' | 'BENEFIT' | 'USER_ASSET';

export interface BenefitGraphNode {
  id: string;
  name: string;
  type: GraphNodeType;
  metadata?: Record<string, unknown>;
}

export interface BenefitGraphEdge {
  fromNodeId: string;
  toNodeId: string;
  relation: 'PARTNER_OF' | 'BENEFITS_AT' | 'ISSUES' | 'EARNS' | 'OWNS';
  benefit?: PartnerBenefit;
}

export interface StackingCombinationResult {
  vouchersApplied: UserVoucher[];
  voucherSavings: Money;
  partnerBenefitApplied?: PartnerBenefit;
  partnerSavings: Money;
  residualCartTotal: Money;
  recipeSteps: StrategyRecipeStep[];
}

export interface ProactiveAlert {
  id: string;
  type: 'PARTNER_BENEFIT' | 'EXPIRING_VOUCHER' | 'ANTI_CANNIBALIZATION_WARNING' | 'MEMBERSHIP_RATE';
  title: string;
  message: string;
  savingsEstimate?: Money;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendedAction: string;
}
