import type { Cart, PaymentStrategy } from '@payments-optimizer/domain';
// F3: message types come from the library's validated schemas — the
// extension no longer hand-declares a parallel set of message interfaces.
import type {
  ContentToBackgroundMessage,
  ConfirmSavingsMessage,
  OptimizePaymentMessage,
} from '@payments-optimizer/domain';
// F3: the wire codec is the library's DomainSerializer — namespaced
// {"__type":"bigint","value":"..."} encoding (F16: cannot collide with a
// natural string value like "100n"), shared with every other consumer of
// domain serialization instead of a hand-rolled per-extension format.
import { DomainSerializer } from '@payments-optimizer/domain';

export type { ContentToBackgroundMessage, ConfirmSavingsMessage, OptimizePaymentMessage };

// ── Outbound: Content Script → Service Worker ────────────────────────────────

export interface OptimizePaymentMessageLegacy {
  type: 'OPTIMIZE_PAYMENT';
  payload: {
    cart: Cart;
    /** Serialised Cart — bigints encoded as {"__bigint__": "123"} (F16) */
    cartJson: string;
  };
}

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
  /** F9: stable joinable IDs carried through serialization */
  benefitSourceId: string;
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

export type BackgroundToContentMessage =
  | OptimizePaymentResponse
  | OptimizePaymentErrorResponse;

// ── Serialization helpers ────────────────────────────────────────────────────

export function serializeCart(cart: Cart): string {
  return DomainSerializer.serializeSimple(cart);
}

export function deserializeCart(json: string): Cart {
  return DomainSerializer.deserializeSimple<Cart>(json);
}

export function serializeStrategy(strategy: PaymentStrategy): SerializedStrategy {
  const m = (money: { amountMinor: bigint; currency: string }): SerializedMoney => ({
    amountMinor: money.amountMinor.toString(),
    currency: money.currency,
  });

  const unified = strategy as Partial<
    import('@payments-optimizer/domain').UnifiedTransactionStrategy
  >;

  // F9: benefitSourceId is a required field of StrategyRecipeStep in the
  // domain model — carry it through so the savings ledger gets a real,
  // stable join key instead of `undefined`.
  const recipeSteps: SerializedRecipeStep[] | undefined = unified.recipeSteps?.map((step) => ({
    stepNumber: step.stepNumber,
    phase: step.phase,
    actionType: step.actionType,
    benefitSourceId: step.benefitSourceId,
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
