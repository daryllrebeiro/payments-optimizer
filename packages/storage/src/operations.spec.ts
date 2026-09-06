/**
 * Integration tests for concrete operations (Epic 1.2)
 * Tests BurnVoucherOperation, SaveSavingsOperation, UpdateProfileOperation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BurnVoucherOperation,
  SaveSavingsOperation,
  UpdateProfileOperation,
  type VoucherEntity,
  type SavingsEntity,
  type UserProfileEntity,
} from './operations.js';
import { InMemoryRepository } from './index.js';
import { TransactionCoordinator } from './transaction-coordinator.js';

describe('BurnVoucherOperation', () => {
  let voucherRepo: InMemoryRepository<VoucherEntity>;
  let testVoucher: VoucherEntity;

  beforeEach(() => {
    voucherRepo = new InMemoryRepository<VoucherEntity>();
    testVoucher = {
      id: 'voucher-1',
      merchantId: 'amazon',
      title: 'Amazon Gift Card ₹1000',
      code: 'AMZN1000',
      initialValue: { amountMinor: '100000', currency: 'INR' },
      remainingValue: { amountMinor: '100000', currency: 'INR' },
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      singleUse: false,
    };
  });

  it('should burn voucher successfully', async () => {
    await voucherRepo.put(testVoucher);

    const operation = new BurnVoucherOperation(
      voucherRepo,
      'voucher-1',
      { amountMinor: 50000n, currency: 'INR' }
    );

    const result = await operation.execute();

    expect(result.success).toBe(true);
    expect(result.rollbackData).toBeDefined();

    // Verify voucher balance updated
    const updatedVoucher = await voucherRepo.get('voucher-1');
    expect(updatedVoucher?.remainingValue.amountMinor).toBe('50000');
  });

  it('should fail if voucher not found', async () => {
    const operation = new BurnVoucherOperation(
      voucherRepo,
      'non-existent',
      { amountMinor: 50000n, currency: 'INR' }
    );

    const result = await operation.execute();

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('not found');
  });

  it('should fail if insufficient balance', async () => {
    await voucherRepo.put(testVoucher);

    const operation = new BurnVoucherOperation(
      voucherRepo,
      'voucher-1',
      { amountMinor: 150000n, currency: 'INR' } // More than available
    );

    const result = await operation.execute();

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('Insufficient');
  });

  it('should rollback voucher burn successfully', async () => {
    await voucherRepo.put(testVoucher);

    const operation = new BurnVoucherOperation(
      voucherRepo,
      'voucher-1',
      { amountMinor: 50000n, currency: 'INR' }
    );

    const result = await operation.execute();
    expect(result.success).toBe(true);

    // Verify balance was reduced
    let voucher = await voucherRepo.get('voucher-1');
    expect(voucher?.remainingValue.amountMinor).toBe('50000');

    // Rollback
    await operation.rollback(result);

    // Verify balance restored
    voucher = await voucherRepo.get('voucher-1');
    expect(voucher?.remainingValue.amountMinor).toBe('100000');
  });

  it('should handle multiple sequential burns', async () => {
    await voucherRepo.put(testVoucher);

    // First burn: 30000
    const op1 = new BurnVoucherOperation(
      voucherRepo,
      'voucher-1',
      { amountMinor: 30000n, currency: 'INR' }
    );
    const result1 = await op1.execute();
    expect(result1.success).toBe(true);

    let voucher = await voucherRepo.get('voucher-1');
    expect(voucher?.remainingValue.amountMinor).toBe('70000');

    // Second burn: 20000
    const op2 = new BurnVoucherOperation(
      voucherRepo,
      'voucher-1',
      { amountMinor: 20000n, currency: 'INR' }
    );
    const result2 = await op2.execute();
    expect(result2.success).toBe(true);

    voucher = await voucherRepo.get('voucher-1');
    expect(voucher?.remainingValue.amountMinor).toBe('50000');
  });
});

describe('SaveSavingsOperation', () => {
  let savingsRepo: InMemoryRepository<SavingsEntity>;
  let testSavings: SavingsEntity;

  beforeEach(() => {
    savingsRepo = new InMemoryRepository<SavingsEntity>();
    testSavings = {
      id: 'savings-1',
      timestamp: Date.now(),
      merchantId: 'amazon',
      cartTotal: { amountMinor: '100000', currency: 'INR' },
      selectedStrategy: {
        id: 'strategy-1',
        immediateDiscount: { amountMinor: '10000', currency: 'INR' },
        rewardValue: { amountMinor: '5000', currency: 'INR' },
        totalBenefit: { amountMinor: '15000', currency: 'INR' },
        confidence: 0.95,
      },
      originalTotal: { amountMinor: '100000', currency: 'INR' },
      savings: { amountMinor: '15000', currency: 'INR' },
      benefitsApplied: [
        {
          benefitId: 'benefit-1',
          benefitType: 'VOUCHER_REDEMPTION',
          benefitSourceId: 'voucher-1',
          benefitSourceName: 'Amazon Gift Card',
          amountApplied: { amountMinor: '10000', currency: 'INR' },
        },
      ],
      vouchersBurned: ['voucher-1'],
    };
  });

  it('should save savings entry successfully', async () => {
    const operation = new SaveSavingsOperation(savingsRepo, testSavings);

    const result = await operation.execute();

    expect(result.success).toBe(true);
    expect(result.data).toBe('savings-1');

    // Verify entry was saved
    const saved = await savingsRepo.get('savings-1');
    expect(saved).toBeDefined();
    expect(saved?.merchantId).toBe('amazon');
  });

  it('should rollback savings entry successfully', async () => {
    const operation = new SaveSavingsOperation(savingsRepo, testSavings);

    const result = await operation.execute();
    expect(result.success).toBe(true);

    // Verify entry exists
    let saved = await savingsRepo.get('savings-1');
    expect(saved).toBeDefined();

    // Rollback
    await operation.rollback(result);

    // Verify entry deleted
    saved = await savingsRepo.get('savings-1');
    expect(saved).toBeUndefined();
  });
});

describe('UpdateProfileOperation', () => {
  let profileRepo: InMemoryRepository<UserProfileEntity>;
  let testProfile: UserProfileEntity;

  beforeEach(() => {
    profileRepo = new InMemoryRepository<UserProfileEntity>();
    testProfile = {
      id: 'profile-1',
      version: 1,
      currency: 'INR',
      lastOptimizationTimestamp: Date.now() - 10000,
      totalSavings: { amountMinor: '50000', currency: 'INR' },
    };
  });

  it('should update profile successfully', async () => {
    await profileRepo.put(testProfile);

    const newTimestamp = Date.now();
    const operation = new UpdateProfileOperation(profileRepo, 'profile-1', {
      lastOptimizationTimestamp: newTimestamp,
      totalSavings: { amountMinor: '65000', currency: 'INR' },
    });

    const result = await operation.execute();

    expect(result.success).toBe(true);

    // Verify updates applied
    const updated = await profileRepo.get('profile-1');
    expect(updated?.lastOptimizationTimestamp).toBe(newTimestamp);
    expect(updated?.totalSavings?.amountMinor).toBe('65000');
  });

  it('should fail if profile not found', async () => {
    const operation = new UpdateProfileOperation(profileRepo, 'non-existent', {
      lastOptimizationTimestamp: Date.now(),
    });

    const result = await operation.execute();

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('not found');
  });

  it('should rollback profile update successfully', async () => {
    await profileRepo.put(testProfile);

    const originalTimestamp = testProfile.lastOptimizationTimestamp!;
    const newTimestamp = Date.now();

    const operation = new UpdateProfileOperation(profileRepo, 'profile-1', {
      lastOptimizationTimestamp: newTimestamp,
      totalSavings: { amountMinor: '65000', currency: 'INR' },
    });

    const result = await operation.execute();
    expect(result.success).toBe(true);

    // Verify updates applied
    let profile = await profileRepo.get('profile-1');
    expect(profile?.lastOptimizationTimestamp).toBe(newTimestamp);

    // Rollback
    await operation.rollback(result);

    // Verify original state restored
    profile = await profileRepo.get('profile-1');
    expect(profile?.lastOptimizationTimestamp).toBe(originalTimestamp);
    expect(profile?.totalSavings?.amountMinor).toBe('50000');
  });
});

describe('TransactionCoordinator with real operations', () => {
  let coordinator: TransactionCoordinator;
  let voucherRepo: InMemoryRepository<VoucherEntity>;
  let savingsRepo: InMemoryRepository<SavingsEntity>;
  let profileRepo: InMemoryRepository<UserProfileEntity>;

  beforeEach(() => {
    coordinator = new TransactionCoordinator();
    voucherRepo = new InMemoryRepository<VoucherEntity>();
    savingsRepo = new InMemoryRepository<SavingsEntity>();
    profileRepo = new InMemoryRepository<UserProfileEntity>();
  });

  it('should atomically burn voucher + save savings + update profile', async () => {
    // Setup initial state
    const voucher: VoucherEntity = {
      id: 'voucher-1',
      merchantId: 'amazon',
      title: 'Amazon ₹500',
      code: 'AMZN500',
      initialValue: { amountMinor: '50000', currency: 'INR' },
      remainingValue: { amountMinor: '50000', currency: 'INR' },
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      singleUse: false,
    };

    const profile: UserProfileEntity = {
      id: 'profile-1',
      version: 1,
      currency: 'INR',
      totalSavings: { amountMinor: '0', currency: 'INR' },
    };

    await voucherRepo.put(voucher);
    await profileRepo.put(profile);

    const savings: SavingsEntity = {
      id: 'savings-1',
      timestamp: Date.now(),
      merchantId: 'amazon',
      cartTotal: { amountMinor: '100000', currency: 'INR' },
      selectedStrategy: {
        id: 'strategy-1',
        immediateDiscount: { amountMinor: '50000', currency: 'INR' },
        rewardValue: { amountMinor: '0', currency: 'INR' },
        totalBenefit: { amountMinor: '50000', currency: 'INR' },
        confidence: 1.0,
      },
      originalTotal: { amountMinor: '100000', currency: 'INR' },
      savings: { amountMinor: '50000', currency: 'INR' },
      benefitsApplied: [],
      vouchersBurned: ['voucher-1'],
    };

    // Execute atomic transaction
    const operations = [
      new BurnVoucherOperation(voucherRepo, 'voucher-1', { amountMinor: 50000n, currency: 'INR' }),
      new SaveSavingsOperation(savingsRepo, savings),
      new UpdateProfileOperation(profileRepo, 'profile-1', {
        lastOptimizationTimestamp: Date.now(),
        totalSavings: { amountMinor: '50000', currency: 'INR' },
      }),
    ];

    const result = await coordinator.executeAtomically(operations);

    expect(result.success).toBe(true);

    // Verify all operations succeeded
    const updatedVoucher = await voucherRepo.get('voucher-1');
    expect(updatedVoucher?.remainingValue.amountMinor).toBe('0');

    const savedEntry = await savingsRepo.get('savings-1');
    expect(savedEntry).toBeDefined();

    const updatedProfile = await profileRepo.get('profile-1');
    expect(updatedProfile?.totalSavings?.amountMinor).toBe('50000');
  });

  it('should rollback voucher burn when savings write fails', async () => {
    // Setup initial state
    const voucher: VoucherEntity = {
      id: 'voucher-1',
      merchantId: 'amazon',
      title: 'Amazon ₹500',
      code: 'AMZN500',
      initialValue: { amountMinor: '50000', currency: 'INR' },
      remainingValue: { amountMinor: '50000', currency: 'INR' },
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      singleUse: false,
    };

    await voucherRepo.put(voucher);

    // Create a failing savings operation
    const failingSavingsOp: SaveSavingsOperation = new SaveSavingsOperation(
      savingsRepo,
      {} as SavingsEntity // Invalid entry will cause failure
    );
    // Override execute to force failure
    failingSavingsOp.execute = async () => ({
      success: false,
      error: new Error('Simulated savings write failure'),
    });

    const operations = [
      new BurnVoucherOperation(voucherRepo, 'voucher-1', { amountMinor: 50000n, currency: 'INR' }),
      failingSavingsOp,
    ];

    const result = await coordinator.executeAtomically(operations);

    expect(result.success).toBe(false);
    expect(result.error?.failedOperation).toBe(failingSavingsOp.id);

    // Verify voucher burn was rolled back
    const voucherAfterRollback = await voucherRepo.get('voucher-1');
    expect(voucherAfterRollback?.remainingValue.amountMinor).toBe('50000'); // Unchanged

    // Verify savings entry was not created
    const savingsEntries = await savingsRepo.list();
    expect(savingsEntries.length).toBe(0);
  });

  it('should rollback voucher burn and savings write when profile update fails', async () => {
    // Setup initial state
    const voucher: VoucherEntity = {
      id: 'voucher-1',
      merchantId: 'amazon',
      title: 'Amazon ₹500',
      code: 'AMZN500',
      initialValue: { amountMinor: '50000', currency: 'INR' },
      remainingValue: { amountMinor: '50000', currency: 'INR' },
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      singleUse: false,
    };

    await voucherRepo.put(voucher);

    const savings: SavingsEntity = {
      id: 'savings-1',
      timestamp: Date.now(),
      merchantId: 'amazon',
      cartTotal: { amountMinor: '100000', currency: 'INR' },
      selectedStrategy: {
        id: 'strategy-1',
        immediateDiscount: { amountMinor: '50000', currency: 'INR' },
        rewardValue: { amountMinor: '0', currency: 'INR' },
        totalBenefit: { amountMinor: '50000', currency: 'INR' },
        confidence: 1.0,
      },
      originalTotal: { amountMinor: '100000', currency: 'INR' },
      savings: { amountMinor: '50000', currency: 'INR' },
      benefitsApplied: [],
    };

    // Profile update will fail (profile doesn't exist)
    const operations = [
      new BurnVoucherOperation(voucherRepo, 'voucher-1', { amountMinor: 50000n, currency: 'INR' }),
      new SaveSavingsOperation(savingsRepo, savings),
      new UpdateProfileOperation(profileRepo, 'non-existent-profile', {
        lastOptimizationTimestamp: Date.now(),
      }),
    ];

    const result = await coordinator.executeAtomically(operations);

    expect(result.success).toBe(false);

    // Verify both voucher burn and savings write were rolled back
    const voucherAfterRollback = await voucherRepo.get('voucher-1');
    expect(voucherAfterRollback?.remainingValue.amountMinor).toBe('50000'); // Unchanged

    const savingsAfterRollback = await savingsRepo.get('savings-1');
    expect(savingsAfterRollback).toBeUndefined(); // Deleted
  });
});
