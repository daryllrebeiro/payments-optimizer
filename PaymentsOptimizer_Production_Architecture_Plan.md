# PaymentsOptimizer --- Production-Ready Architecture & Implementation Plan

**Version:** 1.1\
**Status:** Implementation specification\
**Repository:** `payments-optimizer` (recommended)\
**Working project name:** PaymentsOptimizer\
**Brand:** TBD --- branding will be decided after the technical product
is established.

> **Important naming note:** A web search found an existing **"Savant
> Pay"** product powered by Tapcheck and associated with Savant Payroll
> Solutions. It is an earned-wage-access/payroll product, not this
> shopping-payment optimizer. Therefore, **PaymentsOptimizer is not a
> clean trademark/brand-clearance result**. Treat the name as a working
> project name until a proper trademark, corporate-name, domain, and
> app-store clearance is performed. GitHub search did not surface a
> clear matching repository in the search results reviewed, but GitHub
> availability should be checked directly before creating the canonical
> organization/repository.

------------------------------------------------------------------------

# 1. Executive Summary

PaymentsOptimizer is a **privacy-first, local-first personal payment
optimization engine** that determines the best way for an individual to
pay for an online purchase.

It evaluates combinations of:

-   Credit/debit cards
-   Bank offers
-   Instant discounts
-   Coupon codes
-   Gift cards
-   Gift-card marketplaces
-   Cashback portals
-   Wallets
-   UPI/payment methods
-   Merchant-specific offers
-   Reward points
-   Miles
-   Card milestones
-   Annual-fee recovery
-   Reward caps
-   Minimum spend requirements
-   Category-specific rewards
-   Payment-method restrictions
-   Stacking rules
-   User-defined reward valuations

The system produces ranked payment strategies and explains exactly why a
strategy is better.

### Core principle

> **The deterministic financial engine is the source of truth. AI may
> explain the result, but AI must never calculate or invent monetary
> outcomes.**

------------------------------------------------------------------------

# 2. Product Vision

Today, a shopper may have several possible ways to pay:

``` text
Direct credit card
Gift card + credit card
Wallet + credit card
Coupon + credit card
Cashback portal + credit card
Bank offer + credit card
Gift card + coupon + credit card
```

A human usually compares only one or two options.

PaymentsOptimizer should evaluate the complete feasible strategy space
and answer:

> **"Given the payment methods and rewards I personally have access to,
> what is the most valuable way to make this purchase?"**

The answer must account for both:

1.  **Immediate savings**
2.  **Future value**

Example:

``` text
Purchase: ₹50,000

Strategy A
Immediate savings: ₹2,000
Reward value: ₹500
Effective cost: ₹47,500

Strategy B
Immediate savings: ₹1,200
Reward value: ₹800
Milestone value: ₹4,000
Effective cost: ₹44,000
```

Strategy B may be superior even though Strategy A has the larger
immediate discount.

------------------------------------------------------------------------

# 3. Product Principles

## 3.1 Local-first

User financial configuration remains on the user's device.

The following must not leave the device by default:

-   Card configuration
-   Card numbers
-   CVV
-   Banking credentials
-   User identity
-   Purchase history
-   Cart contents
-   Browsing history
-   Reward balances
-   Spending patterns
-   Financial goals
-   Personal preferences
-   Transaction calculations
-   Recommendations

------------------------------------------------------------------------

## 3.2 Zero customer-data egress by default

The product should work without a user account or backend.

Network communication is limited to explicitly defined public-data
resources such as:

-   Public offer data
-   Public merchant metadata
-   Public coupon metadata
-   Public card-program rules
-   Public gift-card metadata
-   Application updates

No user profile or transaction data should accompany these requests.

------------------------------------------------------------------------

## 3.3 Deterministic financial calculations

For identical:

``` text
User profile
+
Cart
+
Offer dataset version
+
Engine version
```

the optimizer must produce the same result.

------------------------------------------------------------------------

## 3.4 Explainability

Every recommendation must be explainable as a calculation trace.

Example:

``` text
Purchase                         ₹25,000
Coupon                           -₹1,000
Gift-card discount                 -₹800
Card cashback                      -₹600
Reward value                       -₹250
---------------------------------------
Effective cost                    ₹22,350
```

------------------------------------------------------------------------

## 3.5 User remains in control

PaymentsOptimizer recommends.

The user decides.

The extension must not:

-   Execute payments
-   Purchase gift cards automatically
-   Submit orders
-   Enter CVVs
-   Enter OTPs
-   Change bank settings
-   Apply financial products

------------------------------------------------------------------------

# 4. Project Naming & Future Branding

## Product name

**PaymentsOptimizer**

## Recommended GitHub repository

``` text
savantpay
```

## Suggested package naming

``` text
@savantpay/domain
@savantpay/rules-engine
@savantpay/optimizer
@savantpay/merchant-detector
@savantpay/offer-engine
@savantpay/profile
@savantpay/storage
@savantpay/security
```

## Important clearance requirement

The name **Savant Pay** is already used commercially by a
payroll/earned-wage-access product. Do not assume that
`PaymentsOptimizer` is legally or commercially available simply because
a specific GitHub repository is not obvious.

Before public launch:

-   Perform trademark clearance in intended markets.
-   Check Indian trademark databases.
-   Check USPTO/EUIPO/UKIPO if international distribution is planned.
-   Check domains.
-   Check Chrome Web Store naming conflicts.
-   Check npm/package namespace conflicts.
-   Check GitHub organization/repository availability.
-   Check app-store names if mobile distribution is planned.
-   Consult qualified trademark counsel before commercial launch.

