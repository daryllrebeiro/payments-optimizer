# Payment Optimizer Architecture

High-level architecture and design decisions for the Payment Optimizer system.

## System Overview

Payment Optimizer is a browser extension that helps users maximize savings and rewards when shopping online by:
1. Detecting merchant pages and cart contexts
2. Analyzing available payment methods, offers, coupons, and vouchers
3. Computing optimal benefit stacking strategies
4. Presenting actionable recommendations in real-time

## Architecture Principles

### 1. **Local-First Privacy**
- All sensitive data stored locally in IndexedDB
- No personal financial information sent to external servers
- Offers/catalogs can be fetched from public APIs
- User maintains full control over their data

### 2. **Modular Package Design**
- Monorepo structure with independent packages
- Clear separation of concerns
- Packages can be used independently
- Type-safe boundaries via TypeScript

### 3. **Offline-Capable**
- Core optimization works without network
- Graceful degradation when offers unavailable
- Local caching of merchant data

### 4. **Extensible Plugin System**
- Merchant adapters for site-specific detection
- Plugin registry for custom integrations
- Hot-loadable benefit rules

---

## Package Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser Extension                        │
│                    (apps/extension)                          │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Popup UI   │  │   Content    │  │  Background  │     │
│  │   (React)    │  │   Script     │  │  Service     │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
└─────────┼──────────────────┼──────────────────┼────────────┘
          │                  │                  │
          └──────────────────┴──────────────────┘
                             │
        ┌────────────────────┴────────────────────┐
        │                                         │
   ┌────▼────┐                              ┌────▼────┐
   │ Benefits │◄───────────┐                │ Storage │
   │ Package  │            │                │ Package │
   └────┬────┘            │                └────┬────┘
        │                 │                     │
        │            ┌────▼────┐               │
        │            │  Rules  │               │
        │            │ Engine  │               │
        │            └────┬────┘               │
        │                 │                    │
   ┌────▼─────────────────▼────────────────────▼────┐
   │              Domain Types                       │
   │         (@payments-optimizer/domain)            │
   └─────────────────────────────────────────────────┘
```

---

## Core Packages

### 1. Domain (@payments-optimizer/domain)

**Purpose**: Centralized type definitions and domain models

**Key Types:**
- `Money`, `Cart`, `Offer`, `Coupon`
- `CreditCard`, `RewardRule`, `MilestoneRule`
- `UserProfile`, `PaymentMethod`

**Why**: Single source of truth for types ensures consistency across packages.

---

### 2. Benefits (@payments-optimizer/benefits)

**Purpose**: Core optimization engine

**Components:**
- **UnifiedBenefitOptimizer**: Main optimization orchestrator
- **PublicBenefitCatalog**: Partner benefit discovery
- **BenefitStackingEngine**: Voucher/perk combination generator
- **OpportunityScorer**: Strategy ranking algorithm
- **EligibilityEngine**: Benefit qualification checker
- **VoucherManager**: Expiry tracking and burning logic

**Flow:**
```
Cart + Profile
    ↓
PublicBenefitCatalog.getBenefitsForMerchant()
    ↓
BenefitStackingEngine.generateStackingCombinations()
    ↓
For each combination:
  - Evaluate payment methods
  - Calculate rewards
  - Calculate milestones
  - Calculate fees
    ↓
OpportunityScorer.calculateScore()
    ↓
Sort by score
    ↓
