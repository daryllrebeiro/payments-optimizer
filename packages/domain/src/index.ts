// Core Types
export type Currency = 'INR' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'SGD' | 'AED';
export type CardNetwork = 'VISA' | 'MASTERCARD' | 'AMEX' | 'RUPAY' | 'DINERS';
export type RewardType = 'CASHBACK' | 'POINTS' | 'MILES' | 'HOTEL_POINTS' | 'VOUCHER' | 'OTHER';
export type Decimal = number;

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
}

export interface UserProfile {
  version: number;
  currency: Currency;
  paymentMethods: PaymentMethod[];
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