Until clearance is complete, use **PaymentsOptimizer** as the
project/product working name.

------------------------------------------------------------------------

# 5. Non-Goals

The initial product must not:

-   Process payments.
-   Store CVV.
-   Store full card numbers.
-   Store banking credentials.
-   Automatically execute purchases.
-   Access bank accounts.
-   Access email accounts.
-   Scrape authenticated banking websites.
-   Build centralized user financial profiles.
-   Sell user data.
-   Send shopping history to cloud AI.
-   Automatically purchase gift cards.
-   Automatically apply financial products.

------------------------------------------------------------------------

# 6. High-Level Architecture

``` text
                         USER
                           |
                           v
                  +------------------+
                  | Browser          |
                  | Extension        |
                  +--------+---------+
                           |
                           v
                  +------------------+
                  | Application      |
                  | Layer            |
                  +--------+---------+
                           |
             +-------------+-------------+
             |             |             |
             v             v             v
        Merchant      User Profile   Public Offer
        Detection        Local DB       Dataset
             |             |             |
             +-------------+-------------+
                           |
                           v
                  +------------------+
                  | Rules Engine     |
                  | Deterministic    |
                  | Financial Math   |
                  +--------+---------+
                           |
                           v
                  +------------------+
                  | Strategy          |
                  | Generator         |
                  +--------+---------+
                           |
                           v
                  +------------------+
                  | Optimizer         |
                  +--------+---------+
                           |
                           v
                  +------------------+
                  | Recommendation   |
                  | + Audit Trace    |
                  +--------+---------+
                           |
                    +------+------+
                    |             |
                    v             v
                   UI       Optional AI
                            Explanation
```

------------------------------------------------------------------------

# 7. Architectural Layers

Use strict dependency direction:

``` text
Presentation
     |
Application
     |
Domain
     |
Infrastructure
```

### Domain

Pure business logic.

Must not depend on:

-   React
-   Chrome APIs
-   IndexedDB
-   HTTP
-   AI SDKs
-   Browser DOM

### Application

Coordinates use cases.

### Infrastructure

Implements:

-   Storage
-   Browser APIs
-   Network
-   Data loading
-   Cryptography adapters

### Presentation

React UI and browser extension UI.

------------------------------------------------------------------------

# 8. Repository Structure

Use a monorepo.

``` text
savantpay/
|
├── apps/
│   └── extension/
|
├── packages/
│   ├── domain/
│   ├── rules-engine/
│   ├── optimizer/
│   ├── merchant-detector/
│   ├── offer-engine/
│   ├── profile/
│   ├── storage/
│   ├── security/
│   ├── ui/
│   └── test-fixtures/
|
├── data/
│   ├── cards/
│   ├── merchants/
│   ├── offers/
│   ├── coupons/
│   └── gift-cards/
|
├── tools/
│   ├── validate-data/
│   ├── build-data/
│   └── benchmark/
|
├── docs/
│   ├── architecture/
│   ├── security/
│   ├── privacy/
│   ├── threat-model/
│   └── data-model/
|
├── tests/
│   ├── integration/
│   ├── property/
│   └── e2e/
|
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.js
├── prettier.config.js
├── vitest.config.ts
└── playwright.config.ts
```

------------------------------------------------------------------------

# 9. Technology Stack

## Core

-   TypeScript
-   Node.js for tooling
-   pnpm workspaces
-   Vite
-   React
-   Manifest V3

## Testing

-   Vitest
-   Playwright
-   fast-check for property-based testing

## Validation

-   Zod

## Storage

-   IndexedDB through a repository abstraction

## Cryptography

-   Web Crypto API

Avoid unnecessary dependencies.

------------------------------------------------------------------------

# 10. Domain Model

## Money

Never use JavaScript floating-point numbers for financial calculations.

Prefer integer minor units.

``` typescript
interface Money {
    amountMinor: bigint;
    currency: Currency;
}
```

Example:

``` text
₹1,999.99
=
199999 paise
```

All calculations must be deterministic.

------------------------------------------------------------------------

# 11. Currency

Initial currency:

``` text
INR
```

Architecture must support:

``` text
INR
USD
EUR
GBP
JPY
SGD
AED
```

Currency conversion must explicitly track:

``` text
source
rate
timestamp
```

If a reliable conversion rate is unavailable, do not silently compare
values across currencies.

------------------------------------------------------------------------

# 12. User Profile

``` typescript
interface UserProfile {
    version: number;
    currency: Currency;
    paymentMethods: PaymentMethod[];
    rewardPreferences: RewardPreferences;
    optimizationPreferences: OptimizationPreferences;
}
```

The profile is local-only.

------------------------------------------------------------------------

# 13. Payment Methods

``` typescript
type PaymentMethod =
    | CreditCard
    | DebitCard
    | Wallet
    | UpiAccount
    | BankAccount
    | GiftCard;
```

------------------------------------------------------------------------

# 14. Card Model

``` typescript
interface CreditCard {
    id: string;
    issuer: string;
    productName: string;
    network?: CardNetwork;

    rewardProgram: RewardProgram;

    annualFee?: Money;

    rewardRules: RewardRule[];

    spendingCaps?: SpendingCap[];

    milestoneRules?: MilestoneRule[];

    eligibleCategories?: MerchantCategory[];

    exclusions?: RewardExclusion[];

    userState?: UserCardState;
}
```

Never store:

``` text
full PAN
CVV
PIN
OTP
bank password
```

Store only a local card identity such as:

``` text
HDFC Millennia
```

and optionally:

``` text
****1234
```

------------------------------------------------------------------------

# 15. Reward Model