Return strategies[]
```

---

### 3. Rules Engine (@payments-optimizer/rules-engine)

**Purpose**: Eligibility checking and benefit calculation

**Functions:**
- `checkEligibility()`: Validate rule conditions
- `calculateBenefit()`: Compute monetary value of benefits
- `evaluateCardReward()`: Calculate card rewards
- `calculateMilestoneContribution()`: Track progress to milestones
- `calculatePaymentFees()`: Compute convenience fees

**Design**: Pure functions for testability and predictability.

---

### 4. Storage (@payments-optimizer/storage)

**Purpose**: Persistent data storage

**Implementation**: IndexedDB wrapper with typed API

**Stores:**
- `cards`: User credit/debit cards
- `offers`: Merchant offers and promotions
- `coupons`: User coupons and promo codes
- `profiles`: User profile and preferences
- `savings`: Historical savings tracking

**Why IndexedDB**: 
- Large storage capacity (50MB+)
- Structured data with indexes
- Transactional integrity
- Works offline

---

### 5. Profile (@payments-optimizer/profile)

**Purpose**: User profile management

**Features:**
- Profile CRUD operations
- Import/Export with encryption (AES-256-GCM)
- Membership tracking
- Voucher inventory management

**Security**: Optional passphrase-based encryption for data portability.

---

### 6. Merchant Detector (@payments-optimizer/merchant-detector)

**Purpose**: Detect merchant pages and extract cart information

**Components:**
- **MerchantRegistry**: Maps domains to adapters
- **Generic Adapter**: Fallback detection logic
- **Plugin System**: Custom merchant adapters

**Detection Flow:**
```
Page Load
    ↓
MerchantDetector.detect(pageContext)
    ↓
MerchantRegistry.getAdapter(domain)
    ↓
Adapter.canHandle(context)
    ↓
Adapter.detectMerchant(context)
    ↓
Adapter.extractCart(context)
    ↓
Return Cart
```

---

### 7. Offer Engine (@payments-optimizer/offer-engine)

**Purpose**: Public offer catalog management

**Features:**
- Schema validation for offers
- Offer bundling and distribution
- Partner API integration
- Confidence scoring

**Data Sources:**
- Official merchant APIs
- Partner networks
- Community submissions
- Verified databases

---

## Extension Architecture

### Background Service Worker

**Responsibilities:**
- Listen for merchant page navigation
- Coordinate optimization workflow
- Manage storage operations
- Handle message passing

**Key Functions:**
```typescript
// Detect merchant and optimize
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    detectAndOptimize(tab);
  }
});

async function detectAndOptimize(tab: chrome.tabs.Tab) {
  // 1. Extract page context
  const context = await extractPageContext(tab);
  
  // 2. Detect merchant
  const merchant = merchantDetector.detect(context);
  if (!merchant) return;
  
  // 3. Extract cart
  const cart = await extractCart(context);
  if (!cart) return;
  
  // 4. Get user profile
  const profile = await profileManager.getProfile();
  if (!profile) return;
  
  // 5. Optimize
  const strategies = optimizer.optimize(cart, profile);
  
  // 6. Send to popup
  chrome.runtime.sendMessage({
    type: 'OPTIMIZATION_COMPLETE',
    strategies
  });
}
```

### Content Script

**Responsibilities:**
- Inject UI overlays
- Monitor DOM changes
- Extract product/cart data
- Communicate with background script

**Why**: Content scripts have access to page DOM, enabling cart extraction.

### Popup UI (React)

**Responsibilities:**
- Display optimization strategies
- Manage user profile
- Configure preferences
- Show savings history

**Components:**
- Dashboard: Overview and quick actions
- Settings: Profile and preferences
- Diagnostics: Extension health
- Savings History: Track past optimizations

---

## Data Flow

### Complete Optimization Flow

```
1. User navigates to merchant site
        ↓
2. Content script detects page load
        ↓
3. Background service worker triggered
        ↓
4. Merchant detector identifies site
        ↓
5. Cart extractor reads product/cart info
        ↓
6. Storage retrieves user profile
        ↓
7. Benefit optimizer generates strategies
        ↓
8. Opportunity scorer ranks strategies
        ↓
9. Results sent to popup
        ↓
10. User reviews recommendations
        ↓
11. User follows recipe steps
        ↓
