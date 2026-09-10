/**
 * Loyalty Program Balance Repository
 * Feature 2: Local-first manual-entry loyalty program balance tracker
 */

import { IndexedDbRepository } from './base-repository.js';
import type { LoyaltyProgramBalance, LoyaltyProgramType } from '@payments-optimizer/domain';

const DB_NAME = 'payments-optimizer-loyalty';
const STORE_NAME = 'loyaltyBalances';
const DB_VERSION = 1;

/**
 * Stored format matches the domain type exactly but with string for bigint
 * and explicit undefined for optional properties (exactOptionalPropertyTypes compatible)
 */
export interface LoyaltyProgramBalanceStored {
  id: string;
  programName: string;
  programType: LoyaltyProgramType;
  balance: number;
  userEstimatedValuePerUnitMinor: string | undefined;
  lastUpdatedTimestamp: number;
  expiryDate: number | undefined;
  expiryPolicyNote: string | undefined;
}

export class LoyaltyRepository {
  private repo: IndexedDbRepository<LoyaltyProgramBalanceStored>;

  constructor() {
    this.repo = new IndexedDbRepository(DB_NAME, STORE_NAME, DB_VERSION, (db, oldVersion, newVersion) => {
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('by_expiry', 'expiryDate', { unique: false });
          store.createIndex('by_programName', 'programName', { unique: false });
        }
      }
    });
  }

  /**
   * Convert domain type to stored type
   */
  private toStored(balance: LoyaltyProgramBalance): LoyaltyProgramBalanceStored {
    return {
      id: balance.id,
      programName: balance.programName,
      programType: balance.programType,
      balance: balance.balance,
      userEstimatedValuePerUnitMinor: balance.userEstimatedValuePerUnitMinor?.toString(),
      lastUpdatedTimestamp: balance.lastUpdatedTimestamp,
      expiryDate: balance.expiryDate,
      expiryPolicyNote: balance.expiryPolicyNote,
    };
  }

  /**
   * Convert stored type to domain type
   */
  private toDomain(stored: LoyaltyProgramBalanceStored): LoyaltyProgramBalance {
    const domain: LoyaltyProgramBalance = {
      id: stored.id,
      programName: stored.programName,
      programType: stored.programType,
      balance: stored.balance,
      lastUpdatedTimestamp: stored.lastUpdatedTimestamp,
    };
    if (stored.userEstimatedValuePerUnitMinor !== undefined) {
      domain.userEstimatedValuePerUnitMinor = BigInt(stored.userEstimatedValuePerUnitMinor);
    }
    if (stored.expiryDate !== undefined) {
      domain.expiryDate = stored.expiryDate;
    }
    if (stored.expiryPolicyNote !== undefined) {
      domain.expiryPolicyNote = stored.expiryPolicyNote;
    }
    return domain;
  }

  /**
   * Add a new loyalty program balance
   */
  async add(balance: LoyaltyProgramBalance): Promise<void> {
    await this.repo.put(this.toStored(balance));
  }

  /**
   * Update an existing loyalty program balance
   */
  async update(balance: LoyaltyProgramBalance): Promise<void> {
    await this.repo.put(this.toStored(balance));
  }

  /**
   * Delete a loyalty program balance
   */
  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  /**
   * Get a single balance by ID
   */
  async get(id: string): Promise<LoyaltyProgramBalance | undefined> {
    const stored = await this.repo.get(id);
    return stored ? this.toDomain(stored) : undefined;
  }

  /**
   * Get all loyalty program balances
   */
  async getAll(): Promise<LoyaltyProgramBalance[]> {
    const stored = await this.repo.list();
    return stored.map((s) => this.toDomain(s));
  }

  /**
   * Get balances expiring before a given timestamp
   */
  async getExpiringBefore(timestamp: number): Promise<LoyaltyProgramBalance[]> {
    const all = await this.getAll();
    return all.filter((b) => b.expiryDate !== undefined && b.expiryDate <= timestamp);
  }

  /**
   * Get balances that are expiring soon (within days)
   */
  async getExpiringWithin(days: number): Promise<LoyaltyProgramBalance[]> {
    const now = Date.now();
    const threshold = now + days * 24 * 60 * 60 * 1000;
    const all = await this.getAll();
    return all.filter(
      (b) => b.expiryDate !== undefined && b.expiryDate > now && b.expiryDate <= threshold
    );
  }
}

/**
 * Singleton instance
 */
let loyaltyRepositoryInstance: LoyaltyRepository | null = null;

export function getLoyaltyRepository(): LoyaltyRepository {
  if (!loyaltyRepositoryInstance) {
    loyaltyRepositoryInstance = new LoyaltyRepository();
  }
  return loyaltyRepositoryInstance;
}