Support:

``` text
CASHBACK
POINTS
MILES
HOTEL_POINTS
VOUCHER
OTHER
```

``` typescript
interface RewardRule {
    id: string;
    rewardType: RewardType;
    rate: Decimal;

    category?: MerchantCategory[];
    merchantIds?: string[];

    minimumSpend?: Money;
    maximumReward?: Money;

    period?: RewardPeriod;

    conditions?: RuleCondition[];
}
```

------------------------------------------------------------------------

# 16. Reward Valuation

Never assume:

``` text
1 point = ₹1
```

Use:

``` typescript
interface RewardValuation {
    rewardProgramId: string;
    valuePerPoint?: Money;
    confidence: "USER_DEFINED" | "DEFAULT";
}
```

Users can override valuations.

------------------------------------------------------------------------

# 17. Merchant Model

``` typescript
interface Merchant {
    id: string;
    canonicalName: string;
    domains: string[];
    category: MerchantCategory;

    supportedPaymentMethods: PaymentMethodType[];

    giftCards?: GiftCardProgram[];

    offers?: OfferReference[];
}
```

Merchant identification confidence must be tracked.

------------------------------------------------------------------------

# 18. Merchant Adapter Architecture

Each major merchant gets an adapter.

``` typescript
interface MerchantAdapter {

    canHandle(context: PageContext): boolean;

    detectMerchant(
        context: PageContext
    ): MerchantDetectionResult;

    extractCart(
        context: PageContext
    ): Promise<Cart>;

    extractProduct(
        context: PageContext
    ): Promise<ProductContext>;
}
```

Initial adapters:

``` text
Amazon
Flipkart
GenericMerchant
```

The generic fallback uses:

``` text
Domain
 -> structured data
 -> OpenGraph
 -> DOM heuristics
 -> user confirmation
```

------------------------------------------------------------------------

# 19. Cart Model

``` typescript
interface Cart {
    merchantId: string;
    items: CartItem[];

    subtotal: Money;
    discounts: Discount[];
    shipping: Money;
    taxes: Money;

    total: Money;
    currency: Currency;
}
```

DOM-derived data must be treated as untrusted input.

------------------------------------------------------------------------

# 20. Offer Model

``` typescript
interface Offer {
    id: string;
    merchantId: string;

    title: string;
    description?: string;

    validFrom: Instant;
    validUntil: Instant;

    conditions: RuleCondition[];

    benefit: OfferBenefit;

    paymentRequirements?: PaymentRequirement[];

    stackingPolicy: StackingPolicy;

    source: OfferSource;
    confidence: OfferConfidence;
}
```

------------------------------------------------------------------------

# 21. Coupon Model

``` typescript
interface Coupon {
    id: string;
    merchantId: string;
    code: string;

    benefit: OfferBenefit;
    conditions: RuleCondition[];

    validUntil?: Instant;

    stackability: Stackability;
}
```

Never blindly apply a coupon.

Calculate whether it improves the overall strategy.

------------------------------------------------------------------------

# 22. Gift Card Optimization

Treat gift cards as payment instruments.

Example:

``` text
Purchase ₹10,000 gift card
Cost: ₹9,650

Payment method:
HDFC Millennia

Card reward:
₹482.50

Effective cost of ₹10,000 merchant value:
₹9,167.50
```

Model:

``` text
Gift Card Purchase
        |
        v
Payment Method
        |
        v
Gift Card Face Value
        |
        v
Merchant Purchase
```

------------------------------------------------------------------------

# 23. Payment Strategy

``` typescript
interface PaymentStrategy {

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
```

------------------------------------------------------------------------

# 24. Strategy Graph

Payment strategies form a graph:

``` text
Purchase
 |
 +-- Direct Card
 |
 +-- Wallet
 |
 +-- Gift Card
 |      |
 |      +-- Credit Card
 |
 +-- Cashback Portal
        |
        +-- Credit Card
```

This is preferable to hard-coded merchant-specific `if/else` logic.

------------------------------------------------------------------------

# 25. Strategy Generation

Pipeline:

``` text
Generate candidate strategies
        |
        v
Validate constraints
        |
        v
Calculate outcome
        |
        v
Remove dominated strategies
        |
        v
Apply personal preferences
        |
        v
Rank
```

------------------------------------------------------------------------

# 26. Constraint Engine

Validate:

-   Minimum spend
-   Maximum discount
-   Reward cap
-   Merchant eligibility
-   MCC/category eligibility
-   Payment-method eligibility
-   Coupon compatibility
-   Gift-card limits
-   Offer expiry
-   Stacking restrictions
-   Per-user limits

Invalid strategies are discarded before ranking.

------------------------------------------------------------------------

# 27. Effective Cost

Primary financial metric:

``` text
Effective Cost =
Purchase Cost
- Immediate Discounts
- Cashback Value
- Reward Value
- Gift Card Savings
- Future Benefit
+ Fees
```

Every displayed monetary result must be derived from this deterministic
calculation.

------------------------------------------------------------------------

# 28. Reward Caps

Example:

``` text
5% cashback
Maximum ₹1,000/month
```

Maintain local spending state:

``` typescript
interface SpendingState {
    period: string;
    rewardProgramId: string;
    usedAmount: Money;
    estimatedRemainingCap: Money;
}
```

User can edit/reset this state.

------------------------------------------------------------------------

# 29. Milestone Optimization

Example:

``` text
Annual spend: ₹3,72,000
Milestone: ₹4,00,000
Current purchase: ₹35,000
```

The optimizer should calculate the incremental milestone value.

This is a major differentiator from ordinary coupon tools.

