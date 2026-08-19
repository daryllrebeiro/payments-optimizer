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
