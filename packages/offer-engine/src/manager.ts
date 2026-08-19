import { DatasetBundleSchema } from './schemas.js';
import type { DatasetBundle } from './schemas.js';
import type { Offer, Coupon, CreditCard } from '@payments-optimizer/domain';

export class PublicDataManager {
  private activeBundle: DatasetBundle | null = null;

  /**
   * Load and validate a raw public data bundle.
   * This is atomic: if validation fails, the active bundle is not modified.
   * Throws a ZodError if validation fails.
   */
  loadBundle(rawBundle: unknown): void {
    const validated = DatasetBundleSchema.parse(rawBundle);
    this.activeBundle = validated;
  }

  /**
   * Check if a bundle is currently loaded.
   */
  isLoaded(): boolean {
    return this.activeBundle !== null;
  }

  /**
   * Get version metadata of the active data bundle.
   */
  getVersionInfo(): { schemaVersion: number; dataVersion: string; createdAt: string } | null {
    if (!this.activeBundle) return null;
    return {
      schemaVersion: this.activeBundle.schemaVersion,
      dataVersion: this.activeBundle.dataVersion,
      createdAt: this.activeBundle.createdAt,
    };
  }

  /**
   * Query active, non-expired offers for a specific merchant.
   * Offers are filtered by date range: validFrom <= now <= validUntil.
   */
  getOffersForMerchant(merchantId: string, referenceTime: string = new Date().toISOString()): Offer[] {
    if (!this.activeBundle) return [];
    
    return (this.activeBundle.offers as unknown as Offer[]).filter((offer) => {
      if (offer.merchantId !== merchantId) return false;
      
      // Active date check
      const validFromMs = Date.parse(offer.validFrom);
      const validUntilMs = Date.parse(offer.validUntil);
      const refMs = Date.parse(referenceTime);

      if (isNaN(validFromMs) || isNaN(validUntilMs) || isNaN(refMs)) {
        return false; // Safely exclude if date parsing fails
      }

      return refMs >= validFromMs && refMs <= validUntilMs;
    });
  }

  /**
   * Query active coupons for a merchant.
   * Filters out expired coupons (if validUntil is specified).
   */
  getCouponsForMerchant(merchantId: string, referenceTime: string = new Date().toISOString()): Coupon[] {
    if (!this.activeBundle) return [];

    return (this.activeBundle.coupons as unknown as Coupon[]).filter((coupon) => {
      if (coupon.merchantId !== merchantId) return false;
      if (!coupon.validUntil) return true; // no expiry restriction

      const validUntilMs = Date.parse(coupon.validUntil);
      const refMs = Date.parse(referenceTime);

      if (isNaN(validUntilMs) || isNaN(refMs)) {
        return false;
      }

      return refMs <= validUntilMs;
    });
  }

  /**
   * Get all validated credit card templates available in the catalog.
   */
  getCardCatalog(): CreditCard[] {
    if (!this.activeBundle) return [];
    return this.activeBundle.cards as unknown as CreditCard[];
  }

  /**
   * Find a specific card template by its ID.
   */
  getCardTemplate(cardId: string): CreditCard | undefined {
    if (!this.activeBundle) return undefined;
    return (this.activeBundle.cards as unknown as CreditCard[]).find((c) => c.id === cardId);
  }
}