------------------------------------------------------------------------

# 30. Optimization Profiles

Support:

## Maximum Immediate Savings

Prioritize:

``` text
cashback
discounts
coupons
```

## Maximum Reward Value

Prioritize:

``` text
points
miles
hotel rewards
```

## Balanced

Optimize:

``` text
immediate savings
+
reward value
+
milestone value
```

## Custom

``` typescript
interface OptimizationPreferences {
    immediateSavingsWeight: Decimal;
    rewardValueWeight: Decimal;
    milestoneWeight: Decimal;
    simplicityWeight: Decimal;
    riskWeight: Decimal;
}
```

Actual effective cost must always remain visible.

------------------------------------------------------------------------

# 31. Complexity Score

A strategy requiring:

``` text
3 websites
2 gift cards
1 coupon
```

may be less attractive than a slightly worse single-card option.

Track:

``` text
complexityScore
```

Show both:

``` text
Best overall
Best simple option
```

when appropriate.

------------------------------------------------------------------------

# 32. Confidence Model

Confidence should depend on data provenance.

Suggested hierarchy:

``` text
Official source
    HIGH

Verified structured source
    HIGH

Partner/verified source
    MEDIUM-HIGH

Community verified
    MEDIUM

Heuristic
    LOW
```

Never present uncertain savings as guaranteed.

------------------------------------------------------------------------

# 33. Calculation Trace

Every optimization should produce an audit trace.

``` typescript
interface CalculationTrace {
    steps: CalculationStep[];
    input: CalculationInput;
    output: CalculationOutput;
}
```

Example:

``` text
Purchase               ₹18,499
Coupon                 -₹500
Gift-card discount     -₹400
Card reward            -₹530
Final                  ₹17,069
```

------------------------------------------------------------------------

# 34. Reproducibility

A recommendation must be reproducible from:

``` text
Engine version
Data version
User configuration
Cart
Timestamp/context
```

Do not require customer data to be uploaded to reproduce a calculation
locally.

------------------------------------------------------------------------

# 35. Local Storage

Use IndexedDB behind an interface.

``` typescript
interface StorageRepository<T> {

    get(id: string): Promise<T | undefined>;

    list(): Promise<T[]>;

    put(entity: T): Promise<void>;

    delete(id: string): Promise<void>;
}
```

The domain layer must never directly access IndexedDB.

------------------------------------------------------------------------

# 36. Encryption

Use Web Crypto API.

Use standard cryptographic primitives such as:

``` text
AES-GCM
```

Do not invent custom cryptography.

Never store secrets in:

``` text
localStorage
sessionStorage
DOM
URL parameters
logs
analytics
```

------------------------------------------------------------------------

# 37. Sensitive Card Data

MVP stores:

``` text
Card name
Issuer
Optional last four digits
Reward configuration
Nickname
```

Never stores:

``` text
PAN
CVV
PIN
OTP
Online banking credentials
```

------------------------------------------------------------------------

# 38. Network Architecture

Create a dedicated public-data network boundary.

``` typescript
interface PublicDataClient {
    fetchPublicData(
        request: PublicDataRequest
    ): Promise<PublicDataResponse>;
}
```

Do not allow these types into network requests:

``` text
UserProfile
Cart
PurchaseHistory
RewardBalances
Card credentials
Personal identifiers
```

------------------------------------------------------------------------

# 39. Network Allowlist

The extension should only communicate with explicitly approved
public-data endpoints.

Unknown outbound requests must be rejected.

Add automated tests that inspect the production bundle and verify
network destinations.

------------------------------------------------------------------------

# 40. Manifest V3 Security

Use strict CSP.

No:

``` text
eval()
new Function()
unsafe-eval
inline executable scripts
remote executable JavaScript
```

Request minimum permissions.

Avoid broad permissions such as:

``` text
history
cookies
webRequest
```

unless a future feature has a documented security justification.

Use optional host permissions where practical.

------------------------------------------------------------------------

# 41. Content Script Security

Content scripts operate on untrusted websites.

Never trust:

``` text
merchant
price
coupon
currency
product
```

until validated.

Use schema validation at application boundaries.

------------------------------------------------------------------------

# 42. Extension Messaging

All extension messages must be typed and validated.

``` typescript
type ExtensionMessage =
    | DetectMerchantMessage
    | GetRecommendationMessage
    | UpdateProfileMessage
    | RefreshOffersMessage;
```

Every incoming message must be validated before use.

------------------------------------------------------------------------

# 43. Security Boundary

``` text
Web Page
   |
   | UNTRUSTED
   v
Content Script
   |
   | VALIDATED MESSAGE
   v
Extension Service Worker
   |
   v
Application Layer
   |
   v
Domain Engine
```

Never allow:

``` text
Web Page -> Domain Engine
```

directly.

------------------------------------------------------------------------

# 44. AI Architecture

AI is optional.

Correct flow:

``` text
Rules Engine
      |
      v
Structured Recommendation
      |
      v
Sanitized Explanation Object
      |
      v
Optional AI
      |
      v
Natural Language Explanation
```

AI may receive:

``` json
{
  "merchant": "Amazon",
  "purchaseAmount": 18499,
  "recommendation": {
    "effectiveCost": 17069,
    "discount": 500,
    "rewardValue": 650,
    "couponValue": 280
  }
}
```

AI must not receive:

-   Card number
-   CVV
-   User identity
-   Purchase history
-   Financial profile

------------------------------------------------------------------------

# 45. AI Failure Policy

If AI is unavailable:

``` text
The product continues working.
```

If AI produces an incorrect explanation:

