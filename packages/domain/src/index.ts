// Branded types for currency safety
export type InrMinor = bigint & { __brand: 'InrMinor' };
export type InrMajor = number & { __brand: 'InrMajor' };
export type UsdMinor = bigint & { __brand: 'UsdMinor' };
export type UsdMajor = number & { __brand: 'UsdMajor' };

/**
 * Converts INR amount in major units (rupees) to minor units (paise)
 */
export function inrToMinor(amount: number): InrMinor {
  return BigInt(Math.round(amount * 100)) as InrMinor;
}

/**
 * Converts INR amount in minor units (paise) to major units (rupees)
 */
export function inrToMajor(amount: InrMinor | bigint): InrMajor {
  return (Number(amount) / 100) as InrMajor;
}

/**
 * Converts USD amount in major units (dollars) to minor units (cents)
 */
export function usdToMinor(amount: number): UsdMinor {
  return BigInt(Math.round(amount * 100)) as UsdMinor;
}

/**
 * Converts USD amount in minor units (cents) to major units (dollars)
 */
export function usdToMajor(amount: UsdMinor | bigint): UsdMajor {
  return (Number(amount) / 100) as UsdMajor;
}

// Core Types
export type Currency = 'INR' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'SGD' | 'AED';
export type CardNetwork = 'VISA' | 'MASTERCARD' | 'AMEX' | 'RUPAY' | 'DINERS';
export type RewardType = 'CASHBACK' | 'POINTS' | 'MILES' | 'HOTEL_POINTS' | 'VOUCHER' | 'OTHER';
export type Decimal = number;

/**
 * Parses an ISO 8601 date string and validates it.
 * @param dateStr - Date string in ISO 8601 format
 * @returns Date object if valid, null if parsing fails
 */
