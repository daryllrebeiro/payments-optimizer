import { Money, Cart } from '@payments-optimizer/domain';
import { zeroMoney, compareMoney, subtractMoney } from '@payments-optimizer/rules-engine';
import { UserVoucher } from '../domain/types.js';

export interface VoucherApplicationResult {
  voucher: UserVoucher;
  amountBurned: Money;
  remainingCartTotal: Money;
  voucherResidualBalance: Money;
}

export class VoucherInventoryManager {
  constructor(private vouchers: UserVoucher[] = []) {}

  getAllVouchers(): UserVoucher[] {
    return [...this.vouchers];
  }

  getEligibleVouchers(cart: Cart, now = Date.now()): UserVoucher[] {
    return this.vouchers.filter((voucher) => {
      // Merchant match
      if (voucher.merchantId.toLowerCase() !== cart.merchantId.toLowerCase()) {
        return false;
      }

      // Remaining balance check
      if (voucher.remainingValue.amountMinor <= 0n) {
        return false;
      }

      // Expiry check
      const expiryMs = new Date(voucher.expiryDate).getTime();
      if (expiryMs <= now) {
        return false;
      }

      // Minimum spend condition
      if (voucher.minimumSpend && compareMoney(cart.total, voucher.minimumSpend) < 0) {
        return false;
      }

      return true;
    });
  }

  /**
   * Applies a voucher to a cart amount, computing the amount burned and remaining balance.
   */
  applyVoucher(voucher: UserVoucher, currentTotal: Money): VoucherApplicationResult {
    const currency = currentTotal.currency;
    if (voucher.remainingValue.amountMinor <= 0n || currentTotal.amountMinor <= 0n) {
      return {
        voucher,
        amountBurned: zeroMoney(currency),
        remainingCartTotal: currentTotal,
        voucherResidualBalance: voucher.remainingValue,
      };
    }

    // Determine burn amount: min(currentTotal, voucher.remainingValue)
    if (voucher.remainingValue.amountMinor >= currentTotal.amountMinor) {
      const amountBurned = currentTotal;
      const voucherResidualBalance: Money = {
        amountMinor: voucher.remainingValue.amountMinor - currentTotal.amountMinor,
        currency: voucher.remainingValue.currency,
      };
      return {
        voucher,
        amountBurned,
        remainingCartTotal: zeroMoney(currency),
        voucherResidualBalance,
      };
    } else {
      const amountBurned = voucher.remainingValue;
      const remainingCartTotal = subtractMoney(currentTotal, voucher.remainingValue);
      return {
        voucher,
        amountBurned,
        remainingCartTotal,
        voucherResidualBalance: zeroMoney(voucher.remainingValue.currency),
      };
    }
  }

  /**
   * Finds vouchers expiring within a given day threshold.
   */
  getExpiringSoon(
    thresholdDays = 7,
    now = Date.now()
  ): { voucher: UserVoucher; daysLeft: number }[] {
    const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
    const results: { voucher: UserVoucher; daysLeft: number }[] = [];

    for (const voucher of this.vouchers) {
      if (voucher.remainingValue.amountMinor <= 0n) continue;
      const expiryMs = new Date(voucher.expiryDate).getTime();
      const diffMs = expiryMs - now;
      if (diffMs > 0 && diffMs <= thresholdMs) {
        const daysLeft = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
        results.push({ voucher, daysLeft });
      }
    }

    return results.sort((a, b) => a.daysLeft - b.daysLeft);
  }
}
