import { UserProfile, PaymentMethod, CreditCard } from '@payments-optimizer/domain';
import { StorageRepository } from '@payments-optimizer/storage';
import { deriveKey, encrypt, decrypt } from '@payments-optimizer/security';

// Card Catalog Registry
export class CardCatalog {
  constructor(private cards: CreditCard[] = []) {}

  search(query: string): CreditCard[] {
    const q = query.toLowerCase();
    return this.cards.filter(
      (c) => c.issuer.toLowerCase().includes(q) || c.productName.toLowerCase().includes(q)
    );
  }

  getCardById(id: string): CreditCard | undefined {
    return this.cards.find((c) => c.id === id);
  }
}

// User Profile Coordinator
export class ProfileManager {
  constructor(private repo: StorageRepository<UserProfile>) {}

  async getProfile(): Promise<UserProfile | undefined> {
    return await this.repo.get('current-profile');
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    await this.repo.put({ ...profile, id: 'current-profile' });
  }

  async addPaymentMethod(method: PaymentMethod): Promise<void> {
    const profile = await this.getProfile();
    if (!profile) throw new Error('No profile loaded');
    profile.paymentMethods.push(method);
    await this.saveProfile(profile);
  }

  async updateOptimizationPreferences(
    prefs: UserProfile['optimizationPreferences']
  ): Promise<void> {
    const profile = await this.getProfile();
    if (!profile) throw new Error('No profile loaded');
    profile.optimizationPreferences = prefs;
    await this.saveProfile(profile);
  }
}

// Profile Import & Export with AES-GCM PBKDF2 protection
export class ProfileImportExport {
  static async exportProfile(profile: UserProfile, passphrase?: string): Promise<string> {
    const serialized = JSON.stringify(profile, (_key, value) => {
      if (typeof value === 'bigint') {
        return `${value.toString()}n`;
      }
      return value;
    });

    if (!passphrase) {
      return serialized;
    }

    const salt = 'payments-optimizer-salt';
    const key = await deriveKey(passphrase, salt);
    const encrypted = await encrypt(serialized, key);
    return JSON.stringify(encrypted);
  }

  static async importProfile(exportedData: string, passphrase?: string): Promise<UserProfile> {
    let plaintext = '';

    if (!passphrase) {
      plaintext = exportedData;
    } else {
      const encrypted = JSON.parse(exportedData) as { ciphertext: string; iv: string };
      const salt = 'payments-optimizer-salt';
      const key = await deriveKey(passphrase, salt);
      plaintext = await decrypt(encrypted.ciphertext, encrypted.iv, key);
    }

    return JSON.parse(plaintext, (_key, value) => {
      if (typeof value === 'string' && /^-?\d+n$/.test(value)) {
        return BigInt(value.slice(0, -1));
      }
      return value;
    }) as UserProfile;
  }
}