12. Savings tracked in history
```

---

## Design Patterns

### 1. **Repository Pattern** (Storage)
```typescript
class StorageRepository {
  async save<T>(store: string, entity: T): Promise<void> { }
  async get<T>(store: string, id: string): Promise<T | undefined> { }
  async getAll<T>(store: string): Promise<T[]> { }
}
```

### 2. **Strategy Pattern** (Optimization)
```typescript
interface OptimizationStrategy {
  optimize(cart: Cart, profile: UserProfile): UnifiedTransactionStrategy[];
}

class UnifiedBenefitOptimizer implements OptimizationStrategy {
  optimize(cart, profile) {
    // Implementation
  }
}
```

### 3. **Factory Pattern** (Test Fixtures)
```typescript
export function createMoney(amount: number, currency: Currency): Money {
  return {
    amountMinor: BigInt(Math.round(amount * 100)),
    currency
  };
}
```

### 4. **Registry Pattern** (Merchant Detection)
```typescript
class MerchantRegistry {
  private adapters = new Map<string, MerchantAdapter>();
  
  register(domain: string, adapter: MerchantAdapter) {
    this.adapters.set(domain, adapter);
  }
  
  getAdapter(domain: string): MerchantAdapter | undefined {
    return this.adapters.get(domain);
  }
}
```

---

## Performance Considerations

### 1. **Lazy Loading**
- Load merchant adapters on-demand
- Defer non-critical UI components
- Load offers asynchronously

### 2. **Caching**
- Cache merchant detection results
- Memoize expensive calculations
- Cache public benefit catalog

### 3. **Indexing**
- Index storage by merchantId for fast lookups
- Index offers by validFrom/validUntil dates
- Index cards by issuer and network

### 4. **Benchmarking**
- Regular performance regression testing
- Benchmark critical paths (optimization, storage)
- Track bundle size

---

## Security Considerations

### 1. **Data Storage**
- Sensitive data only in IndexedDB (never in localStorage)
- Optional encryption for export
- Secure key derivation (PBKDF2)

### 2. **Content Security Policy**
```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

### 3. **Permissions**
- Minimal required permissions
- No remote code execution
- No access to browsing history

### 4. **Input Validation**
- Validate all external data (offers, coupons)
- Sanitize user inputs
- Type checking with TypeScript

---

## Testing Strategy

### 1. **Unit Tests** (Vitest)
- Test pure functions in isolation
- Mock external dependencies
- Aim for 80%+ coverage

### 2. **Integration Tests**
- Test package interactions
- Verify storage operations
- Test optimization workflows

### 3. **E2E Tests** (Playwright)
- Test complete user flows
- Verify UI interactions
- Test across browsers

### 4. **Performance Tests**
- Benchmark critical algorithms
- Regression detection
- Memory leak detection

---

## Build & Deployment

### Development
```bash
pnpm install
pnpm build
pnpm test
```

### Production Build
```bash
pnpm build
# Output: apps/extension/dist/
# Load unpacked extension in Chrome
```

### CI/CD
```yaml
# .github/workflows/ci.yml
- Build all packages
- Run tests
- Run linter
- Check bundle size
- Deploy extension (future)
```

---

## Future Architecture

### Planned Enhancements

1. **Cloud Sync** (Optional)
   - End-to-end encrypted profile sync
   - Multi-device support
   - Backup and restore

2. **AI Recommendations**
   - ML-based opportunity scoring
   - Personalized suggestions
   - Anomaly detection

3. **Social Features**
   - Community-sourced offers
   - Deal sharing
   - Leaderboards

4. **Mobile Support**
   - React Native app
   - Shared core packages
   - Cross-platform sync

---

## References

- [ADR-001: Repository Foundation](./architecture/ADR-001-Repository-Foundation.md)
- [ADR-002: Benefits & Membership Intelligence](./architecture/ADR-002-Benefits-Membership-Intelligence.md)
- [API Documentation](./API.md)
- [Contributing Guide](../CONTRIBUTING.md)