``` text
The deterministic calculation remains authoritative.
```

The UI must render monetary values directly from the structured
calculation result.

------------------------------------------------------------------------

# 46. Public Data Architecture

Data packages:

``` text
cards.json
offers.json
merchants.json
coupons.json
gift-cards.json
```

Each release must contain:

``` text
schemaVersion
dataVersion
createdAt
validFrom
checksum
sourceMetadata
```

Example:

``` json
{
  "schemaVersion": 1,
  "dataVersion": "2026.08.19.1",
  "createdAt": "...",
  "validFrom": "...",
  "checksum": "..."
}
```

------------------------------------------------------------------------

# 47. Data Integrity

Validate all datasets before activation.

Use atomic replacement.

If validation fails:

``` text
Keep previous dataset active.
Reject new dataset.
Record local diagnostic error.
```

------------------------------------------------------------------------

# 48. Offer Expiration

Every offer should have:

``` text
validFrom
validUntil
```

Expired offers must never contribute positive benefit.

If freshness cannot be established:

``` text
Mark as uncertain.
Reduce confidence.
Do not present as guaranteed.
```

------------------------------------------------------------------------

# 49. Data Provenance

``` typescript
interface OfferSource {
    type:
        | "OFFICIAL"
        | "PARTNER"
        | "VERIFIED"
        | "COMMUNITY";

    reference?: string;
    retrievedAt: Instant;
}
```

Display source and freshness where appropriate.

------------------------------------------------------------------------

# 50. Offline Mode

Core optimization must work without internet.

``` text
No Internet
    |
    v
Local User Profile
+
Local Offer Dataset
+
Rules Engine
    |
    v
Recommendation
```

Only fresh external offer data may become unavailable.

------------------------------------------------------------------------

# 51. Performance Requirements

Initial targets:

``` text
Merchant detection: <100ms
Cart extraction: <300ms
Optimization: <100ms for normal carts
UI rendering: <100ms
```

Benchmark strategy counts:

``` text
10
100
1,000
10,000
```

If strategy generation becomes expensive, use:

-   Candidate pruning
-   Dominance filtering
-   Memoization
-   Web Worker execution

Optimize only after measurement.

------------------------------------------------------------------------

# 52. Dominance Filtering

Strategy A dominates B when:

``` text
A has equal/lower effective cost
AND
A has equal/lower complexity
AND
A has equal/higher confidence
```

Remove dominated strategies before ranking.

------------------------------------------------------------------------

# 53. Recommendation Ranking

Default score:

``` text
Score =
SavingsWeight × Savings
+
RewardWeight × RewardValue
+
MilestoneWeight × FutureBenefit
-
ComplexityWeight × Complexity
-
RiskWeight × Risk
```

The UI must separately display:

``` text
Immediate savings
Reward value
Future benefit
Fees
Effective cost
Complexity
Confidence
```

Never hide actual financial numbers behind a subjective score.

------------------------------------------------------------------------

# 54. Browser UI

Primary result:

``` text
+--------------------------------+
| PaymentsOptimizer                      |
|                                |
| Amazon                         |
| Cart: ₹18,499                  |
|                                |
| 🏆 BEST WAY TO PAY             |
|                                |
| HDFC Millennia                 |
| + Amazon Gift Card             |
|                                |
| Save ₹1,430                    |
| Effective cost ₹17,069         |
|                                |
| [Why?]                         |
|                                |
| Other options                  |
| SBI Cashback        ₹1,210     |
| Axis Atlas          ₹980       |
+--------------------------------+
```

------------------------------------------------------------------------

# 55. Explainability UI

``` text
Why this is best

✓ Gift-card discount      +₹500
✓ HDFC reward             +₹650
✓ Coupon                  +₹280
--------------------------------
Total benefit             ₹1,430
```

Add:

``` text
Source
Confidence
Data freshness
```

where relevant.

------------------------------------------------------------------------

# 56. What-If Simulator

Allow the user to change:

-   Payment method
-   Coupon
-   Gift card
-   Reward valuation
-   Purchase amount
-   Milestone state

Example:

``` text
Current:
₹17,069

Switch to SBI Cashback:
₹17,289

Difference:
₹220
```

------------------------------------------------------------------------

# 57. Onboarding

First launch:

``` text
1. Country
2. Currency
3. Add cards
4. Configure reward valuations
5. Configure optimization mode
6. Optional gift-card/cashback preferences
7. Finish
```

No account creation.

------------------------------------------------------------------------

# 58. Card Catalog

Users select known cards from a catalog.

Example:

``` text
Search cards

HDFC Millennia     [Add]
Axis Atlas         [Add]
SBI Cashback       [Add]
```

Sensitive card credentials are never requested.

------------------------------------------------------------------------

# 59. User Overrides

Users can override:

-   Reward valuation
-   Monthly spend
-   Milestone progress
-   Annual fee
-   Card availability
-   Offer applicability

This is essential because public reward rules cannot know every user's
state.

------------------------------------------------------------------------

# 60. Versioning and Migrations

All persisted schemas must be versioned.

``` text
v1 -> v2
v2 -> v3
```

Before migration:

``` text
Create local backup.
Run migration.
Validate result.
```

If migration fails:

``` text
Restore previous backup.
```

Never lose user configuration due to an update.

------------------------------------------------------------------------

# 61. Import / Export

Allow encrypted local profile export:

``` text
best-way-to-pay-profile.bwp
```

Import process:

``` text
Decrypt
  |
Validate schema
  |
Validate domain invariants
  |
Migrate
  |
Activate
```

------------------------------------------------------------------------

# 62. Diagnostics

