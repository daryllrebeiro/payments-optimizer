import { describe, it, expect } from 'vitest';
import { CardCatalog, ProfileManager, ProfileImportExport } from './index.js';
import { hdfcMillenniaCard, axisAtlasCard } from '@payments-optimizer/test-fixtures';
import { InMemoryRepository } from '@payments-optimizer/storage';
import { UserProfile } from '@payments-optimizer/domain';

describe('Profile Coordinator and Import/Export', () => {
  describe('CardCatalog', () => {
    it('should search cards and match by query', () => {
      const catalog = new CardCatalog([hdfcMillenniaCard, axisAtlasCard]);
      const results = catalog.search('millennia');
      expect(results.length).toBe(1);
      expect(results[0]?.id).toBe('hdfc-millennia');
    });

    it('should retrieve card by exact id', () => {
      const catalog = new CardCatalog([hdfcMillenniaCard, axisAtlasCard]);
      const card = catalog.getCardById('axis-atlas');
      expect(card?.issuer).toBe('AXIS');
    });
  });

  describe('ProfileManager', () => {
    it('should load, save, and modify profile', async () => {
      const repo = new InMemoryRepository<UserProfile>();
      const manager = new ProfileManager(repo);

      const mockProfile: UserProfile = {
        version: 1,
        currency: 'INR',
        paymentMethods: [],
        rewardPreferences: { defaultValuations: {} },
        optimizationPreferences: {
          immediateSavingsWeight: 1,
          rewardValueWeight: 0,
          milestoneWeight: 0,
          simplicityWeight: 0,
          riskWeight: 0,
        },
      };

      await manager.saveProfile(mockProfile);
      const loaded = await manager.getProfile();
      expect(loaded?.currency).toBe('INR');
      expect(loaded?.paymentMethods.length).toBe(0);

      await manager.addPaymentMethod({ type: 'CREDIT_CARD', card: hdfcMillenniaCard });
      const updated = await manager.getProfile();
      expect(updated?.paymentMethods.length).toBe(1);
      expect(updated?.paymentMethods[0]?.type).toBe('CREDIT_CARD');

      // Test Memberships
      await manager.addMembership({
        id: 'prime-1',
        programId: 'amazon-prime',
        programName: 'Amazon Prime',
        tier: 'Prime',
      });
      const withMem = await manager.getProfile();
      expect(withMem?.memberships?.length).toBe(1);
      expect(withMem?.memberships?.[0]?.programName).toBe('Amazon Prime');

      // Test Vouchers
      const futureExpiry = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      await manager.addVoucher({
        id: 'voucher-myntra-500',
        merchantId: 'myntra',
        title: 'Myntra Gift Voucher ₹500',
        initialValue: { amountMinor: 50000n, currency: 'INR' },
        remainingValue: { amountMinor: 50000n, currency: 'INR' },
        expiryDate: futureExpiry,
        singleUse: false,
      });

      const withVoucher = await manager.getProfile();
      expect(withVoucher?.vouchers?.length).toBe(1);
      expect(withVoucher?.vouchers?.[0]?.title).toBe('Myntra Gift Voucher ₹500');

      const expiring = await manager.getExpiringVouchers(7);
      expect(expiring.length).toBe(1);
      expect(expiring[0]?.id).toBe('voucher-myntra-500');

      await manager.removeMembership('amazon-prime');
      const afterRemoveMem = await manager.getProfile();
      expect(afterRemoveMem?.memberships?.length).toBe(0);
    });
  });

  describe('ProfileImportExport', () => {
    const mockProfile: UserProfile = {
      version: 1,
      currency: 'INR',
      paymentMethods: [
        {
          type: 'WALLET',
          wallet: {
            name: 'Amazon Pay',
            balance: { amountMinor: 50000n, currency: 'INR' },
          },
        },
      ],
      rewardPreferences: { defaultValuations: {} },
      optimizationPreferences: {
        immediateSavingsWeight: 1,
        rewardValueWeight: 0,
        milestoneWeight: 0,
        simplicityWeight: 0,
        riskWeight: 0,
      },
    };

    it('should export and import plaintext profile with BigInt revival', async () => {
      const exported = await ProfileImportExport.exportProfile(mockProfile);
      expect(exported).toContain('50000n');

      const imported = await ProfileImportExport.importProfile(exported);
      expect(imported.currency).toBe('INR');
      const method = imported.paymentMethods[0];
      expect(method?.type).toBe('WALLET');
      if (method && method.type === 'WALLET') {
        const balance = method.wallet.balance;
        expect(balance?.amountMinor).toBe(50000n);
        expect(typeof balance?.amountMinor).toBe('bigint');
      }
    });

    it('should encrypt and decrypt profile during import/export', async () => {
      const passphrase = 'password123';
      const exported = await ProfileImportExport.exportProfile(mockProfile, passphrase);
      expect(exported).not.toContain('50000n');
      expect(exported).toContain('ciphertext');

      const imported = await ProfileImportExport.importProfile(exported, passphrase);
      expect(imported.currency).toBe('INR');
      const method = imported.paymentMethods[0];
      expect(method?.type).toBe('WALLET');
      if (method && method.type === 'WALLET') {
        const balance = method.wallet.balance;
        expect(balance?.amountMinor).toBe(50000n);
      }
    });
  });
});
