/**
 * Concrete Operations for Transaction Coordinator
 * Epic 1.2: BurnVoucherOperation, SaveSavingsOperation, UpdateProfileOperation
 */

import type { Operation, OperationResult } from './transaction-coordinator.js';
import type { StorageRepository } from './index.js';

/**
 * Voucher entity as stored in the repository
 */
export interface VoucherEntity {
  id: string;
  merchantId: string;
  title: string;
  code?: string;
  initialValue: { amountMinor: string; currency: string };
  remainingValue: { amountMinor: string; currency: string };
  expiryDate: string;
  singleUse: boolean;
  minimumSpend?: { amountMinor: string; currency: string };
}

/**
 * Voucher data (without id, which is handled by repository)
 */
export interface VoucherData {
  merchantId: string;
  title: string;
  code?: string;
  initialValue: { amountMinor: string; currency: string };
  remainingValue: { amountMinor: string; currency: string };
  expiryDate: string;
  singleUse: boolean;
  minimumSpend?: { amountMinor: string; currency: string };
}

/**
 * Savings entry entity
 */
export interface SavingsEntity {
  id: string;
  timestamp: number;
  merchantId: string;
  cartTotal: { amountMinor: string; currency: string };
  selectedStrategy: {
    id: string;
    immediateDiscount: { amountMinor: string; currency: string };
    rewardValue: { amountMinor: string; currency: string };
    totalBenefit: { amountMinor: string; currency: string };
    confidence: number;
  };
  originalTotal: { amountMinor: string; currency: string };
  savings: { amountMinor: string; currency: string };
  benefitsApplied: Array<{
    benefitId: string;
    benefitType: string;
    benefitSourceId: string;
    benefitSourceName: string;
    amountApplied: { amountMinor: string; currency: string };
  }>;
  vouchersBurned?: string[]; // IDs of vouchers used
}

/**
 * User profile entity
 */
export interface UserProfileEntity {
  id: string;
  version: number;
  currency: string;
  lastOptimizationTimestamp?: number;
  totalSavings?: { amountMinor: string; currency: string };
  // ... other profile fields
}

/**
 * Rollback data for voucher burn
 */
interface VoucherBurnRollbackData {
  voucherId: string;
  previousRemainingValue: { amountMinor: string; currency: string };
  amountBurned: { amountMinor: string; currency: string };
}

/**
 * Operation to burn (reduce balance of) a voucher
 */
export class BurnVoucherOperation implements Operation<VoucherBurnRollbackData> {
  readonly id: string;
  readonly description: string;

  constructor(
    private voucherRepository: StorageRepository<VoucherEntity>,
    private voucherId: string,
    private amountToBurn: { amountMinor: bigint; currency: string }
  ) {
    this.id = `burn-voucher-${voucherId}`;
    this.description = `Burn ${amountToBurn.amountMinor} from voucher ${voucherId}`;
  }

