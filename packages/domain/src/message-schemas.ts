/**
 * Zod schemas for message validation
 * Epic 1.3: Type-safe message passing with runtime validation
 */

import { z } from 'zod';

/**
 * Schema for Money type (serialized with string amountMinor)
 */
export const SerializedMoneySchema = z.object({
  amountMinor: z.string().regex(/^-?\d+$/, 'amountMinor must be a valid integer string'),
  currency: z.enum(['INR', 'USD', 'EUR', 'GBP']),
});

/**
 * Schema for Cart items
 */
export const CartItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: SerializedMoneySchema,
  quantity: z.number().int().positive(),
  category: z.string(),
});

/**
 * Schema for Cart
 */
export const CartSchema = z.object({
  merchantId: z.string().min(1),
  items: z.array(CartItemSchema).min(1),
  subtotal: SerializedMoneySchema,
  discounts: z.array(SerializedMoneySchema),
  shipping: SerializedMoneySchema,
  taxes: SerializedMoneySchema,
  total: SerializedMoneySchema,
  currency: z.enum(['INR', 'USD', 'EUR', 'GBP']),
});

export type SerializedCart = z.infer<typeof CartSchema>;

/**
 * Schema for recipe steps
 */
export const SerializedRecipeStepSchema = z.object({
  stepNumber: z.number().int().positive(),
  phase: z.enum(['BEFORE_PAYMENT', 'AT_PAYMENT', 'POST_PAYMENT']),
  actionType: z.string(),
  // Fix F9: stable joinable ledger key — domain StrategyRecipeStep requires
  // benefitSourceId; the wire schema must carry it or validation strips it
  // and every persisted benefits[].benefitId becomes undefined.
  benefitId: z.string().min(1).optional(),
  benefitSourceId: z.string().min(1),
  benefitSourceName: z.string(),
  description: z.string(),
  amountApplied: SerializedMoneySchema,
  savingsGenerated: SerializedMoneySchema,
  instructions: z.string().optional(),
  codeToApply: z.string().optional(),
});

/**
 * Schema for serialized strategy
 */
export const SerializedStrategySchema = z.object({
  id: z.string(),
  immediateDiscount: SerializedMoneySchema,
  rewardValue: SerializedMoneySchema,
  futureBenefit: SerializedMoneySchema,
  fees: SerializedMoneySchema,
  effectiveCost: SerializedMoneySchema,
  totalBenefit: SerializedMoneySchema,
  confidence: z.number().min(0).max(1),
  complexityScore: z.number().min(0),
  stepDescriptions: z.array(z.string()),
  recipeSteps: z.array(SerializedRecipeStepSchema).optional(),
  voucherSavings: SerializedMoneySchema.optional(),
  partnerSavings: SerializedMoneySchema.optional(),
  cardSavings: SerializedMoneySchema.optional(),
});

export type SerializedStrategy = z.infer<typeof SerializedStrategySchema>;

/**
 * Schema for OPTIMIZE_PAYMENT message payload
 */
export const OptimizePaymentPayloadSchema = z.object({
  cartJson: z.string().min(1),
});

/**
 * Schema for OPTIMIZE_PAYMENT message
 */
export const OptimizePaymentMessageSchema = z.object({
  type: z.literal('OPTIMIZE_PAYMENT'),
  payload: OptimizePaymentPayloadSchema,
});

export type OptimizePaymentMessage = z.infer<typeof OptimizePaymentMessageSchema>;

/**
 * F13: schema for CONFIRM_SAVINGS — the explicit user action that is the
 * ONLY trigger for persisting a savings entry. Money fields are integer
 * strings; the handler enforces currency equality (F2) before any math.
 */
export const ConfirmSavingsMessageSchema = z.object({
  type: z.literal('CONFIRM_SAVINGS'),
  payload: z.object({
    merchantId: z.string().min(1).max(200),
    cartTotal: z.object({
      amountMinor: z.string().regex(/^\d{1,17}$/, 'amountMinor must be an integer string'),
      currency: z.enum(['INR', 'USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AED']),
    }),
    strategy: z.object({
      id: z.string().min(1).max(200),
      immediateDiscount: SerializedMoneySchema,
      rewardValue: SerializedMoneySchema,
      futureBenefit: SerializedMoneySchema,
      fees: SerializedMoneySchema,
      effectiveCost: SerializedMoneySchema,
      totalBenefit: SerializedMoneySchema,
      confidence: z.number().min(0).max(1),
      complexityScore: z.number().min(0),
      stepDescriptions: z.array(z.string()),
    }),
    benefitsApplied: z.array(
      z.object({
        benefitId: z.string(),
        benefitType: z.string(),
        benefitSourceId: z.string(),
        benefitSourceName: z.string(),
        amountApplied: z.object({
          amountMinor: z.string().regex(/^\d{1,17}$/),
          currency: z.enum(['INR', 'USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AED']),
        }),
      })
    ),
  }),
});

export type ConfirmSavingsMessage = z.infer<typeof ConfirmSavingsMessageSchema>;

/**
 * Schema for optimization result
 */
export const OptimizationResultSchema = z.object({
  strategies: z.array(SerializedStrategySchema),
  bestStrategy: SerializedStrategySchema.nullable(),
});

/**
 * Schema for OPTIMIZE_PAYMENT_RESULT response
 */
export const OptimizePaymentResponseSchema = z.object({
  type: z.literal('OPTIMIZE_PAYMENT_RESULT'),
  payload: OptimizationResultSchema,
});

export type OptimizePaymentResponse = z.infer<typeof OptimizePaymentResponseSchema>;

/**
 * Schema for error response
 */
export const OptimizePaymentErrorResponseSchema = z.object({
  type: z.literal('OPTIMIZE_PAYMENT_ERROR'),
  error: z.string(),
});

export type OptimizePaymentErrorResponse = z.infer<typeof OptimizePaymentErrorResponseSchema>;

/**
 * Union of all message types
 */
export const ContentToBackgroundMessageSchema = z.union([
  OptimizePaymentMessageSchema,
  ConfirmSavingsMessageSchema,
]);
export const BackgroundToContentMessageSchema = z.union([
  OptimizePaymentResponseSchema,
  OptimizePaymentErrorResponseSchema,
]);

export type ContentToBackgroundMessage = z.infer<typeof ContentToBackgroundMessageSchema>;
export type BackgroundToContentMessage = z.infer<typeof BackgroundToContentMessageSchema>;

/**
 * Validation helpers
 */
export function validateMessage(message: unknown): ContentToBackgroundMessage {
  return ContentToBackgroundMessageSchema.parse(message);
}

export function validateOptimizePaymentMessage(message: unknown): OptimizePaymentMessage {
  return OptimizePaymentMessageSchema.parse(message);
}

export function validateConfirmSavingsMessage(message: unknown): ConfirmSavingsMessage {
  return ConfirmSavingsMessageSchema.parse(message);
}

export function validateOptimizePaymentResponse(response: unknown): OptimizePaymentResponse {
  return OptimizePaymentResponseSchema.parse(response);
}

export function validateOptimizePaymentErrorResponse(
  response: unknown
): OptimizePaymentErrorResponse {
  return OptimizePaymentErrorResponseSchema.parse(response);
}

export function validateCart(cart: unknown): SerializedCart {
  return CartSchema.parse(cart);
}

export function validateStrategy(strategy: unknown): SerializedStrategy {
  return SerializedStrategySchema.parse(strategy);
}
