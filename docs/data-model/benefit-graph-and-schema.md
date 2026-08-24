# Data Model: Benefit Graph & Schemas

## 1. Domain Entities

### `BenefitSource`

Universal abstraction encompassing any source capable of emitting benefits:

- `MEMBERSHIP` (Amazon Prime, Accor ALL, Swiggy One)
- `PARTNER_PROGRAM` (Accor Dining / Partner portal)
- `STORED_VALUE` / `VOUCHER` (User-owned ₹500 Myntra voucher)
- `COUPON` (Merchant promo code)
- `PAYMENT_METHOD` (Credit card, Debit card, Wallet)

### `UserMembership`

```typescript
export interface UserMembership {
  id: string;
  programId: string;
  programName: string;
  tier?: string;
  membershipNumber?: string;
  validUntil?: string; // ISO 8601
  autoRenew?: boolean;
}
```

### `UserVoucher`

```typescript
export interface UserVoucher {
  id: string;
  merchantId: string;
  title: string;
  code?: string;
  initialValue: Money;
  remainingValue: Money;
  minimumSpend?: Money;
  expiryDate: string; // ISO 8601
  singleUse: boolean;
  terms?: string;
}
```

### `PartnerBenefit`

```typescript
export interface PartnerBenefit {
  id: string;
  programId: string;
  merchantId: string;
  partnerName: string;
  title: string;
  description?: string;
  benefit: OfferBenefit;
  conditions: RuleCondition[];
  validUntil?: string;
  stackableWithVouchers: boolean;
  stackableWithCards: boolean;
}
```

---

## 2. Benefit Graph DAG

```
   [Accor ALL] ──(BENEFITS_AT)──> [Myntra] (10% Off, Cap ₹1,000)
        │
   (BENEFITS_AT)
        │
        ▼
   [Accor Dining] (10% Dining Discount)
```

The `BenefitGraph` stores nodes (`PROGRAM`, `MERCHANT`, `CATEGORY`) and edges (`PARTNER_OF`, `BENEFITS_AT`, `ISSUES`, `EARNS`, `OWNS`).
During transaction evaluation, `getMerchantBenefitsForPrograms(merchantId, userPrograms)` traverses incoming edges to match active memberships with eligible merchant partner benefits.