Provide a local diagnostics screen.

Safe diagnostic bundle:

``` text
Engine version
Data version
Browser version
Extension version
Feature flags
Error codes
Performance metrics
```

Never include:

-   Card details
-   Cart data
-   User identity
-   Financial balances
-   Browsing history

------------------------------------------------------------------------

# 63. Logging

Production logs must never contain:

-   PAN
-   CVV
-   User identity
-   Cart contents
-   Purchase history
-   Financial balances

Use structured logging:

``` text
DEBUG
INFO
WARN
ERROR
```

Production default should be minimal.

------------------------------------------------------------------------

# 64. Telemetry

Default:

``` text
NO TELEMETRY
```

If introduced later:

-   Explicit opt-in
-   Anonymous
-   No financial information
-   No browsing history
-   No cart contents
-   No persistent user identifier

The architecture should make accidental telemetry difficult.

------------------------------------------------------------------------

# 65. Threat Model

Threats to document and test:

``` text
Malicious website
Malicious DOM
XSS
Prototype pollution
Malicious offer dataset
Compromised update source
Extension supply-chain attack
Data exfiltration
Malicious coupon
Tampered merchant metadata
Malicious extension message
```

------------------------------------------------------------------------

# 66. Testing Strategy

## Unit tests

Every financial calculation must have tests.

Cover:

-   Cashback
-   Points
-   Miles
-   Caps
-   Minimum spend
-   Expiry
-   Coupons
-   Gift cards
-   Stacking
-   Milestones
-   Fees
-   Merchant eligibility
-   Currency handling

------------------------------------------------------------------------

# 67. Property-Based Tests

Use fast-check.

Examples:

``` text
Increasing a discount cannot increase effective cost.

A reward cannot exceed its cap.

An expired offer cannot produce positive benefit.

A zero-benefit strategy cannot become cheaper because of zero-fee arithmetic.

Adding a valid positive discount cannot worsen the strategy outcome.

Identical inputs always produce identical outputs.
```

------------------------------------------------------------------------

# 68. Golden Tests

Create deterministic fixtures.

Example:

``` text
Amazon
₹10,000

Card A
Card B
Card C

Coupon X
Gift Card Y

Expected winner:
Strategy B

Expected effective cost:
₹X,XXX.XX
```

Run all fixtures in CI.

------------------------------------------------------------------------

# 69. Mutation Testing

Use mutation testing against the rules engine to verify that tests
detect:

-   Wrong reward rates
-   Wrong caps
-   Incorrect expiry comparisons
-   Incorrect minimum-spend operators
-   Incorrect discount arithmetic

------------------------------------------------------------------------

# 70. Integration Tests

Test:

``` text
Fixture website
  |
Content script
  |
Merchant adapter
  |
Cart extraction
  |
Optimizer
  |
UI
```

Use Playwright.

Avoid depending exclusively on live commercial websites for
deterministic CI.

------------------------------------------------------------------------

# 71. Browser Security Tests

Verify:

-   No sensitive data leaves the extension
-   Unknown network destinations are blocked
-   Content scripts cannot access extension secrets
-   CSP blocks script injection
-   Malicious DOM cannot execute code
-   Malformed offers cannot crash the optimizer
-   Malicious messages are rejected

------------------------------------------------------------------------

# 72. CI/CD

Every pull request must execute:

``` text
TypeScript compilation
ESLint
Prettier check
Unit tests
Property tests
Integration tests
Security tests
Build
Bundle validation
Dependency audit
```

Merge is blocked on failure.

------------------------------------------------------------------------

# 73. Dependency Security

Use:

``` text
Dependabot or Renovate
npm/pnpm audit
OSV scanning
lockfile
```

Review every dependency addition.

Prefer standard platform APIs over dependencies where reasonable.

------------------------------------------------------------------------

# 74. Supply-Chain Security

Production builds should be reproducible:

``` text
Source
  |
Locked dependencies
  |
Deterministic build
  |
Artifact
  |
Hash
  |
Release
```

Never download executable JavaScript dynamically.

------------------------------------------------------------------------

# 75. TypeScript Standards

Enable:

``` text
strict
noImplicitAny
strictNullChecks
noUncheckedIndexedAccess
exactOptionalPropertyTypes
```

Prefer:

-   Pure functions
-   Immutable data
-   Explicit interfaces
-   Dependency injection
-   Small modules
-   Typed errors
-   Typed boundary validation

Avoid:

-   Global state
-   Singleton abuse
-   Magic numbers
-   Business logic in React
-   Giant service classes
-   Browser APIs inside domain code

------------------------------------------------------------------------

# 76. Dependency Rules

Enforce:

``` text
UI
 ↓
Application
 ↓
Domain
```

Forbidden:

``` text
Domain -> UI
Domain -> Browser API
Domain -> IndexedDB
Domain -> HTTP
Domain -> AI SDK
```

Use automated dependency-boundary checks if practical.

------------------------------------------------------------------------

# 77. Package Responsibilities

### `domain`

Business entities and value objects.

### `rules-engine`

Financial rules and calculations.

### `optimizer`

Strategy generation, evaluation, pruning, ranking.

### `merchant-detector`

Merchant detection and adapters.

### `offer-engine`

Offer/coupon/gift-card handling.

### `profile`

User configuration.

### `storage`

IndexedDB implementation and migrations.

### `security`

Crypto and security utilities.

### `ui`

React components.

------------------------------------------------------------------------

# 78. Dependency Injection

Example:

``` typescript
class RecommendationService {

    constructor(
        private readonly merchantRepository: MerchantRepository,
        private readonly offerRepository: OfferRepository,
        private readonly optimizer: Optimizer
    ) {}
}
```

