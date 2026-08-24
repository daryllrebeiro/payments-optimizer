import { Cart, UserProfile } from '@payments-optimizer/domain';
import { PublicBenefitCatalog } from '../catalog/public-catalog.js';
import { VoucherInventoryManager } from '../inventory/voucher-manager.js';
import { ProactiveAlert } from '../domain/types.js';

export class ProactiveAlertsEngine {
  constructor(private catalog: PublicBenefitCatalog = new PublicBenefitCatalog()) {}

  generateAlerts(
    merchantId: string,
    profile: UserProfile,
    cart?: Cart,
    now = Date.now()
  ): ProactiveAlert[] {
    const alerts: ProactiveAlert[] = [];
    const userPrograms = profile.memberships?.map((m) => m.programId) || [];

    // 1. Partner perk alert
    const partnerBenefits = this.catalog.getBenefitsForMerchant(merchantId, userPrograms);
    for (const perk of partnerBenefits) {
      alerts.push({
        id: `alert-partner-${perk.id}`,
        type: 'PARTNER_BENEFIT',
        title: `You have an active partner perk at ${perk.partnerName}`,
        message: `${perk.title}: ${perk.description || 'Exclusive member savings apply.'}`,
        urgency: 'HIGH',
        recommendedAction: `Apply ${perk.partnerName} partner perk at checkout.`,
      });
    }

    // 2. Expiring voucher alerts
    const voucherManager = new VoucherInventoryManager(profile.vouchers || []);
    const expiring = voucherManager.getExpiringSoon(7, now);
    for (const item of expiring) {
      if (item.voucher.merchantId.toLowerCase() === merchantId.toLowerCase()) {
        const daysText = item.daysLeft === 1 ? 'tomorrow' : `in ${item.daysLeft} days`;
        alerts.push({
          id: `alert-expiring-${item.voucher.id}`,
          type: 'EXPIRING_VOUCHER',
          title: `Your ${item.voucher.title} expires ${daysText}`,
          message: `You have ${item.voucher.remainingValue.amountMinor / 100n} ${item.voucher.remainingValue.currency} remaining on this voucher. Use it before it expires!`,
          urgency: item.daysLeft <= 3 ? 'HIGH' : 'MEDIUM',
          recommendedAction: `Burn this voucher on today's purchase to avoid loss.`,
        });
      }
    }

    // 3. Anti-cannibalization alert (e.g. if voucher has >30 days left and a 20% promo is active)
    if (cart && partnerBenefits.length > 0 && (profile.vouchers || []).length > 0) {
      const longVouchers = (profile.vouchers || []).filter((v) => {
        if (v.merchantId.toLowerCase() !== merchantId.toLowerCase()) return false;
        const days = (new Date(v.expiryDate).getTime() - now) / (24 * 60 * 60 * 1000);
        return days > 30 && v.remainingValue.amountMinor > 0n;
      });

      if (longVouchers.length > 0) {
        alerts.push({
          id: `alert-anticannibalization-${merchantId}`,
          type: 'ANTI_CANNIBALIZATION_WARNING',
          title: `Smart Voucher Strategy`,
          message: `Your voucher has over 30 days of validity. Using the active partner discount first lets you save your voucher for a future non-discounted order.`,
          urgency: 'LOW',
          recommendedAction: `Consider keeping your voucher for an upcoming order.`,
        });
      }
    }

    return alerts;
  }
}
