import type { Cart, PaymentStrategy } from '@payments-optimizer/domain';

// ── Outbound: Content Script → Service Worker ────────────────────────────────

export interface OptimizePaymentMessage {
  type: 'OPTIMIZE_PAYMENT';
  payload: {
    cart: Cart;
    /** Serialised Cart — bigints are stringified with trailing 'n' */
    cartJson: string;
  };
}

export type ContentToBackgroundMessage = OptimizePaymentMessage;

// ── Inbound: Service Worker → Content Script ─────────────────────────────────

export interface OptimizationResult {
  strategies: SerializedStrategy[];
  bestStrategy: SerializedStrategy | null;
}

/** PaymentStrategy with Money.amountMinor serialized as string (bigint safe) */
export interface SerializedMoney {
  amountMinor: string; // bigint as string
  currency: string;
}

export interface SerializedRecipeStep {
  stepNumber: number;
  phase: 'BEFORE_PAYMENT' | 'AT_PAYMENT' | 'POST_PAYMENT';
  actionType: string;
  benefitSourceName: string;
  description: string;
  amountApplied: SerializedMoney;
  savingsGenerated: SerializedMoney;
  instructions?: string;
  codeToApply?: string;
}

export interface SerializedStrategy {
  id: string;
  immediateDiscount: SerializedMoney;
  rewardValue: SerializedMoney;
  futureBenefit: SerializedMoney;
  fees: SerializedMoney;
  effectiveCost: SerializedMoney;
  totalBenefit: SerializedMoney;
  confidence: number;
  complexityScore: number;
  stepDescriptions: string[];
  recipeSteps?: SerializedRecipeStep[];
  voucherSavings?: SerializedMoney;
  partnerSavings?: SerializedMoney;
  cardSavings?: SerializedMoney;
}

export interface OptimizePaymentResponse {
  type: 'OPTIMIZE_PAYMENT_RESULT';
  payload: OptimizationResult;
}

export interface OptimizePaymentErrorResponse {
  type: 'OPTIMIZE_PAYMENT_ERROR';
  error: string;
}

export type BackgroundToContentMessage = OptimizePaymentResponse | OptimizePaymentErrorResponse;

// ── Serialization helpers ────────────────────────────────────────────────────

export function serializeCart(cart: Cart): string {
  return JSON.stringify(cart, (_key, value) => {
    if (typeof value === 'bigint') return `${value.toString()}n`;
    return value;
  });
}

export function deserializeCart(json: string): Cart {
  return JSON.parse(json, (_key, value) => {
    if (typeof value === 'string' && /^-?\d+n$/.test(value)) {
      return BigInt(value.slice(0, -1));
    }
    return value;
  }) as Cart;
}

export function serializeStrategy(strategy: PaymentStrategy): SerializedStrategy {
  const m = (money: { amountMinor: bigint; currency: string }): SerializedMoney => ({
    amountMinor: money.amountMinor.toString(),
    currency: money.currency,
  });

  const unified = strategy as Partial<
    import('@payments-optimizer/domain').UnifiedTransactionStrategy
  >;

  const recipeSteps: SerializedRecipeStep[] | undefined = unified.recipeSteps?.map((step) => ({
    stepNumber: step.stepNumber,
    phase: step.phase,
    actionType: step.actionType,
    benefitSourceName: step.benefitSourceName,
    description: step.description,
    amountApplied: m(step.amountApplied),
    savingsGenerated: m(step.savingsGenerated),
    ...(step.instructions ? { instructions: step.instructions } : {}),
    ...(step.codeToApply ? { codeToApply: step.codeToApply } : {}),
  }));

  return {
    id: strategy.id,
    immediateDiscount: m(strategy.immediateDiscount),
    rewardValue: m(strategy.rewardValue),
    futureBenefit: m(strategy.futureBenefit),
    fees: m(strategy.fees),
    effectiveCost: m(strategy.effectiveCost),
    totalBenefit: m(strategy.totalBenefit),
    confidence: strategy.confidence,
    complexityScore: strategy.complexityScore,
    stepDescriptions: strategy.steps.map((s) => s.description),
    ...(recipeSteps ? { recipeSteps } : {}),
    ...(unified.voucherSavings ? { voucherSavings: m(unified.voucherSavings) } : {}),
    ...(unified.partnerSavings ? { partnerSavings: m(unified.partnerSavings) } : {}),
    ...(unified.cardSavings ? { cardSavings: m(unified.cardSavings) } : {}),
  };
}

export function deserializeStrategy(
  s: SerializedStrategy,
  currency: string
): Pick<
  PaymentStrategy,
  | 'id'
  | 'immediateDiscount'
  | 'rewardValue'
  | 'futureBenefit'
  | 'fees'
  | 'effectiveCost'
  | 'totalBenefit'
  | 'confidence'
  | 'complexityScore'
> {
  const m = (sm: SerializedMoney) => ({
    amountMinor: BigInt(sm.amountMinor),
    currency: (sm.currency || currency) as import('@payments-optimizer/domain').Currency,
  });

  return {
    id: s.id,
    immediateDiscount: m(s.immediateDiscount),
    rewardValue: m(s.rewardValue),
    futureBenefit: m(s.futureBenefit),
    fees: m(s.fees),
    effectiveCost: m(s.effectiveCost),
    totalBenefit: m(s.totalBenefit),
    confidence: s.confidence,
    complexityScore: s.complexityScore,
  };
}