Use interfaces at infrastructure boundaries.

------------------------------------------------------------------------

# 79. Avoid God Classes

Do not create:

``` text
BestWayToPayService
```

that contains all logic.

Prefer:

``` text
MerchantDetectionService
CartExtractionService
OfferService
StrategyGenerator
StrategyEvaluator
RecommendationRanker
ExplanationService
```

------------------------------------------------------------------------

# 80. First Milestone

Do not start with the browser extension.

Start with:

``` text
domain
   |
rules-engine
   |
optimizer
   |
CLI test harness
```

The first milestone must be able to process:

``` text
Merchant: Amazon
Purchase: ₹20,000

User cards:
HDFC Millennia
SBI Cashback
Axis Atlas

Gift card:
Amazon ₹20,000 @ 4%

Coupon:
₹1,000
```

Output:

``` text
Generated strategies: N

Best strategy:
...

Effective cost:
...

Immediate savings:
...

Reward value:
...

Future milestone value:
...

Confidence:
...

Calculation trace:
...
```

Only after this is trustworthy should browser integration begin.

------------------------------------------------------------------------

# 81. Implementation Phases

## Phase 0 --- Repository Foundation

Create:

-   Monorepo
-   TypeScript
-   pnpm
-   ESLint
-   Prettier
-   Vitest
-   Playwright
-   CI
-   Dependency boundaries
-   README
-   ADR structure

Deliverable:

``` text
Clean production-grade repository
```

------------------------------------------------------------------------

## Phase 1 --- Domain

Implement:

-   Money
-   Currency
-   Merchant
-   PaymentMethod
-   Reward
-   Offer
-   Coupon
-   GiftCard
-   PaymentStrategy
-   Recommendation
-   CalculationTrace

Deliverable:

``` text
Pure domain package
```

------------------------------------------------------------------------

## Phase 2 --- Rules Engine

Implement:

-   Discounts
-   Cashback
-   Points
-   Caps
-   Minimum spend
-   Expiry
-   Eligibility
-   Coupons
-   Gift-card discounts
-   Stacking
-   Milestones
-   Fees

Deliverable:

``` text
Deterministic financial engine
```

------------------------------------------------------------------------

## Phase 3 --- Optimizer

Implement:

-   Strategy generation
-   Constraint filtering
-   Evaluation
-   Dominance filtering
-   Personal scoring
-   Ranking
-   Complexity
-   Confidence

Deliverable:

``` text
Best payment strategy engine
```

------------------------------------------------------------------------

## Phase 4 --- User Profile

Implement:

-   Card catalog
-   Local profile
-   Reward valuations
-   Milestone tracking
-   Preferences
-   IndexedDB
-   Encryption
-   Migrations
-   Import/export

Deliverable:

``` text
Persistent private local configuration
```

------------------------------------------------------------------------

## Phase 5 --- Browser Integration

Implement:

-   Manifest V3
-   Service worker
-   Content scripts
-   Merchant detection
-   Cart extraction
-   Typed messaging

Initial support:

``` text
Amazon
Flipkart
Generic merchant
```

------------------------------------------------------------------------

## Phase 6 --- UI

Implement:

-   Onboarding
-   Popup
-   Recommendation
-   Calculation breakdown
-   What-if simulator
-   Settings
-   Card management
-   Privacy controls
-   Diagnostics

------------------------------------------------------------------------

## Phase 7 --- Public Data

Implement:

-   Card rules
-   Merchant offers
-   Coupons
-   Gift cards
-   Cashback data
-   Schema validation
-   Versioning
-   Checksums
-   Atomic updates
-   Expiration
-   Provenance

------------------------------------------------------------------------

## Phase 8 --- Security Hardening

Perform:

-   Threat modelling
-   Permission audit
-   CSP testing
-   XSS testing
-   DOM fuzzing
-   Message fuzzing
-   Malicious dataset testing
-   Dependency audit
-   Bundle inspection

------------------------------------------------------------------------

## Phase 9 --- Performance

Benchmark and optimize.

Only introduce:

-   Web Workers
-   Memoization
-   Candidate pruning

when measurements justify them.

------------------------------------------------------------------------

## Phase 10 --- AI Explanation

Add only after the deterministic engine is stable.

AI receives structured, sanitized results.

AI never owns financial calculations.

------------------------------------------------------------------------

# 82. MVP Definition

MVP is complete when:

``` text
User installs extension
        |
Adds cards
        |
Visits supported merchant
        |
Extension detects merchant
        |
Extracts cart
        |
Loads local offers
        |
Generates strategies
        |
Calculates savings
        |
Ranks strategies
        |
Shows best option
        |
Explains why
```

Requirements:

``` text
No account
No sensitive card credentials
No customer-data egress
Offline optimizer
Deterministic calculations
```

------------------------------------------------------------------------

# 83. Example End-to-End Scenario

User:

``` text
HDFC Millennia
SBI Cashback
Axis Atlas
```

Purchase:

``` text
Amazon
₹25,000
```

Available:

``` text
Coupon:
₹1,000

Gift card:
4% discount

HDFC:
5% reward

SBI:
5% cashback

Axis:
2 miles/₹100
```

Generate:

``` text
Strategy 1
Gift Card + HDFC

Strategy 2
Direct SBI Cashback

Strategy 3
Direct Axis Atlas

Strategy 4
Gift Card + SBI
```

Evaluate every valid strategy.

Output:

``` text
BEST OVERALL
Gift Card + HDFC

Effective cost: ₹XX,XXX
Total benefit: ₹X,XXX
Confidence: High
Complexity: Medium
```

