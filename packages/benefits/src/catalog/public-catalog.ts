import { BenefitProgram, PartnerBenefit } from '../domain/types.js';
import { BenefitGraph } from '../graph/benefit-graph.js';

/**
 * Memoization cache key for getBenefitsForMerchant
 */
type MemoKey = `${string}:${string}`;

/**
 * Memoization cache entry
 */
interface MemoEntry {
  timestamp: number;
  benefits: PartnerBenefit[];
}

// Cache TTL: 5 minutes
const CACHE_TTL_MS = 5 * 60 * 1000;

export class PublicBenefitCatalog {
  private programs = new Map<string, BenefitProgram>();
  private graph = new BenefitGraph();
  private memoCache = new Map<MemoKey, MemoEntry>();

  constructor() {
    this.initializeDefaultCatalog();
  }

  /**
   * Clears the memoization cache
   */
  clearCache(): void {
    this.memoCache.clear();
  }

  /**
   * Gets cached benefits or computes and caches them
   */
  private getCachedBenefits(
    merchantId: string,
    userProgramIds: string[]
  ): PartnerBenefit[] {
    const key: MemoKey = `${merchantId}:${userProgramIds.sort().join(',')}`;
    const now = Date.now();

    const cached = this.memoCache.get(key);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return cached.benefits;
    }