  async execute(): Promise<OperationResult<VoucherBurnRollbackData>> {
    try {
      // Get current voucher state
      const voucherData = await this.voucherRepository.get(this.voucherId);

      if (!voucherData) {
        return {
          success: false,
          error: new Error(`Voucher ${this.voucherId} not found`),
        };
      }

      const currentBalance = BigInt(voucherData.remainingValue.amountMinor);
      const burnAmount = this.amountToBurn.amountMinor;

      if (burnAmount > currentBalance) {
        return {
          success: false,
          error: new Error(`Insufficient voucher balance: ${currentBalance} < ${burnAmount}`),
        };
      }

      // Calculate new balance
      const newBalance = currentBalance - burnAmount;

      // Store rollback data BEFORE making changes
      const rollbackData: VoucherBurnRollbackData = {
        voucherId: this.voucherId,
        previousRemainingValue: { ...voucherData.remainingValue },
        amountBurned: {
          amountMinor: burnAmount.toString(),
          currency: this.amountToBurn.currency,
        },
      };

      // Update voucher with new balance (id must be included for put)
      const updatedVoucher: VoucherEntity = {
        ...voucherData,
        id: this.voucherId, // Repository requires id for put
        remainingValue: {
          amountMinor: newBalance.toString(),
          currency: voucherData.remainingValue.currency,
        },
      };

      await this.voucherRepository.put(updatedVoucher);

      return {
        success: true,
        data: rollbackData,
        rollbackData,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async rollback(executeResult: OperationResult<VoucherBurnRollbackData>): Promise<void> {
    if (!executeResult.rollbackData) {
      throw new Error('Cannot rollback: no rollback data available');
    }

    const rollbackData = executeResult.rollbackData as VoucherBurnRollbackData;

    // Restore previous voucher balance
    const voucherData = await this.voucherRepository.get(rollbackData.voucherId);

    if (!voucherData) {
      throw new Error(`Cannot rollback: voucher ${rollbackData.voucherId} not found`);
    }

    const restoredVoucher: VoucherEntity = {
      ...voucherData,
      id: rollbackData.voucherId, // Repository requires id for put
      remainingValue: rollbackData.previousRemainingValue,
    };

    await this.voucherRepository.put(restoredVoucher);
  }
}

/**
 * Operation to save a savings entry to history
 */
export class SaveSavingsOperation implements Operation<string> {
  readonly id: string;
  readonly description: string;

  constructor(
    private savingsRepository: StorageRepository<SavingsEntity>,
    private savingsEntry: SavingsEntity
  ) {
    this.id = `save-savings-${savingsEntry.id}`;
    this.description = `Save savings entry ${savingsEntry.id} for merchant ${savingsEntry.merchantId}`;
  }

  async execute(): Promise<OperationResult<string>> {
    try {
      // Ensure ID is present
      const entryWithId = { ...this.savingsEntry, id: this.savingsEntry.id };
      await this.savingsRepository.put(entryWithId);

      return {
        success: true,
        data: this.savingsEntry.id,
        rollbackData: this.savingsEntry.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async rollback(executeResult: OperationResult<string>): Promise<void> {
    if (!executeResult.rollbackData) {
      throw new Error('Cannot rollback: no rollback data available');
    }

    const savingsId = executeResult.rollbackData as string;

    // Delete the savings entry
    await this.savingsRepository.delete(savingsId);
  }
}

/**
 * Rollback data for profile update
 */
interface ProfileUpdateRollbackData {
  profileId: string;
  previousState: UserProfileEntity;
}

/**
 * Operation to update user profile with optimization metadata
 */
export class UpdateProfileOperation implements Operation<ProfileUpdateRollbackData> {
  readonly id: string;
  readonly description: string;

  constructor(
    private profileRepository: StorageRepository<UserProfileEntity>,
    private profileId: string,
    private updates: Partial<UserProfileEntity>
  ) {
    this.id = `update-profile-${profileId}`;
    this.description = `Update profile ${profileId} with optimization metadata`;
  }

  async execute(): Promise<OperationResult<ProfileUpdateRollbackData>> {
    try {
      // Get current profile state
      const currentProfileData = await this.profileRepository.get(this.profileId);

      if (!currentProfileData) {
        return {
          success: false,
          error: new Error(`Profile ${this.profileId} not found`),
        };
      }

      // Store rollback data BEFORE making changes
      const rollbackData: ProfileUpdateRollbackData = {
        profileId: this.profileId,
        previousState: { ...currentProfileData, id: this.profileId },
      };

      // Apply updates (id must be included for put)
      const updatedProfile: UserProfileEntity = {
        ...currentProfileData,
        ...this.updates,
        id: this.profileId, // Repository requires id for put
      };

      await this.profileRepository.put(updatedProfile);

      return {
        success: true,
        data: rollbackData,
        rollbackData,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async rollback(executeResult: OperationResult<ProfileUpdateRollbackData>): Promise<void> {
    if (!executeResult.rollbackData) {
      throw new Error('Cannot rollback: no rollback data available');
    }

    const rollbackData = executeResult.rollbackData as ProfileUpdateRollbackData;

    // Restore previous profile state
    const restoredProfile = { ...rollbackData.previousState, id: rollbackData.profileId };
    await this.profileRepository.put(restoredProfile);
  }
}