export function parseExpiryDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }

  const trimmed = dateStr.trim();
  const parsed = new Date(trimmed);

  // Check if date is valid
  if (isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export interface Money {
  amountMinor: bigint;
  currency: Currency;
}

// Card Models
export interface RewardRule {
  id: string;
  rewardType: RewardType;
  rate: Decimal;
  category?: string[];
  merchantIds?: string[];
  minimumSpend?: Money;
  maximumReward?: Money;
  period?: 'MONTHLY' | 'ANNUAL' | 'STATEMENT';
  conditions?: RuleCondition[];
}

export interface SpendingCap {
  period: 'MONTHLY' | 'ANNUAL' | 'STATEMENT';
  rewardProgramId: string;
  limit: Money;
  currentSpent: Money;
}

export interface MilestoneRule {
  id: string;
  targetSpend: Money;
  reward: Money;
  rewardType: RewardType;
  period: 'MONTHLY' | 'ANNUAL';
}

export interface UserCardState {
  isAvailable: boolean;
  currentStatementSpend: Money;
  annualSpendToDate: Money;
  monthlySpendToDate: Money;
}

export interface CreditCard {
  id: string;
  issuer: string;
  productName: string;
  network?: CardNetwork;
  rewardProgram: string;
  annualFee?: Money;
  rewardRules: RewardRule[];
  spendingCaps?: SpendingCap[];
  milestoneRules?: MilestoneRule[];
  eligibleCategories?: string[];
  exclusions?: string[];
  userState?: UserCardState;
}

export interface DebitCard {
  id: string;
  issuer: string;
  productName: string;
  network?: CardNetwork;
  rewardProgram: string;
  rewardRules: RewardRule[];
  spendingCaps?: SpendingCap[];
  eligibleCategories?: string[];
  exclusions?: string[];
  userState?: UserCardState;
}

export interface Wallet {
  name: string;
  balance?: Money;
}

export interface UpiAccount {
  upiId?: string;
  bankName?: string;
}

export interface BankAccount {
  bankName: string;
  accountNumberTail?: string;
}

export interface GiftCard {
  id: string;
  merchantId: string;
  faceValue: Money;
  cost: Money;
  balance: Money;
  expiry?: string; // ISO 8601 Date string
}

export type PaymentMethod =
  | { type: 'CREDIT_CARD'; card: CreditCard }
  | { type: 'DEBIT_CARD'; card: DebitCard }
  | { type: 'WALLET'; wallet: Wallet }
  | { type: 'UPI'; upi: UpiAccount }
  | { type: 'BANK_ACCOUNT'; bank: BankAccount }
  | { type: 'GIFT_CARD'; giftCard: GiftCard };

// User Profile Models
export interface RewardPreferences {
  defaultValuations: Record<string, Money>; // rewardProgramId -> valuation per unit
  preferredType?: RewardType;
}

export interface OptimizationPreferences {
  immediateSavingsWeight: Decimal;
  rewardValueWeight: Decimal;
  milestoneWeight: Decimal;
  simplicityWeight: Decimal;
  riskWeight: Decimal;
  urgencyWeight?: Decimal;
}

// Benefits & Membership Intelligence Types
export type BenefitSourceType =
  | 'MEMBERSHIP'
  | 'SUBSCRIPTION'
  | 'LOYALTY_PROGRAM'
  | 'PARTNER_PROGRAM'
  | 'STORED_VALUE'
  | 'VOUCHER'
  | 'COUPON'
  | 'PAYMENT_METHOD'
  | 'EMPLOYER_BENEFIT'
  | 'PROMOTION';

export type BenefitActionType =
  | 'INSTANT_DISCOUNT'
  | 'CASHBACK'
  | 'REWARD_POINTS'
  | 'VOUCHER_REDEMPTION'
  | 'FREE_SHIPPING'
  | 'PARTNER_RATE'
  | 'UPGRADE'
  | 'BONUS_POINTS'
  | 'PARTNER_OFFER';

export interface UserMembership {
  id: string;
  programId: string;
  programName: string;
  tier?: string | undefined;
  membershipNumber?: string | undefined;
  validUntil?: string | undefined; // ISO 8601 Date string
  autoRenew?: boolean | undefined;
}

export interface UserVoucher {
  id: string;
  merchantId: string;
  title: string;
  code?: string | undefined;
  initialValue: Money;
  remainingValue: Money;
  minimumSpend?: Money | undefined;
  expiryDate: string; // ISO 8601 Date string
  singleUse: boolean;
  terms?: string | undefined;
}

export interface PartnerBenefit {
  id: string;
  programId: string;
  merchantId: string;
  partnerName: string;
  title: string;
  description?: string | undefined;
  benefit: OfferBenefit;
  conditions: RuleCondition[];
  validUntil?: string | undefined;
  stackableWithVouchers: boolean;
  stackableWithCards: boolean;
}

export interface StrategyRecipeStep {
  stepNumber: number;
  phase: 'BEFORE_PAYMENT' | 'AT_PAYMENT' | 'POST_PAYMENT';
  actionType: BenefitActionType;
  benefitSourceId: string;
  benefitSourceName: string;
  description: string;
  amountApplied: Money;
  savingsGenerated: Money;
  instructions?: string | undefined;
  codeToApply?: string | undefined;
}

export interface UnifiedTransactionStrategy extends PaymentStrategy {
  recipeSteps: StrategyRecipeStep[];
  voucherSavings: Money;
  partnerSavings: Money;
  cardSavings: Money;
  opportunityScore: number;
  urgencyBonus: Money;
}

export interface UserProfile {
  version: number;
  currency: Currency;
  paymentMethods: PaymentMethod[];
  memberships?: UserMembership[];
  vouchers?: UserVoucher[];
  rewardPreferences: RewardPreferences;
  optimizationPreferences: OptimizationPreferences;
}

// Cart Models
export interface CartItem {
  id: string;
  name: string;
  price: Money;
  quantity: number;
  category?: string;
}

export interface Discount {
  amount: Money;
  description?: string;
}

export interface Cart {
  merchantId: string;
  items: CartItem[];
  subtotal: Money;
  discounts: Discount[];
  shipping: Money;
  taxes: Money;
  total: Money;
  currency: Currency;
}

// Merchant Models
export interface GiftCardProgram {
  id: string;
  merchantId: string;
  supportedPurchaseMethods: string[];
}

export interface OfferReference {
  offerId: string;
  confidence: number;
}

export type PaymentMethodType =
  'CREDIT_CARD' | 'DEBIT_CARD' | 'UPI' | 'WALLET' | 'BANK_ACCOUNT' | 'GIFT_CARD';

export interface Merchant {
  id: string;
  canonicalName: string;
  domains: string[];
  category: string;
  supportedPaymentMethods: PaymentMethodType[];
  giftCards?: GiftCardProgram[];
  offers?: OfferReference[];
}

// Merchant Adapter Types
export interface PageContext {
  url: string;
  domContentStub?: string;
}

export interface MerchantDetectionResult {
  merchantId?: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  matchedDomain?: string;
}

export interface ProductContext {
  productId: string;
  name: string;
  price: Money;
  category?: string;
}

export interface MerchantAdapter {
  canHandle(context: PageContext): boolean;
  detectMerchant(context: PageContext): MerchantDetectionResult;
  extractCart(context: PageContext): Promise<Cart>;
  extractProduct(context: PageContext): Promise<ProductContext>;
}

// Offers & Rules Models
export interface RuleCondition {
  type:
    | 'MINIMUM_SPEND'
    | 'MCC_ELIGIBILITY'
    | 'MERCHANT_ELIGIBILITY'
    | 'COUPON_COMPATIBILITY'
    | 'EXPIRY'
    | 'STACKING_RESTRICTION'
    | 'OTHER';
  value?: string | Money | number | boolean | string[];
}

export interface OfferBenefit {
  type: 'PERCENTAGE_DISCOUNT' | 'FIXED_DISCOUNT' | 'CASHBACK' | 'POINTS';
  value: Decimal | Money;
  cap?: Money;
}

export interface PaymentRequirement {
  methodType: PaymentMethodType;
  network?: CardNetwork;
  issuer?: string;
}

export interface StackingPolicy {
  canStackWithCoupons: boolean;
  canStackWithGiftCards: boolean;
}

export interface OfferSource {
  type: 'OFFICIAL' | 'PARTNER' | 'VERIFIED' | 'COMMUNITY';
  reference?: string;
  retrievedAt: string; // ISO Date String
}

export interface Offer {
  id: string;
  merchantId: string;
  title: string;
  description?: string;
  validFrom: string; // ISO Date String
  validUntil: string; // ISO Date String
  conditions: RuleCondition[];
  benefit: OfferBenefit;
  paymentRequirements?: PaymentRequirement[];
  stackingPolicy: StackingPolicy;
  source: OfferSource;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface Coupon {
  id: string;
  merchantId: string;
  code: string;
  benefit: OfferBenefit;
  conditions: RuleCondition[];
  validUntil?: string; // ISO Date String
  stackability: 'STACKABLE' | 'NON_STACKABLE';
}

// Strategy & Optimization Results
export interface PaymentStep {
  type: 'GIFT_CARD_PURCHASE' | 'MERCHANT_PAYMENT' | 'CASHBACK_PORTAL';
  amount: Money;
  paymentMethod: PaymentMethod;
  description: string;
}

export interface PaymentStrategy {
  id: string;
  steps: PaymentStep[];
  immediateDiscount: Money;
  rewardValue: Money;
  futureBenefit: Money;
  fees: Money;
  effectiveCost: Money;
  totalBenefit: Money;
  confidence: number;
  complexityScore: number;
}

export interface CalculationStep {
  description: string;
  amountChange: Money;
  type: 'BASE_PRICE' | 'DISCOUNT' | 'CASHBACK' | 'REWARD_POINTS' | 'FEE';
}

export interface CalculationTrace {
  steps: CalculationStep[];
  input: {
    cart: Cart;
    strategyId: string;
  };
  output: {
    effectiveCost: Money;
    totalBenefit: Money;
  };
}

export interface Recommendation {
  strategy: PaymentStrategy;
  trace: CalculationTrace;
  explanation?: string;
}

// Historical Savings Tracking Types
export interface BenefitApplication {
  benefitId: string;
  benefitType: string;
  benefitSourceId: string;
  benefitSourceName: string;
  amountApplied: Money;
}

export interface SavingsEntry {
  id: string;
  timestamp: number;
  merchantId: string;
  cartTotal: Money;
  selectedStrategy: PaymentStrategy;
  originalTotal: Money;
  savings: Money;
  paymentMethodUsed?: PaymentMethod;
  benefitsApplied: BenefitApplication[];
}

// Serialization and Message Schemas
export * from './serialization.js';
export * from './message-schemas.js';
export * from './profile-schema.js';

// Circuit Breaker for API resilience
export * from './circuit-breaker.js';

// Result type and error handling
export * from './result.js';
export {
  ValidationError,
  NotFoundError,
  InsufficientResourceError,
  TimeoutError,
  NetworkError,
  CircuitBreakerOpenError,
  StorageError,
  TransactionError,
  MigrationError,
  ConfigurationError,
  AuthorizationError,
  BusinessLogicError,
  ConflictError,
  RateLimitError,
  isValidationError,
  isNotFoundError,
  isInsufficientResourceError,
  isTimeoutError,
  isNetworkError,
  isCircuitBreakerOpenError,
  isStorageError,
  isTransactionError,
  isMigrationError,
  isConfigurationError,
  isAuthorizationError,
  isBusinessLogicError,
  isConflictError,
  isRateLimitError,
  ErrorCode,
} from './errors.js';

// Clock abstraction for time handling
export * from './clock.js';

// Logger with privacy-first design
export * from './logger.js';

// Telemetry system
export * from './telemetry.js';