    const benefits = this.graph.getMerchantBenefitsForPrograms(merchantId, userProgramIds).map(
      (h) => h.benefit
    );
    this.memoCache.set(key, { timestamp: now, benefits });
    return benefits;
  }

  registerProgram(program: BenefitProgram): void {
    this.programs.set(program.id, program);

    // Register Program Node
    this.graph.addNode({
      id: program.id,
      name: program.name,
      type: 'PROGRAM',
      metadata: { category: program.category, issuerOrBrand: program.issuerOrBrand },
    });

    // Register partner benefits and edges
    for (const benefit of program.partnerBenefits) {
      // Ensure Merchant Node exists
      if (!this.graph.getNode(benefit.merchantId)) {
        this.graph.addNode({
          id: benefit.merchantId,
          name: benefit.partnerName,
          type: 'MERCHANT',
        });
      }

      // Add edge from Program -> Merchant
      this.graph.addEdge({
        fromNodeId: program.id,
        toNodeId: benefit.merchantId,
        relation: 'BENEFITS_AT',
        benefit,
      });
    }
  }

  getProgram(programId: string): BenefitProgram | undefined {
    return this.programs.get(programId);
  }

  getAllPrograms(): BenefitProgram[] {
    return Array.from(this.programs.values());
  }

  getGraph(): BenefitGraph {
    return this.graph;
  }

  getBenefitsForMerchant(merchantId: string, userProgramIds: string[]): PartnerBenefit[] {
    return this.getCachedBenefits(merchantId, userProgramIds);
  }

  private initializeDefaultCatalog(): void {
    // 1. Accor ALL (Accor Live Limitless)
    this.registerProgram({
      id: 'accor-all',
      name: 'Accor ALL',
      category: 'HOTEL',
      issuerOrBrand: 'Accor',
      tiers: ['Classic', 'Silver', 'Gold', 'Platinum', 'Diamond'],
      partnerBenefits: [
        {
          id: 'accor-dining-10',
          programId: 'accor-all',
          merchantId: 'accor-dining',
          partnerName: 'Accor Restaurants & Bars',
          title: 'Accor ALL 10% Member Dining Discount',
          description:
            '10% instant discount on food and non-alcoholic beverages at participating Accor properties.',
          benefit: {
            type: 'PERCENTAGE_DISCOUNT',
            value: 0.1,
          },
          conditions: [],
          stackableWithVouchers: true,
          stackableWithCards: true,
        },
        {
          id: 'accor-myntra-partner',
          programId: 'accor-all',
          merchantId: 'myntra',
          partnerName: 'Myntra',
          title: 'Accor ALL Member Perk at Myntra',
          description: '10% instant discount up to ₹1,000 on fashion purchases.',
          benefit: {
            type: 'PERCENTAGE_DISCOUNT',
            value: 0.1,
            cap: { amountMinor: 100000n, currency: 'INR' },
          },
          conditions: [{ type: 'MINIMUM_SPEND', value: { amountMinor: 200000n, currency: 'INR' } }],
          stackableWithVouchers: true,
          stackableWithCards: true,
        },
      ],
    });

    // 2. Amazon Prime
    this.registerProgram({
      id: 'amazon-prime',
      name: 'Amazon Prime',
      category: 'SUBSCRIPTION',
      issuerOrBrand: 'Amazon',
      partnerBenefits: [
        {
          id: 'prime-exclusive-deals',
          programId: 'amazon-prime',
          merchantId: 'amazon',
          partnerName: 'Amazon India',
          title: 'Prime Member Exclusive Savings',
          description: 'Prime 5% additional reward savings on select retail orders.',
          benefit: {
            type: 'PERCENTAGE_DISCOUNT',
            value: 0.05,
          },
          conditions: [],
          stackableWithVouchers: true,
          stackableWithCards: true,
        },
      ],
    });

    // 3. Swiggy One
    this.registerProgram({
      id: 'swiggy-one',
      name: 'Swiggy One',
      category: 'SUBSCRIPTION',
      issuerOrBrand: 'Swiggy',
      partnerBenefits: [
        {
          id: 'swiggy-one-delivery',
          programId: 'swiggy-one',
          merchantId: 'swiggy',
          partnerName: 'Swiggy',
          title: 'Swiggy One Free Delivery & Member Discounts',
          description: 'Free delivery and extra 10% discount on food orders over ₹149.',
          benefit: {
            type: 'PERCENTAGE_DISCOUNT',
            value: 0.1,
            cap: { amountMinor: 10000n, currency: 'INR' },
          },
          conditions: [{ type: 'MINIMUM_SPEND', value: { amountMinor: 14900n, currency: 'INR' } }],
          stackableWithVouchers: true,
          stackableWithCards: true,
        },
      ],
    });

    // 4. Marriott Bonvoy
    this.registerProgram({
      id: 'marriott-bonvoy',
      name: 'Marriott Bonvoy',
      category: 'HOTEL',
      issuerOrBrand: 'Marriott',
      partnerBenefits: [
        {
          id: 'marriott-member-rate',
          programId: 'marriott-bonvoy',
          merchantId: 'marriott',
          partnerName: 'Marriott Hotels',
          title: 'Marriott Bonvoy 5% Member Rate',
          description: '5% member discount on direct hotel bookings.',
          benefit: {
            type: 'PERCENTAGE_DISCOUNT',
            value: 0.05,
          },
          conditions: [],
          stackableWithVouchers: true,
          stackableWithCards: true,
        },
      ],
    });

    // 5. Tata Neu (NeuPass)
    this.registerProgram({
      id: 'tata-neu',
      name: 'Tata Neu NeuPass',
      category: 'RETAIL',
      issuerOrBrand: 'Tata Digital',
      partnerBenefits: [
        {
          id: 'tata-croma-neupass',
          programId: 'tata-neu',
          merchantId: 'croma',
          partnerName: 'Croma Electronics',
          title: '5% NeuCoins on Croma',
          description: 'Earn 5% NeuCoins on all electronics purchases.',
          benefit: {
            type: 'POINTS',
            value: 0.05,
          },
          conditions: [],
          stackableWithVouchers: true,
          stackableWithCards: true,
        },
        {
          id: 'tata-1mg-neupass',
          programId: 'tata-neu',
          merchantId: 'tata-1mg',
          partnerName: 'Tata 1mg',
          title: '5% NeuCoins on 1mg Medicines',
          description: 'Earn 5% NeuCoins on medicines and lab tests.',
          benefit: {
            type: 'POINTS',
            value: 0.05,
          },
          conditions: [],
          stackableWithVouchers: true,
          stackableWithCards: true,
        },
      ],
    });
  }
}