Also show:

``` text
BEST SIMPLE OPTION
Direct SBI Cashback
```

------------------------------------------------------------------------

# 84. Future Architecture

``` text
                    SAVANTPAY
                        |
          +-------------+-------------+
          |             |             |
       Shopping       Travel        Bills
          |             |             |
       Amazon         Flights       Utilities
       Flipkart       Hotels        Insurance
       Myntra         Forex         Rent
          |             |
          +-------------+-------------+
                        |
                 Payment Optimizer
                        |
        +---------------+---------------+
        |               |               |
       Cards          Wallets       Gift Cards
        |               |               |
        +---------------+---------------+
                        |
                 Personal Value Model
```

------------------------------------------------------------------------

# 85. Future AI Agent

Eventually support:

``` text
User:
"I need to buy a ₹70,000 TV."

Agent:
1. Detect merchant
2. Load local offer data
3. Generate strategies
4. Calculate rewards
5. Check milestones
6. Evaluate gift cards
7. Rank strategies
8. Explain recommendation
```

The agent calls deterministic tools:

``` text
calculateReward()
calculateDiscount()
evaluateGiftCard()
calculateMilestone()
rankStrategies()
```

The LLM does not invent the financial answer.

------------------------------------------------------------------------

# 86. Future Reusable Engine

Because the core packages have no browser dependencies:

``` text
@savantpay/domain
@savantpay/rules-engine
@savantpay/optimizer
```

can later power:

``` text
Chrome extension
Firefox extension
Desktop application
Android application
iOS application
Shopping assistant
Travel optimizer
AI agent
```

------------------------------------------------------------------------

# 87. Production Release Checklist

-   [ ] Trademark/name clearance initiated
-   [ ] Domain availability verified
-   [ ] GitHub organization/repository availability verified
-   [ ] Security audit completed
-   [ ] Permission audit completed
-   [ ] Privacy audit completed
-   [ ] Dependency audit completed
-   [ ] CSP validated
-   [ ] XSS testing completed
-   [ ] Extension messaging fuzzed
-   [ ] Financial calculations reviewed
-   [ ] Property tests passing
-   [ ] Golden tests passing
-   [ ] E2E tests passing
-   [ ] Migration tests passing
-   [ ] Performance benchmarks passing
-   [ ] Offline mode tested
-   [ ] Corrupted-data recovery tested
-   [ ] Malicious-DOM testing completed
-   [ ] Offer-expiry testing completed
-   [ ] Production bundle inspected
-   [ ] No unauthorized network endpoints
-   [ ] No sensitive telemetry
-   [ ] Privacy documentation published
-   [ ] Threat model published
-   [ ] User documentation published

------------------------------------------------------------------------

# 88. Codex Execution Rules

Codex must implement incrementally.

For each phase:

1.  Inspect repository.
2.  Confirm current architecture.
3.  Implement smallest coherent unit.
4.  Add tests.
5.  Run type checking.
6.  Run lint.
7.  Run tests.
8.  Run security checks where applicable.
9.  Review dependency boundaries.
10. Commit only coherent changes.
11. Continue only after the phase passes.

Codex must not:

-   Invent financial rules.
-   Invent reward rates.
-   Invent merchant offers.
-   Invent coupon validity.
-   Add a backend unnecessarily.
-   Add analytics by default.
-   Send customer data externally.
-   Store sensitive card information.
-   Put business logic in React.
-   Put browser APIs in domain code.
-   Use floating-point arithmetic for money.
-   Allow AI to calculate financial outcomes.
-   Bypass validation for convenience.
-   Introduce broad extension permissions without documented
    justification.

------------------------------------------------------------------------

# 89. Definition of Done

Production-ready PaymentsOptimizer requires:

``` text
✓ Deterministic financial engine
✓ Correct monetary arithmetic
✓ Fully tested calculations
✓ Property-based tests
✓ Strategy optimizer
✓ Local private profile
✓ IndexedDB persistence
✓ Encryption where appropriate
✓ Schema migrations
✓ Merchant adapters
✓ Generic merchant fallback
✓ Offer versioning
✓ Offer provenance
✓ Expiration handling
✓ Manifest V3 extension
✓ Minimum permissions
✓ Strict CSP
✓ Typed extension messaging
✓ No sensitive telemetry
✓ Offline operation
✓ Reproducible calculations
✓ Calculation trace
✓ Explainable recommendations
✓ Accessibility
✓ Internationalization foundation
✓ CI/CD
✓ Dependency security
✓ Threat model
✓ E2E tests
✓ Performance benchmarks
✓ Recovery testing
✓ Production build validation
✓ Brand/trademark clearance before commercial launch
```

------------------------------------------------------------------------

# 90. Final Architectural Principle

PaymentsOptimizer is not fundamentally a coupon extension.

It is a:

> **Personal payment optimization engine with a browser interface.**

The browser extension is simply the first interface.

The long-term architecture should preserve this separation:

``` text
                    SAVANTPAY
                        |
          +-------------+-------------+
          |                           |
     Deterministic               Optional AI
     Optimization                Explanation
          |                           |
          v                           v
   Financial Truth             Natural Language
```

The most important rule in the entire codebase:

``` text
AI -> Explanation
Rules Engine -> Calculation
Optimizer -> Recommendation
User -> Decision
```

And the most important privacy rule:

``` text
Customer financial data
        |
        v
      DEVICE
        |
        X
   No customer-data
       egress
```

**PaymentsOptimizer should be built so that a user can trust not only
the recommendation, but also the architecture behind it.**
